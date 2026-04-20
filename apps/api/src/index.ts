import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import {
  analyzeKolByWallet,
  analyzeKolFull,
  analyzeSocialInvestmentByKol,
  discoverRenownedKOLs,
  discoveredToSubjects,
  batchPrefilter,
  batchAnalyzeKols,
  buildLeaderboard,
  buildTimelineAnalysis,
  dashboardData,
  dispatchMemeRecallAgent,
  findSubjectByHandle,
  getAllStoredAnalysisReports,
  getStoredAnalysisReport,
  kolProfiles,
  listHermesDispatchAgents,
  addWatchlistToken,
  deleteWatchlistToken,
  getTokenChart,
  getLatestWatchEvents,
  listWatchlistTokens,
  listWatchlistTokensWithSignals,
  runMemeRecallAnalysisCycle,
  runTokenWatchCycle,
  sendTelegramTestCard,
  setupMemeRecall,
  tokenProfiles,
} from "@memerecall/core";

await setupMemeRecall();

const app = new Elysia()
  .use(cors())
  .get("/", () => ({
    name: "MemeRecall API",
    status: "ok",
    routes: [
      "/dashboard",
      "/analysis",
      "/analysis/:handle",
      "/analysis/:handle/live",
      "/timeline/:handle",
      "/investment/:handle",
      "/agents",
      "/agents/dispatch",
      "/watchlist",
      "/watchlist/add",
      "/watchlist/delete",
      "/watch/chart",
      "/watch/run",
      "/watch/events",
      "/watch/test-telegram",
      "/analysis/refresh",
      "/trust/:handle",
      "/revival/:contract",
    ],
  }))
  .get("/dashboard", () => dashboardData)
  .get("/agents", () => ({
    name: "MemeRecall agent API",
    agents: listHermesDispatchAgents(),
  }))
  .post("/agents/dispatch", async ({ body, set }) => {
    try {
      return await dispatchMemeRecallAgent(body as Parameters<typeof dispatchMemeRecallAgent>[0]);
    } catch (error) {
      set.status = 400;
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .get("/watchlist", async () => ({
    tokens: await listWatchlistTokensWithSignals(),
  }))
  .post("/watchlist/add", async ({ body, set }) => {
    try {
      return await addWatchlistToken(body as Parameters<typeof addWatchlistToken>[0]);
    } catch (error) {
      set.status = 400;
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .post("/watchlist/delete", async ({ body, set }) => {
    try {
      return await deleteWatchlistToken(body as Parameters<typeof deleteWatchlistToken>[0]);
    } catch (error) {
      set.status = 400;
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .get("/watch/chart", async ({ query, set }) => {
    const address = String(query.address || "").trim();
    const chain = String(query.chain || "").trim() as "sol" | "bsc" | "base";
    const resolution = String(query.resolution || "5m").trim() as "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
    const lookbackMinutes = Number.parseInt(String(query.lookbackMinutes || "30"), 10);

    if (!address || !chain) {
      set.status = 400;
      return { error: "Missing chain or address" };
    }

    try {
      return await getTokenChart({
        chain,
        address,
        resolution,
        lookbackMinutes,
      });
    } catch (error) {
      set.status = 400;
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .get("/watch/events", async () => ({
    events: await getLatestWatchEvents(),
  }))
  .post("/watch/run", async ({ body }) => runTokenWatchCycle(body as Parameters<typeof runTokenWatchCycle>[0]))
  .post("/watch/test-telegram", async ({ body }) =>
    sendTelegramTestCard(body as Parameters<typeof sendTelegramTestCard>[0]))
  .get("/analysis", () => getAllStoredAnalysisReports())
  .get("/analysis/:handle", async ({ params, set }) => {
    const cached = getStoredAnalysisReport(params.handle);
    if (cached) {
      return cached;
    }

    const subject = findSubjectByHandle(params.handle);
    if (!subject) {
      set.status = 404;
      return { error: "Tracked subject not found", handle: params.handle };
    }

    return analyzeKolByWallet(subject.walletAddress, subject.chain);
  })
  .get("/analysis/:handle/live", async ({ params, set }) => {
    const subject = findSubjectByHandle(params.handle);
    if (!subject) {
      set.status = 404;
      return { error: "Tracked subject not found", handle: params.handle };
    }

    return analyzeKolByWallet(subject.walletAddress, subject.chain);
  })
  .get("/timeline/:handle", async ({ params, set }) => {
    const subject = findSubjectByHandle(params.handle);
    if (!subject) {
      set.status = 404;
      return { error: "Tracked subject not found", handle: params.handle };
    }

    return buildTimelineAnalysis(subject.handle, subject.walletAddress, subject.chain);
  })
  .get("/investment/:handle", async ({ params, set }) => {
    const subject = findSubjectByHandle(params.handle);
    if (!subject) {
      set.status = 404;
      return { error: "Tracked subject not found", handle: params.handle };
    }

    return analyzeSocialInvestmentByKol(subject.handle, subject.walletAddress, subject.chain);
  })
  .get("/leaderboard", async ({ query }) => {
    const limit = Number.parseInt(String(query.limit || "10"), 10);
    const discovered = await discoverRenownedKOLs("sol", limit);
    const subjects = discoveredToSubjects(discovered);
    const gmgnMap = new Map(discovered.map((k) => [k.handle, k]));
    const prefilterResults = await batchPrefilter(subjects, gmgnMap);
    const passed = subjects.filter((_, i) => prefilterResults[i].passed);
    const reports = await batchAnalyzeKols(passed, 2);
    const leaderboard = buildLeaderboard(reports, gmgnMap);
    leaderboard.discoveredCount = discovered.length;
    leaderboard.prefilterPassedCount = passed.length;
    return leaderboard;
  })
  .get("/kol/:handle/report", async ({ params, set }) => {
    const subject = findSubjectByHandle(params.handle);
    if (!subject) {
      set.status = 404;
      return { error: "Tracked subject not found", handle: params.handle };
    }
    return analyzeKolFull(subject);
  })
  .get("/analysis/refresh", async () => runMemeRecallAnalysisCycle())
  .get("/trust/:handle", ({ params, set }) => {
    const handle = params.handle.toLowerCase().replace(/^@/, "");
    const result = kolProfiles.find((item) => item.handle.toLowerCase() === handle);
    if (!result) {
      set.status = 404;
      return { error: "KOL not found", handle };
    }
    return result;
  })
  .get("/revival/:contract", ({ params, set }) => {
    const contract = params.contract.toLowerCase();
    const result = tokenProfiles.find(
      (item) => item.contract.toLowerCase() === contract || item.symbol.toLowerCase() === contract,
    );
    if (!result) {
      set.status = 404;
      return { error: "Token not found", contract };
    }
    return result;
  });

const port = Number(process.env.PORT || 4049);

app.listen(port);

console.log(`MemeRecall API listening on http://localhost:${port}`);
