/**
 * GPT-driven Signal Intent Classifier
 *
 * Replaces regex-based token extraction with semantic analysis.
 * Uses OpenAI-compatible API (yunwu.ai proxy) to classify tweets
 * into S0-S4 intent levels with position claims and token extraction.
 */

import type { SocialSignal } from "../social-types";
import type { ClassifiedSignal, IntentLevel } from "../kol-report-types";
import { getLLMClient, getLLMModel } from "../llm-client";

// ---- System prompt ----

const SYSTEM_PROMPT = `You are a crypto signal analyst. Analyze a batch of tweets from a KOL (Key Opinion Leader) and classify each tweet's trading intent.

## Intent Levels (S0-S4)

- **S0 (Noise)**: Retweets without comment, casual chat, advertisements, memes, greetings, engagement farming ("GM", "LFG")
- **S1 (Mention)**: Merely mentions a token name or project without any opinion
- **S2 (Opinion)**: Expresses a view (bullish/bearish) but no action claim ("this looks interesting", "great chart")
- **S3 (Claimed Buy)**: Claims to have bought, is buying, or will buy ("picked up a small bag", "added to my position", "ape in", "bought", "loading")
- **S4 (Claimed Exit)**: Claims to have sold, taking profit, or exiting ("sold", "took profit", "trimmed", "exited", "tp'd")

## Critical Rules

1. **Negation detection**: "I didn't buy", "not buying", "supporting ≠ buying", "supporting doesn't mean buying" → positionClaim = "denied", NOT "claimed_buy"
2. **Analogy exclusion**: "Is this the next $KEKIUS?" → KEKIUS is NOT a signal, it's a comparison reference. Only extract the actual target token.
3. **Noise symbols**: "CA" means "Contract Address" (abbreviation), NOT a token symbol. Filter it out. Also filter: "MC" (market cap), "ATH" (all-time high), "LFG", "WAGMI", "NFA", "DYOR"
4. **Chain detection from context**:
   - "BSC", "BNB Chain", "PancakeSwap", "FourMeme" → chain = "bsc"
   - "Ethereum", "Uniswap", "ETH chain", "mainnet" → chain = "eth"
   - "Solana", "pump.fun", "Raydium" → chain = "sol"
   - "Base chain", "Aerodrome" → chain = "base"
   - Address starting with 0x (42 chars) → "eth" by default (could be BSC/Base, use context)
   - Base58 address ending with "pump" → "sol"
5. **Celebrity FOMO**: Tweets leveraging Elon Musk, Vitalik, CZ for FOMO → flag narrativeCategory = "celebrity_fomo"
6. **Affiliate/promo**: Undisclosed paid promotions, referral links → flag narrativeCategory = "undisclosed_affiliate"
7. **De-duplicate**: If a tweet mentions the same token multiple times, output it once

## Output Format

Return a JSON array. Each element:
{
  "tweetId": "string",
  "intentLevel": 0-4,
  "positionClaim": "claimed_buy" | "claimed_exit" | "denied" | "neutral",
  "tokens": [{"symbol": "TOKEN", "address": "0x..." (if found), "chain": "eth|bsc|sol|base|unknown"}],
  "narrativeCategory": "meme_shill" | "tech_analysis" | "project_support" | "celebrity_fomo" | "undisclosed_affiliate" | "social_chat" | "news_retweet",
  "isNoise": true/false,
  "reasoning": "Brief Chinese explanation (1 sentence)"
}

Important: Return ONLY the JSON array, no markdown code fences.`;

// ---- Batch classification ----

interface TweetInput {
  id: string;
  text: string;
  createdAt: string;
  url: string;
}

/**
 * Split tweets into batches to respect token limits.
 * ~30 tweets per batch keeps us well under context limits.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function classifyBatch(
  tweets: TweetInput[],
): Promise<ClassifiedSignal[]> {
  const client = getLLMClient();
  const model = getLLMModel();
  const userContent = JSON.stringify(
    tweets.map((t) => ({ id: t.id, text: t.text, createdAt: t.createdAt })),
  );

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
    max_tokens: 8000,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "[]";

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed: Array<{
    tweetId: string;
    intentLevel: number;
    positionClaim: string;
    tokens: Array<{ symbol: string; address?: string; chain: string }>;
    narrativeCategory: string;
    isNoise: boolean;
    reasoning: string;
  }>;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[signal-classifier] Failed to parse LLM response, returning empty batch");
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  // Build a lookup for tweet metadata
  const tweetMap = new Map(tweets.map((t) => [t.id, t]));

  return parsed.map((item) => {
    const tweet = tweetMap.get(item.tweetId);
    return {
      tweetId: item.tweetId,
      tweetText: tweet?.text?.slice(0, 500) || "",
      tweetUrl: tweet?.url || "",
      createdAt: tweet?.createdAt || "",
      intentLevel: (Math.max(0, Math.min(4, item.intentLevel)) as IntentLevel),
      positionClaim: (["claimed_buy", "claimed_exit", "denied", "neutral"].includes(item.positionClaim)
        ? item.positionClaim
        : "neutral") as ClassifiedSignal["positionClaim"],
      tokens: (item.tokens || []).filter(
        (t) => t.symbol && !["CA", "MC", "ATH", "LFG", "WAGMI", "NFA", "DYOR"].includes(t.symbol.toUpperCase()),
      ),
      narrativeCategory: item.narrativeCategory || "social_chat",
      isNoise: item.isNoise ?? item.intentLevel === 0,
      reasoning: item.reasoning || "",
    };
  });
}

// ---- Public API ----

export async function classifySignals(
  tweets: SocialSignal[],
): Promise<ClassifiedSignal[]> {
  const inputs: TweetInput[] = tweets.map((t) => ({
    id: t.id,
    text: t.text,
    createdAt: t.createdAt,
    url: t.url,
  }));

  const batches = chunkArray(inputs, 25);
  console.log(
    `[signal-classifier] Classifying ${inputs.length} tweets in ${batches.length} batch(es) via ${getLLMModel()}`,
  );

  const results: ClassifiedSignal[] = [];
  for (const batch of batches) {
    const batchResults = await classifyBatch(batch);
    results.push(...batchResults);
  }

  console.log(
    `[signal-classifier] Done: ${results.length} classified, ` +
    `S0=${results.filter((r) => r.intentLevel === 0).length} ` +
    `S1=${results.filter((r) => r.intentLevel === 1).length} ` +
    `S2=${results.filter((r) => r.intentLevel === 2).length} ` +
    `S3=${results.filter((r) => r.intentLevel === 3).length} ` +
    `S4=${results.filter((r) => r.intentLevel === 4).length}`,
  );

  return results;
}
