import { trackedSubjects } from "./agent-catalog";
import { getMemeRecallConfig } from "./config";
import { loadAnalysisReport } from "./persist";
import { setStoredAnalysisReport } from "./store";
import { runMemeRecallAnalysisCycle } from "./worker";

export async function setupMemeRecall(): Promise<void> {
  const config = getMemeRecallConfig();

  for (const subject of trackedSubjects) {
    const report = await loadAnalysisReport(config.reportsDir, subject.handle);
    if (report) {
      setStoredAnalysisReport(subject.handle, report);
    }
  }

  if (config.runOnStartup) {
    await runMemeRecallAnalysisCycle();
  }
}
