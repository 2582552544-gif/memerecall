export interface ScoreFactor {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  note: string;
}

export interface EvidenceItem {
  id: string;
  type: "tweet" | "trade" | "wallet_link" | "holder" | "volume" | "security" | "timeline" | "alert";
  title: string;
  detail: string;
  timestamp: string;
  source: string;
}

export interface KOLProfile {
  id: string;
  handle: string;
  displayName: string;
  primaryWallet: string;
  walletConfidence: number;
  followerBucket: string;
  labels: string[];
  riskFlags: string[];
  score: number;
  sayDoScore: number;
  winRateScore: number;
  rugScore: number;
  bundlerScore: number;
  timingScore: number;
  factors: ScoreFactor[];
  evidence: EvidenceItem[];
  sampleCalls: number;
  wins24h: number;
  dumpChains: number;
}

export interface TokenProfile {
  id: string;
  contract: string;
  symbol: string;
  name: string;
  lifecycleStage: "dead" | "reviving" | "watch" | "active";
  score: number;
  holderGrowthScore: number;
  volumeRecoveryScore: number;
  kolReentryScore: number;
  bundlerCleanlinessScore: number;
  liquidityReturnScore: number;
  narrativeScore: number;
  factors: ScoreFactor[];
  timeline: EvidenceItem[];
  alerts: string[];
  tags: string[];
}

export interface DashboardSummary {
  totalKols: number;
  totalTokens: number;
  highTrustCount: number;
  highRevivalCount: number;
  dumperEvidenceChains: number;
  revivalCases: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  topKols: KOLProfile[];
  topTokens: TokenProfile[];
  latestAlerts: EvidenceItem[];
}
