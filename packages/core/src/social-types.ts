export interface SocialSignal {
  id: string;
  platform: "x";
  handle: string;
  type: string;
  createdAt: string;
  timestampMs: number;
  text: string;
  url: string;
  likes: number;
  retweets: number;
  tokens: Array<{
    symbol: string;
    address: string;
    chain: "eth" | "sol" | "bsc" | "base" | "unknown";
  }>;
}

export interface TimelineJudgement {
  signalId: string;
  signalCreatedAt: string;
  tokenSymbol: string;
  tokenAddress: string;
  matchedTrade: boolean;
  matchedTradeStatus: "holding" | "cleared" | "none";
  holdMinutes: number | null;
  totalProfitUsd: number | null;
  totalProfitPct: number | null;
  timeDeltaMinutes: number | null;
  verdict: "matched_profitable" | "matched_loss" | "open_position" | "no_match";
  explanation: string;
}

export interface TimelineAnalysisReport {
  generatedAt: string;
  subjectHandle: string;
  walletAddress: string;
  socialHistoryCount: number;
  socialSignals: SocialSignal[];
  activityRows: import("./activity-types").ActivityRow[];
  judgements: TimelineJudgement[];
}
