// apps/web/app/components/follower-simulator.tsx
"use client";

import type { FollowerSimResult } from "@memerecall/core";

function toneClass(v: number): string {
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

export function FollowerSimulator({
  handle,
  sim,
}: {
  handle: string;
  sim: FollowerSimResult;
}) {
  const fillWidth = Math.min(50, Math.abs(sim.roiPct) / 2);
  const fillSide = sim.roiPct >= 0 ? "left" : "right";
  const fillColor = sim.roiPct >= 0
    ? "rgba(126, 230, 161, 0.25)"
    : "rgba(255, 102, 135, 0.25)";

  return (
    <div className="terminal-panel" style={{ padding: 16 }}>
      <div className="panel-title-row">
        <div>
          <strong>Copy-Trade Simulator</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            If you bought ${sim.unitUsd} per signal from @{handle}
          </div>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          last {sim.signalCount} signals
        </span>
      </div>

      <div className="sim-grid">
        <div className="sim-stat">
          <span>Invested</span>
          <strong>${sim.totalInvested.toLocaleString()}</strong>
        </div>
        <div className="sim-stat">
          <span>Current Value</span>
          <strong className={toneClass(sim.finalValue - sim.totalInvested)}>
            ${sim.finalValue.toFixed(0)}
          </strong>
        </div>
        <div className="sim-stat">
          <span>PnL</span>
          <strong className={toneClass(sim.pnlUsd)}>
            {sim.pnlUsd >= 0 ? "+" : ""}${sim.pnlUsd.toFixed(0)}
          </strong>
        </div>
        <div className="sim-stat">
          <span>Win Rate</span>
          <strong>{sim.winRate}%</strong>
        </div>
      </div>

      <div className="sim-roi-bar">
        <div className="sim-center" />
        <div
          className="sim-fill"
          style={{
            [fillSide === "left" ? "left" : "right"]: "50%",
            width: `${fillWidth}%`,
            background: fillColor,
          }}
        />
        <div className={`sim-roi-text ${toneClass(sim.roiPct)}`}>
          {sim.roiPct >= 0 ? "+" : ""}{sim.roiPct.toFixed(1)}% ROI
        </div>
      </div>
    </div>
  );
}
