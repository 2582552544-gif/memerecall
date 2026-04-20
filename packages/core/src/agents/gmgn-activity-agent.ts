import { fetchGmgnWalletActivity } from "../gmgn-client";
import type { ActivityRow } from "../activity-types";

function relativeTimeFromTimestamp(timestamp: number): string {
  const deltaSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (deltaSeconds < 60) return `${deltaSeconds}s`;
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d`;
}

export async function collectMultiChainActivityRows(
  wallets: Array<{ address: string; chain: string }>,
  limit = 30,
): Promise<(ActivityRow & { chain: string })[]> {
  const results = await Promise.all(
    wallets.map(async (w) => {
      const rows = await collectGmgnActivityRows(w.address, w.chain, limit);
      return rows.map((r) => ({ ...r, chain: w.chain }));
    }),
  );
  return results
    .flat()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit * wallets.length);
}

export async function collectGmgnActivityRows(
  walletAddress: string,
  chain = "sol",
  limit = 30,
): Promise<ActivityRow[]> {
  const response = await fetchGmgnWalletActivity(walletAddress, chain, limit);
  return response.activities.slice(0, limit).map((row) => {
    const txUrl =
      chain === "sol"
        ? `https://solscan.io/tx/${row.tx_hash}`
        : chain === "bsc"
          ? `https://bscscan.com/tx/${row.tx_hash}`
          : chain === "base"
            ? `https://basescan.org/tx/${row.tx_hash}`
            : null;
    const tokenUrl = `https://gmgn.ai/${chain}/token/${row.token.address}`;
    const walletUrl = `https://gmgn.ai/${chain}/address/${walletAddress}`;
    const timestampIso = new Date(row.timestamp * 1000).toISOString();
    const tokenAmount = row.token_amount || null;
    const costUsd = Number(row.cost_usd);
    const priceUsd = Number(row.price_usd);
    const buyCostUsd = row.buy_cost_usd ? Number(row.buy_cost_usd) : null;
    const quoteAmount = row.quote_amount || null;
    const quoteSymbol = row.quote_token?.symbol || null;

    return {
      relativeTime: relativeTimeFromTimestamp(row.timestamp),
      walletName: walletAddress,
      walletUrl,
      tokenSymbol: row.token.symbol,
      tokenUrl,
      txUrl,
      xSearchUrl: null,
      summaryText: `${row.event_type.toUpperCase()} ${row.token.symbol} ${tokenAmount || ""} for ${quoteAmount || ""} ${quoteSymbol || ""}`.trim(),
      txHash: row.tx_hash,
      eventType: row.event_type,
      timestamp: row.timestamp,
      timestampIso,
      tokenAddress: row.token.address,
      tokenAmount,
      quoteAmount,
      costUsd: Number.isFinite(costUsd) ? costUsd : null,
      buyCostUsd,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
      quoteSymbol,
      launchpad: row.launchpad || null,
      launchpadPlatform: row.launchpad_platform || null,
      amountText: tokenAmount,
      marketCapText: null,
    };
  });
}
