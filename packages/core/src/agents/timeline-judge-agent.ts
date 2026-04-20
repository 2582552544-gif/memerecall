import { analyzeKolByWallet } from "./kol-analysis-agent";
import { collectSocialSignalsForHandle } from "./gmgn-social-agent";
import { collectGmgnActivityRows } from "./gmgn-activity-agent";
import type { TimelineAnalysisReport, TimelineJudgement } from "../social-types";

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesTokenName(signalText: string, tokenName: string): boolean {
  const haystack = ` ${normalizeText(signalText)} `;
  const needle = ` ${normalizeText(tokenName)} `;
  return needle.trim().length >= 4 && haystack.includes(needle);
}

function judgeVerdict(
  matchedTrade: boolean,
  status: "holding" | "cleared" | "none",
  totalProfitUsd: number | null,
): TimelineJudgement["verdict"] {
  if (!matchedTrade) return "no_match";
  if (status === "holding") return "open_position";
  if ((totalProfitUsd || 0) > 0) return "matched_profitable";
  return "matched_loss";
}

export async function buildTimelineAnalysis(
  handle: string,
  walletAddress: string,
  chain = "sol",
): Promise<TimelineAnalysisReport> {
  const [socialSignals, walletReport, activityRows] = await Promise.all([
    collectSocialSignalsForHandle(handle, 100),
    analyzeKolByWallet(walletAddress, chain),
    collectGmgnActivityRows(walletAddress, chain, 40),
  ]);

  const judgements: TimelineJudgement[] = socialSignals.map((signal) => {
    const tokenCandidate = signal.tokens.find(
      (item) => item.chain === chain || item.chain === "unknown",
    );

    const matched = walletReport.tradeDecisions.find((row) => {
      if (tokenCandidate?.address.startsWith("0x")) {
        return normalizeAddress(row.tokenAddress) === normalizeAddress(tokenCandidate.address);
      }

      if (tokenCandidate && tokenCandidate.address === tokenCandidate.symbol) {
        return row.tokenSymbol.toUpperCase() === tokenCandidate.symbol.toUpperCase();
      }

      return (
        row.tokenSymbol.toUpperCase() === tokenCandidate?.symbol?.toUpperCase() ||
        includesTokenName(signal.text, row.tokenName) ||
        includesTokenName(signal.text, row.tokenSymbol)
      );
    });

    const activityMatch = activityRows.find((row) => {
      if (!row.tokenSymbol) return false;
      return (
        row.tokenSymbol.toUpperCase() === tokenCandidate?.symbol?.toUpperCase() ||
        includesTokenName(signal.text, row.tokenSymbol)
      );
    });

    if (!matched) {
      return {
        signalId: signal.id,
        signalCreatedAt: signal.createdAt,
        tokenSymbol: tokenCandidate?.symbol || "N/A",
        tokenAddress: tokenCandidate?.address || "N/A",
        matchedTrade: false,
        matchedTradeStatus: "none",
        holdMinutes: null,
        totalProfitUsd: null,
        totalProfitPct: null,
        timeDeltaMinutes: null,
        verdict: "no_match",
        explanation: activityMatch
          ? `Activity row found (${activityMatch.relativeTime}) but no holdings result match yet.`
          : "No matching token was found in holdings or activity rows by contract, symbol, or token name.",
      };
    }

    const timeDeltaMinutes = Math.round((matched.lastActiveTimestamp * 1000 - signal.timestampMs) / 60000);
    const verdict = judgeVerdict(true, matched.status, matched.totalProfitUsd);
    const explanation =
      verdict === "matched_profitable"
        ? "The referenced token appears in wallet holdings with a positive result."
        : verdict === "matched_loss"
          ? "The referenced token appears in wallet holdings with a negative result."
          : "The referenced token is still an open position in the wallet.";

    return {
      signalId: signal.id,
      signalCreatedAt: signal.createdAt,
      tokenSymbol: matched.tokenSymbol,
      tokenAddress: matched.tokenAddress,
      matchedTrade: true,
      matchedTradeStatus: matched.status,
      holdMinutes: matched.holdMinutes,
      totalProfitUsd: matched.totalProfitUsd,
      totalProfitPct: matched.totalProfitPct,
      timeDeltaMinutes,
      verdict,
      explanation,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    subjectHandle: handle.replace(/^@/, ""),
    walletAddress,
    socialHistoryCount: socialSignals.length,
    socialSignals,
    activityRows,
    judgements,
  };
}
