/**
 * MemeRecall v3.0 Leaderboard Demo
 *
 * Full funnel: GMGN Discovery → Prefilter → v2.0 Analysis → Ranking → Leaderboard
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  discoverKOLs,
  discoveredToSubjects,
  batchPrefilter,
  batchAnalyzeKols,
  buildLeaderboard,
} from "../packages/core/src/index";
import type { DiscoveredKOL } from "../packages/core/src/leaderboard-types";

async function main(): Promise<void> {
  const limit = Number.parseInt(process.argv[2] || "10", 10);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  MemeRecall v3.0 Leaderboard Engine`);
  console.log(`  Discovering ${limit} KOLs from GMGN renowned ranking`);
  console.log(`${"=".repeat(60)}\n`);

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
    console.log("\n  No KOLs passed prefilter. Exiting.");
    return;
  }

  // Step 3: Batch v2.0 Analysis
  console.log(`\n[Step 3/4] Analyzing ${passedSubjects.length} KOLs (v2.0 pipeline, 2 concurrent)...\n`);
  const reports = await batchAnalyzeKols(passedSubjects, 2);

  // Step 4: Ranking
  console.log(`\n[Step 4/4] Computing RankScore and building leaderboard...\n`);
  const leaderboard = buildLeaderboard(reports, gmgnMap);
  leaderboard.discoveredCount = discovered.length;
  leaderboard.prefilterPassedCount = passedSubjects.length;

  // Save to file
  const outDir = path.resolve(process.cwd(), "data", "leaderboard");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, "latest.json");
  await writeFile(outputPath, JSON.stringify(leaderboard, null, 2), "utf8");

  // Print leaderboard
  console.log(`${"=".repeat(80)}`);
  console.log(`  LEADERBOARD (${leaderboard.entries.length} KOLs)`);
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

  console.log(`\n  Saved to: ${outputPath}`);
  console.log(`  Generated at: ${leaderboard.generatedAt}\n`);
}

await main();
