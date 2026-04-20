import type { SocialInvestmentPick, WalletOnlyInvestmentTrade } from "./social-investment-types";
import type { EvidenceRow, FollowerSimResult, PnlBreakdownSummary } from "./evidence-types";

// --- Action Tiers (5 档替代二元 verdict) ---

export type ActionTier =
  | "auto_copy"
  | "watchlist"
  | "narrative_only"
  | "avoid"
  | "insufficient_data";

// --- Red Flags ---

export type RedFlag =
  | "CHAIN_MISMATCH"
  | "CLAIMED_BUY_NO_TRADE"
  | "MICRO_WALLET"
  | "CELEBRITY_FOMO_TRIGGER"
  | "UNDISCLOSED_AFFILIATE"
  | "QUICK_FLIP_AFTER_SHILL"
  | "SELF_CONTRADICTION";

// --- Signal Intent Classification (S0-S4) ---

export type IntentLevel = 0 | 1 | 2 | 3 | 4;

export interface ClassifiedSignal {
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  createdAt: string;
  intentLevel: IntentLevel;
  positionClaim: "claimed_buy" | "claimed_exit" | "denied" | "neutral";
  tokens: Array<{
    symbol: string;
    address?: string;
    chain: string;
  }>;
  narrativeCategory: string;
  isNoise: boolean;
  reasoning: string;
}

// --- Four-Dimensional Scoring ---

export interface KOLScores {
  composite: number;
  authenticity: number;
  followerAlpha: number | null;
  coverage: number;
  discipline: number;
}

// --- Chain Coverage ---

export interface ChainCoverage {
  signalChains: Record<string, number>;
  walletChains: Record<string, number>;
  missingChains: string[];
}

// --- Signal Stats ---

export interface SignalStats {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  total: number;
}

// --- Wallet Summary ---

export interface WalletSummary {
  address: string;
  chain: string;
  confirmation: "confirmed" | "suggested";
  tradeCount: number;
  pnlUsd: number;
  balanceUsd: number;
}

// --- Full KOL Report ---

export interface KOLReport {
  generatedAt: string;
  agentVersion: string;

  kol: {
    handle: string;
    followers: number;
    displayName: string;
  };

  scores: KOLScores;
  action: ActionTier;
  signalStats: SignalStats;

  topInsights: string[];
  thesis: string;
  redFlags: RedFlag[];

  chainCoverage: ChainCoverage;
  classifiedSignals: ClassifiedSignal[];
  picks: SocialInvestmentPick[];
  walletOnlyTrades: WalletOnlyInvestmentTrade[];
  walletSummaries: WalletSummary[];

  // Evidence-first analysis (v2.1)
  evidences?: EvidenceRow[];
  followerSim?: FollowerSimResult;
  pnlBreakdown?: PnlBreakdownSummary;
}
