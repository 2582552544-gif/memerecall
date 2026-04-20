import {
  fetchGmgnWalletHoldings,
  fetchGmgnWalletProfile,
} from "../gmgn-client";
import type {
  GmgnHoldingRow,
  KolAnalysisReport,
  KolAnalysisSummary,
  WalletTradeDecision,
} from "../gmgn-types";

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDecision(row: GmgnHoldingRow): WalletTradeDecision {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const end = row.end_holding_at || nowSeconds;
  const holdMinutes = Math.max(0, Math.round((end - row.start_holding_at) / 60));
  const balanceUsd = toNumber(row.usd_value);
  const status = balanceUsd > 0 ? "holding" : "cleared";

  return {
    tokenSymbol: row.token.symbol,
    tokenName: row.token.name,
    tokenAddress: row.token.token_address,
    status,
    holdMinutes,
    totalBuys: row.history_total_buys,
    totalSells: row.history_total_sells,
    realizedProfitUsd: toNumber(row.realized_profit),
    realizedProfitPct: toNumber(row.realized_profit_pnl) * 100,
    unrealizedProfitUsd: toNumber(row.unrealized_profit),
    totalProfitUsd: toNumber(row.total_profit),
    totalProfitPct: toNumber(row.total_profit_pnl) * 100,
    balanceUsd,
    buyCostUsd: toNumber(row.history_bought_cost),
    sellIncomeUsd: toNumber(row.history_sold_income),
    lastActiveTimestamp: row.last_active_timestamp,
    tags: row.wallet_token_tags || [],
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferStyleLabel(decisions: WalletTradeDecision[]): string {
  const avgHold = average(decisions.map((item) => item.holdMinutes));
  if (avgHold <= 60) return "micro-scalp trader";
  if (avgHold <= 360) return "short-term momentum trader";
  if (avgHold <= 1440) return "swing meme trader";
  return "longer-horizon holder";
}

function inferRiskLabel(decisions: WalletTradeDecision[]): string {
  const heavyLosses = decisions.filter((item) => item.totalProfitPct <= -70).length;
  const openRisk = decisions.filter((item) => item.status === "holding").length;
  if (heavyLosses >= 2) return "high drawdown tolerance";
  if (openRisk >= 3) return "moderate risk stacking";
  return "measured risk posture";
}

export interface MultiWalletReport {
  wallets: Array<{
    address: string;
    chain: string;
    profile: import("../gmgn-types").GmgnWalletProfile;
    tradeDecisions: WalletTradeDecision[];
  }>;
  /** All trade decisions merged, each with a `chain` field */
  allTradeDecisions: (WalletTradeDecision & { chain: string })[];
  summary: KolAnalysisSummary;
}

export async function analyzeKolMultiWallet(
  wallets: Array<{ address: string; chain: string }>,
): Promise<MultiWalletReport> {
  const walletResults = await Promise.all(
    wallets.map(async (w) => {
      const [profileResponse, holdingsResponse] = await Promise.all([
        fetchGmgnWalletProfile(w.address, w.chain),
        fetchGmgnWalletHoldings(w.address, w.chain, 20),
      ]);
      const decisions = holdingsResponse.code === 0
        ? holdingsResponse.data.list.map(toDecision)
        : [];
      return {
        address: w.address,
        chain: w.chain,
        profile: profileResponse.code === 0 ? profileResponse.data : null,
        tradeDecisions: decisions,
      };
    }),
  );

  const validWallets = walletResults.filter((w) => w.profile !== null) as Array<{
    address: string;
    chain: string;
    profile: import("../gmgn-types").GmgnWalletProfile;
    tradeDecisions: WalletTradeDecision[];
  }>;

  const allDecisions = validWallets.flatMap((w) =>
    w.tradeDecisions.map((d) => ({ ...d, chain: w.chain })),
  );

  const winCount = allDecisions.filter((d) => d.totalProfitUsd > 0).length;
  const lossCount = allDecisions.filter((d) => d.totalProfitUsd < 0).length;
  const openCount = allDecisions.filter((d) => d.status === "holding").length;
  const primary = validWallets[0];

  const summary: KolAnalysisSummary = {
    walletAddress: primary?.address || wallets[0]?.address || "",
    chain: primary?.chain || wallets[0]?.chain || "sol",
    displayName: primary?.profile?.name || primary?.profile?.twitter_name || primary?.address || "",
    twitterHandle: primary?.profile?.twitter_username || null,
    followers: primary?.profile?.followers_count || primary?.profile?.twitter_fans_num || 0,
    walletBalance: validWallets.reduce((s, w) => s + toNumber(w.profile.balance), 0),
    realizedProfit30d: validWallets.reduce((s, w) => s + (w.profile.realized_profit || 0), 0),
    pnl30d: primary?.profile?.pnl_30d ? primary.profile.pnl_30d * 100 : 0,
    totalTrackedTokens: allDecisions.length,
    winCount,
    lossCount,
    openCount,
    winRateFromResults: allDecisions.length > 0 ? Math.round((winCount / allDecisions.length) * 10000) / 100 : 0,
    avgHoldMinutes: Math.round(average(allDecisions.map((d) => d.holdMinutes))),
    bestTrade: allDecisions.slice().sort((a, b) => b.totalProfitUsd - a.totalProfitUsd)[0] || null,
    worstTrade: allDecisions.slice().sort((a, b) => a.totalProfitUsd - b.totalProfitUsd)[0] || null,
    styleLabel: inferStyleLabel(allDecisions),
    riskLabel: inferRiskLabel(allDecisions),
  };

  return {
    wallets: validWallets,
    allTradeDecisions: allDecisions,
    summary,
  };
}

export async function analyzeKolByWallet(
  walletAddress: string,
  chain = "sol",
): Promise<KolAnalysisReport> {
  const [profileResponse, holdingsResponse] = await Promise.all([
    fetchGmgnWalletProfile(walletAddress, chain),
    fetchGmgnWalletHoldings(walletAddress, chain, 20),
  ]);

  if (profileResponse.code !== 0) {
    throw new Error(`Wallet profile fetch failed: ${profileResponse.msg || profileResponse.message || profileResponse.code}`);
  }

  if (holdingsResponse.code !== 0) {
    throw new Error(`Wallet holdings fetch failed: ${holdingsResponse.reason || holdingsResponse.message || holdingsResponse.code}`);
  }

  const decisions = holdingsResponse.data.list.map(toDecision);
  const winCount = decisions.filter((item) => item.totalProfitUsd > 0).length;
  const lossCount = decisions.filter((item) => item.totalProfitUsd < 0).length;
  const openCount = decisions.filter((item) => item.status === "holding").length;
  const sortedByProfit = decisions.slice().sort((a, b) => b.totalProfitUsd - a.totalProfitUsd);
  const summary: KolAnalysisSummary = {
    walletAddress,
    chain,
    displayName: profileResponse.data.name || profileResponse.data.twitter_name || walletAddress,
    twitterHandle: profileResponse.data.twitter_username || null,
    followers: profileResponse.data.followers_count || profileResponse.data.twitter_fans_num || 0,
    walletBalance: toNumber(profileResponse.data.balance),
    realizedProfit30d: profileResponse.data.realized_profit,
    pnl30d: profileResponse.data.pnl_30d * 100,
    totalTrackedTokens: decisions.length,
    winCount,
    lossCount,
    openCount,
    winRateFromResults: decisions.length > 0 ? Math.round((winCount / decisions.length) * 10000) / 100 : 0,
    avgHoldMinutes: Math.round(average(decisions.map((item) => item.holdMinutes))),
    bestTrade: sortedByProfit[0] || null,
    worstTrade: sortedByProfit[sortedByProfit.length - 1] || null,
    styleLabel: inferStyleLabel(decisions),
    riskLabel: inferRiskLabel(decisions),
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "gmgn-bb-browser",
    summary,
    tradeDecisions: decisions,
    notes: [
      "This report uses the wallet page and holdings data from GMGN through bb-browser.",
      "The holdings endpoint provides per-token result aggregation, not raw transaction-by-transaction fills.",
      "For say-do consistency, the next layer is to align tweet timestamps with the wallet activity stream.",
    ],
  };
}
