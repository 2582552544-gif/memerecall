export interface ActivityRow {
  relativeTime: string;
  walletName: string;
  walletUrl: string | null;
  tokenSymbol: string;
  tokenUrl: string | null;
  txUrl: string | null;
  xSearchUrl: string | null;
  summaryText: string;
  txHash?: string | null;
  eventType?: string | null;
  timestamp?: number | null;
  timestampIso?: string | null;
  tokenAddress?: string | null;
  tokenAmount?: string | null;
  quoteAmount?: string | null;
  costUsd?: number | null;
  buyCostUsd?: number | null;
  priceUsd?: number | null;
  quoteSymbol?: string | null;
  launchpad?: string | null;
  launchpadPlatform?: string | null;
  marketCapText?: string | null;
  amountText?: string | null;
}
