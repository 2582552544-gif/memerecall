// packages/core/src/agents/evidence-builder.ts

import type { ClassifiedSignal } from "../kol-report-types";
import type { ActivityRow } from "../activity-types";
import type { SocialInvestmentPick } from "../social-investment-types";
import type { WalletTradeDecision } from "../gmgn-types";
import type {
  EvidenceRow,
  EvidenceIntent,
  EvidenceTradeMatch,
  EvidencePnl,
  EvidenceVerdict,
  FollowerSimResult,
  PnlBreakdownRow,
  PnlBreakdownSummary,
} from "../evidence-types";
import { fetchGmgnTokenInfo } from "../gmgn-client";

// ---- Helpers ----

function normalizeSymbol(v: string | null | undefined): string {
  return (v || "").trim().toUpperCase();
}

function normalizeAddress(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function intentFromLevel(
  level: number,
  claim: string,
): EvidenceIntent {
  if (level >= 4) return "S4_CLAIM_SELL";
  if (level >= 3) return "S3_CLAIM_BUY";
  return "S2_OPINION";
}

function buildTxUrl(txHash: string, chain: string): string {
  switch (chain) {
    case "sol": return `https://solscan.io/tx/${txHash}`;
    case "bsc": return `https://bscscan.com/tx/${txHash}`;
    case "base": return `https://basescan.org/tx/${txHash}`;
    case "eth": return `https://etherscan.io/tx/${txHash}`;
    default: return `https://solscan.io/tx/${txHash}`;
  }
}

// ---- Match signals to activities ----

interface ActivityMatch {
  txHash: string;
  chain: string;
  deltaMinutes: number;
  amountUsd: number;
  entryPrice: number;
  eventType: string;
}

function findClosestActivity(
  signalTimestampMs: number,
  tokenSymbol: string,
  tokenAddress: string | undefined,
  activities: (ActivityRow & { chain: string })[],
): ActivityMatch | null {
  const symNorm = normalizeSymbol(tokenSymbol);
  const addrNorm = normalizeAddress(tokenAddress);

  // Find activities for this token
  const candidates = activities.filter((a) => {
    if (addrNorm && normalizeAddress(a.tokenAddress) === addrNorm) return true;
    if (symNorm && normalizeSymbol(a.tokenSymbol) === symNorm) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  // Find the one closest in time to the signal (prefer buys)
  const signalSec = Math.floor(signalTimestampMs / 1000);
  const buys = candidates.filter((c) => c.eventType === "buy");
  const pool = buys.length > 0 ? buys : candidates;

  let best: (ActivityRow & { chain: string }) | null = null;
  let bestDelta = Infinity;
  for (const c of pool) {
    if (!c.timestamp) continue;
    const delta = Math.abs(c.timestamp - signalSec);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }

  if (!best || !best.timestamp || !best.txHash) return null;

  return {
    txHash: best.txHash,
    chain: best.chain,
    deltaMinutes: Math.round((best.timestamp - signalSec) / 60),
    amountUsd: best.costUsd || 0,
    entryPrice: best.priceUsd || 0,
    eventType: best.eventType || "buy",
  };
}

function deltaToMatchKind(
  deltaMinutes: number,
): EvidenceTradeMatch["kind"] {
  if (deltaMinutes < -1440) return "late_entry"; // >24h before = probably unrelated
  if (deltaMinutes < 0) return "buy_before_signal";
  if (deltaMinutes < 5) return "immediate_buy";
  if (deltaMinutes < 60) return "quick_buy";
  if (deltaMinutes < 360) return "delayed_buy";
  return "late_entry";
}

// ---- Live token prices (best-effort) ----

async function fetchLivePrices(
  tokens: Array<{ address: string; chain: string }>,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const unique = new Map<string, { address: string; chain: string }>();

  for (const t of tokens) {
    const key = `${t.chain}:${normalizeAddress(t.address)}`;
    if (!unique.has(key) && t.address && t.address.length > 6) {
      unique.set(key, t);
    }
  }

  // Limit to 10 concurrent fetches to avoid rate limiting
  const entries = [...unique.entries()].slice(0, 10);
  await Promise.allSettled(
    entries.map(async ([key, { address, chain }]) => {
      try {
        const info = await fetchGmgnTokenInfo(address, chain);
        const price = Number(info.price);
        if (Number.isFinite(price) && price > 0) {
          prices.set(key, price);
        }
      } catch {
        // Ignore — price will be null in the evidence row
      }
    }),
  );

  return prices;
}

// ---- Main builder ----

export async function buildEvidenceRows(
  signals: ClassifiedSignal[],
  activities: (ActivityRow & { chain: string })[],
  picks: SocialInvestmentPick[],
): Promise<EvidenceRow[]> {
  // Only process S2+ signals that mention tokens
  const actionable = signals.filter(
    (s) => s.intentLevel >= 2 && s.tokens.length > 0,
  );

  if (actionable.length === 0) return [];

  // Build token list for live price fetching
  const tokensForPricing = actionable.flatMap((s) =>
    s.tokens
      .filter((t) => t.address)
      .map((t) => ({ address: t.address!, chain: t.chain })),
  );
  const livePrices = await fetchLivePrices(tokensForPricing);

  const rows: EvidenceRow[] = [];

  for (const signal of actionable) {
    for (const token of signal.tokens) {
      const signalTimestampMs = Date.parse(signal.createdAt);
      if (!signalTimestampMs) continue;

      // Find matching on-chain activity
      const activityMatch = findClosestActivity(
        signalTimestampMs,
        token.symbol,
        token.address,
        activities,
      );

      // Build trade match
      let match: EvidenceTradeMatch | null = null;
      if (activityMatch) {
        match = {
          kind: deltaToMatchKind(activityMatch.deltaMinutes),
          deltaMinutes: activityMatch.deltaMinutes,
          txHash: activityMatch.txHash,
          txUrl: buildTxUrl(activityMatch.txHash, activityMatch.chain),
          amountUsd: activityMatch.amountUsd,
          entryPrice: activityMatch.entryPrice,
        };
      }

      // Build PnL from pick data + live price
      let pnl: EvidencePnl | null = null;
      const pickMatch = picks.find(
        (p) =>
          normalizeSymbol(p.tokenSymbol) === normalizeSymbol(token.symbol) ||
          (token.address && normalizeAddress(p.tokenAddress) === normalizeAddress(token.address)),
      );

      const priceKey = `${token.chain}:${normalizeAddress(token.address)}`;
      const livePrice = livePrices.get(priceKey);

      if (pickMatch && match) {
        const currentPrice = livePrice || 0;
        const entryPrice = match.entryPrice;
        const roiPct = entryPrice > 0 && currentPrice > 0
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : pickMatch.aggregateProfitPct || 0;

        pnl = {
          currentPrice,
          roiPct,
          realizedUsd: pickMatch.aggregateStatus === "cleared"
            ? pickMatch.aggregateProfitUsd
            : null,
          status: pickMatch.aggregateStatus === "cleared" ? "closed" : "holding",
        };
      }

      // Determine verdict
      const intent = intentFromLevel(signal.intentLevel, signal.positionClaim);
      let verdict: EvidenceVerdict = "unverified";

      if (match && (intent === "S3_CLAIM_BUY" || intent === "S4_CLAIM_SELL")) {
        verdict = "verified";
      }
      if (
        !match &&
        signal.positionClaim === "claimed_buy" &&
        signal.intentLevel >= 3
      ) {
        verdict = "contradicted";
      }

      rows.push({
        id: makeId("ev"),
        tweetAt: signal.createdAt,
        tweetText: signal.tweetText.slice(0, 500),
        tweetUrl: signal.tweetUrl,
        intent,
        token: {
          symbol: token.symbol,
          address: token.address || "",
          chain: token.chain,
        },
        match,
        pnl,
        verdict,
      });
    }
  }

  // Deduplicate: keep best verdict per token per signal
  const best = new Map<string, EvidenceRow>();
  for (const row of rows) {
    const key = `${row.tweetUrl}:${normalizeSymbol(row.token.symbol)}`;
    const existing = best.get(key);
    if (
      !existing ||
      (row.verdict === "verified" && existing.verdict !== "verified") ||
      (row.match && !existing.match)
    ) {
      best.set(key, row);
    }
  }

  return [...best.values()].sort(
    (a, b) => Date.parse(b.tweetAt) - Date.parse(a.tweetAt),
  );
}

// ---- Follower Simulator ----

export function computeFollowerSim(
  evidences: EvidenceRow[],
  unitUsd = 100,
): FollowerSimResult {
  const actionable = evidences.filter(
    (e) => e.intent === "S3_CLAIM_BUY" && e.pnl,
  );

  const totalInvested = actionable.length * unitUsd;
  let finalValue = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const e of actionable) {
    const roi = e.pnl!.roiPct;
    const value = unitUsd * (1 + roi / 100);
    finalValue += value;
    if (roi > 0) winCount++;
    else lossCount++;
  }

  const pnlUsd = finalValue - totalInvested;
  const roiPct = totalInvested > 0 ? (pnlUsd / totalInvested) * 100 : 0;

  return {
    unitUsd,
    totalInvested,
    finalValue: Math.round(finalValue * 100) / 100,
    pnlUsd: Math.round(pnlUsd * 100) / 100,
    roiPct: Math.round(roiPct * 10) / 10,
    winCount,
    lossCount,
    winRate: actionable.length > 0
      ? Math.round((winCount / actionable.length) * 100)
      : 0,
    signalCount: actionable.length,
  };
}

// ---- PnL Breakdown ----

export function computePnlBreakdown(
  tradeDecisions: (WalletTradeDecision & { chain: string })[],
  signals: ClassifiedSignal[],
): PnlBreakdownSummary {
  // Build set of tweeted token symbols
  const tweetedSymbols = new Set<string>();
  for (const s of signals) {
    if (s.intentLevel >= 2) {
      for (const t of s.tokens) {
        tweetedSymbols.add(normalizeSymbol(t.symbol));
      }
    }
  }

  const positions: PnlBreakdownRow[] = tradeDecisions
    .filter((d) => Math.abs(d.totalProfitUsd) > 0.01 || d.balanceUsd > 0.01)
    .sort((a, b) => Math.abs(b.totalProfitUsd) - Math.abs(a.totalProfitUsd))
    .slice(0, 15)
    .map((d) => ({
      symbol: d.tokenSymbol,
      chain: d.chain,
      realizedUsd: d.realizedProfitUsd,
      unrealizedUsd: d.unrealizedProfitUsd,
      tweeted: tweetedSymbols.has(normalizeSymbol(d.tokenSymbol)),
    }));

  const totalPnl = positions.reduce(
    (s, p) => s + p.realizedUsd + p.unrealizedUsd,
    0,
  );
  const tweetedPnl = positions
    .filter((p) => p.tweeted)
    .reduce((s, p) => s + p.realizedUsd + p.unrealizedUsd, 0);
  const alignmentPct =
    totalPnl !== 0 ? Math.round((tweetedPnl / totalPnl) * 100) : 0;

  return { totalPnl, tweetedPnl, alignmentPct, positions };
}
