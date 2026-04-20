# Evidence-First KOL Analysis UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Evidence-First" data layer and UI to MemeRecall so users can see the complete proof chain for each KOL: tweet signal -> on-chain trade -> PnL outcome, plus a copy-trade simulator and wallet PnL breakdown.

**Architecture:** Backend adds `EvidenceRow[]` to `KOLReport` by cross-referencing classified signals with activity rows and live token prices. Frontend adds three new components to the existing `analysis/[handle]/page.tsx` detail page as new tabs, using the existing CSS design system and shadcn/ui components. No CSS system rewrite.

**Tech Stack:** TypeScript, Bun, Elysia.js (backend), Next.js 15 + React 19 + ECharts + shadcn/ui (frontend), GMGN API (data source)

---

## File Structure

### Backend (packages/core/src/)

| File | Action | Responsibility |
|------|--------|---------------|
| `evidence-types.ts` | Create | `EvidenceRow`, `FollowerSimResult`, `PnlBreakdownRow` type definitions |
| `agents/evidence-builder.ts` | Create | `buildEvidenceRows()` — cross-references signals with activities, fetches live prices |
| `agents/kol-full-agent.ts` | Modify | Wire `buildEvidenceRows()` into the analysis pipeline, add fields to `KOLReport` |
| `kol-report-types.ts` | Modify | Extend `KOLReport` interface with `evidences`, `followerSim`, `pnlBreakdown` |
| `index.ts` | Modify | Re-export new types |

### Frontend (apps/web/)

| File | Action | Responsibility |
|------|--------|---------------|
| `app/components/evidence-chain.tsx` | Create | `EvidenceCard` component — 3-column tweet->trade->PnL card |
| `app/components/follower-simulator.tsx` | Create | `FollowerSimulator` component — copy-trade ROI calculator |
| `app/components/pnl-breakdown.tsx` | Create | `WalletPnlBreakdown` component — token-level PnL table with tweeted-alignment % |
| `app/analysis/[handle]/page.tsx` | Modify | Add Evidence/Simulator/Breakdown tabs |
| `app/globals.css` | Modify | Add ~40 lines of CSS for new components |

---

## Task 1: Define Evidence Types

**Files:**
- Create: `packages/core/src/evidence-types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create the evidence types file**

```typescript
// packages/core/src/evidence-types.ts

export type TradeMatchKind =
  | "buy_before_signal"
  | "immediate_buy"
  | "quick_buy"
  | "delayed_buy"
  | "late_entry";

export type EvidenceVerdict = "verified" | "unverified" | "contradicted";

export type EvidenceIntent = "S3_CLAIM_BUY" | "S4_CLAIM_SELL" | "S2_OPINION";

export interface EvidenceTradeMatch {
  kind: TradeMatchKind;
  deltaMinutes: number;
  txHash: string;
  txUrl: string;
  amountUsd: number;
  entryPrice: number;
}

export interface EvidencePnl {
  currentPrice: number;
  roiPct: number;
  realizedUsd: number | null;
  status: "holding" | "closed" | "rug";
}

export interface EvidenceRow {
  id: string;
  tweetAt: string;
  tweetText: string;
  tweetUrl: string;
  intent: EvidenceIntent;
  token: {
    symbol: string;
    address: string;
    chain: string;
  };
  match: EvidenceTradeMatch | null;
  pnl: EvidencePnl | null;
  verdict: EvidenceVerdict;
}

export interface FollowerSimResult {
  unitUsd: number;
  totalInvested: number;
  finalValue: number;
  pnlUsd: number;
  roiPct: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  signalCount: number;
}

export interface PnlBreakdownRow {
  symbol: string;
  chain: string;
  realizedUsd: number;
  unrealizedUsd: number;
  tweeted: boolean;
}

