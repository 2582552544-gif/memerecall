import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeKolFull,
  findSubjectByHandle,
} from "@memerecall/core";
import type { ActionTier, RedFlag, ClassifiedSignal, KOLReport } from "@memerecall/core";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProfitBars, SignalRadar } from "./analysis-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Nav } from "../../components/nav";
import { EvidenceList } from "../../components/evidence-chain";
import { FollowerSimulator } from "../../components/follower-simulator";
import { WalletPnlBreakdown } from "../../components/pnl-breakdown";

// ---- Helpers ----

function formatUsd(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return "N/A";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-5)}`;
}

function toneForValue(value: number | null | undefined): string {
  if ((value || 0) > 0) return "is-positive";
  if ((value || 0) < 0) return "is-negative";
  return "is-neutral";
}

function actionBadgeVariant(action: ActionTier): "default" | "positive" | "negative" | "warning" | "outline" {
  switch (action) {
    case "auto_copy": return "positive";
    case "watchlist": return "warning";
    case "narrative_only": return "outline";
    case "avoid": return "negative";
    case "insufficient_data": return "default";
  }
}

function actionLabel(action: ActionTier): string {
  switch (action) {
    case "auto_copy": return "AUTO COPY";
    case "watchlist": return "WATCHLIST";
    case "narrative_only": return "NARRATIVE ONLY";
    case "avoid": return "AVOID";
    case "insufficient_data": return "INSUFFICIENT DATA";
  }
}

function actionEmoji(action: ActionTier): string {
  switch (action) {
    case "auto_copy": return "";
    case "watchlist": return "";
    case "narrative_only": return "";
    case "avoid": return "";
    case "insufficient_data": return "";
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return "score-green";
  if (score >= 60) return "score-yellow";
  if (score >= 30) return "score-orange";
  return "score-red";
}

function intentBadge(level: number): { label: string; variant: "default" | "positive" | "negative" | "warning" | "outline" } {
  switch (level) {
    case 0: return { label: "S0 Noise", variant: "default" };
    case 1: return { label: "S1 Mention", variant: "outline" };
    case 2: return { label: "S2 Opinion", variant: "warning" };
    case 3: return { label: "S3 Buy", variant: "positive" };
    case 4: return { label: "S4 Exit", variant: "negative" };
    default: return { label: `S${level}`, variant: "default" };
  }
}

function chainBadgeClass(chain: string): string {
  switch (chain) {
    case "eth": return "chain-eth";
    case "bsc": return "chain-bsc";
    case "sol": return "chain-sol";
    case "base": return "chain-base";
    default: return "chain-unknown";
  }
}

function flagSeverity(flag: RedFlag): "high" | "medium" | "low" {
  switch (flag) {
    case "CHAIN_MISMATCH":
    case "CLAIMED_BUY_NO_TRADE":
    case "QUICK_FLIP_AFTER_SHILL":
      return "high";
    case "CELEBRITY_FOMO_TRIGGER":
    case "UNDISCLOSED_AFFILIATE":
    case "SELF_CONTRADICTION":
      return "medium";
    case "MICRO_WALLET":
      return "low";
  }
}

function formatIso(value: string | null | undefined): string {
  if (!value) return "N/A";
  return value.replace("T", " ").replace(".000Z", " UTC");
}

// ---- Page ----

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  // 1. Try loading cached report from data/reports/
  const normalizedHandle = handle.replace(/^@/, "").trim().toLowerCase();
  const reportCandidates = [
    path.resolve(process.cwd(), "data", "reports", `${normalizedHandle}-v2.json`),
    path.resolve(process.cwd(), "..", "..", "data", "reports", `${normalizedHandle}-v2.json`),
  ];
  let report: KOLReport | null = null;
  for (const filePath of reportCandidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      report = JSON.parse(raw) as KOLReport;
      break;
    } catch {
      continue;
    }
  }

  // 2. No cache — try live analysis if handle is in catalog
  if (!report) {
    const subject = findSubjectByHandle(handle);
    if (subject) {
      report = await analyzeKolFull(subject);
    }
  }

  // 3. No data at all — show submit prompt
  if (!report) {
    return (
      <main className="terminal-shell">
        <Nav />
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>@{handle} not found</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            No cached analysis for this KOL. Submit a new analysis request.
          </p>
          <Link
            href={`/submit?handle=${encodeURIComponent(handle)}`}
            className="action-badge"
            style={{ display: "inline-block", marginTop: 16, padding: "8px 24px", background: "#7ee6a1", color: "#000", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}
          >
            Analyze @{handle}
          </Link>
        </div>
      </main>
    );
  }

  const profitPoints = report.picks
    .filter((p) => p.aggregateProfitUsd !== null)
    .sort((a, b) => Math.abs(b.aggregateProfitUsd!) - Math.abs(a.aggregateProfitUsd!))
    .slice(0, 10)
    .map((p) => ({ symbol: p.tokenSymbol, profitUsd: p.aggregateProfitUsd! }));

  const radarPoints = [
    { label: "Authenticity", value: report.scores.authenticity },
    { label: "Alpha", value: report.scores.followerAlpha !== null ? Math.max(0, report.scores.followerAlpha + 50) : 0 },
    { label: "Coverage", value: report.scores.coverage },
    { label: "Discipline", value: report.scores.discipline },
  ];

  const s3s4Signals = report.classifiedSignals.filter((s) => s.intentLevel >= 3);
  const nonNoiseSignals = report.classifiedSignals.filter((s) => !s.isNoise);

  return (
    <main className="terminal-shell">
      {/* ===== HEADER ===== */}
      <Nav />
      <div style={{ padding: "8px 16px" }}>
        <Link href="/" style={{ color: "var(--cyan)", fontSize: 13, textDecoration: "none" }}>
          &larr; Back to Leaderboard
        </Link>
      </div>

      {/* ===== TIER 1: HERO SUMMARY CARD ===== */}
      <TooltipProvider>
      <section className="terminal-grid hero-grid">

        {/* Left: Score + Action */}
        <Card className="terminal-panel verdict-panel">
          <CardContent>
            <div className="kol-identity">
              <div className="avatar-orb">
                <img src="/assets/agent-orb.svg" alt="" />
              </div>
              <div>
                <h1>{report.kol.displayName}</h1>
                <div className="muted">@{report.kol.handle} · {report.kol.followers.toLocaleString()} followers</div>
              </div>
            </div>

            <div className={`verdict-score ${scoreColor(report.scores.composite)}`}>
              <span>{report.scores.composite}</span>
              <small>/100</small>
            </div>

            <Badge variant={actionBadgeVariant(report.action)} className="action-badge">
              {actionEmoji(report.action)} {actionLabel(report.action)}
            </Badge>

            {/* 4-dim mini scores */}
            <div className="mini-metric-grid">
              <div>
                <span>Authenticity</span>
                <strong className={scoreColor(report.scores.authenticity)}>{report.scores.authenticity}</strong>
              </div>
              <div>
                <span>Alpha</span>
                <strong>{report.scores.followerAlpha !== null ? report.scores.followerAlpha : "N/A"}</strong>
              </div>
              <div>
                <span>Coverage</span>
                <strong className={scoreColor(report.scores.coverage)}>{report.scores.coverage}</strong>
              </div>
              <div>
                <span>Discipline</span>
                <strong className={scoreColor(report.scores.discipline)}>{report.scores.discipline}</strong>
              </div>
            </div>

            {/* Signal Funnel */}
            <div className="signal-funnel">
              <span>{report.signalStats.total} tweets</span>
              <span className="funnel-arrow">&rarr;</span>
              <span>{nonNoiseSignals.length} evaluated</span>
              <span className="funnel-arrow">&rarr;</span>
              <span>{s3s4Signals.length} actionable</span>
              <span className="funnel-arrow">&rarr;</span>
              <span>{report.picks.filter((p) => p.matchType !== "none").length} verified</span>
            </div>
          </CardContent>
        </Card>

        {/* Center: Insights + Thesis */}
        <Card className="terminal-panel insights-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>TOP INSIGHTS</CardTitle>
            <Badge variant="outline">GPT Analysis</Badge>
          </CardHeader>
          <CardContent>
            <ol className="insight-list">
              {report.topInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ol>

            <div className="terminal-thesis">{report.thesis}</div>

            {/* Red Flags */}
            {report.redFlags.length > 0 && (
              <div className="red-flags-row">
                <span className="flag-label">RED FLAGS ({report.redFlags.length})</span>
                <div className="flag-chips">
                  {report.redFlags.map((flag) => (
                    <span key={flag} className={`flag-chip flag-${flagSeverity(flag)}`}>
                      {flag.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Radar */}
        <Card className="terminal-panel chart-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>4-Dim Score</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalRadar signalPoints={radarPoints} />
          </CardContent>
        </Card>
      </section>

      {/* ===== TIER 2: EVIDENCE PANEL ===== */}
      <Card className="terminal-panel full-width-panel">
        <Tabs defaultValue="picks">
          <TabsList>
            <TabsTrigger value="picks">Picks</TabsTrigger>
            <TabsTrigger value="wallets">Wallets ({report.walletSummaries.length})</TabsTrigger>
            <TabsTrigger value="signals">Signals ({report.classifiedSignals.length})</TabsTrigger>
            <TabsTrigger value="flags">Red Flags ({report.redFlags.length})</TabsTrigger>
            {report.evidences && report.evidences.length > 0 && (
              <TabsTrigger value="evidence">Evidence ({report.evidences.length})</TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Picks */}
          <TabsContent value="picks">
            <CardContent>
              <ScrollArea className="terminal-table-scroll terminal-table-scroll-lg">
                <div className="terminal-table-wrap">
                  <table className="terminal-table">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Chain</th>
                        <th>Match</th>
                        <th>Wallet Action</th>
                        <th>Buy / Sell</th>
                        <th>PnL</th>
                        <th>Score</th>
                        <th>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.picks.map((pick, i) => (
                        <tr key={`${pick.signalId}-${pick.tokenAddress}-${i}`}>
                          <td>
                            <div className="token-cell">
                              <span className="token-icon">{pick.tokenSymbol.slice(0, 1)}</span>
                              <div>
                                <strong>{pick.tokenSymbol}</strong>
                                <small>{shortAddress(pick.tokenAddress)}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`chain-pill-sm ${chainBadgeClass("unknown")}`}>
                              {pick.tokenAddress?.startsWith("0x") ? "EVM" : "SOL"}
                            </span>
                          </td>
                          <td><Badge variant="outline">{pick.matchType}</Badge></td>
                          <td><Badge variant="outline">{pick.walletAction.replaceAll("_", " ")}</Badge></td>
                          <td>
                            <span className="is-positive">{formatUsd(pick.buyUsd)}</span>
                            <span className="muted"> / </span>
                            <span className={toneForValue(pick.sellUsd)}>{formatUsd(pick.sellUsd)}</span>
                          </td>
                          <td className={toneForValue(pick.aggregateProfitUsd)}>
                            {pick.aggregateProfitUsd !== null ? formatUsd(pick.aggregateProfitUsd) : "N/A"}
                          </td>
                          <td><strong className={scoreColor(pick.confidenceScore)}>{pick.confidenceScore}</strong></td>
                          <td>
                            <Badge variant={
                              pick.verdict === "follow_candidate" ? "positive"
                                : pick.verdict === "watch_only" ? "warning"
                                  : pick.verdict === "reject" ? "negative"
                                    : "default"
                            }>
                              {pick.verdict.replaceAll("_", " ")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>

              {/* Wallet-only trades */}
              {report.walletOnlyTrades.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="sub-heading">Wallet-Only Trades (no tweet match)</h4>
                  <div className="compact-feed">
                    {report.walletOnlyTrades.map((trade, i) => (
                      <div key={`wot-${i}`} className="compact-feed-row">
                        <div>
                          <strong>{trade.tokenSymbol}</strong>
                          <small>{shortAddress(trade.tokenAddress)}</small>
                        </div>
                        <div className="feed-stats">
                          <span>{trade.buyCount}B / {trade.sellCount}S</span>
                          <span className={toneForValue(trade.sellUsd - trade.buyUsd)}>
                            {formatUsd(trade.sellUsd - trade.buyUsd)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </TabsContent>

          {/* Tab: Wallets */}
          <TabsContent value="wallets">
            <CardContent>
              <div className="terminal-table-wrap">
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Chain</th>
                      <th>Status</th>
                      <th>Trades</th>
                      <th>PnL</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.walletSummaries.map((w) => (
                      <tr key={w.address}>
                        <td><code>{shortAddress(w.address)}</code></td>
                        <td><span className={`chain-pill-sm ${chainBadgeClass(w.chain)}`}>{w.chain.toUpperCase()}</span></td>
                        <td><Badge variant={w.confirmation === "confirmed" ? "positive" : "warning"}>{w.confirmation}</Badge></td>
                        <td>{w.tradeCount}</td>
                        <td className={toneForValue(w.pnlUsd)}>{formatUsd(w.pnlUsd)}</td>
                        <td>{formatUsd(w.balanceUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chain coverage gap */}
              <div className="coverage-gap" style={{ marginTop: 16 }}>
                <h4 className="sub-heading">Chain Coverage Gap</h4>
                <div className="mini-metric-grid">
                  <div>
                    <span>Signal Chains</span>
                    <strong>{Object.entries(report.chainCoverage.signalChains).map(([c, v]) => `${c.toUpperCase()} ${Math.round(v * 100)}%`).join(", ") || "None"}</strong>
                  </div>
                  <div>
                    <span>Wallet Chains</span>
                    <strong>{Object.keys(report.chainCoverage.walletChains).map((c) => c.toUpperCase()).join(", ") || "None"}</strong>
                  </div>
                  <div>
                    <span>Missing</span>
                    <strong className="is-negative">{report.chainCoverage.missingChains.map((c) => c.toUpperCase()).join(", ") || "None"}</strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </TabsContent>

          {/* Tab: Signals (classified tweets) */}
          <TabsContent value="signals">
            <CardContent>
              <div className="signal-summary" style={{ marginBottom: 12 }}>
                <Badge variant="default">S0: {report.signalStats.s0}</Badge>
                <Badge variant="outline">S1: {report.signalStats.s1}</Badge>
                <Badge variant="warning">S2: {report.signalStats.s2}</Badge>
                <Badge variant="positive">S3: {report.signalStats.s3}</Badge>
                <Badge variant="negative">S4: {report.signalStats.s4}</Badge>
              </div>
              <ScrollArea className="terminal-table-scroll terminal-table-scroll-lg">
                <div className="terminal-table-wrap">
                  <table className="terminal-table">
                    <thead>
                      <tr>
                        <th>Intent</th>
                        <th>Claim</th>
                        <th>Tokens</th>
                        <th>Category</th>
                        <th>Tweet</th>
                        <th>Reasoning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.classifiedSignals
                        .filter((s) => s.intentLevel >= 1)
                        .sort((a, b) => b.intentLevel - a.intentLevel)
                        .map((sig) => {
                          const badge = intentBadge(sig.intentLevel);
                          return (
                            <tr key={sig.tweetId}>
                              <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                              <td><Badge variant="outline">{sig.positionClaim}</Badge></td>
                              <td>
                                {sig.tokens.map((t, i) => (
                                  <span key={i} className="token-tag">
                                    ${t.symbol}
                                    <small className={chainBadgeClass(t.chain)}> {t.chain}</small>
                                  </span>
                                ))}
                              </td>
                              <td><small>{sig.narrativeCategory}</small></td>
                              <td className="wrap-cell">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a href={sig.tweetUrl} target="_blank" rel="noopener noreferrer">
                                      {sig.tweetText.slice(0, 80)}...
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent className="wide-tooltip">{sig.tweetText}</TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="wrap-cell"><small>{sig.reasoning}</small></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>

          {/* Tab: Red Flags */}
          <TabsContent value="flags">
            <CardContent>
              {report.redFlags.length === 0 ? (
                <p className="muted">No red flags detected.</p>
              ) : (
                <div className="flag-detail-list">
                  {report.redFlags.map((flag) => (
                    <div key={flag} className={`flag-detail flag-${flagSeverity(flag)}`}>
                      <div className="flag-header">
                        <span className={`flag-dot flag-dot-${flagSeverity(flag)}`} />
                        <strong>{flag.replaceAll("_", " ")}</strong>
                        <Badge variant={flagSeverity(flag) === "high" ? "negative" : "warning"}>
                          {flagSeverity(flag)}
                        </Badge>
                      </div>
                      <p className="flag-description">
                        {flag === "CHAIN_MISMATCH" && `Signal chains (${report.chainCoverage.missingChains.map(c => c.toUpperCase()).join(", ")}) are not covered by any mapped wallet. This is a coverage gap, not proof of fraud.`}
                        {flag === "CLAIMED_BUY_NO_TRADE" && "KOL claimed to buy tokens in tweets but no corresponding wallet trade was found."}
                        {flag === "MICRO_WALLET" && "Total wallet trading volume is below $1,000 — too small to validate signal quality."}
                        {flag === "CELEBRITY_FOMO_TRIGGER" && "Multiple tweets leverage celebrity names (Elon, CZ, Vitalik) to create FOMO."}
                        {flag === "UNDISCLOSED_AFFILIATE" && "Suspected undisclosed paid promotion or affiliate marketing detected."}
                        {flag === "SELF_CONTRADICTION" && "KOL explicitly denied buying tokens they appeared to promote."}
                        {flag === "QUICK_FLIP_AFTER_SHILL" && "KOL sold tokens shortly after promoting them — suspected distribution."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </TabsContent>

          {/* Tab: Evidence Chain */}
          {report.evidences && report.evidences.length > 0 && (
            <TabsContent value="evidence">
              <CardContent>
                <EvidenceList evidences={report.evidences} />
              </CardContent>
            </TabsContent>
          )}
        </Tabs>
      </Card>

      {/* ===== TIER 2.5: SIMULATOR + PNL BREAKDOWN ===== */}
      {(report.followerSim || report.pnlBreakdown) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {report.followerSim && (
            <FollowerSimulator handle={report.kol.handle} sim={report.followerSim} />
          )}
          {report.pnlBreakdown && (
            <WalletPnlBreakdown breakdown={report.pnlBreakdown} />
          )}
        </div>
      )}

      {/* ===== TIER 3: DEEP REPORT (charts) ===== */}
      {profitPoints.length > 0 && (
        <Card className="terminal-panel full-width-panel">
          <CardHeader className="panel-title-row">
            <CardTitle>Trade PnL Distribution</CardTitle>
            <Badge variant="outline">ECharts</Badge>
          </CardHeader>
          <CardContent>
            <ProfitBars profitPoints={profitPoints} />
          </CardContent>
        </Card>
      )}

      </TooltipProvider>

      <footer className="terminal-footer">
        <span><span className="status-dot" /> Agent v{report.agentVersion}</span>
        <span>GPT Signal Classifier + GMGN Multi-Chain + MemeRecall</span>
        <span>{formatIso(report.generatedAt)}</span>
      </footer>
    </main>
  );
}
