/**
 * KOL Prefilter Agent v2
 *
 * Twitter-First prefilter: S3 signal frequency is Gate 1.
 * Pure rules, zero GPT cost.
 *
 * Gate order (changed from v1):
 *   G1: Tweet signal frequency (S3/S4 >= 3 in recent tweets) ← NEW FIRST GATE
 *   G2: Not a bot (diverse content)
 *   G3: Wallet exists
 *   G4: Chain coverage (signal chains ∩ wallet chains)
 *   G5: Wallet active (volume >= $500)
 */

import type { AgentSubject } from "../agent-catalog";
import type { DiscoveredKOL, PrefilterResult, PrefilterStatus } from "../leaderboard-types";
import type { SocialSignal } from "../social-types";
import { collectSocialSignalsForHandle } from "./gmgn-social-agent";

// ---- Cheap signal detection (no LLM) ----

const BUY_KEYWORDS = /\b(bought|buying|picked up|added|loading|ape[ds]?\s+in|loaded|accumulating|scooped|grabbed)\b/i;
const BUY_KEYWORDS_CN = /买了|建仓|加仓|上车|冲了|抄底/;
const SELL_KEYWORDS = /\b(sold|selling|took profit|exited|trimmed|tp['\u2019]?d|dumped|closed)\b/i;
const TOKEN_MENTION = /\$[A-Za-z][A-Za-z0-9]{1,15}\b/;
const CONTRACT_ADDR = /\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/;

function countActionSignals(tweets: SocialSignal[]): { s3: number; s4: number; tokenMentions: number } {
  let s3 = 0;
  let s4 = 0;
  let tokenMentions = 0;

  for (const tweet of tweets) {
    const text = tweet.text;
    const hasToken = TOKEN_MENTION.test(text) || CONTRACT_ADDR.test(text);
    if (hasToken) tokenMentions++;

    if (hasToken && (BUY_KEYWORDS.test(text) || BUY_KEYWORDS_CN.test(text))) s3++;
    if (hasToken && SELL_KEYWORDS.test(text)) s4++;
  }

  return { s3, s4, tokenMentions };
}

// ---- Chain detection (no LLM) ----

const SOL_KEYWORDS = /solana|pump\.fun|raydium|jupiter|jup\b/i;
const BSC_KEYWORDS = /bsc|bnb chain|pancake|fourmeme|binance smart/i;
const ETH_KEYWORDS = /ethereum|uniswap|eth chain|mainnet/i;
const BASE_KEYWORDS = /base chain|aerodrome|based/i;

function cheapChainDetect(tweets: SocialSignal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tweet of tweets) {
    const text = tweet.text;
    const addresses = text.match(/\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g) || [];
    for (const addr of addresses) {
      if (!addr.startsWith("0x") && addr.length >= 32) {
        counts.sol = (counts.sol || 0) + 1;
      } else if (addr.startsWith("0x")) {
        if (BSC_KEYWORDS.test(text)) counts.bsc = (counts.bsc || 0) + 1;
        else if (BASE_KEYWORDS.test(text)) counts.base = (counts.base || 0) + 1;
        else counts.eth = (counts.eth || 0) + 1;
      }
    }
    if (SOL_KEYWORDS.test(text)) counts.sol = (counts.sol || 0) + 1;
    if (BSC_KEYWORDS.test(text)) counts.bsc = (counts.bsc || 0) + 1;
    if (ETH_KEYWORDS.test(text)) counts.eth = (counts.eth || 0) + 1;
    if (BASE_KEYWORDS.test(text)) counts.base = (counts.base || 0) + 1;
  }
  return counts;
}

// ---- Main prefilter ----

export async function prefilterKOL(
  subject: AgentSubject,
  gmgnData?: DiscoveredKOL,
): Promise<PrefilterResult> {
  const gates: Record<string, boolean> = {};
  let failureReason: PrefilterStatus | null = null;

  // Fetch tweets first (needed for G1, G2, G4)
  let tweets: SocialSignal[] = [];
  try {
    tweets = await collectSocialSignalsForHandle(subject.handle, 30);
  } catch {
    // If tweet fetch fails entirely, reject (can't evaluate signal quality)
    return {
      handle: subject.handle,
      passed: false,
      gates: { G1_signals: false },
      failureReason: "inactive",
    };
  }

  // G1: Tweet signal frequency (THE FIRST GATE)
  const { s3, s4, tokenMentions } = countActionSignals(tweets);
  gates.G1_signals = (s3 + s4) >= 3 || tokenMentions >= 5;
  if (!gates.G1_signals) {
    failureReason = "inactive";
    console.log(
      `[prefilter] @${subject.handle}: G1 FAIL — S3=${s3} S4=${s4} mentions=${tokenMentions} (need S3+S4>=3 or mentions>=5)`,
    );
    return { handle: subject.handle, passed: false, gates, failureReason };
  }

  // G2: Not a bot (basic check)
  gates.G2_not_bot = true; // KOL-tagged accounts are pre-vetted

  // G3: Wallet exists
  gates.G3_wallet = subject.wallets.length >= 1;
  if (!gates.G3_wallet) {
    failureReason = "no_wallet";
    return { handle: subject.handle, passed: false, gates, failureReason };
  }

  // G4: Chain coverage
  const signalChains = cheapChainDetect(tweets);
  const walletChains = new Set(subject.wallets.map((w) => w.chain));
  const signalChainKeys = Object.keys(signalChains).filter((c) => signalChains[c] > 0);

  if (signalChainKeys.length === 0) {
    gates.G4_chain = true; // No detectable chain = allow through
  } else {
    gates.G4_chain = signalChainKeys.some((c) => walletChains.has(c));
  }
  if (!gates.G4_chain) {
    failureReason = "chain_mismatch";
    return { handle: subject.handle, passed: false, gates, failureReason };
  }

  // G5: Wallet active
  if (gmgnData) {
    gates.G5_active = gmgnData.volume7d >= 500 || (gmgnData.buy7d + gmgnData.sell7d) >= 5;
  } else {
    gates.G5_active = true;
  }
  if (!gates.G5_active) {
    failureReason = "dead_wallet";
    return { handle: subject.handle, passed: false, gates, failureReason };
  }

  console.log(
    `[prefilter] @${subject.handle}: PASS — S3=${s3} S4=${s4} mentions=${tokenMentions} chains=[${signalChainKeys.join(",")}]`,
  );

  return { handle: subject.handle, passed: true, gates, failureReason: null };
}

export async function batchPrefilter(
  subjects: AgentSubject[],
  gmgnDataMap?: Map<string, DiscoveredKOL>,
  concurrency = 5,
): Promise<PrefilterResult[]> {
  console.log(`[prefilter] Running Twitter-First gates on ${subjects.length} KOLs (concurrency=${concurrency})...`);

  const results: PrefilterResult[] = new Array(subjects.length);
  const queue = subjects.map((s, i) => ({ subject: s, index: i }));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const idx = cursor++;
      const { subject, index } = queue[idx];
      try {
        const gmgnData = gmgnDataMap?.get(subject.handle);
        results[index] = await prefilterKOL(subject, gmgnData);
      } catch (err) {
        console.error(`[prefilter] @${subject.handle}: ERROR`, err instanceof Error ? err.message : err);
        results[index] = { handle: subject.handle, passed: false, gates: {}, failureReason: "inactive" };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, subjects.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const reasons = failed.reduce((acc, r) => {
    const reason = r.failureReason || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(
    `[prefilter] Done: ${passed.length} passed, ${failed.length} rejected` +
    (Object.keys(reasons).length > 0
      ? ` (${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(", ")})`
      : ""),
  );

  return results;
}
