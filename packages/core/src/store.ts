import type { KolAnalysisReport } from "./gmgn-types";

const reportStore = new Map<string, KolAnalysisReport>();

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

export function setStoredAnalysisReport(
  handle: string,
  report: KolAnalysisReport,
): void {
  reportStore.set(normalizeHandle(handle), report);
}

export function getStoredAnalysisReport(
  handle: string,
): KolAnalysisReport | null {
  return reportStore.get(normalizeHandle(handle)) || null;
}

export function getAllStoredAnalysisReports(): KolAnalysisReport[] {
  return Array.from(reportStore.values());
}
