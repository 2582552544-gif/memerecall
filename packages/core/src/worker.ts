import { trackedSubjects } from "./agent-catalog";
import { getMemeRecallConfig } from "./config";
import { analyzeKolByWallet } from "./agents/kol-analysis-agent";
import { saveAnalysisReport } from "./persist";
import { setStoredAnalysisReport } from "./store";

export interface AnalysisCycleResult {
  generatedAt: string;
  reportsDir: string;
  processed: Array<{
    handle: string;
    walletAddress: string;
    outputPath: string;
  }>;
}

export async function runMemeRecallAnalysisCycle(): Promise<AnalysisCycleResult> {
  const config = getMemeRecallConfig();
  const processed: AnalysisCycleResult["processed"] = [];

  for (const subject of trackedSubjects) {
    const report = await analyzeKolByWallet(subject.walletAddress, subject.chain);
    setStoredAnalysisReport(subject.handle, report);
    const outputPath = await saveAnalysisReport(
      config.reportsDir,
      subject.handle,
      report,
    );
    processed.push({
      handle: subject.handle,
      walletAddress: subject.walletAddress,
      outputPath,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    reportsDir: config.reportsDir,
    processed,
  };
}
