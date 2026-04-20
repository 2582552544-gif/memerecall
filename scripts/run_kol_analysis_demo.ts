import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeKolByWallet, findSubjectByHandle } from "../packages/core/src/index";

async function main(): Promise<void> {
  const handle = (process.argv[2] || "0xWilliam888").replace(/^@/, "");
  const subject = findSubjectByHandle(handle);
  if (!subject) {
    throw new Error(`Tracked subject not found: ${handle}`);
  }

  const report = await analyzeKolByWallet(subject.walletAddress, subject.chain);
  const outDir = path.resolve(process.cwd(), "data", "analysis");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${handle}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        handle,
        outputPath,
        summary: report.summary,
        firstRows: report.tradeDecisions.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

await main();
