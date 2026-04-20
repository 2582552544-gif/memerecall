"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeaderboardEntry {
  rank: number;
  handle: string;
  displayName: string;
  tier: string;
  action: string;
  rankScore: number;
  scores: {
    composite: number;
    authenticity: number;
    followerAlpha: number | null;
    coverage: number;
    discipline: number;
  };
  medianROI: number | null;
  winRate: number;
  signalFrequency: number;
  chains: string[];
  redFlagCount: number;
  redFlags: string[];
  verifiedSignals: number;
  gmgnProfit7d: number;
}

type KOLArchetype = "signal_caller" | "silent_whale" | "noise_maker";

function getArchetype(entry: LeaderboardEntry): KOLArchetype {
  if (entry.signalFrequency >= 3) return "signal_caller";
  if (entry.gmgnProfit7d > 0 && entry.signalFrequency < 3) return "silent_whale";
  return "noise_maker";
}

function archetypeLabel(type: KOLArchetype): { label: string; variant: "default" | "positive" | "warning" | "negative" | "outline" } {
  switch (type) {
    case "signal_caller": return { label: "Signal Caller", variant: "positive" };
    case "silent_whale": return { label: "Silent Whale", variant: "outline" };
    case "noise_maker": return { label: "Noise Maker", variant: "negative" };
  }
}

function actionBadge(action: string): { label: string; variant: "default" | "positive" | "warning" | "negative" | "outline" } {
  switch (action) {
    case "auto_copy": return { label: "AUTO COPY", variant: "positive" };
    case "watchlist": return { label: "WATCHLIST", variant: "warning" };
    case "narrative_only": return { label: "NARRATIVE", variant: "outline" };
    case "avoid": return { label: "AVOID", variant: "negative" };
    default: return { label: "N/A", variant: "default" };
  }
}

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPct(v: number | null): string {
  if (v === null) return "N/A";
  return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

function toneClass(v: number | null): string {
  if (v === null) return "is-neutral";
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

function scoreBarWidth(v: number): string {
  return `${Math.max(2, Math.min(100, v))}%`;
}

function scoreBarColor(v: number): string {
  if (v >= 70) return "#7ee6a1";
  if (v >= 40) return "#f5c542";
  if (v >= 20) return "#f59e42";
  return "#ff6687";
}

function chainPill(chain: string): string {
  switch (chain) {
    case "sol": return "chain-sol";
    case "eth": return "chain-eth";
    case "bsc": return "chain-bsc";
    default: return "chain-unknown";
  }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: scoreBarWidth(value), backgroundColor: scoreBarColor(value) }} />
      </div>
      <span className="score-bar-value">{value}</span>
    </div>
  );
}