export interface PnlBreakdownSummary {
  totalPnl: number;
  tweetedPnl: number;
  alignmentPct: number;
  positions: PnlBreakdownRow[];
}
```

- [ ] **Step 2: Add export to index.ts**

Add to the end of `packages/core/src/index.ts`:

```typescript
export * from "./evidence-types";
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/evidence-types.ts packages/core/src/index.ts
git commit -m "feat(core): add EvidenceRow, FollowerSimResult, PnlBreakdown types"
```

---

## Task 2: Extend KOLReport Interface

**Files:**
- Modify: `packages/core/src/kol-report-types.ts:1` (import line)
- Modify: `packages/core/src/kol-report-types.ts:86-109` (KOLReport interface)

- [ ] **Step 1: Add import for new types**

At the top of `packages/core/src/kol-report-types.ts`, after the existing import line, add:

```typescript
import type { EvidenceRow, FollowerSimResult, PnlBreakdownSummary } from "./evidence-types";
```

- [ ] **Step 2: Add optional fields to KOLReport**

In the `KOLReport` interface, after the `walletSummaries` field (line ~108), add three new optional fields:

```typescript
  // Evidence-first analysis (v2.1)
  evidences?: EvidenceRow[];
  followerSim?: FollowerSimResult;
  pnlBreakdown?: PnlBreakdownSummary;
```

These are optional (`?`) so existing reports without them still parse.

- [ ] **Step 3: Verify typecheck**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: No new errors (fields are optional)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/kol-report-types.ts
git commit -m "feat(core): extend KOLReport with evidences, followerSim, pnlBreakdown"
```

---

## Task 3: Implement buildEvidenceRows

**Files:**
- Create: `packages/core/src/agents/evidence-builder.ts`

This is the core logic. It cross-references `ClassifiedSignal[]` with `ActivityRow[]` (already collected in `analyzeKolFull`) and fetches live token prices for matched tokens.

- [ ] **Step 1: Create evidence-builder.ts**

```typescript
// packages/core/src/agents/evidence-builder.ts

import type { ClassifiedSignal } from "../kol-report-types";
import type { ActivityRow } from "../activity-types";
import type { SocialInvestmentPick } from "../social-investment-types";
import type { WalletTradeDecision } from "../gmgn-types";
import type {
  EvidenceRow,
  EvidenceIntent,
  EvidenceTradeMatch,
  EvidencePnl,
  EvidenceVerdict,
  FollowerSimResult,
  PnlBreakdownRow,
  PnlBreakdownSummary,
} from "../evidence-types";
import { fetchGmgnTokenInfo } from "../gmgn-client";

// ---- Helpers ----

function normalizeSymbol(v: string | null | undefined): string {
  return (v || "").trim().toUpperCase();
}

function normalizeAddress(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function intentFromLevel(
  level: number,
  claim: string,
): EvidenceIntent {
  if (level >= 4) return "S4_CLAIM_SELL";
  if (level >= 3) return "S3_CLAIM_BUY";
  return "S2_OPINION";
}

function buildTxUrl(txHash: string, chain: string): string {
  switch (chain) {
    case "sol": return `https://solscan.io/tx/${txHash}`;
    case "bsc": return `https://bscscan.com/tx/${txHash}`;
    case "base": return `https://basescan.org/tx/${txHash}`;
    case "eth": return `https://etherscan.io/tx/${txHash}`;
    default: return `https://solscan.io/tx/${txHash}`;
  }
}

// ---- Match signals to activities ----

interface ActivityMatch {
  txHash: string;
  chain: string;
  deltaMinutes: number;
  amountUsd: number;
  entryPrice: number;
  eventType: string;
}

