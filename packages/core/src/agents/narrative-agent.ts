/**
 * GPT-driven Narrative Agent
 *
 * Generates 3 top insights + thesis in English based on structured analysis data.
 */

import type { KOLScores, RedFlag, SignalStats, ChainCoverage } from "../kol-report-types";
import { getLLMClient, getLLMModel } from "../llm-client";

interface NarrativeInput {
  handle: string;
  scores: KOLScores;
  redFlags: RedFlag[];
  signalStats: SignalStats;
  chainCoverage: ChainCoverage;
  matchedCount: number;
  claimNoTradeCount: number;
  walletOnlyCount: number;
  topTradesSummary: string;
}

export interface NarrativeOutput {
  insights: [string, string, string];
  thesis: string;
}

export async function generateNarrative(
  input: NarrativeInput,
): Promise<NarrativeOutput> {
  const client = getLLMClient();
  const model = getLLMModel();

  const prompt = `You are a crypto KOL analyst. Based on the structured data below, generate an English analysis report.

## Data
- KOL: @${input.handle}
- Composite Score: ${input.scores.composite}/100
- Authenticity: ${input.scores.authenticity}/100
- Follower Alpha: ${input.scores.followerAlpha === null ? "Insufficient data" : input.scores.followerAlpha}
- Coverage: ${input.scores.coverage}/100
- Discipline: ${input.scores.discipline}/100
- Red Flags: ${input.redFlags.join(", ") || "None"}
- Signal Distribution: S0=${input.signalStats.s0} S1=${input.signalStats.s1} S2=${input.signalStats.s2} S3=${input.signalStats.s3} S4=${input.signalStats.s4}
- Chain Coverage: Signal chains ${JSON.stringify(input.chainCoverage.signalChains)}, Wallet chains ${JSON.stringify(input.chainCoverage.walletChains)}, Missing ${input.chainCoverage.missingChains.join(",") || "none"}
- Matched: ${input.matchedCount}, Claimed but no trade: ${input.claimNoTradeCount}, Wallet-only trades: ${input.walletOnlyCount}
- Key trades: ${input.topTradesSummary}

## Output Requirements
Return JSON (no markdown code blocks):
{
  "insights": ["Insight 1 (1-2 sentences)", "Insight 2", "Insight 3"],
  "thesis": "3-5 sentence summary. Be professional and direct with actionable advice. When data coverage is incomplete, state it is a coverage gap, not proof of fraud."
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as { insights: string[]; thesis: string };

    return {
      insights: [
        parsed.insights[0] || "Analysis in progress",
        parsed.insights[1] || "More data needed",
        parsed.insights[2] || "Recommend adding wallet mappings",
      ],
      thesis: parsed.thesis || "Insufficient analysis data. Recommend adding more wallet mappings and re-evaluating.",
    };
  } catch (error) {
    console.error("[narrative-agent] LLM call failed, using fallback:", error);
    return {
      insights: [
        `Composite score ${input.scores.composite}/100, Authenticity ${input.scores.authenticity}/100`,
        `${input.redFlags.length} red flag(s): ${input.redFlags.slice(0, 3).join(", ") || "None"}`,
        `Missing chain coverage: ${input.chainCoverage.missingChains.join(", ") || "None"}`,
      ],
      thesis: `@${input.handle} currently scores ${input.scores.composite}/100. ${
        input.redFlags.includes("CHAIN_MISMATCH")
          ? "Signal chains do not match wallet chains. Add corresponding chain wallets and re-evaluate."
          : "Analysis complete. Refer to the 4-dimension scores and red flags for decision-making."
      }`,
    };
  }
}
