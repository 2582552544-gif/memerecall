import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMemeRecallConfig } from "../config";
import { fetchGmgnPageTokenMcapCandles, fetchGmgnTokenInfo, fetchGmgnTokenKline } from "../gmgn-client";
import { aggregateWatchSignal } from "./watch-signal-aggregator";
import type {
  PriceNotifyEvent,
  PriceSnapshot,
  SupportedChain,
  TokenChartResponse,
  WatchCycleResult,
  WatchlistToken,
} from "../token-watch-types";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pctChange(previous: number, current: number): number {
  if (!Number.isFinite(previous) || previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatUsd(value: number | null): string {
  if (value === null) return "n/a";
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${value.toPrecision(4)}`;
}

function parseRequiredNumber(value: string | number | null | undefined): number {
  return toNumber(value) ?? 0;
}

function isoToMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeChartTimeMs(value: number): number {
  return value > 10_000_000_000 ? value : value * 1000;
}

function buildChartMetrics(points: TokenChartResponse["points"]): TokenChartResponse["metrics"] {
  const windows = [
    { label: "5m" as const, ms: 5 * 60 * 1000 },
    { label: "30m" as const, ms: 30 * 60 * 1000 },
    { label: "5h" as const, ms: 5 * 60 * 60 * 1000 },
    { label: "24h" as const, ms: 24 * 60 * 60 * 1000 },
  ];

  if (points.length < 2) {
    return windows.map((window) => ({ label: window.label, changePct: null }));
  }

  const normalized = points
    .map((point) => ({ ...point, time: normalizeChartTimeMs(point.time) }))
    .sort((a, b) => a.time - b.time);
  const latest = normalized[normalized.length - 1];

  return windows.map((window) => {
    const targetTime = latest.time - window.ms;
    let candidate = normalized[0];

    for (const point of normalized) {
      if (point.time <= targetTime) {
        candidate = point;
        continue;
      }
      break;
    }

    if (!candidate?.close || candidate.time === latest.time) {
      return { label: window.label, changePct: null };
    }

    return {
      label: window.label,
      changePct: pctChange(candidate.close, latest.close),
    };
  });
}

function watchDir(): string {
  return getMemeRecallConfig().watchDataDir;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function watchlistPath(): string {
  return path.join(watchDir(), "watchlist.json");
}

function snapshotsPath(): string {
  return path.join(watchDir(), "snapshots.json");
}

function eventsPath(): string {
  return path.join(watchDir(), "notify-events.json");
}

export async function listWatchlistTokens(): Promise<WatchlistToken[]> {
  return readJsonFile<WatchlistToken[]>(watchlistPath(), []);
}

export async function getLatestWatchEvents(): Promise<PriceNotifyEvent[]> {
  return readJsonFile<PriceNotifyEvent[]>(eventsPath(), []);
}

async function saveWatchlist(tokens: WatchlistToken[]): Promise<void> {
  await writeJsonFile(watchlistPath(), tokens);
}

async function appendSnapshots(snapshots: PriceSnapshot[]): Promise<void> {
  const existing = await readJsonFile<PriceSnapshot[]>(snapshotsPath(), []);
  await writeJsonFile(snapshotsPath(), [...existing, ...snapshots].slice(-5000));
}

async function appendEvents(events: PriceNotifyEvent[]): Promise<void> {
  const existing = await readJsonFile<PriceNotifyEvent[]>(eventsPath(), []);
  await writeJsonFile(eventsPath(), [...existing, ...events].slice(-1000));
}

async function readSnapshots(): Promise<PriceSnapshot[]> {
  return readJsonFile<PriceSnapshot[]>(snapshotsPath(), []);
}

function latestSnapshotForToken(
  token: WatchlistToken,
  snapshots: PriceSnapshot[],
): PriceSnapshot | null {
  return (
    snapshots
      .filter(
        (snapshot) =>
          snapshot.chain === token.chain &&
          snapshot.address.toLowerCase() === token.address.toLowerCase(),
      )
      .sort((a, b) => isoToMs(b.capturedAt) - isoToMs(a.capturedAt))[0] || null
  );
}

export async function listWatchlistTokensWithSignals(): Promise<WatchlistToken[]> {
  const [tokens, snapshots] = await Promise.all([
    listWatchlistTokens(),
    readSnapshots(),
  ]);

  const enriched = await Promise.all(
    tokens.map(async (token) => {
      const snapshot = latestSnapshotForToken(token, snapshots);
      const chart = await getTokenChart({
        chain: token.chain,
        address: token.address,
        resolution: "5m",
        lookbackMinutes: 180,
      }).catch(() => null);
      const signal = aggregateWatchSignal({
        token: {
          ...token,
          symbol: token.symbol || snapshot?.symbol,
          name: token.name || snapshot?.name,
        },
        snapshot,
        chart,
      });

      return {
        ...token,
        symbol: token.symbol || snapshot?.symbol,
        name: token.name || snapshot?.name,
        signalScore: signal.signalScore,
        signalLabel: signal.signalLabel,
        factorBreakdown: signal.factorBreakdown,
      };
    }),
  );

  return enriched;
}

export async function addWatchlistToken(input: {
  chain: SupportedChain;
  address: string;
  symbol?: string;
  name?: string;
  note?: string;
  thresholdPct?: number;
  cooldownMinutes?: number;
}): Promise<WatchlistToken> {
  const tokens = await listWatchlistTokens();
  const existing = tokens.find(
    (item) => item.chain === input.chain && item.address.toLowerCase() === input.address.toLowerCase(),
  );
  const timestamp = nowIso();

  if (existing) {
    const updated = {
      ...existing,
      symbol: input.symbol || existing.symbol,
      name: input.name || existing.name,
      note: input.note ?? existing.note,
      thresholdPct: input.thresholdPct ?? existing.thresholdPct,
      cooldownMinutes: input.cooldownMinutes ?? existing.cooldownMinutes,
      enabled: true,
      updatedAt: timestamp,
    };
    await saveWatchlist(tokens.map((item) => (item.id === existing.id ? updated : item)));
    return updated;
  }

  const token: WatchlistToken = {
    id: makeId("watch"),
    chain: input.chain,
    address: input.address,
    symbol: input.symbol,
    name: input.name,
    note: input.note,
    enabled: true,
    thresholdPct: input.thresholdPct ?? 20,
    cooldownMinutes: input.cooldownMinutes ?? 30,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSnapshotAt: null,
    lastSnapshotPrice: null,
    lastNotifyAt: null,
    lastNotifyPrice: null,
  };

  await saveWatchlist([...tokens, token]);
  return token;
}

export async function deleteWatchlistToken(input: {
  id?: string;
  chain?: SupportedChain;
  address?: string;
}): Promise<{ ok: true; deleted: WatchlistToken | null; remaining: number }> {
  const tokens = await listWatchlistTokens();
  const index = tokens.findIndex((item) => {
    if (input.id && item.id === input.id) return true;
    return Boolean(
      input.address &&
        input.chain &&
        item.chain === input.chain &&
        item.address.toLowerCase() === input.address.toLowerCase(),
    );
  });

  if (index < 0) {
    return { ok: true, deleted: null, remaining: tokens.length };
  }

  const [deleted] = tokens.splice(index, 1);
  await saveWatchlist(tokens);
  return { ok: true, deleted, remaining: tokens.length };
}

async function buildSnapshot(token: WatchlistToken): Promise<PriceSnapshot> {
  const info = await fetchGmgnTokenInfo(token.address, token.chain);
  const priceUsd = toNumber(info.price) ?? 0;
  const liquidityUsd = toNumber(info.liquidity ?? info.pool?.liquidity);
  const supply = toNumber(info.circulating_supply ?? info.total_supply);
  const holderCount = info.holder_count ?? info.stat?.holder_count ?? null;
  const marketCapUsd = supply && priceUsd ? supply * priceUsd : null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 30 * 60;
  let volume30mUsd: number | null = null;

  try {
    const kline = await fetchGmgnTokenKline(token.address, token.chain, "5m", from, to);
    volume30mUsd = kline.list.reduce((sum, row) => sum + (toNumber(row.volume) ?? 0), 0);
  } catch {
    volume30mUsd = null;
  }

  return {
    id: makeId("snap"),
    tokenId: token.id,
    chain: token.chain,
    address: token.address,
    symbol: info.symbol || token.symbol || token.address.slice(0, 6),
    name: info.name || token.name || info.symbol || token.address,
    priceUsd,
    liquidityUsd,
    holderCount,
    marketCapUsd,
    volume30mUsd,
    capturedAt: nowIso(),
  };
}

function buildTelegramCard(event: PriceNotifyEvent): string {
  const direction = event.changePct >= 0 ? "🚀" : "⚠️";
  return [
    `<b>${direction} MemeRecall Price Alert</b>`,
    "",
    `<b>${escapeHtml(event.symbol)}</b> · <code>${escapeHtml(event.chain)}</code>`,
    `<code>${escapeHtml(event.address)}</code>`,
    "",
    `<b>30m Change:</b> ${event.changePct.toFixed(2)}%`,
    `<b>Price:</b> ${formatUsd(event.previousPriceUsd)} → ${formatUsd(event.currentPriceUsd)}`,
    `<b>Liquidity:</b> ${formatUsd(event.liquidityUsd)}`,
    `<b>Volume 30m:</b> ${formatUsd(event.volume30mUsd)}`,
    `<b>Holders:</b> ${event.holderCount ?? "n/a"}`,
    "",
    `<b>Action:</b> threshold ${event.thresholdPct}% triggered. Review before trading.`,
  ].join("\n");
}

async function sendTelegramCard(event: PriceNotifyEvent, dryRun: boolean): Promise<PriceNotifyEvent> {
  const config = getMemeRecallConfig();
  if (dryRun || !config.telegramBotToken || !config.telegramChatId) {
    return { ...event, status: "dry_run" };
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: buildTelegramCard(event),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const payload = await response.json() as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };

  if (!response.ok || !payload.ok) {
    return {
      ...event,
      status: "failed",
      error: payload.description || `Telegram HTTP ${response.status}`,
    };
  }

  return {
    ...event,
    status: "sent",
    telegramMessageId: payload.result?.message_id ?? null,
  };
}

export async function sendTelegramTestCard(options: {
  symbol?: string;
  chain?: SupportedChain;
  address?: string;
  previousPriceUsd?: number;
  currentPriceUsd?: number;
  changePct?: number;
  liquidityUsd?: number | null;
  volume30mUsd?: number | null;
  holderCount?: number | null;
  dryRun?: boolean;
} = {}): Promise<PriceNotifyEvent> {
  const event: PriceNotifyEvent = {
    id: makeId("notify"),
    tokenId: "manual-test",
    chain: options.chain || "sol",
    address: options.address || "manual-test-address",
    symbol: options.symbol || "TEST",
    name: options.symbol || "TEST",
    previousPriceUsd: options.previousPriceUsd ?? 1,
    currentPriceUsd: options.currentPriceUsd ?? 1.25,
    changePct: options.changePct ?? 25,
    thresholdPct: 20,
    liquidityUsd: options.liquidityUsd ?? 125000,
    volume30mUsd: options.volume30mUsd ?? 42000,
    holderCount: options.holderCount ?? 888,
    createdAt: nowIso(),
    status: "dry_run",
  };

  const sent = await sendTelegramCard(event, options.dryRun ?? getMemeRecallConfig().notifyDryRun);
  await appendEvents([sent]);
  return sent;
}

export async function getTokenChart(input: {
  chain: SupportedChain;
  address: string;
  resolution?: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  lookbackMinutes?: number;
}): Promise<TokenChartResponse> {
  const requestedResolution = input.resolution || "5m";
  const requestedLookbackMinutes = input.lookbackMinutes || 30;
  const to = Math.floor(Date.now() / 1000);
  const from = to - requestedLookbackMinutes * 60;
  const attempts: Array<{
    resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
    lookbackMinutes: number;
  }> = [
    { resolution: requestedResolution, lookbackMinutes: requestedLookbackMinutes },
    { resolution: "5m", lookbackMinutes: Math.max(requestedLookbackMinutes, 180) },
    { resolution: "15m", lookbackMinutes: Math.max(requestedLookbackMinutes, 720) },
    { resolution: "1h", lookbackMinutes: Math.max(requestedLookbackMinutes, 1440) },
  ];
  const notes: string[] = [];
  try {
    const pageCandles = await fetchGmgnPageTokenMcapCandles(
      input.address,
      input.chain,
      requestedResolution,
      501,
    );
    const pagePoints = pageCandles.list
      .map((row) => ({
        time: row.time,
        open: parseRequiredNumber(row.open),
        close: parseRequiredNumber(row.close),
        high: parseRequiredNumber(row.high),
        low: parseRequiredNumber(row.low),
        volumeUsd: parseRequiredNumber(row.amount || row.volume),
      }))
      .filter((point) => point.close > 0)
      .filter((point) => point.time >= from * 1000);
    if (pagePoints.length > 0) {
      return {
        chain: input.chain,
        address: input.address,
        resolution: requestedResolution,
        from,
        to,
        source: "gmgn_kline",
        points: pagePoints,
        metrics: buildChartMetrics(pagePoints),
        notes: [
          "Using GMGN page candles.",
          ...(pageCandles._debug_tpool_desc ? [String(pageCandles._debug_tpool_desc)] : []),
        ],
      };
    }
    notes.push("GMGN page candles returned no usable points.");
  } catch (error) {
    notes.push(`GMGN page candles failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const attempt of attempts) {
    const attemptTo = Math.floor(Date.now() / 1000);
    const attemptFrom = attemptTo - attempt.lookbackMinutes * 60;
    try {
      const kline = await fetchGmgnTokenKline(
        input.address,
        input.chain,
        attempt.resolution,
        attemptFrom,
        attemptTo,
      );
      const points = kline.list.map((row) => ({
        time: row.time,
        open: parseRequiredNumber(row.open),
        close: parseRequiredNumber(row.close),
        high: parseRequiredNumber(row.high),
        low: parseRequiredNumber(row.low),
        volumeUsd: parseRequiredNumber(row.volume),
      })).filter((point) => point.close > 0);

      if (points.length > 0) {
        return {
          chain: input.chain,
          address: input.address,
          resolution: attempt.resolution,
          from: attemptFrom,
          to: attemptTo,
          source: "gmgn_kline",
          points,
          metrics: buildChartMetrics(points),
          notes,
        };
      }

      notes.push(`GMGN ${attempt.resolution}/${attempt.lookbackMinutes}m returned no candles.`);
    } catch (error) {
      notes.push(
        `GMGN ${attempt.resolution}/${attempt.lookbackMinutes}m failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const snapshotFloorMs = (to - Math.max(requestedLookbackMinutes, 180) * 60) * 1000;
  const snapshots = (await readSnapshots())
    .filter(
      (snapshot) =>
        snapshot.chain === input.chain &&
        snapshot.address.toLowerCase() === input.address.toLowerCase() &&
        snapshot.priceUsd > 0 &&
        isoToMs(snapshot.capturedAt) >= snapshotFloorMs,
    )
    .sort((a, b) => isoToMs(a.capturedAt) - isoToMs(b.capturedAt));

  if (snapshots.length > 0) {
    return {
      chain: input.chain,
      address: input.address,
      resolution: requestedResolution,
      from,
      to,
      source: "local_snapshot",
      points: snapshots.map((snapshot) => ({
        time: isoToMs(snapshot.capturedAt),
        open: snapshot.priceUsd,
        close: snapshot.priceUsd,
        high: snapshot.priceUsd,
        low: snapshot.priceUsd,
        volumeUsd: snapshot.volume30mUsd ?? 0,
      })),
      metrics: buildChartMetrics(
        snapshots.map((snapshot) => ({
          time: isoToMs(snapshot.capturedAt),
          open: snapshot.priceUsd,
          close: snapshot.priceUsd,
          high: snapshot.priceUsd,
          low: snapshot.priceUsd,
          volumeUsd: snapshot.volume30mUsd ?? 0,
        })),
      ),
      notes: [...notes, `Using ${snapshots.length} local price snapshots.`],
    };
  }

  return {
    chain: input.chain,
    address: input.address,
    resolution: requestedResolution,
    from,
    to,
    source: "empty",
    points: [],
    metrics: buildChartMetrics([]),
    notes: [...notes, "No usable GMGN candles or local snapshots found."],
  };
}

function isCooldownActive(token: WatchlistToken, nowMs: number): boolean {
  if (!token.lastNotifyAt) return false;
  const last = Date.parse(token.lastNotifyAt);
  if (!Number.isFinite(last)) return false;
  return nowMs - last < token.cooldownMinutes * 60_000;
}

export async function runTokenWatchCycle(options: {
  dryRun?: boolean;
  forceNotify?: boolean;
} = {}): Promise<WatchCycleResult> {
  const config = getMemeRecallConfig();
  const dryRun = options.dryRun ?? config.notifyDryRun;
  const tokens = (await listWatchlistTokens()).filter((item) => item.enabled);
  const snapshots: PriceSnapshot[] = [];
  const alerts: PriceNotifyEvent[] = [];
  const updatedTokens: WatchlistToken[] = await listWatchlistTokens();
  const notes: string[] = [];
  const now = Date.now();

  for (const token of tokens) {
    let snapshot: PriceSnapshot;
    try {
      snapshot = await buildSnapshot(token);
    } catch (error) {
      notes.push(
        `${token.symbol || token.address.slice(0, 6)}: snapshot failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }
    snapshots.push(snapshot);
    const previousPrice = token.lastSnapshotPrice ?? snapshot.priceUsd;
    const changePct = pctChange(previousPrice, snapshot.priceUsd);
    const thresholdHit = Math.abs(changePct) >= token.thresholdPct;
    const cooldown = isCooldownActive(token, now);

    const tokenUpdate: WatchlistToken = {
      ...token,
      symbol: snapshot.symbol,
      name: snapshot.name,
      lastSnapshotAt: snapshot.capturedAt,
      lastSnapshotPrice: snapshot.priceUsd,
      updatedAt: snapshot.capturedAt,
    };

    if ((thresholdHit || options.forceNotify) && !cooldown) {
      const event: PriceNotifyEvent = {
        id: makeId("notify"),
        tokenId: token.id,
        chain: token.chain,
        address: token.address,
        symbol: snapshot.symbol,
        name: snapshot.name,
        previousPriceUsd: previousPrice,
        currentPriceUsd: snapshot.priceUsd,
        changePct,
        thresholdPct: token.thresholdPct,
        liquidityUsd: snapshot.liquidityUsd,
        volume30mUsd: snapshot.volume30mUsd,
        holderCount: snapshot.holderCount,
        createdAt: snapshot.capturedAt,
        status: "dry_run",
      };
      const sent = await sendTelegramCard(event, dryRun);
      alerts.push(sent);
      tokenUpdate.lastNotifyAt = snapshot.capturedAt;
      tokenUpdate.lastNotifyPrice = snapshot.priceUsd;
    } else if (thresholdHit && cooldown) {
      notes.push(`${snapshot.symbol}: threshold hit but cooldown is active.`);
    }

    const index = updatedTokens.findIndex((item) => item.id === token.id);
    if (index >= 0) updatedTokens[index] = tokenUpdate;
  }

  await appendSnapshots(snapshots);
  await appendEvents(alerts);
  await saveWatchlist(updatedTokens);

  return {
    generatedAt: nowIso(),
    dryRun,
    checked: tokens.length,
    alerts,
    snapshots,
    notes,
  };
}
