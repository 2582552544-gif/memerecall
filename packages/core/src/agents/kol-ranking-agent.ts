/**
 * KOL Ranking Agent
 *
 * Computes RankScore from KOLReport and sorts into S/A/B tiers.
 * Formula: log(1 + MedianROI) × (WinRate / 0.5) × (Auth/100)² × P_risk × P_sample
 */

import type { KOLReport, RedFlag } from "../kol-report-types";
import type { DiscoveredKOL } from "../leaderboard-types";
import type { Leaderboard, LeaderboardEntry, LeaderboardTier } from "../leaderboard-types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeRiskPenalty(redFlags: RedFlag[]): number {
  if (redFlags.includes("QUICK_FLIP_AFTER_SHILL")) return 0.1;
  if (redFlags.includes("CLAIMED_BUY_NO_TRADE")) return 0.5;
  if (redFlags.includes("UNDISCLOSED_AFFILIATE")) return 0.6;
  if (redFlags.includes("SELF_CONTRADICTION")) return 0.7;
  if (redFlags.includes("MICRO_WALLET")) return 0.8;
  return 1.0;
}

function computeRankScore(report: KOLReport): {
  rankScore: number;
  medianROI: number | null;
  winRate: number;
  verifiedSignals: number;
} {
  // Verified signals = picks with actual wallet match
  const verified = report.picks.filter(
    (p) => p.matchType !== "none" && p.walletAction !== "no_wallet_trade",
  );

  // Median ROI of verified signals
  const rois = verified
    .map((p) => p.aggregateProfitPct)
    .filter((v): v is number => v !== null);
  const medianROI = rois.length > 0 ? median(rois) : null;

  // Win rate
  const wins = verified.filter((p) => (p.aggregateProfitUsd || 0) > 0).length;
  const winRate = verified.length > 0 ? wins / verified.length : 0;

  // Sample penalty: need at least 10 verified signals for full score
  const pSample = Math.min(1, verified.length / 10);

  // Risk penalty
  const pRisk = computeRiskPenalty(report.redFlags);

  // Authenticity squared (penalize fraud harder)
  const authFactor = Math.pow(report.scores.authenticity / 100, 2);

  // Win rate factor
  const wrFactor = winRate / 0.5; // 50% WR = 1.0x, 70% = 1.4x

  // Log(1 + medianROI) — prevents extreme values from dominating
  const roiFactor = medianROI !== null ? Math.log(1 + Math.max(0, medianROI / 100)) : 0;

  // Final score (0-100 normalized)
  let rankScore = roiFactor * wrFactor * authFactor * pRisk * pSample * 100;

  // Fallback for KOLs with no verified signals: use GMGN data as proxy
  if (verified.length === 0 && report.scores.composite > 0) {
    rankScore = report.scores.composite * pRisk * 0.3; // Heavy discount
  }

  return {
    rankScore: Math.max(0, Math.min(100, Math.round(rankScore * 10) / 10)),
    medianROI,
    winRate: Math.round(winRate * 100),
    verifiedSignals: verified.length,
  };
}

function determineTier(rankScore: number, redFlags: RedFlag[]): LeaderboardTier {
  if (redFlags.includes("QUICK_FLIP_AFTER_SHILL")) return "B";
  if (rankScore >= 70) return "S";
  if (rankScore >= 40) return "A";
  return "B";
}

export function buildLeaderboard(
  reports: KOLReport[],
  gmgnDataMap?: Map<string, DiscoveredKOL>,
): Leaderboard {
  const entries: LeaderboardEntry[] = reports
    .map((report) => {
      const { rankScore, medianROI, winRate, verifiedSignals } = computeRankScore(report);
      const gmgn = gmgnDataMap?.get(report.kol.handle);
      const tier = determineTier(rankScore, report.redFlags);

      // Signal frequency: S3+S4 count (actionable signals)
      const signalFrequency = report.signalStats.s3 + report.signalStats.s4;

      // Chains: from wallet summaries
      const chains = report.walletSummaries.map((w) => w.chain);

      return {
        rank: 0, // Will be set after sorting
        handle: report.kol.handle,
        displayName: report.kol.displayName,
        tier,
        action: report.action,
        rankScore,
        scores: report.scores,
        medianROI,
        winRate,
        signalFrequency,
        chains: [...new Set(chains)],
        redFlagCount: report.redFlags.length,
        redFlags: report.redFlags,
        verifiedSignals,
        gmgnProfit7d: gmgn?.realizedProfit7d || 0,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);

  // Assign ranks
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    kolCount: entries.length,
    discoveredCount: 0,
    prefilterPassedCount: 0,
    analyzedCount: reports.length,
    entries,
  };
}
