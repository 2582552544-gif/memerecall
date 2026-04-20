export type TradeMatchKind =
  | "buy_before_signal"
  | "immediate_buy"
  | "quick_buy"
  | "delayed_buy"
  | "late_entry";

export type EvidenceVerdict = "verified" | "unverified" | "contradicted";

export type EvidenceIntent = "S3_CLAIM_BUY" | "S4_CLAIM_SELL" | "S2_OPINION";

export interface EvidenceTradeMatch {
  kind: TradeMatchKind;
  deltaMinutes: number;
  txHash: string;
  txUrl: string;
  amountUsd: number;
  entryPrice: number;
}

export interface EvidencePnl {
  currentPrice: number;
  roiPct: number;
  realizedUsd: number | null;
  status: "holding" | "closed" | "rug";
}

export interface EvidenceRow {
  id: string;
  tweetAt: string;
  tweetText: string;
  tweetUrl: string;
  intent: EvidenceIntent;
  token: {
    symbol: string;
    address: string;
    chain: string;
  };
  match: EvidenceTradeMatch | null;
  pnl: EvidencePnl | null;
  verdict: EvidenceVerdict;
}

export interface FollowerSimResult {
  unitUsd: number;
  totalInvested: number;
  finalValue: number;
  pnlUsd: number;
  roiPct: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  signalCount: number;
}

export interface PnlBreakdownRow {
  symbol: string;
  chain: string;
  realizedUsd: number;
  unrealizedUsd: number;
  tweeted: boolean;
}

export interface PnlBreakdownSummary {
  totalPnl: number;
  tweetedPnl: number;
  alignmentPct: number;
  positions: PnlBreakdownRow[];
}
