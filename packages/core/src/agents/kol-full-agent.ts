/**
 * KOL Full Analysis Agent (v2.0)
 *
 * Main orchestrator: tweets → GPT classification → multi-chain wallet →
 * chain-routed matching → 4-dim scoring → red flag detection → GPT narrative.
 */

import type { AgentSubject, WalletBinding } from "../agent-catalog";
import type { ActivityRow } from "../activity-types";
import type { WalletTradeDecision } from "../gmgn-types";
import type {
  SocialInvestmentPick,
  WalletOnlyInvestmentTrade,
} from "../social-investment-types";
import type {
  ActionTier,
  ChainCoverage,
  ClassifiedSignal,
  KOLReport,
  KOLScores,
  RedFlag,
  SignalStats,
  WalletSummary,
} from "../kol-report-types";

import { collectSocialSignalsForHandle } from "./gmgn-social-agent";
import { analyzeKolMultiWallet, type MultiWalletReport } from "./kol-analysis-agent";
import { collectMultiChainActivityRows } from "./gmgn-activity-agent";
import { classifySignals } from "./signal-classifier-agent";
import { generateNarrative } from "./narrative-agent";

const AGENT_VERSION = "2.0.0";

// ============================================================
// Matching helpers
// ============================================================

function normalizeSymbol(v: string | null | undefined): string {
  return (v || "").trim().toUpperCase();
}
function normalizeAddress(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

interface ActivityGroup {
  tokenSymbol: string;
  tokenAddress: string | null;
  chain: string;
  buyCount: number;
  sellCount: number;
  buyUsd: number;
  sellUsd: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}

function groupActivitiesByChain(
  rows: (ActivityRow & { chain: string })[],
): Map<string, ActivityGroup[]> {
  const byChain = new Map<string, Map<string, ActivityGroup>>();

  for (const row of rows) {
    if (!byChain.has(row.chain)) byChain.set(row.chain, new Map());
    const chainMap = byChain.get(row.chain)!;

    const key =
      normalizeAddress(row.tokenAddress) ||
      `symbol:${normalizeSymbol(row.tokenSymbol)}`;
    if (!key) continue;

    const existing = chainMap.get(key) || {
      tokenSymbol: row.tokenSymbol,
      tokenAddress: row.tokenAddress || null,
      chain: row.chain,
      buyCount: 0,
      sellCount: 0,
      buyUsd: 0,
      sellUsd: 0,
      firstTimestamp: null,
      lastTimestamp: null,
    };

    if (row.eventType === "buy") {
      existing.buyCount += 1;
      existing.buyUsd += row.costUsd || 0;
    }
    if (row.eventType === "sell") {
      existing.sellCount += 1;
      existing.sellUsd += row.costUsd || 0;
    }
    if (row.timestamp) {
      existing.firstTimestamp =
        existing.firstTimestamp === null ? row.timestamp : Math.min(existing.firstTimestamp, row.timestamp);
      existing.lastTimestamp =
        existing.lastTimestamp === null ? row.timestamp : Math.max(existing.lastTimestamp, row.timestamp);
    }
    chainMap.set(key, existing);
  }

  const result = new Map<string, ActivityGroup[]>();
  for (const [chain, map] of byChain) {
    result.set(chain, [...map.values()]);
  }
  return result;
}

// ============================================================
// Chain-routed matching
// ============================================================

type TradeRelation =
  | "buy_before_signal"
  | "immediate_buy"
  | "quick_buy"
  | "delayed_buy"
  | "late_entry"
  | "unrelated"
  | "no_trade";

function inferTradeRelation(
  signalTimestampMs: number,
  group: ActivityGroup | null,
): TradeRelation {
  if (!group?.firstTimestamp) return "no_trade";
  const postSeconds = Math.floor(signalTimestampMs / 1000);
  const deltaMinutes = Math.round((group.firstTimestamp - postSeconds) / 60);

  if (deltaMinutes < -1440) return "unrelated";
  if (deltaMinutes < 0) return "buy_before_signal";
  if (deltaMinutes < 60) return "immediate_buy";
  if (deltaMinutes < 360) return "quick_buy";
  if (deltaMinutes < 1440) return "delayed_buy";
  return "late_entry";
}

function findMatchingGroup(
  token: ClassifiedSignal["tokens"][number],
  groupsByChain: Map<string, ActivityGroup[]>,
): { group: ActivityGroup | null; matchType: "exact_contract" | "symbol" | "cross_chain_symbol" | "none" } {
  const addr = normalizeAddress(token.address);
  const sym = normalizeSymbol(token.symbol);

  // 1. Same-chain exact address match
  const sameChainGroups = groupsByChain.get(token.chain) || [];
  if (addr && addr !== normalizeAddress(token.symbol)) {
    const exact = sameChainGroups.find((g) => normalizeAddress(g.tokenAddress) === addr);
    if (exact) return { group: exact, matchType: "exact_contract" };
  }

  // 2. Same-chain symbol match
  if (sym) {
    const bySymbol = sameChainGroups.find((g) => normalizeSymbol(g.tokenSymbol) === sym);
    if (bySymbol) return { group: bySymbol, matchType: "symbol" };
  }

  // 3. Cross-chain symbol fallback (降权)
  if (sym) {
    for (const [chain, groups] of groupsByChain) {
      if (chain === token.chain) continue;
      const cross = groups.find((g) => normalizeSymbol(g.tokenSymbol) === sym);
      if (cross) return { group: cross, matchType: "cross_chain_symbol" };
    }
  }

  return { group: null, matchType: "none" };
}

// ============================================================
// Build picks from classified signals
// ============================================================

function buildPicksFromClassified(
  signals: ClassifiedSignal[],
  groupsByChain: Map<string, ActivityGroup[]>,
  trades: (WalletTradeDecision & { chain: string })[],
): SocialInvestmentPick[] {
  const picks: SocialInvestmentPick[] = [];

  // Only process S1+ signals with tokens
  const actionableSignals = signals.filter((s) => s.intentLevel >= 1 && s.tokens.length > 0);

  for (const signal of actionableSignals) {
    for (const token of signal.tokens) {
      const { group, matchType } = findMatchingGroup(token, groupsByChain);

      const action: SocialInvestmentPick["walletAction"] =
        !group || (group.buyCount === 0 && group.sellCount === 0)
          ? "no_wallet_trade"
          : group.buyCount > 0 && group.sellCount > 0
            ? "round_trip"
            : group.buyCount > 0
              ? "bought"
              : "sold";

      const relation = inferTradeRelation(
        Date.parse(signal.createdAt),
        group,
      );

      // Find matching trade decision
      const tradeDecision = trades.find(
        (t) =>
          normalizeAddress(t.tokenAddress) === normalizeAddress(group?.tokenAddress) ||
          normalizeSymbol(t.tokenSymbol) === normalizeSymbol(group?.tokenSymbol || token.symbol),
      );

      // Map relation to old format for compatibility
      const tradeRelationCompat: SocialInvestmentPick["tradeRelation"] =
        relation === "no_trade" ? "no_trade"
          : relation === "buy_before_signal" ? "before_post"
            : relation === "unrelated" ? "no_trade"
              : "after_post";

      // Score
      let score = 15;
      if (matchType === "exact_contract") score += 35;
      else if (matchType === "symbol") score += 20;
      else if (matchType === "cross_chain_symbol") score += 10;

      if (action === "bought") score += 20;
      else if (action === "round_trip") score += 12;
      else if (action === "sold") score -= 15;
      else if (action === "no_wallet_trade") score -= 25;

      // Weight by intent level
      if (signal.intentLevel >= 3) score += 10;
      if (signal.positionClaim === "claimed_buy" && action === "no_wallet_trade") score -= 15;
      if (signal.positionClaim === "denied") score -= 10;

      // Relation scoring
      if (relation === "buy_before_signal") score += 15;
      else if (relation === "immediate_buy") score += 12;
      else if (relation === "quick_buy") score += 8;
      else if (relation === "delayed_buy") score += 4;

      // Profitability
      if ((tradeDecision?.totalProfitUsd || 0) > 0) score += 10;
      if ((tradeDecision?.totalProfitUsd || 0) < 0) score -= 12;

      score = Math.max(0, Math.min(100, Math.round(score)));

      const verdict =
        action === "no_wallet_trade" ? "insufficient_evidence" as const
          : score >= 72 ? "follow_candidate" as const
            : score >= 50 ? "watch_only" as const
              : "reject" as const;

      picks.push({
        signalId: signal.tweetId,
        signalCreatedAt: signal.createdAt,
        signalUrl: signal.tweetUrl,
        signalText: signal.tweetText,
        tokenSymbol: group?.tokenSymbol || token.symbol,
        tokenAddress: group?.tokenAddress || token.address || token.symbol,
        matchType: matchType === "cross_chain_symbol" ? "symbol" : matchType === "none" ? "none" : matchType,
        walletAction: action,
        firstTradeAt: group?.firstTimestamp ? new Date(group.firstTimestamp * 1000).toISOString() : null,
        lastTradeAt: group?.lastTimestamp ? new Date(group.lastTimestamp * 1000).toISOString() : null,
        buyCount: group?.buyCount || 0,
        sellCount: group?.sellCount || 0,
        buyUsd: group?.buyUsd || 0,
        sellUsd: group?.sellUsd || 0,
        realizedProxyUsd: (group?.sellUsd || 0) - (group?.buyUsd || 0),
        latestPriceUsd: null,
        aggregateStatus: tradeDecision?.status || "unknown",
        aggregateProfitUsd: tradeDecision?.totalProfitUsd ?? null,
        aggregateProfitPct: tradeDecision?.totalProfitPct ?? null,
        tradeRelation: tradeRelationCompat,
        confidenceScore: score,
        verdict,
        reasoning: signal.reasoning,
      });
    }
  }

  // Deduplicate: keep highest score per token
  const best = new Map<string, SocialInvestmentPick>();
  for (const pick of picks) {
    const key = normalizeAddress(pick.tokenAddress) || normalizeSymbol(pick.tokenSymbol);
    const existing = best.get(key);
    if (!existing || pick.confidenceScore > existing.confidenceScore) {
      best.set(key, pick);
    }
  }

  return [...best.values()].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// ============================================================
// Wallet-only trades
// ============================================================

function buildWalletOnlyTrades(
  groupsByChain: Map<string, ActivityGroup[]>,
  picks: SocialInvestmentPick[],
): WalletOnlyInvestmentTrade[] {
  const pickedKeys = new Set(
    picks.map((p) => normalizeAddress(p.tokenAddress) || normalizeSymbol(p.tokenSymbol)),
  );

  const trades: WalletOnlyInvestmentTrade[] = [];
  for (const groups of groupsByChain.values()) {
    for (const group of groups) {
      const key = normalizeAddress(group.tokenAddress) || normalizeSymbol(group.tokenSymbol);
      if (pickedKeys.has(key)) continue;
      trades.push({
        tokenSymbol: group.tokenSymbol,
        tokenAddress: group.tokenAddress,
        firstTradeAt: group.firstTimestamp ? new Date(group.firstTimestamp * 1000).toISOString() : null,
        lastTradeAt: group.lastTimestamp ? new Date(group.lastTimestamp * 1000).toISOString() : null,
        buyUsd: group.buyUsd,
        sellUsd: group.sellUsd,
        buyCount: group.buyCount,
        sellCount: group.sellCount,
        reasoning: `钱包有真实交易（${group.chain}链），但推文中未匹配到同名或同合约信号。`,
      });
    }
  }
  return trades.slice(0, 10);
}

// ============================================================
// Scoring (4-dim)
// ============================================================

function computeScores(
  signals: ClassifiedSignal[],
  picks: SocialInvestmentPick[],
  wallets: WalletBinding[],
  chainCoverage: ChainCoverage,
): KOLScores {
  // Authenticity: S3+S4 matched / S3+S4 total
  const s3s4 = signals.filter((s) => s.intentLevel >= 3);
  const s3s4Matched = picks.filter(
    (p) => p.matchType !== "none" && p.walletAction !== "no_wallet_trade",
  );
  const claimNoTrade = picks.filter(
    (p) => p.walletAction === "no_wallet_trade",
  ).length;
  const authenticity = s3s4.length > 0
    ? Math.max(0, Math.min(100, Math.round((s3s4Matched.length / s3s4.length) * 100 - claimNoTrade * 5)))
    : 0;

  // Coverage: signal chains covered by wallet chains
  const signalChainSet = new Set(Object.keys(chainCoverage.signalChains));
  const walletChainSet = new Set(Object.keys(chainCoverage.walletChains));
  const coveredChains = [...signalChainSet].filter((c) => walletChainSet.has(c));
  const coverage = signalChainSet.size > 0
    ? Math.round((coveredChains.length / signalChainSet.size) * 100)
    : 0;

  // Discipline: base 100, penalties
  let discipline = 100;
  const quickFlips = picks.filter(
    (p) => p.walletAction === "sold" && p.tradeRelation === "after_post",
  );
  discipline -= quickFlips.length * 20;
  discipline = Math.max(0, Math.min(100, discipline));

  // Follower alpha: null if not enough matched signals
  const followerAlpha = s3s4Matched.length >= 3
    ? Math.round(
        s3s4Matched.reduce((sum, p) => sum + (p.aggregateProfitPct || 0), 0) / s3s4Matched.length,
      )
    : null;

  // Composite
  const composite = followerAlpha !== null
    ? Math.round(0.35 * authenticity + 0.35 * Math.max(0, Math.min(100, followerAlpha + 50)) + 0.15 * coverage + 0.15 * discipline)
    : Math.round(0.50 * authenticity + 0.20 * coverage + 0.30 * discipline);

  return { composite, authenticity, followerAlpha, coverage, discipline };
}

// ============================================================
// Red flags
// ============================================================

function detectRedFlags(
  signals: ClassifiedSignal[],
  picks: SocialInvestmentPick[],
  chainCoverage: ChainCoverage,
  walletReport: MultiWalletReport,
): RedFlag[] {
  const flags: RedFlag[] = [];

  if (chainCoverage.missingChains.length > 0) flags.push("CHAIN_MISMATCH");

  const claimNoTrade = signals.filter(
    (s) => s.positionClaim === "claimed_buy" &&
      picks.some((p) => p.signalId === s.tweetId && p.walletAction === "no_wallet_trade"),
  );
  if (claimNoTrade.length > 0) flags.push("CLAIMED_BUY_NO_TRADE");

  const totalVolume = walletReport.allTradeDecisions.reduce(
    (s, d) => s + d.buyCostUsd + d.sellIncomeUsd, 0,
  );
  if (totalVolume < 1000) flags.push("MICRO_WALLET");

  const celeb = signals.filter((s) => s.narrativeCategory === "celebrity_fomo");
  if (celeb.length >= 2) flags.push("CELEBRITY_FOMO_TRIGGER");

  const affiliate = signals.filter((s) => s.narrativeCategory === "undisclosed_affiliate");
  if (affiliate.length > 0) flags.push("UNDISCLOSED_AFFILIATE");

  const contradictions = signals.filter((s) => s.positionClaim === "denied");
  if (contradictions.length > 0) flags.push("SELF_CONTRADICTION");

  return flags;
}

// ============================================================
// Chain coverage
// ============================================================

function computeChainCoverage(
  signals: ClassifiedSignal[],
  wallets: WalletBinding[],
): ChainCoverage {
  const signalChainCount: Record<string, number> = {};
  let totalTokens = 0;

  for (const s of signals) {
    for (const t of s.tokens) {
      const chain = t.chain || "unknown";
      signalChainCount[chain] = (signalChainCount[chain] || 0) + 1;
      totalTokens++;
    }
  }

  const signalChains: Record<string, number> = {};
  for (const [chain, count] of Object.entries(signalChainCount)) {
    if (chain === "unknown") continue;
    signalChains[chain] = Math.round((count / Math.max(1, totalTokens)) * 100) / 100;
  }

  const walletChains: Record<string, number> = {};
  for (const w of wallets) {
    walletChains[w.chain] = (walletChains[w.chain] || 0) + 1;
  }
  // Normalize
  const totalWallets = wallets.length || 1;
  for (const chain of Object.keys(walletChains)) {
    walletChains[chain] = Math.round((walletChains[chain] / totalWallets) * 100) / 100;
  }

  const signalChainSet = new Set(Object.keys(signalChains));
  const walletChainSet = new Set(Object.keys(walletChains));
  const missingChains = [...signalChainSet].filter((c) => !walletChainSet.has(c));

  return { signalChains, walletChains, missingChains };
}

// ============================================================
// Signal stats
// ============================================================

function computeSignalStats(signals: ClassifiedSignal[]): SignalStats {
  return {
    s0: signals.filter((s) => s.intentLevel === 0).length,
    s1: signals.filter((s) => s.intentLevel === 1).length,
    s2: signals.filter((s) => s.intentLevel === 2).length,
    s3: signals.filter((s) => s.intentLevel === 3).length,
    s4: signals.filter((s) => s.intentLevel === 4).length,
    total: signals.length,
  };
}

// ============================================================
// Verdict
// ============================================================

function determineVerdict(
  scores: KOLScores,
  redFlags: RedFlag[],
): ActionTier {
  if (redFlags.includes("CHAIN_MISMATCH") && scores.coverage < 40) return "insufficient_data";
  if (redFlags.includes("QUICK_FLIP_AFTER_SHILL") && scores.authenticity < 30) return "avoid";
  if (scores.composite >= 75 && scores.authenticity >= 60) return "auto_copy";
  if (scores.composite >= 50) return "watchlist";
  if (scores.coverage < 50) return "insufficient_data";
  return "narrative_only";
}

// ============================================================
// Main entry point
// ============================================================

export async function analyzeKolFull(
  subject: AgentSubject,
): Promise<KOLReport> {
  console.log(`[kol-full] Starting full analysis for @${subject.handle} (${subject.wallets.length} wallets)`);

  // Step 1: Parallel data collection
  const [tweets, walletReport, activities] = await Promise.all([
    collectSocialSignalsForHandle(subject.handle, 100),
    analyzeKolMultiWallet(subject.wallets),
    collectMultiChainActivityRows(subject.wallets, 80),
  ]);

  console.log(
    `[kol-full] Data collected: ${tweets.length} tweets, ` +
    `${walletReport.allTradeDecisions.length} trades, ${activities.length} activities`,
  );

  // Step 2: GPT signal classification
  const classified = await classifySignals(tweets);

  // Step 3: Chain coverage analysis
  const chainCoverage = computeChainCoverage(classified, subject.wallets);

  // Step 4: Chain-routed matching
  const groupsByChain = groupActivitiesByChain(activities);
  const picks = buildPicksFromClassified(
    classified,
    groupsByChain,
    walletReport.allTradeDecisions,
  ).slice(0, 15);

  const walletOnlyTrades = buildWalletOnlyTrades(groupsByChain, picks);

  // Step 5: Scoring + red flags
  const scores = computeScores(classified, picks, subject.wallets, chainCoverage);
  const redFlags = detectRedFlags(classified, picks, chainCoverage, walletReport);
  const action = determineVerdict(scores, redFlags);
  const signalStats = computeSignalStats(classified);

  // Step 6: GPT narrative
  const matchedCount = picks.filter((p) => p.matchType !== "none").length;
  const claimNoTradeCount = picks.filter(
    (p) => p.walletAction === "no_wallet_trade",
  ).length;

  const topTradesSummary = walletReport.allTradeDecisions
    .slice()
    .sort((a, b) => Math.abs(b.totalProfitUsd) - Math.abs(a.totalProfitUsd))
    .slice(0, 3)
    .map((t) => `${t.tokenSymbol}(${t.chain}): ${t.totalProfitUsd > 0 ? "+" : ""}$${t.totalProfitUsd.toFixed(2)}`)
    .join(", ");

  const narrative = await generateNarrative({
    handle: subject.handle,
    scores,
    redFlags,
    signalStats,
    chainCoverage,
    matchedCount,
    claimNoTradeCount,
    walletOnlyCount: walletOnlyTrades.length,
    topTradesSummary,
  });

  // Step 7: Build wallet summaries
  const walletSummaries: WalletSummary[] = walletReport.wallets.map((w) => ({
    address: w.address,
    chain: w.chain,
    confirmation: subject.wallets.find((sw) => sw.address === w.address)?.confirmation || "confirmed",
    tradeCount: w.tradeDecisions.length,
    pnlUsd: w.tradeDecisions.reduce((s, d) => s + d.totalProfitUsd, 0),
    balanceUsd: w.tradeDecisions.reduce((s, d) => s + d.balanceUsd, 0),
  }));

  console.log(
    `[kol-full] Done: score=${scores.composite}, action=${action}, ` +
    `flags=[${redFlags.join(",")}], matched=${matchedCount}/${picks.length}`,
  );

  return {
    generatedAt: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
    kol: {
      handle: subject.handle,
      followers: walletReport.summary.followers,
      displayName: walletReport.summary.displayName || subject.label,
    },
    scores,
    action,
    signalStats,
    topInsights: narrative.insights,
    thesis: narrative.thesis,
    redFlags,
    chainCoverage,
    classifiedSignals: classified,
    picks,
    walletOnlyTrades,
    walletSummaries,
  };
}

// ============================================================
// Batch analysis with concurrency control
// ============================================================

export async function batchAnalyzeKols(
  subjects: AgentSubject[],
  concurrency = 3,
): Promise<KOLReport[]> {
  console.log(
    `[batch] Analyzing ${subjects.length} KOLs (concurrency=${concurrency})`,
  );

  const results: KOLReport[] = [];
  const queue = [...subjects];
  let completed = 0;

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const subject = queue.shift();
      if (!subject) break;

      try {
        const report = await analyzeKolFull(subject);
        results.push(report);
        completed++;
        console.log(
          `[batch] ${completed}/${subjects.length} @${subject.handle}: ` +
          `score=${report.scores.composite}, action=${report.action}`,
        );
      } catch (error) {
        completed++;
        console.error(
          `[batch] ${completed}/${subjects.length} @${subject.handle}: FAILED`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, subjects.length) }, () => worker());
  await Promise.all(workers);

  console.log(`[batch] Done: ${results.length}/${subjects.length} successful`);
  return results;
}
