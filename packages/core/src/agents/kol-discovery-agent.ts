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

/**
 * Lookup a single KOL by twitter handle.
 * Strategy: GMGN ranking API (kol → smart_money) → gmgn-cli track kol fallback.
 */
export async function lookupKolByHandle(
  handle: string,
  chain = "sol",
): Promise<DiscoveredKOL | null> {
  const normalized = handle.replace(/^@/, "").trim().toLowerCase();
  if (!normalized) return null;

  // 1. GMGN KOL ranking (top 200)
  console.log(`[discovery] Looking up @${normalized} in GMGN KOL ranking...`);
  try {
    const kols = await discoverKOLs(chain, 200, "kol", "pnl_7d");
    const match = kols.find((k) => k.handle.toLowerCase() === normalized);
    if (match) {
      console.log(`[discovery] Found @${normalized}: wallet=${match.walletAddress}`);
      return match;
    }
  } catch (err) {
    console.error(`[discovery] KOL ranking lookup failed:`, err instanceof Error ? err.message : err);
  }

  // 2. GMGN smart_money ranking (top 200)
  console.log(`[discovery] Trying smart_money ranking...`);
  try {
    const smartMoney = await discoverKOLs(chain, 200, "smart_money", "pnl_7d");
    const smMatch = smartMoney.find((k) => k.handle.toLowerCase() === normalized);
    if (smMatch) {
      console.log(`[discovery] Found @${normalized} in smart_money: wallet=${smMatch.walletAddress}`);
      return smMatch;
    }
  } catch (err) {
    console.error(`[discovery] smart_money ranking lookup failed:`, err instanceof Error ? err.message : err);
  }

  // 3. gmgn-cli track kol — recent KOL trades have twitter_username + wallet
  console.log(`[discovery] Trying gmgn-cli track kol...`);
  try {
    const raw = await runBb(["gmgn-cli", "track", "kol", "--chain", chain, "--limit", "200", "--raw"]);
    const data = JSON.parse(raw) as { list?: { maker: string; maker_info?: { twitter_username?: string; twitter_name?: string } }[] };
    if (data.list) {
      const found = data.list.find(
        (item) => item.maker_info?.twitter_username?.toLowerCase() === normalized,
      );
      if (found) {
        console.log(`[discovery] Found @${normalized} via gmgn-cli: wallet=${found.maker}`);
        return {
          handle: found.maker_info!.twitter_username!,
          walletAddress: found.maker,
          chain,
          name: found.maker_info?.twitter_name || normalized,
          followers: 0,
          realizedProfit7d: 0,
          winrate7d: 0,
          buy7d: 0,
          sell7d: 0,
          volume7d: 0,
          tags: ["kol"],
        };
      }
    }
  } catch (err) {
    console.error(`[discovery] gmgn-cli fallback failed:`, err instanceof Error ? err.message : err);
  }

  console.log(`[discovery] @${normalized} not found in any GMGN source`);
  return null;
}

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
