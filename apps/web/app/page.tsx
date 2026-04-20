import { readFile } from "node:fs/promises";
import path from "node:path";
import { Nav } from "./components/nav";
import { LeaderboardInteractive } from "./leaderboard-client";

interface Leaderboard {
  generatedAt: string;
  kolCount: number;
  discoveredCount: number;
  prefilterPassedCount: number;
  analyzedCount: number;
  entries: Array<{
    rank: number;
    handle: string;
    displayName: string;
    tier: string;
    action: string;
    rankScore: number;
    scores: { composite: number; authenticity: number; followerAlpha: number | null; coverage: number; discipline: number };
    medianROI: number | null;
    winRate: number;
    signalFrequency: number;
    chains: string[];
    redFlagCount: number;
    redFlags: string[];
    verifiedSignals: number;
    gmgnProfit7d: number;
    followers?: number;
    wallets?: { address: string; chain: string }[];
    twitterUrl?: string;
  }>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadLeaderboard(): Promise<Leaderboard | null> {
  const candidates = [
    path.resolve(process.cwd(), "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "..", "..", "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "data-leaderboard-latest.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Leaderboard;
    } catch { continue; }
  }
  return null;
}

export default async function HomePage() {
  const lb = await loadLeaderboard();

  if (!lb || lb.entries.length === 0) {
    return (
      <main className="terminal-shell">
        <Nav />
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>No leaderboard data yet</h2>
          <p className="muted">Run <code>bun run leaderboard:run</code> to generate the first leaderboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="terminal-shell">
      <Nav />
      <div className="funnel-stats">
        <div className="funnel-step"><span className="funnel-num">{lb.discoveredCount}</span><span className="funnel-label">Discovered</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.prefilterPassedCount}</span><span className="funnel-label">Prefiltered</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.analyzedCount}</span><span className="funnel-label">Analyzed</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.kolCount}</span><span className="funnel-label">Ranked</span></div>
        <span className="funnel-arrow" />
        <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>Updated {timeAgo(lb.generatedAt)}</span>
      </div>
      <LeaderboardInteractive entries={lb.entries} />
      <footer className="terminal-footer">
        <span><span className="status-dot" /> MemeRecall v3.0</span>
        <span>GMGN + GPT Signal Classifier + RankScore</span>
        <span>{lb.generatedAt.replace("T", " ").slice(0, 19)} UTC</span>
      </footer>
    </main>
  );
}
