import type { ActionTier, KOLScores, RedFlag } from "./kol-report-types";

export type LeaderboardTier = "S" | "A" | "B";

export type PrefilterStatus =
  | "passed"
  | "no_wallet"
  | "dead_wallet"
  | "inactive"
  | "chain_mismatch"
  | "micro_kol"
  | "spam_bot";

export interface PrefilterResult {
  handle: string;
  passed: boolean;
  gates: Record<string, boolean>;
  failureReason: PrefilterStatus | null;
}

export interface DiscoveredKOL {
  handle: string;
  walletAddress: string;
  chain: string;
  name: string;
  followers: number;
  realizedProfit7d: number;
  winrate7d: number;
  buy7d: number;
  sell7d: number;
  volume7d: number;
  tags: string[];
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  displayName: string;
  tier: LeaderboardTier;
  action: ActionTier;
  rankScore: number;
  scores: KOLScores;
  medianROI: number | null;
  winRate: number;
  signalFrequency: number;
  chains: string[];
  redFlagCount: number;
  redFlags: RedFlag[];
  verifiedSignals: number;
  gmgnProfit7d: number;
  followers: number;
  wallets: { address: string; chain: string }[];
  twitterUrl: string;
}

export interface Leaderboard {
  generatedAt: string;
  kolCount: number;
  discoveredCount: number;
  prefilterPassedCount: number;
  analyzedCount: number;
  entries: LeaderboardEntry[];
}