function findClosestActivity(
  signalTimestampMs: number,
  tokenSymbol: string,
  tokenAddress: string | undefined,
  activities: (ActivityRow & { chain: string })[],
): ActivityMatch | null {
  const symNorm = normalizeSymbol(tokenSymbol);
  const addrNorm = normalizeAddress(tokenAddress);

  // Find activities for this token
  const candidates = activities.filter((a) => {
    if (addrNorm && normalizeAddress(a.tokenAddress) === addrNorm) return true;
    if (symNorm && normalizeSymbol(a.tokenSymbol) === symNorm) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  // Find the one closest in time to the signal (prefer buys)
  const signalSec = Math.floor(signalTimestampMs / 1000);
  const buys = candidates.filter((c) => c.eventType === "buy");
  const pool = buys.length > 0 ? buys : candidates;

  let best: (ActivityRow & { chain: string }) | null = null;
  let bestDelta = Infinity;
  for (const c of pool) {
    if (!c.timestamp) continue;
    const delta = Math.abs(c.timestamp - signalSec);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }

  if (!best || !best.timestamp || !best.txHash) return null;

  return {
    txHash: best.txHash,
    chain: best.chain,
    deltaMinutes: Math.round((best.timestamp - signalSec) / 60),
    amountUsd: best.costUsd || 0,
    entryPrice: best.priceUsd || 0,
    eventType: best.eventType || "buy",
  };
}

function deltaToMatchKind(
  deltaMinutes: number,
): EvidenceTradeMatch["kind"] {
  if (deltaMinutes < -1440) return "late_entry"; // >24h before = probably unrelated
  if (deltaMinutes < 0) return "buy_before_signal";
  if (deltaMinutes < 5) return "immediate_buy";
  if (deltaMinutes < 60) return "quick_buy";
  if (deltaMinutes < 360) return "delayed_buy";
  return "late_entry";
}

// ---- Live token prices (best-effort) ----

async function fetchLivePrices(
  tokens: Array<{ address: string; chain: string }>,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const unique = new Map<string, { address: string; chain: string }>();

  for (const t of tokens) {
    const key = `${t.chain}:${normalizeAddress(t.address)}`;
    if (!unique.has(key) && t.address && t.address.length > 6) {
      unique.set(key, t);
    }
  }

  // Limit to 10 concurrent fetches to avoid rate limiting
  const entries = [...unique.entries()].slice(0, 10);
  await Promise.allSettled(
    entries.map(async ([key, { address, chain }]) => {
      try {
        const info = await fetchGmgnTokenInfo(address, chain);
        const price = Number(info.price);
        if (Number.isFinite(price) && price > 0) {
          prices.set(key, price);
        }
      } catch {
        // Ignore — price will be null in the evidence row
      }
    }),
  );

  return prices;
}

// ---- Main builder ----

export async function buildEvidenceRows(
  signals: ClassifiedSignal[],
  activities: (ActivityRow & { chain: string })[],
  picks: SocialInvestmentPick[],
): Promise<EvidenceRow[]> {
  // Only process S2+ signals that mention tokens
  const actionable = signals.filter(
    (s) => s.intentLevel >= 2 && s.tokens.length > 0,
  );

  if (actionable.length === 0) return [];

  // Build token list for live price fetching
  const tokensForPricing = actionable.flatMap((s) =>
    s.tokens
      .filter((t) => t.address)
      .map((t) => ({ address: t.address!, chain: t.chain })),
  );
  const livePrices = await fetchLivePrices(tokensForPricing);

  const rows: EvidenceRow[] = [];

  for (const signal of actionable) {
    for (const token of signal.tokens) {
      const signalTimestampMs = Date.parse(signal.createdAt);
      if (!signalTimestampMs) continue;

      // Find matching on-chain activity
      const activityMatch = findClosestActivity(
        signalTimestampMs,
        token.symbol,
        token.address,
        activities,
      );

      // Build trade match
      let match: EvidenceTradeMatch | null = null;
      if (activityMatch) {
        match = {
          kind: deltaToMatchKind(activityMatch.deltaMinutes),
          deltaMinutes: activityMatch.deltaMinutes,
          txHash: activityMatch.txHash,
          txUrl: buildTxUrl(activityMatch.txHash, activityMatch.chain),
          amountUsd: activityMatch.amountUsd,
          entryPrice: activityMatch.entryPrice,
        };
      }

      // Build PnL from pick data + live price
      let pnl: EvidencePnl | null = null;
      const pickMatch = picks.find(
        (p) =>
          normalizeSymbol(p.tokenSymbol) === normalizeSymbol(token.symbol) ||
          (token.address && normalizeAddress(p.tokenAddress) === normalizeAddress(token.address)),
      );

      const priceKey = `${token.chain}:${normalizeAddress(token.address)}`;
      const livePrice = livePrices.get(priceKey);

      if (pickMatch && match) {
        const currentPrice = livePrice || 0;
        const entryPrice = match.entryPrice;
        const roiPct = entryPrice > 0 && currentPrice > 0
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : pickMatch.aggregateProfitPct || 0;

        pnl = {
          currentPrice,
          roiPct,
          realizedUsd: pickMatch.aggregateStatus === "cleared"
            ? pickMatch.aggregateProfitUsd
            : null,
          status: pickMatch.aggregateStatus === "cleared" ? "closed" : "holding",
        };
      }

      // Determine verdict
      const intent = intentFromLevel(signal.intentLevel, signal.positionClaim);
      let verdict: EvidenceVerdict = "unverified";

      if (match && (intent === "S3_CLAIM_BUY" || intent === "S4_CLAIM_SELL")) {
        verdict = "verified";
      }
      if (
        !match &&
        signal.positionClaim === "claimed_buy" &&
        signal.intentLevel >= 3
      ) {
        verdict = "contradicted";
      }

      rows.push({
        id: makeId("ev"),
        tweetAt: signal.createdAt,
        tweetText: signal.tweetText.slice(0, 500),
        tweetUrl: signal.tweetUrl,
        intent,
        token: {
          symbol: token.symbol,
          address: token.address || "",
          chain: token.chain,
        },
        match,
        pnl,
        verdict,
      });
    }
  }

  // Deduplicate: keep best verdict per token per signal
  const best = new Map<string, EvidenceRow>();
  for (const row of rows) {
    const key = `${row.tweetUrl}:${normalizeSymbol(row.token.symbol)}`;
    const existing = best.get(key);
    if (
      !existing ||
      (row.verdict === "verified" && existing.verdict !== "verified") ||
      (row.match && !existing.match)
    ) {
      best.set(key, row);
    }
  }

  return [...best.values()].sort(
    (a, b) => Date.parse(b.tweetAt) - Date.parse(a.tweetAt),
  );
}

// ---- Follower Simulator ----

export function computeFollowerSim(
  evidences: EvidenceRow[],
  unitUsd = 100,
): FollowerSimResult {
  const actionable = evidences.filter(
    (e) => e.intent === "S3_CLAIM_BUY" && e.pnl,
  );

  const totalInvested = actionable.length * unitUsd;
  let finalValue = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const e of actionable) {
    const roi = e.pnl!.roiPct;
    const value = unitUsd * (1 + roi / 100);
    finalValue += value;
    if (roi > 0) winCount++;
    else lossCount++;
  }

  const pnlUsd = finalValue - totalInvested;
  const roiPct = totalInvested > 0 ? (pnlUsd / totalInvested) * 100 : 0;

  return {
    unitUsd,
    totalInvested,
    finalValue: Math.round(finalValue * 100) / 100,
    pnlUsd: Math.round(pnlUsd * 100) / 100,
    roiPct: Math.round(roiPct * 10) / 10,
    winCount,
    lossCount,
    winRate: actionable.length > 0
      ? Math.round((winCount / actionable.length) * 100)
      : 0,
    signalCount: actionable.length,
  };
}

// ---- PnL Breakdown ----

export function computePnlBreakdown(
  tradeDecisions: (WalletTradeDecision & { chain: string })[],
  signals: ClassifiedSignal[],
): PnlBreakdownSummary {
  // Build set of tweeted token symbols
  const tweetedSymbols = new Set<string>();
  for (const s of signals) {
    if (s.intentLevel >= 2) {
      for (const t of s.tokens) {
        tweetedSymbols.add(normalizeSymbol(t.symbol));
      }
    }
  }

  const positions: PnlBreakdownRow[] = tradeDecisions
    .filter((d) => Math.abs(d.totalProfitUsd) > 0.01 || d.balanceUsd > 0.01)
    .sort((a, b) => Math.abs(b.totalProfitUsd) - Math.abs(a.totalProfitUsd))
    .slice(0, 15)
    .map((d) => ({
      symbol: d.tokenSymbol,
      chain: d.chain,
      realizedUsd: d.realizedProfitUsd,
      unrealizedUsd: d.unrealizedProfitUsd,
      tweeted: tweetedSymbols.has(normalizeSymbol(d.tokenSymbol)),
    }));

  const totalPnl = positions.reduce(
    (s, p) => s + p.realizedUsd + p.unrealizedUsd,
    0,
  );
  const tweetedPnl = positions
    .filter((p) => p.tweeted)
    .reduce((s, p) => s + p.realizedUsd + p.unrealizedUsd, 0);
  const alignmentPct =
    totalPnl !== 0 ? Math.round((tweetedPnl / totalPnl) * 100) : 0;

  return { totalPnl, tweetedPnl, alignmentPct, positions };
}
```

- [ ] **Step 2: Add export to index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export * from "./agents/evidence-builder";
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/agents/evidence-builder.ts packages/core/src/index.ts
git commit -m "feat(core): implement buildEvidenceRows, follower sim, PnL breakdown"
```

---

## Task 4: Wire Evidence Builder into kol-full-agent

**Files:**
- Modify: `packages/core/src/agents/kol-full-agent.ts`

- [ ] **Step 1: Add imports**

At the top of `kol-full-agent.ts`, after the existing imports, add:

```typescript
import { buildEvidenceRows, computeFollowerSim, computePnlBreakdown } from "./evidence-builder";
```

- [ ] **Step 2: Add evidence building after Step 6 (narrative generation)**

In `analyzeKolFull()`, find the line `const narrative = await generateNarrative({...})` block (around line 543-553). After the narrative block and before `// Step 7: Build wallet summaries`, add:

```typescript
  // Step 6b: Evidence-first data
  let evidences: import("../evidence-types").EvidenceRow[] = [];
  let followerSim: import("../evidence-types").FollowerSimResult | undefined;
  let pnlBreakdown: import("../evidence-types").PnlBreakdownSummary | undefined;

  try {
    evidences = await buildEvidenceRows(classified, activities, picks);
    followerSim = computeFollowerSim(evidences);
    pnlBreakdown = computePnlBreakdown(
      walletReport.allTradeDecisions,
      classified,
    );
    console.log(
      `[kol-full] Evidence: ${evidences.length} rows, ` +
      `sim=${followerSim.roiPct}% ROI, alignment=${pnlBreakdown.alignmentPct}%`,
    );
  } catch (err) {
    console.error(`[kol-full] Evidence building failed:`, err instanceof Error ? err.message : err);
  }
```

- [ ] **Step 3: Add new fields to the report object**

In the `const report: KOLReport = {` block (around line 570), after `walletSummaries`, add:

```typescript
    evidences,
    followerSim,
    pnlBreakdown,
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/kol-full-agent.ts
git commit -m "feat(core): wire evidence builder into KOL full analysis pipeline"
```

---

## Task 5: Add Evidence CSS Styles

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add evidence-chain styles at the end of globals.css**

Append to `apps/web/app/globals.css`:

```css
/* ================================================================
   EVIDENCE-FIRST COMPONENTS
   ================================================================ */

.evidence-card {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--panel);
}

.evidence-card.verdict-verified {
  border-color: rgba(126, 230, 161, 0.35);
}

.evidence-card.verdict-contradicted {
  border-color: rgba(255, 102, 135, 0.4);
}

.evidence-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.evidence-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.evidence-chain {
  display: grid;
  grid-template-columns: 1fr 24px 1fr 24px 1fr;
  gap: 10px;
  align-items: stretch;
}

.evidence-col {
  padding: 12px;
  border-radius: 12px;
  background: var(--panel-2);
  display: flex;
  flex-direction: column;
}

.evidence-col-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.evidence-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 16px;
}

.evidence-no-match {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px 0;
  color: var(--red);
  font-size: 12px;
}

.evidence-pnl-value {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

@media (max-width: 900px) {
  .evidence-chain {
    grid-template-columns: 1fr;
  }
  .evidence-arrow {
    transform: rotate(90deg);
    padding: 4px 0;
  }
}

/* Follower Simulator */

.sim-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.sim-stat {
  padding: 12px;
  border-radius: 12px;
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
}

.sim-stat span {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.sim-stat strong {
  font-size: 20px;
  letter-spacing: -0.03em;
}

.sim-roi-bar {
  position: relative;
  height: 32px;
  border-radius: 10px;
  background: var(--panel-2);
  overflow: hidden;
}

.sim-roi-bar .sim-center {
  position: absolute;
  inset: 0;
  left: 50%;
  width: 1px;
  background: var(--line);
}

.sim-roi-bar .sim-fill {
  position: absolute;
  inset: 0;
}

.sim-roi-bar .sim-roi-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
  font-weight: 800;
  z-index: 1;
}

/* PnL Breakdown */

.alignment-bar {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 14px;
  background: var(--panel-3);
}

.alignment-bar div {
  height: 100%;
}

@media (max-width: 760px) {
  .sim-grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): add evidence-chain, simulator, breakdown CSS"
```

---

## Task 6: Create EvidenceCard Component

**Files:**
- Create: `apps/web/app/components/evidence-chain.tsx`

- [ ] **Step 1: Create the component file**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/evidence-chain.tsx
git commit -m "feat(web): add EvidenceCard and EvidenceList components"
```

---

## Task 7: Create FollowerSimulator Component

**Files:**
- Create: `apps/web/app/components/follower-simulator.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/app/components/follower-simulator.tsx
"use client";

import type { FollowerSimResult } from "@memerecall/core";

function toneClass(v: number): string {
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

export function FollowerSimulator({
  handle,
  sim,
}: {
  handle: string;
  sim: FollowerSimResult;
}) {
  const fillWidth = Math.min(50, Math.abs(sim.roiPct) / 2);
  const fillSide = sim.roiPct >= 0 ? "left" : "right";
  const fillColor = sim.roiPct >= 0
    ? "rgba(126, 230, 161, 0.25)"
    : "rgba(255, 102, 135, 0.25)";

  return (
    <div className="terminal-panel" style={{ padding: 16 }}>
      <div className="panel-title-row">
        <div>
          <strong>Copy-Trade Simulator</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            If you bought ${sim.unitUsd} per signal from @{handle}
          </div>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          last {sim.signalCount} signals
        </span>
      </div>

      <div className="sim-grid">
        <div className="sim-stat">
          <span>Invested</span>
          <strong>${sim.totalInvested.toLocaleString()}</strong>
        </div>
        <div className="sim-stat">
          <span>Current Value</span>
          <strong className={toneClass(sim.finalValue - sim.totalInvested)}>
            ${sim.finalValue.toFixed(0)}
          </strong>
        </div>
        <div className="sim-stat">
          <span>PnL</span>
          <strong className={toneClass(sim.pnlUsd)}>
            {sim.pnlUsd >= 0 ? "+" : ""}${sim.pnlUsd.toFixed(0)}
          </strong>
        </div>
        <div className="sim-stat">
          <span>Win Rate</span>
          <strong>{sim.winRate}%</strong>
        </div>
      </div>

      <div className="sim-roi-bar">
        <div className="sim-center" />
        <div
          className="sim-fill"
          style={{
            [fillSide === "left" ? "left" : "right"]: "50%",
            width: `${fillWidth}%`,
            background: fillColor,
          }}
        />
        <div className={`sim-roi-text ${toneClass(sim.roiPct)}`}>
          {sim.roiPct >= 0 ? "+" : ""}{sim.roiPct.toFixed(1)}% ROI
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/follower-simulator.tsx
git commit -m "feat(web): add FollowerSimulator component"
```

---

## Task 8: Create PnlBreakdown Component

**Files:**
- Create: `apps/web/app/components/pnl-breakdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/app/components/pnl-breakdown.tsx
"use client";

import type { PnlBreakdownSummary } from "@memerecall/core";

function toneClass(v: number): string {
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

function formatUsd(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toFixed(2)}`;
}

export function WalletPnlBreakdown({ breakdown }: { breakdown: PnlBreakdownSummary }) {
  return (
    <div className="terminal-panel" style={{ padding: 16 }}>
      <div className="panel-title-row">
        <div>
          <strong>Where the PnL Comes From</strong>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Tweeted tokens account for{" "}
            <strong style={{ color: "var(--text)" }}>{breakdown.alignmentPct}%</strong>{" "}
            of total PnL
          </div>
        </div>
        <strong style={{ fontSize: 20 }}>
          ${breakdown.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </strong>
      </div>

      {/* Stacked alignment bar */}
      <div className="alignment-bar">
        {breakdown.positions.map((p, i) => {
          const total = Math.max(1, Math.abs(breakdown.totalPnl));
          const pct = (Math.abs(p.realizedUsd + p.unrealizedUsd) / total) * 100;
          const hue = p.tweeted ? 152 : 215;
          const lightness = 35 + (i % 5) * 4;
          return (
            <div
              key={p.symbol}
              title={p.symbol}
              style={{
                width: `${pct}%`,
                background: `hsl(${hue} ${p.tweeted ? "76%" : "12%"} ${lightness}%)`,
              }}
            />
          );
        })}
      </div>

      {/* Table */}
      <div className="terminal-table-wrap">
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Tweeted?</th>
              <th style={{ textAlign: "right" }}>Realized</th>
              <th style={{ textAlign: "right" }}>Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.positions.map((p) => (
              <tr key={p.symbol}>
                <td>
                  <strong style={{ color: "var(--text)" }}>${p.symbol}</strong>
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--muted)" }}>
                    {p.chain}
                  </span>
                </td>
                <td>
                  {p.tweeted ? (
                    <span className="is-positive">yes</span>
                  ) : (
                    <span className="muted">-- silent</span>
                  )}
                </td>
                <td className={toneClass(p.realizedUsd)} style={{ textAlign: "right" }}>
                  {formatUsd(p.realizedUsd)}
                </td>
                <td className={toneClass(p.unrealizedUsd)} style={{ textAlign: "right" }}>
                  {formatUsd(p.unrealizedUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/pnl-breakdown.tsx
git commit -m "feat(web): add WalletPnlBreakdown component"
```

---

## Task 9: Integrate New Components into Analysis Page

**Files:**
- Modify: `apps/web/app/analysis/[handle]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, after the existing imports, add:

```typescript
import { EvidenceList } from "../../components/evidence-chain";
import { FollowerSimulator } from "../../components/follower-simulator";
import { WalletPnlBreakdown } from "../../components/pnl-breakdown";
```

- [ ] **Step 2: Add Evidence tab trigger**

In the `<TabsList>` (around line 305), add a new tab trigger after "Red Flags":

```tsx
{report.evidences && report.evidences.length > 0 && (
  <TabsTrigger value="evidence">Evidence ({report.evidences.length})</TabsTrigger>
)}
```

- [ ] **Step 3: Add Evidence tab content**

After the Red Flags `</TabsContent>` (around line 540), add:

```tsx
          {/* Tab: Evidence Chain */}
          {report.evidences && report.evidences.length > 0 && (
            <TabsContent value="evidence">
              <CardContent>
                {/* Simulator + Breakdown side by side */}
                {(report.followerSim || report.pnlBreakdown) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {report.followerSim && (
                      <FollowerSimulator handle={report.kol.handle} sim={report.followerSim} />
                    )}
                    {report.pnlBreakdown && (
                      <WalletPnlBreakdown breakdown={report.pnlBreakdown} />
                    )}
                  </div>
                )}
                <EvidenceList evidences={report.evidences} />
              </CardContent>
            </TabsContent>
          )}
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/analysis/[handle]/page.tsx
git commit -m "feat(web): integrate evidence chain, simulator, breakdown into analysis page"
```

---

## Task 10: Verify End-to-End

- [ ] **Step 1: Build the project**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run the API server and verify evidence data**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && timeout 10 bun run apps/api/src/index.ts || true`

Verify the server starts without errors.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: verify end-to-end build for evidence-first UI"
```
