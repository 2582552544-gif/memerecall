"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniSparkline, TokenDetailChart } from "./watchroom-charts";
import { Nav } from "../components/nav";

type WatchToken = {
  id: string;
  chain: "sol" | "bsc" | "base";
  address: string;
  symbol?: string;
  name?: string;
  enabled: boolean;
  thresholdPct: number;
  lastSnapshotAt?: string | null;
  lastSnapshotPrice?: number | null;
  lastNotifyAt?: string | null;
  signalScore?: number | null;
  signalLabel?: "strong" | "watch" | "weak" | null;
  factorBreakdown?: Array<{
    key:
      | "price_momentum"
      | "liquidity_quality"
      | "holder_quality"
      | "flow_quality"
      | "kol_alignment"
      | "freshness";
    label: string;
    score: number;
    weight: number;
    note: string;
  }> | null;
};

type TokenChartResponse = {
  chain: "sol" | "bsc" | "base";
  address: string;
  resolution: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  source: "gmgn_kline" | "local_snapshot" | "empty";
  points: Array<{
    time: number;
    open: number;
    close: number;
    high: number;
    low: number;
    volumeUsd: number;
  }>;
  metrics: Array<{
    label: "5m" | "30m" | "5h" | "24h";
    changePct: number | null;
  }>;
  notes: string[];
};

type ChartState = TokenChartResponse & {
  loading?: boolean;
  error?: string;
};

