import { analyzeKolByWallet } from "./kol-analysis-agent";
import { collectGmgnActivityRows } from "./gmgn-activity-agent";
import { collectSocialSignalsForHandle } from "./gmgn-social-agent";
import type { ActivityRow } from "../activity-types";
import type { SocialSignal } from "../social-types";
import type { WalletTradeDecision } from "../gmgn-types";
import type {
  SocialInvestmentPick,
  SocialInvestmentReport,
  SocialInvestmentVerdict,
  SocialWalletMatchType,
  WalletOnlyInvestmentTrade,
} from "../social-investment-types";

interface ActivityGroup {
  tokenSymbol: string;
  tokenAddress: string | null;
  rows: ActivityRow[];
  buyCount: number;
  sellCount: number;
  buyUsd: number;
  sellUsd: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  latestPriceUsd: number | null;
}

function normalizeSymbol(value: string | null | undefined): string {
  return (value || "").trim().toUpperCase();
}

function normalizeAddress(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function toUsd(value: number | null | undefined): number {
  return Number.isFinite(value || 0) ? value || 0 : 0;
}

function isoFromSeconds(value: number | null): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

function groupActivities(rows: ActivityRow[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();

  for (const row of rows) {
    const key =
      normalizeAddress(row.tokenAddress) ||
      `symbol:${normalizeSymbol(row.tokenSymbol)}`;
    if (!key) continue;

    const current =
      groups.get(key) ||
      {
        tokenSymbol: row.tokenSymbol,
        tokenAddress: row.tokenAddress || null,
        rows: [],
        buyCount: 0,
        sellCount: 0,
        buyUsd: 0,
        sellUsd: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        latestPriceUsd: null,
      };

    current.rows.push(row);
    if (row.eventType === "buy") {
      current.buyCount += 1;
      current.buyUsd += toUsd(row.costUsd);
    }
    if (row.eventType === "sell") {
      current.sellCount += 1;
      current.sellUsd += toUsd(row.costUsd);
    }
    if (row.timestamp) {
      current.firstTimestamp =
        current.firstTimestamp === null
          ? row.timestamp
          : Math.min(current.firstTimestamp, row.timestamp);
      current.lastTimestamp =
        current.lastTimestamp === null
          ? row.timestamp
          : Math.max(current.lastTimestamp, row.timestamp);
    }
    current.latestPriceUsd = row.priceUsd ?? current.latestPriceUsd;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
}

function findActivityGroup(
  token: SocialSignal["tokens"][number],
  groups: ActivityGroup[],
): { group: ActivityGroup | null; matchType: SocialWalletMatchType } {
  const address = normalizeAddress(token.address);
  const symbol = normalizeSymbol(token.symbol);

  if (address && address !== normalizeAddress(token.symbol)) {
    const exact = groups.find((item) => normalizeAddress(item.tokenAddress) === address);
    if (exact) return { group: exact, matchType: "exact_contract" };
  }

  if (symbol && symbol !== "CA") {
    const bySymbol = groups.find((item) => normalizeSymbol(item.tokenSymbol) === symbol);
    if (bySymbol) return { group: bySymbol, matchType: "symbol" };
  }

  return { group: null, matchType: "none" };
}

function findTradeDecision(
  group: ActivityGroup | null,
  token: SocialSignal["tokens"][number],
  trades: WalletTradeDecision[],
): WalletTradeDecision | null {
  if (group?.tokenAddress) {
    const exact = trades.find(
      (item) => normalizeAddress(item.tokenAddress) === normalizeAddress(group.tokenAddress),
    );
    if (exact) return exact;
  }

  const symbol = normalizeSymbol(group?.tokenSymbol || token.symbol);
  return trades.find((item) => normalizeSymbol(item.tokenSymbol) === symbol) || null;
}

function inferWalletAction(group: ActivityGroup | null): SocialInvestmentPick["walletAction"] {
  if (!group || group.rows.length === 0) return "no_wallet_trade";
  if (group.buyCount > 0 && group.sellCount > 0) return "round_trip";
  if (group.buyCount > 0) return "bought";
  return "sold";
}

function inferTradeRelation(
  signal: SocialSignal,
  group: ActivityGroup | null,
): SocialInvestmentPick["tradeRelation"] {
  if (!group?.firstTimestamp || !group.lastTimestamp) return "no_trade";
  const postSeconds = Math.floor(signal.timestampMs / 1000);
  const firstDeltaMinutes = Math.round((group.firstTimestamp - postSeconds) / 60);
  const lastDeltaMinutes = Math.round((group.lastTimestamp - postSeconds) / 60);
  if (Math.abs(firstDeltaMinutes) <= 360 || Math.abs(lastDeltaMinutes) <= 360) return "same_window";
  if (group.lastTimestamp < postSeconds) return "before_post";
  return "after_post";
}

function scorePick(params: {
  matchType: SocialWalletMatchType;
  action: SocialInvestmentPick["walletAction"];
  relation: SocialInvestmentPick["tradeRelation"];
  aggregateProfitUsd: number | null;
  aggregateProfitPct: number | null;
  buyUsd: number;
  sellUsd: number;
}): number {
  let score = 15;
  if (params.matchType === "exact_contract") score += 35;
  if (params.matchType === "symbol") score += 20;
  if (params.action === "bought") score += 20;
  if (params.action === "round_trip") score += 12;
  if (params.action === "sold") score -= 15;
  if (params.action === "no_wallet_trade") score -= 25;
  if (params.relation === "same_window") score += 12;
  if (params.relation === "after_post") score += 8;
  if (params.relation === "before_post") score -= 4;
  if ((params.aggregateProfitUsd || 0) > 0) score += 10;
  if ((params.aggregateProfitUsd || 0) < 0) score -= 12;
  if ((params.aggregateProfitPct || 0) < -15) score -= 10;
  if (params.sellUsd > params.buyUsd && params.buyUsd > 0) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function verdictForPick(
  score: number,
  action: SocialInvestmentPick["walletAction"],
  aggregateStatus: SocialInvestmentPick["aggregateStatus"],
): SocialInvestmentVerdict {
  if (action === "no_wallet_trade") return "insufficient_evidence";
  if (action === "sold" || aggregateStatus === "cleared") return score >= 55 ? "watch_only" : "reject";
  if (score >= 72) return "follow_candidate";
  if (score >= 50) return "watch_only";
  return "reject";
}

function reasoningForPick(
  group: ActivityGroup | null,
  action: SocialInvestmentPick["walletAction"],
  relation: SocialInvestmentPick["tradeRelation"],
  decision: WalletTradeDecision | null,
): string {
  if (!group) {
    return "推文里出现了代币信号，但当前绑定钱包没有出现对应买卖记录。";
  }

  const relationText =
    relation === "same_window"
      ? "推文时间和钱包交易处在同一交易窗口"
      : relation === "after_post"
        ? "钱包交易发生在推文之后"
        : relation === "before_post"
          ? "钱包先交易，之后才出现推文"
          : "没有可比较的交易时间";

  const resultText = decision
    ? `持仓汇总结果为 ${decision.status}，总盈亏 ${decision.totalProfitUsd.toFixed(2)} USD (${decision.totalProfitPct.toFixed(1)}%).`
    : "当前只有逐笔交易证据，持仓汇总里没有对应结果。";

  return `${relationText}，钱包动作为 ${action}，买入 ${group.buyCount} 笔、卖出 ${group.sellCount} 笔。${resultText}`;
}

function buildPick(
  signal: SocialSignal,
  token: SocialSignal["tokens"][number],
  groups: ActivityGroup[],
  trades: WalletTradeDecision[],
): SocialInvestmentPick {
  const { group, matchType } = findActivityGroup(token, groups);
  const decision = findTradeDecision(group, token, trades);
  const action = inferWalletAction(group);
  const relation = inferTradeRelation(signal, group);
  const aggregateStatus = decision?.status || "unknown";
  const aggregateProfitUsd = decision?.totalProfitUsd ?? null;
  const aggregateProfitPct = decision?.totalProfitPct ?? null;
  const buyUsd = group?.buyUsd || 0;
  const sellUsd = group?.sellUsd || 0;
  const score = scorePick({
    matchType,
    action,
    relation,
    aggregateProfitUsd,
    aggregateProfitPct,
    buyUsd,
    sellUsd,
  });

  return {
    signalId: signal.id,
    signalCreatedAt: signal.createdAt,
    signalUrl: signal.url,
    signalText: signal.text.slice(0, 500),
    tokenSymbol: group?.tokenSymbol || token.symbol,
    tokenAddress: group?.tokenAddress || token.address,
    matchType,
    walletAction: action,
    firstTradeAt: isoFromSeconds(group?.firstTimestamp || null),
    lastTradeAt: isoFromSeconds(group?.lastTimestamp || null),
    buyCount: group?.buyCount || 0,
    sellCount: group?.sellCount || 0,
    buyUsd,
    sellUsd,
    realizedProxyUsd: sellUsd - buyUsd,
    latestPriceUsd: group?.latestPriceUsd || null,
    aggregateStatus,
    aggregateProfitUsd,
    aggregateProfitPct,
    tradeRelation: relation,
    confidenceScore: score,
    verdict: verdictForPick(score, action, aggregateStatus),
    reasoning: reasoningForPick(group, action, relation, decision),
  };
}

function uniquePicks(picks: SocialInvestmentPick[]): SocialInvestmentPick[] {
  const best = new Map<string, SocialInvestmentPick>();
  for (const pick of picks) {
    const key = normalizeAddress(pick.tokenAddress) || normalizeSymbol(pick.tokenSymbol);
    const current = best.get(key);
    if (!current || pick.confidenceScore > current.confidenceScore) {
      best.set(key, pick);
    }
  }
  return [...best.values()].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function buildWalletOnlyTrades(
  groups: ActivityGroup[],
  picks: SocialInvestmentPick[],
): WalletOnlyInvestmentTrade[] {
  const pickedKeys = new Set(
    picks.map((pick) => normalizeAddress(pick.tokenAddress) || normalizeSymbol(pick.tokenSymbol)),
  );

  return groups
    .filter((group) => {
      const key = normalizeAddress(group.tokenAddress) || normalizeSymbol(group.tokenSymbol);
      return !pickedKeys.has(key);
    })
    .slice(0, 8)
    .map((group) => ({
      tokenSymbol: group.tokenSymbol,
      tokenAddress: group.tokenAddress,
      firstTradeAt: isoFromSeconds(group.firstTimestamp),
      lastTradeAt: isoFromSeconds(group.lastTimestamp),
      buyUsd: group.buyUsd,
      sellUsd: group.sellUsd,
      buyCount: group.buyCount,
      sellCount: group.sellCount,
      reasoning: "钱包有真实交易，但最近推特样本里没有匹配到同名或同合约信号。",
    }));
}

function reportVerdict(picks: SocialInvestmentPick[]): {
  verdict: SocialInvestmentVerdict;
  confidenceScore: number;
  thesis: string;
} {
  const candidates = picks.filter((item) => item.verdict === "follow_candidate");
  const watch = picks.filter((item) => item.verdict === "watch_only");
  const score = Math.round(
    picks.length === 0
      ? 0
      : picks.reduce((sum, item) => sum + item.confidenceScore, 0) / picks.length,
  );

  if (candidates.length > 0) {
    return {
      verdict: "follow_candidate",
      confidenceScore: score,
      thesis: `发现 ${candidates.length} 个推特信号被钱包交易验证，可以进入小仓位跟踪候选。`,
    };
  }

  if (watch.length > 0) {
    return {
      verdict: "watch_only",
      confidenceScore: score,
      thesis: `有 ${watch.length} 个推特信号和钱包交易相关，但多数已经卖出或证据强度一般，适合观察。`,
    };
  }

  return {
    verdict: picks.length > 0 ? "reject" : "insufficient_evidence",
    confidenceScore: score,
    thesis:
      picks.length > 0
        ? "最近推特信号缺少当前钱包买入验证，作为跟投依据较弱。"
        : "最近推特样本没有可评估的代币信号。",
  };
}

export async function analyzeSocialInvestmentByKol(
  handle: string,
  walletAddress: string,
  chain = "sol",
): Promise<SocialInvestmentReport> {
  const [socialSignals, walletReport, activityRows] = await Promise.all([
    collectSocialSignalsForHandle(handle, 100),
    analyzeKolByWallet(walletAddress, chain),
    collectGmgnActivityRows(walletAddress, chain, 80),
  ]);

  const groups = groupActivities(activityRows);
  const rawPicks = socialSignals.flatMap((signal) =>
    signal.tokens.map((token) =>
      buildPick(signal, token, groups, walletReport.tradeDecisions),
    ),
  );
  const picks = uniquePicks(rawPicks).slice(0, 12);
  const walletOnlyTrades = buildWalletOnlyTrades(groups, picks);
  const verdict = reportVerdict(picks);

  return {
    generatedAt: new Date().toISOString(),
    subjectHandle: handle.replace(/^@/, ""),
    walletAddress,
    chain,
    ...verdict,
    socialSignalCount: socialSignals.length,
    walletActivityCount: activityRows.length,
    evaluatedSignalCount: rawPicks.length,
    picks,
    walletOnlyTrades,
    notes: [
      "This agent evaluates one thesis: invest based on a KOL's Twitter/X signal only when wallet activity confirms the signal.",
      "Wallet activity comes from GMGN OpenAPI wallet_activity; Twitter history comes from bird-twitter.",
      "The current wallet mapping validates the tracked wallet only. Other wallets owned by the same KOL require separate mapping.",
    ],
  };
}
