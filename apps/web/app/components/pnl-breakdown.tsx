// apps/web/app/components/pnl-breakdown.tsx
"use client";

import type { PnlBreakdownSummary } from "@memerecall/core";

function toneClass(v: number): string {
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

function formatUsd(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toFixed(2)}`;
}

export function WalletPnlBreakdown({ breakdown }: { breakdown: PnlBreakdownSummary }) {
  return (
    <div className="terminal-panel" style={{ padding: 16 }}>
      <div className="panel-title-row">
        <div>
          <strong>Where the PnL Comes From</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Tweeted tokens account for{" "}
            <strong style={{ color: "var(--text)" }}>{breakdown.alignmentPct}%</strong>{" "}
            of total PnL
          </div>
        </div>
        <strong style={{ fontSize: 20 }}>
          ${breakdown.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </strong>
      </div>

      {/* Stacked alignment bar */}
      <div className="alignment-bar">
        {breakdown.positions.map((p, i) => {
          const total = Math.max(1, Math.abs(breakdown.totalPnl));
          const pct = (Math.abs(p.realizedUsd + p.unrealizedUsd) / total) * 100;
          const hue = p.tweeted ? 152 : 215;
          const lightness = 35 + (i % 5) * 4;
          return (
            <div
              key={p.symbol}
              title={p.symbol}
              style={{
                width: `${pct}%`,
                background: `hsl(${hue} ${p.tweeted ? "76%" : "12%"} ${lightness}%)`,
              }}
            />
          );
        })}
      </div>

      {/* Table */}
      <div className="terminal-table-wrap">
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Tweeted?</th>
              <th style={{ textAlign: "right" }}>Realized</th>
              <th style={{ textAlign: "right" }}>Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.positions.map((p) => (
              <tr key={p.symbol}>
                <td>
                  <strong style={{ color: "var(--text)" }}>${p.symbol}</strong>
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--muted)" }}>
                    {p.chain}
                  </span>
                </td>
                <td>
                  {p.tweeted ? (
                    <span className="is-positive">yes</span>
                  ) : (
                    <span className="muted">-- silent</span>
                  )}
                </td>
                <td className={toneClass(p.realizedUsd)} style={{ textAlign: "right" }}>
                  {formatUsd(p.realizedUsd)}
                </td>
                <td className={toneClass(p.unrealizedUsd)} style={{ textAlign: "right" }}>
                  {formatUsd(p.unrealizedUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
