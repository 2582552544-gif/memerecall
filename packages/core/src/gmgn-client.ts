import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type {
  GmgnPageCandlesResponse,
  GmgnKlineResponse,
  GmgnTokenInfoResponse,
  GmgnWalletActivityResponse,
  GmgnWalletHoldingsResponse,
  GmgnWalletProfileResponse,
} from "./gmgn-types";
import { runBb } from "./gmgn-utils";

async function bbFetchJson<T>(url: string): Promise<T> {
  const output = await runBb(["bb-browser", "fetch", url]);
  return JSON.parse(output) as T;
}

export async function fetchGmgnWalletProfile(
  walletAddress: string,
  chain: string,
): Promise<GmgnWalletProfileResponse> {
  return bbFetchJson<GmgnWalletProfileResponse>(
    `https://gmgn.ai/defi/quotation/v1/smartmoney/${chain}/walletNew/${walletAddress}`,
  );
}

export async function fetchGmgnWalletHoldings(
  walletAddress: string,
  chain: string,
  limit = 20,
): Promise<GmgnWalletHoldingsResponse> {
  return bbFetchJson<GmgnWalletHoldingsResponse>(
    `https://gmgn.ai/pf/api/v1/wallet/${chain}/${walletAddress}/holdings?limit=${limit}&order_by=last_active_timestamp&direction=desc&hide_small=false&sellout=true&hide_abnormal=false`,
  );
}

function requireGmgnApiKey(): string {
  const apiKey = process.env.GMGN_API_KEY?.trim();
  if (apiKey) {
    return apiKey;
  }

  const candidates = [
    path.join(homedir(), ".config", "gmgn", ".env"),
    path.join(homedir(), ".codex", "gmgn-cli", ".env"),
  ];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const match = raw.match(/^GMGN_API_KEY=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // ignore missing config files
    }
  }

  throw new Error("GMGN_API_KEY is required for wallet activity queries.");
}

function buildAuthQuery(): { timestamp: number; client_id: string } {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    client_id: crypto.randomUUID(),
  };
}

function buildUrl(base: string, query: Record<string, string | number>): string {
  const url = new URL(base);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function gmgnOpenApiFetch<T>(
  subPath: string,
  query: Record<string, string | number>,
): Promise<T> {
  const apiKey = requireGmgnApiKey();
  const { timestamp, client_id } = buildAuthQuery();
  const url = buildUrl(`https://openapi.gmgn.ai${subPath}`, {
    ...query,
    timestamp,
    client_id,
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-APIKEY": apiKey,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  if (!response.ok || text.trimStart().startsWith("<")) {
    throw new Error(`GMGN OpenAPI HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(text) as { code: number; message?: string; error?: string; data: T };
  if (parsed.code !== 0) {
    throw new Error(`GMGN OpenAPI request failed: ${parsed.message || parsed.error || parsed.code}`);
  }
  return parsed.data;
}

/**
 * Fetch wallet activity via bb-browser (with login session cookies).
 * Uses the same page API that profile/holdings use.
 * Falls back gracefully on failure — returns empty activities.
 */
export async function fetchGmgnWalletActivity(
  walletAddress: string,
  chain: string,
  limit = 20,
): Promise<GmgnWalletActivityResponse> {
  const url = `https://gmgn.ai/api/v1/wallet_activity/${chain}?type=buy&type=sell&wallet=${walletAddress}&limit=${limit}`;
  try {
    const result = await bbFetchJson<{ code: number; data: GmgnWalletActivityResponse }>(url);
    if (result.code !== 0 || !result.data) {
      console.warn(`[gmgn] wallet_activity code=${result.code} for ${walletAddress}`);
      return { activities: [] } as unknown as GmgnWalletActivityResponse;
    }
    return result.data;
  } catch (err) {
    console.warn(`[gmgn] wallet_activity failed for ${walletAddress}:`, err instanceof Error ? err.message : err);
    return { activities: [] } as unknown as GmgnWalletActivityResponse;
  }
}

export async function fetchGmgnTokenInfo(
  address: string,
  chain: string,
): Promise<GmgnTokenInfoResponse> {
  return gmgnOpenApiFetch<GmgnTokenInfoResponse>("/v1/token/info", {
    chain,
    address,
  });
}

export async function fetchGmgnTokenKline(
  address: string,
  chain: string,
  resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
  from?: number,
  to?: number,
): Promise<GmgnKlineResponse> {
  const query: Record<string, string | number> = {
    chain,
    address,
    resolution,
  };
  if (from !== undefined) query.from = from;
  if (to !== undefined) query.to = to;
  return gmgnOpenApiFetch<GmgnKlineResponse>("/v1/market/token_kline", query);
}

export async function fetchGmgnPageTokenMcapCandles(
  address: string,
  chain: string,
  resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
  limit = 501,
): Promise<GmgnPageCandlesResponse["data"]> {
  const query = new URLSearchParams({
    pool_type: "tpool",
    resolution,
    limit: String(limit),
  });

  const payload = await bbFetchJson<GmgnPageCandlesResponse>(
    `https://gmgn.ai/api/v1/token_mcap_candles/${chain}/${address}?${query.toString()}`,
  );

  if (payload.code !== 0) {
    throw new Error(`GMGN page API failed: ${payload.message || payload.reason || payload.code}`);
  }

  return payload.data;
}
