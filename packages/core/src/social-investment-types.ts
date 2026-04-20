export type SocialInvestmentVerdict =
  | "follow_candidate"
  | "watch_only"
  | "reject"
  | "insufficient_evidence";

export type SocialWalletMatchType =
  | "exact_contract"
  | "symbol"
  | "none";

export interface SocialInvestmentPick {
  signalId: string;
  signalCreatedAt: string;
  signalUrl: string;
  signalText: string;
  tokenSymbol: string;
  tokenAddress: string;
  matchType: SocialWalletMatchType;
  walletAction: "bought" | "sold" | "round_trip" | "no_wallet_trade";
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  buyCount: number;
  sellCount: number;
  buyUsd: number;
  sellUsd: number;
  realizedProxyUsd: number;
  latestPriceUsd: number | null;
  aggregateStatus: "holding" | "cleared" | "unknown";
  aggregateProfitUsd: number | null;
  aggregateProfitPct: number | null;
  tradeRelation: "before_post" | "after_post" | "same_window" | "no_trade";
  confidenceScore: number;
  verdict: SocialInvestmentVerdict;
  reasoning: string;
}

export interface WalletOnlyInvestmentTrade {
  tokenSymbol: string;
  tokenAddress: string | null;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  buyUsd: number;
  sellUsd: number;
  buyCount: number;
  sellCount: number;
  reasoning: string;
}

export interface SocialInvestmentReport {
  generatedAt: string;
  subjectHandle: string;
  walletAddress: string;
  chain: string;
  verdict: SocialInvestmentVerdict;
  confidenceScore: number;
  thesis: string;
  socialSignalCount: number;
  walletActivityCount: number;
  evaluatedSignalCount: number;
  picks: SocialInvestmentPick[];
  walletOnlyTrades: WalletOnlyInvestmentTrade[];
  notes: string[];
}
