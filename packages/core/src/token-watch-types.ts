export type SupportedChain = "sol" | "bsc" | "base";

export interface WatchlistToken {
  id: string;
  chain: SupportedChain;
  address: string;
  symbol?: string;
  name?: string;
  note?: string;
  enabled: boolean;
  thresholdPct: number;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
  lastSnapshotAt?: string | null;
  lastSnapshotPrice?: number | null;
  lastNotifyAt?: string | null;
  lastNotifyPrice?: number | null;
  signalScore?: number | null;
  signalLabel?: "strong" | "watch" | "weak" | null;
  factorBreakdown?: WatchSignalFactor[] | null;
}

export interface PriceSnapshot {
  id: string;
  tokenId: string;
  chain: SupportedChain;
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number | null;
  holderCount: number | null;
  marketCapUsd: number | null;
  volume30mUsd: number | null;
  capturedAt: string;
}

export interface PriceNotifyEvent {
  id: string;
  tokenId: string;
  chain: SupportedChain;
  address: string;
  symbol: string;
  name: string;
  previousPriceUsd: number;
  currentPriceUsd: number;
  changePct: number;
  thresholdPct: number;
  liquidityUsd: number | null;
  volume30mUsd: number | null;
  holderCount: number | null;
  createdAt: string;
  status: "dry_run" | "sent" | "skipped_cooldown" | "failed";
  telegramMessageId?: number | null;
  error?: string | null;
}

export interface WatchCycleResult {
  generatedAt: string;
  dryRun: boolean;
  checked: number;
  alerts: PriceNotifyEvent[];
  snapshots: PriceSnapshot[];
  notes: string[];
}

export interface TokenChartPoint {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volumeUsd: number;
}

export interface TokenChartResponse {
  chain: SupportedChain;
  address: string;
  resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  from: number;
  to: number;
  source: "gmgn_kline" | "local_snapshot" | "empty";
  points: TokenChartPoint[];
  metrics: Array<{
    label: "5m" | "30m" | "5h" | "24h";
    changePct: number | null;
  }>;
  notes: string[];
}

export interface WatchSignalFactor {
  key:
    | "price_momentum"
    | "liquidity_quality"
    | "holder_quality"
    | "flow_quality"
    | "kol_alignment"
    | "freshness";
  label: string;
  score: number;
  weight: number;
  note: string;
}

export interface WatchSignalAggregate {
  tokenId: string;
  chain: SupportedChain;
  address: string;
  symbol: string;
  name: string;
  signalScore: number;
  signalLabel: "strong" | "watch" | "weak";
  factorBreakdown: WatchSignalFactor[];
  notes: string[];
}
