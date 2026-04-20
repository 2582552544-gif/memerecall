/**
 * MemeRecall v3.0 Leaderboard Engine
 *
 * Full funnel: GMGN Discovery → Prefilter → v2.0 Analysis → Ranking → Leaderboard
 *
 * CRUD logic: new entries are upserted into the existing leaderboard.
 * Old KOLs that weren't in this run are preserved. Re-ranks all entries.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  discoverKOLs,
  discoveredToSubjects,
  batchPrefilter,
  batchAnalyzeKols,
  buildLeaderboard,
} from "../packages/core/src/index";
import type { DiscoveredKOL } from "../packages/core/src/leaderboard-types";
import type { Leaderboard, LeaderboardEntry } from "../packages/core/src/leaderboard-types";

const LEADERBOARD_DIR = path.resolve(process.cwd(), "data", "leaderboard");
const LEADERBOARD_PATH = path.join(LEADERBOARD_DIR, "latest.json");

/** Load existing leaderboard from disk, or return empty */
async function loadExisting(): Promise<Leaderboard | null> {
  try {
    const raw = await readFile(LEADERBOARD_PATH, "utf8");
    const data = JSON.parse(raw) as Leaderboard;
    if (data.entries?.length > 0) return data;
  } catch { /* first run — no file yet */ }
  return null;
}

/** Merge new entries into existing: upsert by handle, re-rank */
function mergeLeaderboards(existing: Leaderboard | null, fresh: Leaderboard): Leaderboard {
  // Build map: handle → entry (existing first, then overwrite with fresh)
  const map = new Map<string, LeaderboardEntry>();

  // Keep all existing entries
  if (existing) {
    for (const entry of existing.entries) {
      map.set(entry.handle, entry);
    }
  }

  // Upsert fresh entries (overwrite if same handle)
  for (const entry of fresh.entries) {
    map.set(entry.handle, entry);
  }

  // Re-sort by rankScore descending and re-assign ranks
  const merged = [...map.values()]
    .sort((a, b) => b.rankScore - a.rankScore);
  merged.forEach((entry, i) => { entry.rank = i + 1; });

  return {
    generatedAt: fresh.generatedAt,
    kolCount: merged.length,
    discoveredCount: fresh.discoveredCount,
    prefilterPassedCount: fresh.prefilterPassedCount,
    analyzedCount: fresh.analyzedCount,
    entries: merged,
  };
}

async function main(): Promise<void> {
  const limit = Number.parseInt(process.argv[2] || "10", 10);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  MemeRecall v3.0 Leaderboard Engine`);
  console.log(`  Discovering ${limit} KOLs from GMGN renowned ranking`);
  console.log(`${"=".repeat(60)}\n`);

  // Load existing leaderboard
  const existing = await loadExisting();
  if (existing) {
    console.log(`  [DB] Loaded ${existing.entries.length} existing KOLs from leaderboard\n`);
  }

  // Step 1: Discovery
  const discovered = await discoverKOLs("sol", limit);
  console.log(`\n[Step 1/4] Discovered ${discovered.length} KOLs with twitter binding\n`);

  for (const kol of discovered) {
    console.log(
      `  @${kol.handle.padEnd(22)} | 7d PnL: $${kol.realizedProfit7d.toFixed(0).padStart(8)} | WR: ${(kol.winrate7d * 100).toFixed(0).padStart(3)}% | ${kol.tags.join(",")}`,
    );
  }

  // Build lookup map
  const gmgnMap = new Map<string, DiscoveredKOL>(
    discovered.map((k) => [k.handle, k]),
  );

  // Step 2: Prefilter
  console.log(`\n[Step 2/4] Running prefilter (6 gates, zero GPT cost)...\n`);
  const subjects = discoveredToSubjects(discovered);
  const prefilterResults = await batchPrefilter(subjects, gmgnMap);

  const passedSubjects = subjects.filter((_, i) => prefilterResults[i].passed);
  const rejectedSubjects = prefilterResults.filter((r) => !r.passed);

  console.log(
    `\n  Passed: ${passedSubjects.length}/${subjects.length}` +
    (rejectedSubjects.length > 0
      ? ` | Rejected: ${rejectedSubjects.map((r) => `@${r.handle}(${r.failureReason})`).join(", ")}`
      : ""),
  );

  if (passedSubjects.length === 0) {
    console.log("\n  No KOLs passed prefilter.");
    if (existing) {
      console.log(`  Keeping existing ${existing.entries.length} KOLs in leaderboard.\n`);
    }
    return;
  }

  // Step 3: Batch v2.0 Analysis
  console.log(`\n[Step 3/4] Analyzing ${passedSubjects.length} KOLs (v2.0 pipeline, 2 concurrent)...\n`);
  const reports = await batchAnalyzeKols(passedSubjects, 2);

  if (reports.length === 0) {
    console.log("\n  All analyses failed.");
    if (existing) {
      console.log(`  Keeping existing ${existing.entries.length} KOLs in leaderboard.\n`);
    }
    return;
  }

  // Step 4: Ranking + Merge
  console.log(`\n[Step 4/4] Computing RankScore and merging into leaderboard...\n`);
  const freshLeaderboard = buildLeaderboard(reports, gmgnMap);
  freshLeaderboard.discoveredCount = discovered.length;
  freshLeaderboard.prefilterPassedCount = passedSubjects.length;

  // CRUD: merge fresh into existing
  const leaderboard = mergeLeaderboards(existing, freshLeaderboard);

  // Save
  await mkdir(LEADERBOARD_DIR, { recursive: true });
  await writeFile(LEADERBOARD_PATH, JSON.stringify(leaderboard, null, 2), "utf8");

  // Print leaderboard
  console.log(`${"=".repeat(80)}`);
  console.log(`  LEADERBOARD (${leaderboard.entries.length} KOLs — ${freshLeaderboard.entries.length} new/updated, ${leaderboard.entries.length - freshLeaderboard.entries.length} preserved)`);
  console.log(`${"=".repeat(80)}`);
  console.log(
    `  ${"#".padStart(3)} | ${"KOL".padEnd(22)} | ${"Tier".padEnd(4)} | ${"Action".padEnd(18)} | ${"Score".padStart(5)} | ${"7d α".padStart(8)} | ${"WR".padStart(4)} | Flags`,
  );
  console.log(`  ${"-".repeat(76)}`);

  for (const entry of leaderboard.entries) {
    const tierEmoji = entry.tier === "S" ? "S" : entry.tier === "A" ? "A" : "B";
    const roi = entry.medianROI !== null ? `${entry.medianROI > 0 ? "+" : ""}${entry.medianROI.toFixed(0)}%` : "N/A";
    console.log(
      `  ${String(entry.rank).padStart(3)} | @${entry.handle.padEnd(20)} | ${tierEmoji.padEnd(4)} | ${entry.action.padEnd(18)} | ${String(entry.rankScore).padStart(5)} | ${roi.padStart(8)} | ${String(entry.winRate).padStart(3)}% | ${entry.redFlagCount}`,
    );
  }

  console.log(`\n  Saved to: ${LEADERBOARD_PATH}`);
  console.log(`  Generated at: ${leaderboard.generatedAt}\n`);
}

await main();
