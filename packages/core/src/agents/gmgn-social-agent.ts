import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { runBb } from "../gmgn-utils";
import type { SocialSignal } from "../social-types";

type BirdTweet = {
  id: string;
  text: string;
  createdAt: string;
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
  conversationId?: string;
  inReplyToStatusId?: string;
  url?: string;
  author?: {
    username?: string;
    name?: string;
  };
  quotedTweet?: {
    id: string;
    text: string;
    createdAt: string;
    author?: {
      username?: string;
      name?: string;
    };
  };
};

type BirdUserTweetsResponse = {
  screen_name: string;
  user_id: string;
  tweets: BirdTweet[];
  nextCursor?: string;
};

const ADDRESS_REGEX = /\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const SYMBOL_REGEX = /\$([A-Za-z][A-Za-z0-9_]{1,15})\b/g;

function inferChainFromAddress(
  address: string,
): "eth" | "sol" | "bsc" | "base" | "unknown" {
  if (address.startsWith("0x")) return "eth";
  if (address.length >= 32 && address.length <= 44) return "sol";
  return "unknown";
}

function extractTokens(text: string): SocialSignal["tokens"] {
  const tokens: SocialSignal["tokens"] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(ADDRESS_REGEX)) {
    const address = match[1];
    if (seen.has(address)) continue;
    seen.add(address);
    tokens.push({
      symbol: "CA",
      address,
      chain: inferChainFromAddress(address),
    });
  }

  for (const match of text.matchAll(SYMBOL_REGEX)) {
    const symbol = match[1].toUpperCase();
    const key = `symbol:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({
      symbol,
      address: symbol,
      chain: "unknown",
    });
  }

  return tokens;
}

function toSignal(handle: string, tweet: BirdTweet): SocialSignal {
  const text = tweet.text || "";
  return {
    id: tweet.id,
    platform: "x",
    handle,
    type: tweet.inReplyToStatusId
      ? "reply"
      : tweet.quotedTweet
        ? "quote"
        : "tweet",
    createdAt: tweet.createdAt,
    timestampMs: Date.parse(tweet.createdAt),
    text,
    url: tweet.url || `https://x.com/${handle}/status/${tweet.id}`,
    likes: tweet.likeCount || 0,
    retweets: tweet.retweetCount || 0,
    tokens: extractTokens(
      [text, tweet.quotedTweet?.text || ""].filter(Boolean).join("\n"),
    ),
  };
}

function parseBirdJson(output: string): BirdUserTweetsResponse {
  try {
    return JSON.parse(output) as BirdUserTweetsResponse;
  } catch {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("bird user-tweets did not return a JSON payload.");
    }
    return JSON.parse(output.slice(start, end + 1)) as BirdUserTweetsResponse;
  }
}

function findMemeRecallRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const packagePath = path.join(current, "package.json");
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string };
        if (pkg.name === "memerecall") return current;
      } catch {
        // keep walking upward
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

async function writeSocialSignalCache(
  handle: string,
  signals: SocialSignal[],
): Promise<void> {
  try {
    const root = findMemeRecallRoot();
    const dir = path.join(root, "data", "social");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${handle}.json`), JSON.stringify(signals, null, 2), "utf8");
  } catch {
    // cache writes are best-effort
  }
}

async function readSocialSignalCache(handle: string): Promise<SocialSignal[]> {
  const root = findMemeRecallRoot();
  const directCache = path.join(root, "data", "social", `${handle}.json`);
  try {
    const cached = JSON.parse(await readFile(directCache, "utf8")) as SocialSignal[];
    if (Array.isArray(cached)) return cached;
  } catch {
    // try timeline cache below
  }

  const timelineCache = path.join(root, "data", "timeline", `${handle}.json`);
  const cachedTimeline = JSON.parse(await readFile(timelineCache, "utf8")) as {
    socialSignals?: SocialSignal[];
  };
  return cachedTimeline.socialSignals || [];
}

export async function collectSocialSignalsForHandle(
  handle: string,
  limit = 100,
): Promise<SocialSignal[]> {
  const normalized = handle.replace(/^@/, "");
  const maxPages = Math.min(10, Math.max(1, Math.ceil(limit / 20)));
  let output = "";
  try {
    output = await runBb([
      "bird",
      "user-tweets",
      normalized,
      "--json",
      "--count",
      String(limit),
      "--max-pages",
      String(maxPages),
    ]);
  } catch (error) {
    const cached = await readSocialSignalCache(normalized);
    if (cached.length > 0) return cached.slice(0, limit);
    throw error;
  }

  let payload: BirdUserTweetsResponse;
  try {
    payload = parseBirdJson(output);
  } catch (error) {
    const cached = await readSocialSignalCache(normalized);
    if (cached.length > 0) return cached.slice(0, limit);
    throw error;
  }

  const signals = (payload.tweets || [])
    .map((tweet) => toSignal(payload.screen_name || normalized, tweet))
    .sort((a, b) => b.timestampMs - a.timestampMs);
  await writeSocialSignalCache(normalized, signals);
  return signals;
}