const API = process.env.NEXT_PUBLIC_MEMERECALL_API || "http://localhost:4049";

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-5)}`;
}

function formatPrice(value?: number | null): string {
  if (!value) return "No data";
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  if (value >= 0.000001) return `$${value.toFixed(8)}`;
  return `$${value.toExponential(2)}`;
}

function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatTime(value?: string | null): string {
  if (!value) return "Not checked";
  return new Date(value).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metricValue(
  chart: ChartState | undefined,
  label: "5m" | "30m" | "5h" | "24h",
): number | null {
  return chart?.metrics?.find((item) => item.label === label)?.changePct ?? null;
}

function chartSourceLabel(chart?: ChartState): string {
  if (!chart) return "Awaiting data";
  if (chart.loading) return "Loading";
  if (chart.error) return "API error";
  if (chart.source === "gmgn_kline") return "GMGN Kline";
  if (chart.source === "local_snapshot") return "Local snapshot";
  return "No chart";
}

function signalLabelText(value?: WatchToken["signalLabel"]): string {
  if (value === "strong") return "Strong";
  if (value === "watch") return "Watch";
  return "Weak";
}

function makeEmptyChartState(
  token: Pick<WatchToken, "chain" | "address">,
  overrides: Partial<ChartState> = {},
): ChartState {
  return {
    chain: token.chain,
    address: token.address,
    resolution: "5m",
    source: "empty",
    points: [],
    metrics: [],
    notes: [],
    ...overrides,
  };
}

export function WatchroomClient() {
  const [tokens, setTokens] = useState<WatchToken[]>([]);
  const [chain, setChain] = useState<"sol" | "bsc" | "base">("sol");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [charts, setCharts] = useState<Record<string, ChartState>>({});
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function loadTokens() {
    const response = await fetch(`${API}/watchlist`, { cache: "no-store" });
    const data = await response.json() as { tokens: WatchToken[] };
    setTokens(data.tokens || []);
  }

  async function loadChartForToken(token: WatchToken) {
    setCharts((current) => ({
      ...current,
      [token.id]: current[token.id]
        ? { ...current[token.id], loading: true, error: undefined }
        : makeEmptyChartState(token, { loading: true }),
    }));

    try {
      const response = await fetch(
        `${API}/watch/chart?chain=${token.chain}&address=${encodeURIComponent(token.address)}&resolution=5m&lookbackMinutes=180`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const errorPayload = await response.json() as { error?: string };
        throw new Error(errorPayload.error || `HTTP ${response.status}`);
      }
      const data = await response.json() as TokenChartResponse;
      setCharts((current) => ({
        ...current,
        [token.id]: { ...data, loading: false },
      }));
    } catch (error) {
      setCharts((current) => ({
        ...current,
        [token.id]: makeEmptyChartState(token, {
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      }));
    }
  }

  useEffect(() => {
    if (bootstrapped) return;
    setBootstrapped(true);
    void (async () => {
      // Load cached tokens immediately (fast)
      await loadTokens();
      // Then try to sync prices in background (slow, may timeout)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${API}/watch/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dryRun: true }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await response.json() as { checked?: number };
        if ((data.checked || 0) > 0) {
          setMessage(`Synced latest prices. Checked ${data.checked || 0} tokens.`);
          await loadTokens(); // Refresh with updated prices
        }
      } catch {
        setMessage("Showing cached data. Live sync unavailable.");
      }
    })();
  }, [API, bootstrapped]);

  useEffect(() => {
    if (!selectedTokenId && tokens.length > 0) {
      setSelectedTokenId(tokens[0].id);
    }
  }, [tokens, selectedTokenId]);

  useEffect(() => {
    for (const token of tokens) {
      if (charts[token.id]?.loading || charts[token.id]?.points?.length) continue;
      void loadChartForToken(token);
    }
  }, [tokens]);

  function addToken() {
    startTransition(async () => {
      setMessage("");
      const trimmed = address.trim();
      if (!trimmed) {
        setMessage("Paste a token contract address first.");
        return;
      }

      const response = await fetch(`${API}/watchlist/add`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chain,
          address: trimmed,
          thresholdPct: 20,
          cooldownMinutes: 30,
        }),
      });

      if (!response.ok) {
        setMessage("Failed to add. Check address or API service.");
        return;
      }

      setAddress("");
      setMessage("Added to watchlist. System checks every 30 min, alerts on >20% price change.");
      await loadTokens();
    });
  }

  function deleteToken(token: WatchToken) {
    startTransition(async () => {
      await fetch(`${API}/watchlist/delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: token.id }),
      });
      setMessage(`Removed ${token.symbol || shortAddress(token.address)}.`);
      setCharts((current) => {
        const next = { ...current };
        delete next[token.id];
        return next;
      });
      await loadTokens();
    });
  }

  function runOnce() {
    startTransition(async () => {
      const response = await fetch(`${API}/watch/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await response.json() as { checked?: number; alerts?: unknown[] };
      setMessage(`Manually checked ${data.checked || 0} tokens, triggered ${data.alerts?.length || 0} alerts.`);
      await loadTokens();
      await Promise.all(tokens.map((item) => loadChartForToken(item)));
    });
  }

  const selected = tokens.find((item) => item.id === selectedTokenId) || tokens[0];
  const selectedChart = selected ? charts[selected.id] : undefined;
  const validCharts = Object.values(charts).filter((item) => item.points.length > 0).length;

  return (
    <main className="terminal-shell">
      <Nav />

      <section className="watchroom-layout">
        <Card className="terminal-panel watchroom-control-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>Add Token</CardTitle>
            <Badge variant="outline">Paste CA</Badge>
          </CardHeader>
          <CardContent>
            <div className="watchroom-guide">
              <strong>3 Steps</strong>
              <span>Paste contract &rarr; Auto-watch &rarr; Alert on &gt;20% move.</span>
            </div>
            <div className="simple-form">
              <label>
                Chain
                <select value={chain} onChange={(event) => setChain(event.target.value as typeof chain)}>
                  <option value="sol">Solana</option>
                  <option value="bsc">BSC</option>
                  <option value="base">Base</option>
                </select>
              </label>
              <label>
                Contract Address
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="e.g. 6PPX...pump"
                />
              </label>
              <button className="primary-action" onClick={addToken} disabled={isPending}>
                Add to Watch
              </button>
              <button className="secondary-action" onClick={runOnce} disabled={isPending}>
                Check Now
              </button>
            </div>
            <p className="helper-text">
              Prices sync on page load. Charts use GMGN kline data when available, falling back to local snapshots.
            </p>
            {message ? <p className="watch-message">{message}</p> : null}
          </CardContent>
        </Card>

        <Card className="terminal-panel watchroom-table-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>Watch List</CardTitle>
            <div className="panel-badges">
              <Badge>{tokens.length} tokens</Badge>
              <Badge variant="outline">{validCharts} charts</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="watch-list">
              {tokens.length === 0 ? (
                <div className="empty-state">No tokens yet. Paste a contract address on the left to start.</div>
              ) : tokens.map((token) => (
                <div
                  className={`watch-row ${selectedTokenId === token.id ? "watch-row-active" : ""}`}
                  key={token.id}
                  onClick={() => setSelectedTokenId(token.id)}
                >
                  <div>
                    <strong>{token.symbol || shortAddress(token.address)}</strong>
                    <small>{token.chain.toUpperCase()} · {shortAddress(token.address)}</small>
                    <small className="watch-row-signal">
                      Signal {token.signalScore ?? "--"} · {signalLabelText(token.signalLabel)}
                    </small>
                  </div>
                  <div className="watch-chart-cell">
                    {charts[token.id]?.points?.length ? (
                      <MiniSparkline points={charts[token.id].points} />
                    ) : charts[token.id]?.loading ? (
                      <span className="chart-state">Loading</span>
                    ) : charts[token.id]?.error ? (
                      <span className="chart-state chart-state-danger">API error</span>
                    ) : (
                      <span className="chart-state">No chart</span>
                    )}
                  </div>
                  <div>
                    <span>Price</span>
                    <strong className="watch-value watch-value-price">{formatPrice(token.lastSnapshotPrice)}</strong>
                  </div>
                  <div>
                    <span>Threshold</span>
                    <strong className="watch-value">{token.thresholdPct}%</strong>
                  </div>
                  <div>
                    <span>Last Check</span>
                    <strong className="watch-value">{formatTime(token.lastSnapshotAt)}</strong>
                  </div>
                  <div>
                    <span>Last Alert</span>
                    <strong className="watch-value">{token.lastNotifyAt ? formatTime(token.lastNotifyAt) : "None"}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong className="watch-value">{chartSourceLabel(charts[token.id])}</strong>
                  </div>
                  <div>
                    <span>30m</span>
                    <strong className="watch-value">
                      {metricValue(charts[token.id], "30m") === null
                        ? "--"
                        : formatPercent(metricValue(charts[token.id], "30m") as number)}
                    </strong>
                  </div>
                  <button
                    className="watch-row-delete"
                    aria-label={`Remove ${token.symbol || shortAddress(token.address)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteToken(token);
                    }}
                    disabled={isPending}
                  >
                    <span>Remove</span>
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="terminal-panel watchroom-chart-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>Chart</CardTitle>
            <Badge variant={selectedChart?.source === "gmgn_kline" ? "default" : "outline"}>
              {chartSourceLabel(selectedChart)}
            </Badge>
          </CardHeader>
          <CardContent>
            {(() => {
              if (!selected) {
                return <div className="empty-state">Add a token first. Prices will sync automatically and charts will appear.</div>;
              }
              const chart = selectedChart;
              if (chart?.loading) {
                return <div className="empty-state">Loading GMGN kline data and local snapshots.</div>;
              }
              if (!chart?.points?.length) {
                return (
                  <div className="empty-state">
                    <strong>{selected.symbol || shortAddress(selected.address)} — No chart data</strong>
                    <span>{chart?.error || chart?.notes?.[chart.notes.length - 1] || "Trend line will appear after the next price snapshot."}</span>
                  </div>
                );
              }

              return (
                <div className="watchroom-chart-detail">
                  <div className="watchroom-chart-header">
                    <div>
                      <strong>{selected.symbol || shortAddress(selected.address)}</strong>
                      <small>{selected.chain.toUpperCase()} · {shortAddress(selected.address)}</small>
                    </div>
                    <div className="watchroom-chart-meta">
                      <span>{chart.resolution}</span>
                      <span>{chart.points.length} points</span>
                      {chart.metrics.map((metric) => (
                        <span
                          key={metric.label}
                          className={
                            metric.changePct === null
                              ? ""
                              : metric.changePct >= 0
                                ? "positive-text"
                                : "negative-text"
                          }
                        >
                          {metric.label} {metric.changePct === null ? "--" : formatPercent(metric.changePct)}
                    </span>
                  ))}
                    </div>
                  </div>
                  <TokenDetailChart
                    symbol={selected.symbol || shortAddress(selected.address)}
                    points={chart.points}
                  />
                  {selected.factorBreakdown?.length ? (
                    <div className="watch-signal-breakdown">
                      {selected.factorBreakdown.map((factor) => (
                        <div className="watch-signal-factor" key={factor.key}>
                          <span>{factor.label}</span>
                          <strong>{factor.score}</strong>
                          <small>{factor.note}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="watchroom-chart-notes">
                    {(chart.notes || []).slice(-2).map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
