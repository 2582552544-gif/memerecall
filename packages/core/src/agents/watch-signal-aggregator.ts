import type {
  PriceSnapshot,
  TokenChartResponse,
  WatchSignalAggregate,
  WatchSignalFactor,
  WatchlistToken,
} from "../token-watch-types";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function factor(
  key: WatchSignalFactor["key"],
  label: string,
  weight: number,
  score: number,
  note: string,
): WatchSignalFactor {
  return {
    key,
    label,
    weight,
    score: clampScore(score),
    note,
  };
}

function weightedScore(factors: WatchSignalFactor[]): number {
  const total = factors.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return 0;
  return clampScore(
    factors.reduce((sum, item) => sum + item.score * item.weight, 0) / total,
  );
}

function labelForScore(score: number): WatchSignalAggregate["signalLabel"] {
  if (score >= 72) return "strong";
  if (score >= 50) return "watch";
  return "weak";
}

function metricValue(
  chart: TokenChartResponse | null | undefined,
  label: "5m" | "30m" | "5h" | "24h",
): number | null {
  return chart?.metrics?.find((item) => item.label === label)?.changePct ?? null;
}

function scoreMomentum(chart: TokenChartResponse | null | undefined): WatchSignalFactor {
  const weights = [
    { label: "5m" as const, weight: 0.2 },
    { label: "30m" as const, weight: 0.3 },
    { label: "5h" as const, weight: 0.3 },
    { label: "24h" as const, weight: 0.2 },
  ];
  const available = weights
    .map((item) => ({ ...item, value: metricValue(chart, item.label) }))
    .filter((item) => item.value !== null) as Array<{ label: "5m" | "30m" | "5h" | "24h"; weight: number; value: number }>;

  if (available.length === 0) {
    return factor("price_momentum", "Price Momentum", 0.3, 0, "No multi-window price change metrics yet.");
  }

  const raw = available.reduce((sum, item) => {
    const normalized = Math.max(-100, Math.min(100, item.value)) + 100;
    return sum + normalized * item.weight;
  }, 0) / available.reduce((sum, item) => sum + item.weight, 0);

  const summary = available.map((item) => `${item.label}:${item.value.toFixed(2)}%`).join(" · ");
  return factor("price_momentum", "Price Momentum", 0.3, raw / 2, summary);
}

function scoreLiquidity(snapshot: PriceSnapshot | null | undefined): WatchSignalFactor {
  const value = snapshot?.liquidityUsd ?? 0;
  let score = 10;
  if (value >= 100000) score = 95;
  else if (value >= 50000) score = 82;
  else if (value >= 20000) score = 68;
  else if (value >= 10000) score = 52;
  else if (value >= 3000) score = 36;
  return factor(
    "liquidity_quality",
    "Liquidity Quality",
    0.2,
    score,
    value > 0 ? `Liquidity ${value.toFixed(0)} USD.` : "Liquidity unavailable.",
  );
}

function scoreHolder(snapshot: PriceSnapshot | null | undefined): WatchSignalFactor {
  const value = snapshot?.holderCount ?? 0;
  let score = 8;
  if (value >= 5000) score = 92;
  else if (value >= 1000) score = 76;
  else if (value >= 300) score = 60;
  else if (value >= 100) score = 42;
  else if (value >= 20) score = 24;
  return factor(
    "holder_quality",
    "Holder Quality",
    0.15,
    score,
    value > 0 ? `Holder count ${value}.` : "Holder count unavailable.",
  );
}

function scoreFlow(snapshot: PriceSnapshot | null | undefined, chart: TokenChartResponse | null | undefined): WatchSignalFactor {
  const snapshotVolume = snapshot?.volume30mUsd ?? 0;
  const candleVolume = chart?.points?.reduce((sum, item) => sum + (item.volumeUsd || 0), 0) ?? 0;
  const effective = Math.max(snapshotVolume, candleVolume);
  let score = 10;
  if (effective >= 500000) score = 94;
  else if (effective >= 100000) score = 80;
  else if (effective >= 20000) score = 62;
  else if (effective >= 5000) score = 44;
  else if (effective > 0) score = 24;
  return factor(
    "flow_quality",
    "Flow Quality",
    0.15,
    score,
    effective > 0 ? `Observed flow ${effective.toFixed(0)} USD.` : "No flow sample yet.",
  );
}

function scoreKolAlignment(token: WatchlistToken): WatchSignalFactor {
  const symbol = (token.symbol || token.name || "").toUpperCase();
  const score = symbol.includes("TIKTOK") || symbol.includes("RETARD") ? 55 : 20;
  return factor(
    "kol_alignment",
    "KOL Alignment",
    0.15,
    score,
    score > 40
      ? "Token matches a symbol currently visible in tracked KOL research samples."
      : "No direct KOL-wallet confirmation attached to this token yet.",
  );
}

function scoreFreshness(snapshot: PriceSnapshot | null | undefined): WatchSignalFactor {
  const createdAt = snapshot?.capturedAt ? Date.parse(snapshot.capturedAt) : Date.now();
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
  let score = 55;
  if (ageHours <= 1) score = 96;
  else if (ageHours <= 6) score = 84;
  else if (ageHours <= 24) score = 70;
  else if (ageHours <= 72) score = 55;
  else if (ageHours <= 24 * 7) score = 38;
  else score = 22;
  return factor(
    "freshness",
    "Freshness",
    0.05,
    score,
    `Using watch snapshot age ${ageHours.toFixed(1)}h as freshness proxy.`,
  );
}

export function aggregateWatchSignal(input: {
  token: WatchlistToken;
  snapshot?: PriceSnapshot | null;
  chart?: TokenChartResponse | null;
}): WatchSignalAggregate {
  const factors = [
    scoreMomentum(input.chart),
    scoreLiquidity(input.snapshot),
    scoreHolder(input.snapshot),
    scoreFlow(input.snapshot, input.chart),
    scoreKolAlignment(input.token),
    scoreFreshness(input.snapshot),
  ];
  const signalScore = weightedScore(factors);

  return {
    tokenId: input.token.id,
    chain: input.token.chain,
    address: input.token.address,
    symbol: input.token.symbol || input.snapshot?.symbol || input.token.address.slice(0, 6),
    name: input.token.name || input.snapshot?.name || input.token.address,
    signalScore,
    signalLabel: labelForScore(signalScore),
    factorBreakdown: factors,
    notes: factors.map((item) => `${item.label}: ${item.note}`),
  };
}
