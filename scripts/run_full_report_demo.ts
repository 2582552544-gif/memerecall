import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeKolFull, findSubjectByHandle } from "../packages/core/src/index";

async function main(): Promise<void> {
  const handle = (process.argv[2] || "0xWilliam888").replace(/^@/, "");
  const subject = findSubjectByHandle(handle);
  if (!subject) {
    throw new Error(`Tracked subject not found: ${handle}`);
  }

  console.log(`\n=== MemeRecall v2.0 Full Report: @${handle} ===\n`);
  const report = await analyzeKolFull(subject);

  const outDir = path.resolve(process.cwd(), "data", "reports");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${handle}-v2.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        handle,
        outputPath,
        action: report.action,
        scores: report.scores,
        signalStats: report.signalStats,
        redFlags: report.redFlags,
        chainCoverage: report.chainCoverage,
        topInsights: report.topInsights,
        thesis: report.thesis,
        picksCount: report.picks.length,
        walletOnlyCount: report.walletOnlyTrades.length,
        topPicks: report.picks.slice(0, 3).map((p) => ({
          token: p.tokenSymbol,
          matchType: p.matchType,
          walletAction: p.walletAction,
          score: p.confidenceScore,
          verdict: p.verdict,
        })),
      },
      null,
      2,
    ),
  );
}

await main();
