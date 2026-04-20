export interface GmgnWalletProfile {
  twitter_bind: boolean;
  twitter_fans_num: number;
  twitter_username: string | null;
  twitter_name: string | null;
  avatar: string | null;
  name: string | null;
  balance: string;
  realized_profit: number;
  pnl: number;
  pnl_7d: number;
  pnl_30d: number;
  buy_30d: number;
  sell_30d: number;
  buy: number;
  sell: number;
  followers_count: number;
  last_active_timestamp: number;
  updated_at: number | null;
  tags: string[];
}

export interface GmgnTokenMeta {
  token_address: string;
  symbol: string;
  name: string;
  logo: string;
  creation_timestamp: number;
  open_timestamp: number;
  price: string;
  liquidity: string;
  launchpad: string;
  launchpad_platform: string;
}

export interface GmgnHoldingRow {
  balance: string;
  usd_value: string;
  history_bought_cost: string;
  history_sold_income: string;
  history_total_buys: number;
  history_total_sells: number;
  realized_profit: string;
  realized_profit_pnl: string;
  unrealized_profit: string;
  unrealized_profit_pnl: string | null;
  total_profit: string;
  total_profit_pnl: string;
  start_holding_at: number;
  end_holding_at: number;
  last_active_timestamp: number;
  token: GmgnTokenMeta;
  wallet_token_tags: string[] | null;
}

export interface GmgnWalletProfileResponse {
  code: number;
  msg?: string;
  message?: string;
  data: GmgnWalletProfile;
}

export interface GmgnWalletHoldingsResponse {
  code: number;
  reason?: string;
  message?: string;
  data: {
    list: GmgnHoldingRow[];
    next?: string | null;
  };
}

export interface GmgnActivityToken {
  address: string;
  symbol: string;
  logo?: string;
  total_supply?: string;
}

export interface GmgnQuoteToken {
  token_address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface GmgnActivityRow {
  wallet: string;
  chain: string;
  tx_hash: string;
  timestamp: number;
  event_type: "buy" | "sell" | "add" | "remove" | "transfer" | string;
  token: GmgnActivityToken;
  token_amount: string;
  quote_amount: string;
  cost_usd: string;
  buy_cost_usd: string | null;
  price_usd: string;
  price: string;
  is_open_or_close: number;
  quote_token?: GmgnQuoteToken;
  quote_address?: string;
  from_address?: string;
  to_address?: string;
  gas_native?: string;
  gas_usd?: string;
  dex_native?: string;
  dex_usd?: string;
  priority_fee?: string;
  tip_fee?: string;
  launchpad?: string;
  launchpad_platform?: string;
}

export interface GmgnWalletActivityResponse {
  activities: GmgnActivityRow[];
  next?: string | null;
}

export interface GmgnTokenInfoResponse {
  address: string;
  symbol: string;
  name: string;
  decimals?: number;
  total_supply?: string;
  circulating_supply?: string;
  price: string;
  liquidity?: string;
  holder_count?: number;
  logo?: string;
  creation_timestamp?: number;
  open_timestamp?: number;
  biggest_pool_address?: string;
  launchpad?: string;
  launchpad_platform?: string;
  ath_price?: string;
  pool?: {
    pool_address?: string;
    quote_symbol?: string;
    exchange?: string;
    liquidity?: string;
  };
  stat?: {
    holder_count?: number;
    top_10_holder_rate?: number;
    bluechip_owner_count?: number;
    smart_degen_count?: number;
    renowned_count?: number;
  };
  wallet_tags_stat?: {
    smart_wallets?: number;
    renowned_wallets?: number;
    whale_wallets?: number;
    fresh_wallets?: number;
  };
}

export interface GmgnKlineRow {
  time: number;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  amount: string;
}

export interface GmgnKlineResponse {
  list: GmgnKlineRow[];
}

export interface GmgnPageCandlesResponse {
  code: number;
  reason?: string;
  message?: string;
  data: {
    list: Array<{
      time: number;
      open: string;
      close: string;
      high: string;
      low: string;
      volume: string;
      amount: string;
      source?: string;
    }>;
    _debug_tpool?: unknown;
    _debug_tpool_desc?: string;
  };
}

export interface WalletTradeDecision {
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  status: "holding" | "cleared";
  holdMinutes: number;
  totalBuys: number;
  totalSells: number;
  realizedProfitUsd: number;
  realizedProfitPct: number;
  unrealizedProfitUsd: number;
  totalProfitUsd: number;
  totalProfitPct: number;
  balanceUsd: number;
  buyCostUsd: number;
  sellIncomeUsd: number;
  lastActiveTimestamp: number;
  tags: string[];
}

export interface KolAnalysisSummary {
  walletAddress: string;
  chain: string;
  displayName: string;
  twitterHandle: string | null;
  followers: number;
  walletBalance: number;
  realizedProfit30d: number;
  pnl30d: number;
  totalTrackedTokens: number;
  winCount: number;
  lossCount: number;
  openCount: number;
  winRateFromResults: number;
  avgHoldMinutes: number;
  bestTrade: WalletTradeDecision | null;
  worstTrade: WalletTradeDecision | null;
  styleLabel: string;
  riskLabel: string;
}

export interface KolAnalysisReport {
  generatedAt: string;
  source: "gmgn-bb-browser";
  summary: KolAnalysisSummary;
  tradeDecisions: WalletTradeDecision[];
  notes: string[];
}
