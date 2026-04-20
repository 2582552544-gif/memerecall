/**
 * KOL Discovery Agent
 *
 * Fetches KOL-tagged wallets from GMGN ranking API.
 * Uses tag=kol (100% twitter binding rate) as primary source.
 * Builds AgentSubject[] with twitter handle + wallet binding.
 */

import type { AgentSubject } from "../agent-catalog";
import type { DiscoveredKOL } from "../leaderboard-types";
import { runBb } from "../gmgn-utils";

interface GmgnRankWallet {
  wallet_address: string;
  address: string;
  twitter_username: string;
  twitter_name: string;
  name: string;
  realized_profit_7d: string;
  realized_profit_30d: string;
  winrate_7d: number;
  winrate_30d: number;
  buy_7d: number;
  sell_7d: number;
  volume_7d?: string;
  balance: string;
  tags: string[];
  follow_count: number;
  remark_count: number;
  last_active: number;
}

interface GmgnRankResponse {
  code: number;
  msg: string;
  data: {
    rank: GmgnRankWallet[];
  };
}

export async function discoverKOLs(
  chain = "sol",
  limit = 10,
  tag = "kol",
  orderby = "pnl_7d",
): Promise<DiscoveredKOL[]> {
  const url =
    `https://gmgn.ai/defi/quotation/v1/rank/${chain}/wallets/7d` +
    `?orderby=${orderby}&direction=desc&tag=${tag}&limit=${limit}`;

  console.log(`[discovery] Fetching ${limit} KOLs (tag=${tag}) from GMGN (${chain})...`);

  const raw = await runBb(["bb-browser", "fetch", url]);

  let response: GmgnRankResponse;
  try {
    response = JSON.parse(raw);
  } catch {
    const lastBracket = raw.lastIndexOf("}]");
    if (lastBracket > 0) {
      response = JSON.parse(raw.slice(0, lastBracket + 2) + "}}");
    } else {
      throw new Error("[discovery] Failed to parse GMGN rank response");
    }
  }

  if (response.code !== 0) {
    throw new Error(`[discovery] GMGN API error: ${response.msg}`);
  }

  const wallets = response.data.rank.filter((w) => w.twitter_username);

  console.log(
    `[discovery] Found ${wallets.length}/${response.data.rank.length} with twitter`,
  );

  return wallets.map((w) => ({
    handle: w.twitter_username,
    walletAddress: w.wallet_address,
    chain,
    name: w.name || w.twitter_name || w.twitter_username,
    followers: w.follow_count || w.remark_count || 0,
    realizedProfit7d: Number.parseFloat(w.realized_profit_7d) || 0,
    winrate7d: w.winrate_7d || 0,
    buy7d: w.buy_7d || 0,
    sell7d: w.sell_7d || 0,
    volume7d: Number.parseFloat(w.volume_7d || "0") || 0,
    tags: w.tags || [],
  }));
}

/** @deprecated Use discoverKOLs instead */
export const discoverRenownedKOLs = discoverKOLs;

export function discoveredToSubjects(kols: DiscoveredKOL[]): AgentSubject[] {
  return kols.map((kol) => ({
    handle: kol.handle,
    wallets: [
      {
        address: kol.walletAddress,
        chain: kol.chain,
        label: `GMGN ${kol.tags.includes("kol") ? "kol" : "smart_money"}`,
        confirmation: "confirmed" as const,
      },
    ],
    label: kol.name,
    walletAddress: kol.walletAddress,
    chain: kol.chain,
  }));
}