function QuickCard({ entry }: { entry: LeaderboardEntry }) {
  const archetype = getArchetype(entry);
  const arch = archetypeLabel(archetype);
  const isWhale = archetype === "silent_whale";

  return (
    <div className="quick-card">
      <div className="qc-header">
        <div>
          <h3><Link href={`/analysis/${entry.handle}`}>@{entry.handle}</Link></h3>
          <span className="muted">{entry.displayName}</span>
        </div>
        <Badge variant={arch.variant}>{arch.label}</Badge>
      </div>
      <div className="qc-hero">
        <div className={`qc-score ${entry.scores.composite >= 60 ? "score-green" : entry.scores.composite >= 40 ? "score-yellow" : "score-red"}`}>
          <span className="qc-score-num">{entry.scores.composite}</span>
          <span className="qc-score-label">/100</span>
        </div>
        <Badge variant={actionBadge(entry.action).variant} className="action-badge-lg">
          {actionBadge(entry.action).label}
        </Badge>
      </div>
      {isWhale ? (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Wallet PnL (7d)</span>
          <span className={`qc-metric-value ${toneClass(entry.gmgnProfit7d)}`}>{formatUsd(entry.gmgnProfit7d)}</span>
          <p className="qc-whale-note">Silent Whale. Monitor wallet directly.</p>
        </div>
      ) : (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Follower Alpha (30d median)</span>
          <span className={`qc-metric-value ${toneClass(entry.medianROI)}`}>{formatPct(entry.medianROI)}</span>
          <span className="qc-metric-sub">{entry.verifiedSignals} verified / {entry.signalFrequency} signals</span>
        </div>
      )}
      <div className="qc-scores">
        <ScoreBar label="Authenticity" value={entry.scores.authenticity} />
        <ScoreBar label="Alpha" value={entry.scores.followerAlpha !== null ? Math.max(0, Math.min(100, entry.scores.followerAlpha + 50)) : 0} />
        <ScoreBar label="Coverage" value={entry.scores.coverage} />
        <ScoreBar label="Discipline" value={entry.scores.discipline} />
      </div>
      {entry.redFlagCount > 0 && (
        <div className="qc-flags">
          {entry.redFlags.map((f) => (
            <span key={f} className="flag-chip flag-high">{f.replaceAll("_", " ")}</span>
          ))}
        </div>
      )}
      <div className="qc-chains">
        {entry.chains.map((c) => (
          <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardInteractive({ entries }: { entries: LeaderboardEntry[] }) {
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);

  const callers = entries.filter((e) => getArchetype(e) === "signal_caller");
  const whales = entries.filter((e) => getArchetype(e) === "silent_whale");
  const noisy = entries.filter((e) => getArchetype(e) === "noise_maker");

  function renderTab(data: LeaderboardEntry[]) {
    const selected = data.find((e) => e.handle === selectedHandle) || data[0];

    return (
      <div className="leaderboard-layout">
        <div className="leaderboard-table-area">
          <ScrollArea className="terminal-table-scroll terminal-table-scroll-lg">
            <div className="terminal-table-wrap">
              <table className="terminal-table leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>KOL</th>
                    <th>Type</th>
                    <th>
                      <Tooltip><TooltipTrigger>Wallet PnL</TooltipTrigger>
                      <TooltipContent>7-day realized profit from GMGN</TooltipContent></Tooltip>
                    </th>
                    <th>
                      <Tooltip><TooltipTrigger>Alpha</TooltipTrigger>
                      <TooltipContent>Median ROI if followers copy-traded</TooltipContent></Tooltip>
                    </th>
                    <th>Signals</th>
                    <th>Chain</th>
                    <th>Action</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((entry) => {
                    const arch = archetypeLabel(getArchetype(entry));
                    const act = actionBadge(entry.action);
                    const isSelected = entry.handle === selected?.handle;
                    return (
                      <tr
                        key={entry.handle}
                        className={`leaderboard-row ${isSelected ? "row-selected" : ""}`}
                        onClick={() => setSelectedHandle(entry.handle)}
                      >
                        <td className="rank-cell"><span className="rank-num">{entry.rank}</span></td>
                        <td>
                          <Link href={`/analysis/${entry.handle}`} className="kol-cell">
                            <div className="kol-avatar">{entry.displayName.slice(0, 1).toUpperCase()}</div>
                            <div>
                              <strong>@{entry.handle}</strong>
                              <small className="muted">{entry.displayName}</small>
                            </div>
                          </Link>
                        </td>
                        <td><Badge variant={arch.variant}>{arch.label}</Badge></td>
                        <td className={toneClass(entry.gmgnProfit7d)}><strong>{formatUsd(entry.gmgnProfit7d)}</strong></td>
                        <td className={toneClass(entry.medianROI)}>
                          {entry.medianROI !== null ? <strong>{formatPct(entry.medianROI)}</strong> : <span className="muted">N/A</span>}
                        </td>
                        <td>{entry.verifiedSignals} / {entry.signalFrequency}</td>
                        <td>
                          {entry.chains.map((c) => (
                            <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
                          ))}
                        </td>
                        <td><Badge variant={act.variant}>{act.label}</Badge></td>
                        <td>{entry.redFlagCount > 0 ? <span className="flag-count">{entry.redFlagCount}</span> : <span className="muted">0</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
        <aside className="leaderboard-sidebar">
          {selected && <QuickCard entry={selected} />}
        </aside>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tabs defaultValue="all" className="leaderboard-tabs">
        <TabsList>
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          <TabsTrigger value="callers">Signal Callers ({callers.length})</TabsTrigger>
          <TabsTrigger value="whales">Silent Whales ({whales.length})</TabsTrigger>
          {noisy.length > 0 && <TabsTrigger value="noisy">Noise ({noisy.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="all">{renderTab(entries)}</TabsContent>
        <TabsContent value="callers">{renderTab(callers)}</TabsContent>
        <TabsContent value="whales">{renderTab(whales)}</TabsContent>
        {noisy.length > 0 && <TabsContent value="noisy">{renderTab(noisy)}</TabsContent>}
      </Tabs>
    </TooltipProvider>
  );
}
