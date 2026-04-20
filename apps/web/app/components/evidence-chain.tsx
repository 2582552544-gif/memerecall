// apps/web/app/components/evidence-chain.tsx
"use client";

import type { EvidenceRow } from "@memerecall/core";
import { Badge } from "@/components/ui/badge";

const intentLabel: Record<string, { text: string; variant: "positive" | "negative" | "warning" }> = {
  S3_CLAIM_BUY: { text: "Claims BUY", variant: "positive" },
  S4_CLAIM_SELL: { text: "Claims SELL", variant: "negative" },
  S2_OPINION: { text: "Opinion", variant: "warning" },
};

const matchLabel: Record<string, string> = {
  immediate_buy: "Bought within 5 min",
  quick_buy: "Bought within 1h",
  delayed_buy: "Bought >1h later",
  buy_before_signal: "Already held before post",
  late_entry: "Late entry (>6h)",
};

function verdictBadge(v: EvidenceRow["verdict"]) {
  switch (v) {
    case "verified":
      return <Badge variant="positive">Verified</Badge>;
    case "contradicted":
      return <Badge variant="negative">Contradicted</Badge>;
    default:
      return <Badge variant="warning">Unverified</Badge>;
  }
}

function formatPrice(v: number): string {
  if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${v.toPrecision(4)}`;
}

export function EvidenceCard({ e }: { e: EvidenceRow }) {
  const intent = intentLabel[e.intent] || intentLabel.S2_OPINION;
  const verdictClass =
    e.verdict === "verified" ? "verdict-verified"
      : e.verdict === "contradicted" ? "verdict-contradicted"
        : "";

  return (
    <div className={`evidence-card ${verdictClass}`}>
      {/* Top row: time + intent + verdict */}
      <div className="evidence-top">
        <div className="evidence-top-left">
          <span>{new Date(e.tweetAt).toLocaleString()}</span>
          <Badge variant={intent.variant}>{intent.text}</Badge>
        </div>
        {verdictBadge(e.verdict)}
      </div>

      {/* 3-column evidence chain */}
      <div className="evidence-chain">
        {/* Column 1: Social Signal */}
        <div className="evidence-col">
          <div className="evidence-col-label">1. Social Signal</div>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, flex: 1 }}>
            {e.tweetText.slice(0, 200)}{e.tweetText.length > 200 ? "..." : ""}
          </p>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="token-tag">${e.token.symbol}</span>
            {e.tweetUrl && (
              <a href={e.tweetUrl} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: 11, color: "var(--cyan)" }}>
                view tweet
              </a>
            )}
          </div>
        </div>

        <div className="evidence-arrow">&rarr;</div>

        {/* Column 2: On-chain Trade */}
        <div className="evidence-col">
          <div className="evidence-col-label">2. On-chain Trade</div>
          {e.match ? (
            <>
              <div style={{ fontSize: 12, color: "var(--muted-2)", marginBottom: 4 }}>
                {matchLabel[e.match.kind] || e.match.kind}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {"Δ"}t = {e.match.deltaMinutes > 0 ? "+" : ""}{e.match.deltaMinutes} min
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                ${e.match.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                @ {formatPrice(e.match.entryPrice)}
              </div>
              <a href={e.match.txUrl} target="_blank" rel="noopener noreferrer"
                 style={{ marginTop: "auto", paddingTop: 8, fontSize: 11, color: "var(--cyan)", fontFamily: "monospace" }}>
                {e.match.txHash.slice(0, 6)}...{e.match.txHash.slice(-4)}
              </a>
            </>
          ) : (
            <div className="evidence-no-match">
              <strong>No matching trade</strong>
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Wallet never bought ${e.token.symbol}
              </span>
            </div>
          )}
        </div>

        <div className="evidence-arrow">&rarr;</div>

        {/* Column 3: Outcome */}
        <div className="evidence-col">
          <div className="evidence-col-label">3. Outcome (Live)</div>
          {e.pnl ? (
            <>
              <div className={`evidence-pnl-value ${e.pnl.roiPct >= 0 ? "is-positive" : "is-negative"}`}>
                {e.pnl.roiPct >= 0 ? "+" : ""}{e.pnl.roiPct.toFixed(1)}%
              </div>
              {e.pnl.currentPrice > 0 && (
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  now {formatPrice(e.pnl.currentPrice)}
                </div>
              )}
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <Badge variant={
                  e.pnl.status === "holding" ? "outline"
                    : e.pnl.status === "closed" ? "positive"
                      : "negative"
                }>
                  {e.pnl.status.toUpperCase()}
                </Badge>
                {e.pnl.realizedUsd !== null && (
                  <span style={{ marginLeft: 8, fontSize: 12 }}>
                    realized ${e.pnl.realizedUsd.toLocaleString()}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--muted)", fontSize: 12 }}>
              -- no position --
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EvidenceList({ evidences }: { evidences: EvidenceRow[] }) {
  if (evidences.length === 0) {
    return <p className="muted">No evidence rows available. Run a full analysis to generate evidence chains.</p>;
  }

  const verified = evidences.filter((e) => e.verdict === "verified").length;
  const contradicted = evidences.filter((e) => e.verdict === "contradicted").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Badge variant="positive">Verified: {verified}</Badge>
        <Badge variant="negative">Contradicted: {contradicted}</Badge>
        <Badge variant="default">Total: {evidences.length}</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {evidences.map((e) => (
          <EvidenceCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}
