import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addWatchlistToken,
  listWatchlistTokens,
  runTokenWatchCycle,
} from "../packages/core/src/index";

async function main(): Promise<void> {
  const [, , maybeAddress, maybeChain] = process.argv;
  if (maybeAddress) {
    await addWatchlistToken({
      address: maybeAddress,
      chain: (maybeChain || "sol") as "sol" | "bsc" | "base",
      thresholdPct: 20,
      cooldownMinutes: 30,
      note: "Added from token-watch demo",
    });
  }

  const watchlist = await listWatchlistTokens();
  const report = await runTokenWatchCycle({
    dryRun: true,
    forceNotify: process.argv.includes("--force"),
  });

  const outDir = path.resolve(process.cwd(), "data", "watch");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, "last-cycle.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({
    ok: true,
    outputPath,
    watchlistCount: watchlist.length,
    checked: report.checked,
    alertCount: report.alerts.length,
    dryRun: report.dryRun,
    alerts: report.alerts,
    notes: report.notes,
  }, null, 2));
}

await main();
