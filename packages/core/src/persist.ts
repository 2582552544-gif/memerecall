import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KolAnalysisReport } from "./gmgn-types";

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

function reportPath(reportsDir: string, handle: string): string {
  return path.join(reportsDir, `${normalizeHandle(handle)}.json`);
}

export async function saveAnalysisReport(
  reportsDir: string,
  handle: string,
  report: KolAnalysisReport,
): Promise<string> {
  await mkdir(reportsDir, { recursive: true });
  const outputPath = reportPath(reportsDir, handle);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export async function loadAnalysisReport(
  reportsDir: string,
  handle: string,
): Promise<KolAnalysisReport | null> {
  try {
    const raw = await readFile(reportPath(reportsDir, handle), "utf8");
    return JSON.parse(raw) as KolAnalysisReport;
  } catch {
    return null;
  }
}
