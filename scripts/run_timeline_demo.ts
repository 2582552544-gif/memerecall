import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildTimelineAnalysis,
  findSubjectByHandle,
} from "../packages/core/src/index";

async function main(): Promise<void> {
  const handle = (process.argv[2] || "0xWilliam888").replace(/^@/, "");
  const subject = findSubjectByHandle(handle);
  if (!subject) {
    throw new Error(`Tracked subject not found: ${handle}`);
  }

  const report = await buildTimelineAnalysis(
    subject.handle,
    subject.walletAddress,
    subject.chain,
  );

  const outDir = path.resolve(process.cwd(), "data", "timeline");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${handle}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        handle,
        outputPath,
        socialCount: report.socialSignals.length,
        judgementCount: report.judgements.length,
        firstJudgements: report.judgements.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

await main();
