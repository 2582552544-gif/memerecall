import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---- Types (inline to avoid import issues with SSR) ----

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

interface Leaderboard {
  generatedAt: string;
  kolCount: number;
  discoveredCount: number;
  prefilterPassedCount: number;
  analyzedCount: number;
  entries: LeaderboardEntry[];
}

// ---- Helpers ----

type KOLArchetype = "signal_caller" | "silent_whale" | "noise_maker";

function getArchetype(entry: LeaderboardEntry): KOLArchetype {
  if (entry.signalFrequency >= 3) return "signal_caller";
  if (entry.gmgnProfit7d > 0 && entry.signalFrequency < 3) return "silent_whale";
  return "noise_maker";
}

function archetypeLabel(type: KOLArchetype): { emoji: string; label: string; variant: "default" | "positive" | "warning" | "negative" | "outline" } {
  switch (type) {
    case "signal_caller": return { emoji: "", label: "Signal Caller", variant: "positive" };
    case "silent_whale": return { emoji: "", label: "Silent Whale", variant: "outline" };
    case "noise_maker": return { emoji: "", label: "Noise Maker", variant: "negative" };
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---- Data loading ----

async function loadLeaderboard(): Promise<Leaderboard | null> {
  // Try multiple paths (monorepo: cwd may be apps/web or project root)
  const candidates = [
    path.resolve(process.cwd(), "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "..", "..", "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "data-leaderboard-latest.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Leaderboard;
    } catch {
      continue;
    }
  }
  return null;
}

// ---- Components ----

function FunnelStats({ lb }: { lb: Leaderboard }) {
  return (
    <div className="funnel-stats">
      <div className="funnel-step">
        <span className="funnel-num">{lb.discoveredCount}</span>
        <span className="funnel-label">Discovered</span>
      </div>
      <span className="funnel-arrow">&rarr;</span>
      <div className="funnel-step">
        <span className="funnel-num">{lb.prefilterPassedCount}</span>
        <span className="funnel-label">Prefiltered</span>
      </div>
      <span className="funnel-arrow">&rarr;</span>
      <div className="funnel-step">
        <span className="funnel-num">{lb.analyzedCount}</span>
        <span className="funnel-label">Analyzed</span>
      </div>
      <span className="funnel-arrow">&rarr;</span>
      <div className="funnel-step">
        <span className="funnel-num">{lb.kolCount}</span>
        <span className="funnel-label">Ranked</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: scoreBarWidth(value), backgroundColor: scoreBarColor(value) }}
        />
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
          <h3>@{entry.handle}</h3>
          <span className="muted">{entry.displayName}</span>
        </div>
        <Badge variant={arch.variant}>{arch.emoji} {arch.label}</Badge>
      </div>

      <div className="qc-hero">
        <div className={`qc-score ${entry.scores.composite >= 60 ? "score-green" : entry.scores.composite >= 40 ? "score-yellow" : "score-red"}`}>
          <span className="qc-score-num">{entry.scores.composite}</span>
          <span className="qc-score-label">/100</span>
        </div>
        <div className="qc-action">
          <Badge variant={actionBadge(entry.action).variant} className="action-badge-lg">
            {actionBadge(entry.action).label}
          </Badge>
        </div>
      </div>

      {/* Conditional hero metric */}
      {isWhale ? (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Wallet PnL (7d)</span>
          <span className={`qc-metric-value ${toneClass(entry.gmgnProfit7d)}`}>
            {formatUsd(entry.gmgnProfit7d)}
          </span>
          <p className="qc-whale-note">
            This KOL rarely shares Alpha on Twitter. Classified as on-chain smart money. Monitor wallet directly.
          </p>
        </div>
      ) : (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Follower Alpha (30d median)</span>
          <span className={`qc-metric-value ${toneClass(entry.medianROI)}`}>
            {formatPct(entry.medianROI)}
          </span>
          <span className="qc-metric-sub">
            {entry.verifiedSignals} verified / {entry.signalFrequency} signals · WR {entry.winRate}%
          </span>
        </div>
      )}

      {/* 4-dim scores */}
      <div className="qc-scores">
        <ScoreBar label="Authenticity" value={entry.scores.authenticity} />
        <ScoreBar label="Alpha" value={entry.scores.followerAlpha !== null ? Math.max(0, Math.min(100, entry.scores.followerAlpha + 50)) : 0} />
        <ScoreBar label="Coverage" value={entry.scores.coverage} />
        <ScoreBar label="Discipline" value={entry.scores.discipline} />
      </div>

      {/* Red flags */}
      {entry.redFlagCount > 0 && (
        <div className="qc-flags">
          {entry.redFlags.map((f) => (
            <span key={f} className="flag-chip flag-high">{f.replaceAll("_", " ")}</span>
          ))}
        </div>
      )}

      {/* Chains */}
      <div className="qc-chains">
        {entry.chains.map((c) => (
          <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}

function KOLRow({ entry, isSelected, onClick }: {
  entry: LeaderboardEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const archetype = getArchetype(entry);
  const arch = archetypeLabel(archetype);
  const act = actionBadge(entry.action);

  return (
    <tr
      className={`leaderboard-row ${isSelected ? "row-selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <td className="rank-cell">
        <span className="rank-num">{entry.rank}</span>
      </td>
      <td>
        <div className="kol-cell">
          <div className="kol-avatar">{entry.displayName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>@{entry.handle}</strong>
            <small className="muted">{entry.displayName}</small>
          </div>
        </div>
      </td>
      <td>
        <Badge variant={arch.variant} className="archetype-badge">
          {arch.emoji} {arch.label}
        </Badge>
      </td>
      <td className={toneClass(entry.gmgnProfit7d)}>
        <strong>{formatUsd(entry.gmgnProfit7d)}</strong>
      </td>
      <td className={toneClass(entry.medianROI)}>
        {entry.medianROI !== null ? (
          <strong>{formatPct(entry.medianROI)}</strong>
        ) : (
          <span className="muted">N/A</span>
        )}
      </td>
      <td>
        {entry.verifiedSignals > 0 ? (
          <span>{entry.verifiedSignals} / {entry.signalFrequency}</span>
        ) : (
          <span className="muted">0 / {entry.signalFrequency}</span>
        )}
      </td>
      <td>
        {entry.chains.map((c) => (
          <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
        ))}
      </td>
      <td>
        <Badge variant={act.variant}>{act.label}</Badge>
      </td>
      <td>
        {entry.redFlagCount > 0 ? (
          <span className="flag-count">{entry.redFlagCount}</span>
        ) : (
          <span className="muted">0</span>
        )}
      </td>
    </tr>
  );
}

// ---- Main Page (Client-interactive wrapper) ----

// ---- Page ----

export default async function HomePage() {
  const lb = await loadLeaderboard();

  if (!lb || lb.entries.length === 0) {
    return (
      <main className="terminal-shell">
        <header className="terminal-topbar">
          <div className="terminal-brand">
            <img className="brand-logo" src="/assets/memerecall-logo.svg" alt="" />
            <span className="brand-name">MemeRecall <small>v3.0</small></span>
          </div>
        </header>
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>No leaderboard data yet</h2>
          <p className="muted">Run <code>bun run leaderboard:run</code> to generate the first leaderboard.</p>
        </div>
      </main>
    );
  }

  const callers = lb.entries.filter((e) => getArchetype(e) === "signal_caller");
  const whales = lb.entries.filter((e) => getArchetype(e) === "silent_whale");
  const noisy = lb.entries.filter((e) => getArchetype(e) === "noise_maker");

  return (
    <main className="terminal-shell">
      <header className="terminal-topbar">
        <div className="terminal-brand">
          <img className="brand-logo" src="/assets/memerecall-logo.svg" alt="" />
          <span className="brand-name">MemeRecall <small>v3.0</small></span>
        </div>
        <nav className="terminal-nav">
          <span className="nav-item active">Leaderboard</span>
          <span className="nav-item">Watchlist</span>
        </nav>
        <div className="terminal-actions">
          <span className="status-dot" />
          <span>Updated {timeAgo(lb.generatedAt)}</span>
        </div>
      </header>

      {/* Funnel stats */}
      <FunnelStats lb={lb} />

      {/* Tabs: All / Signal Callers / Silent Whales */}
      <TooltipProvider>
      <Tabs defaultValue="all" className="leaderboard-tabs">
        <TabsList>
          <TabsTrigger value="all">All ({lb.entries.length})</TabsTrigger>
          <TabsTrigger value="callers">Signal Callers ({callers.length})</TabsTrigger>
          <TabsTrigger value="whales">Silent Whales ({whales.length})</TabsTrigger>
          {noisy.length > 0 && <TabsTrigger value="noisy">Noise ({noisy.length})</TabsTrigger>}
        </TabsList>

        {[
          { value: "all", data: lb.entries },
          { value: "callers", data: callers },
          { value: "whales", data: whales },
          { value: "noisy", data: noisy },
        ].map(({ value, data }) => (
          <TabsContent key={value} value={value}>
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
                            <Tooltip>
                              <TooltipTrigger>Wallet PnL</TooltipTrigger>
                              <TooltipContent>7-day realized profit from GMGN on-chain data</TooltipContent>
                            </Tooltip>
                          </th>
                          <th>
                            <Tooltip>
                              <TooltipTrigger>Follower a</TooltipTrigger>
                              <TooltipContent>Median ROI if followers copy-traded verified signals</TooltipContent>
                            </Tooltip>
                          </th>
                          <th>
                            <Tooltip>
                              <TooltipTrigger>Signals</TooltipTrigger>
                              <TooltipContent>Verified wallet matches / Total S3+S4 signals</TooltipContent>
                            </Tooltip>
                          </th>
                          <th>Chain</th>
                          <th>Action</th>
                          <th>Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((entry) => {
                          const arch = archetypeLabel(getArchetype(entry));
                          const act = actionBadge(entry.action);
                          return (
                            <tr key={entry.handle} className="leaderboard-row">
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
                              <td><Badge variant={arch.variant}>{arch.emoji} {arch.label}</Badge></td>
                              <td className={toneClass(entry.gmgnProfit7d)}><strong>{formatUsd(entry.gmgnProfit7d)}</strong></td>
                              <td className={toneClass(entry.medianROI)}>
                                {entry.medianROI !== null ? <strong>{formatPct(entry.medianROI)}</strong> : <span className="muted">N/A</span>}
                              </td>
                              <td>
                                {entry.verifiedSignals > 0
                                  ? <span>{entry.verifiedSignals} / {entry.signalFrequency}</span>
                                  : <span className="muted">0 / {entry.signalFrequency}</span>}
                              </td>
                              <td>
                                {entry.chains.map((c) => (
                                  <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
                                ))}
                              </td>
                              <td><Badge variant={act.variant}>{act.label}</Badge></td>
                              <td>
                                {entry.redFlagCount > 0
                                  ? <span className="flag-count">{entry.redFlagCount}</span>
                                  : <span className="muted">0</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>

              {/* Quick Card sidebar — show top entry summary */}
              <aside className="leaderboard-sidebar">
                {data.length > 0 && <QuickCard entry={data[0]} />}
              </aside>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      </TooltipProvider>

      <footer className="terminal-footer">
        <span><span className="status-dot" /> MemeRecall v3.0 Leaderboard Engine</span>
        <span>GMGN Discovery + GPT Signal Classifier + RankScore</span>
        <span>{lb.generatedAt.replace("T", " ").slice(0, 19)} UTC</span>
      </footer>
    </main>
  );
}
