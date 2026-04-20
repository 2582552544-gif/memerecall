# MemeRecall Full-Stack Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken navigation, missing CSS, hardcoded API URLs, dead pages, backend code duplication, and performance bottlenecks across the MemeRecall frontend and backend.

**Architecture:** The project is a Turborepo monorepo with an Elysia API (`apps/api`), a Next.js frontend (`apps/web`), and a shared core library (`packages/core`). Backend changes extract shared utilities and add concurrency. Frontend changes fix navigation, add missing styles, wire up API properly, and remove dead code.

**Tech Stack:** Bun, TypeScript, Elysia, Next.js 14 (App Router), ECharts, shadcn/ui, Tailwind-free custom CSS, OpenAI SDK.

---

## File Structure

### Backend (packages/core/src/)
- **Modify:** `agents/signal-classifier-agent.ts` - extract LLM client to shared module
- **Modify:** `agents/narrative-agent.ts` - use shared LLM client
- **Create:** `llm-client.ts` - shared LLM client factory + model getter
- **Modify:** `agents/kol-prefilter-agent.ts` - add concurrency to batchPrefilter
- **Modify:** `worker.ts` - add concurrency to runMemeRecallAnalysisCycle
- **Modify:** `setup.ts` - make startup non-blocking

### Frontend (apps/web/)
- **Modify:** `app/globals.css` - add ~25 missing CSS classes
- **Modify:** `app/layout.tsx` - add global nav component
- **Create:** `app/components/nav.tsx` - shared navigation bar (client component)
- **Modify:** `app/page.tsx` - use Nav, add refresh button, wire QuickCard selection
- **Modify:** `app/analysis/[handle]/page.tsx` - use Nav, fix API URL
- **Create:** `app/analysis/[handle]/loading.tsx` - loading skeleton for SSR
- **Modify:** `app/submit/page.tsx` - use env var for API URL, use CSS classes
- **Modify:** `app/watchroom/watchroom-client.tsx` - use Nav
- **Delete:** `app/kol/[handle]/page.tsx` - dead page (static mock data)
- **Delete:** `app/token/[contract]/page.tsx` - dead page (static mock data)

---

## Task 1: Create shared LLM client (backend)

**Files:**
- Create: `packages/core/src/llm-client.ts`
- Modify: `packages/core/src/agents/signal-classifier-agent.ts`
- Modify: `packages/core/src/agents/narrative-agent.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `llm-client.ts`**

```typescript
// packages/core/src/llm-client.ts
import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const baseURL = process.env.MEMERECALL_LLM_BASE_URL || "https://yunwu.ai/v1";
  const apiKey =
    process.env.MEMERECALL_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "LLM API key required. Set MEMERECALL_LLM_API_KEY or OPENAI_API_KEY env var.",
    );
  }

  cachedClient = new OpenAI({ baseURL, apiKey });
  return cachedClient;
}

export function getLLMModel(): string {
  return process.env.MEMERECALL_LLM_MODEL || "gpt-5.4";
}
```

- [ ] **Step 2: Update `signal-classifier-agent.ts` to use shared client**

Remove the local `createLLMClient()` and `getModel()` functions (lines 15-33). Replace with imports:

```typescript
// At top of file, replace the local functions with:
import { getLLMClient, getLLMModel } from "../llm-client";
```

In the `classifyBatch` function (line 99), change:
```typescript
// OLD (line 99-103):
async function classifyBatch(
  client: OpenAI,
  model: string,
  tweets: TweetInput[],
): Promise<ClassifiedSignal[]> {
```
to:
```typescript
async function classifyBatch(
  tweets: TweetInput[],
): Promise<ClassifiedSignal[]> {
  const client = getLLMClient();
  const model = getLLMModel();
```

In the `classifySignals` function (lines 168-170), change:
```typescript
// OLD:
  const client = createLLMClient();
  const model = getModel();
```
to nothing (remove these lines), and update the batch call (line 188):
```typescript
// OLD:
    const batchResults = await classifyBatch(client, model, batch);
// NEW:
    const batchResults = await classifyBatch(batch);
```

Also update the log line (line 183):
```typescript
// OLD:
    `[signal-classifier] Classifying ${inputs.length} tweets in ${batches.length} batch(es) via ${model}`,
// NEW:
    `[signal-classifier] Classifying ${inputs.length} tweets in ${batches.length} batch(es) via ${getLLMModel()}`,
```

Remove the `import OpenAI from "openai";` at line 9 (no longer needed directly).

- [ ] **Step 3: Update `narrative-agent.ts` to use shared client**

Remove the local `createLLMClient()` and `getModel()` functions (lines 10-28). Replace with:

```typescript
// At top of file:
import { getLLMClient, getLLMModel } from "../llm-client";
```

In the `generateNarrative` function (lines 50-51), change:
```typescript
// OLD:
  const client = createLLMClient();
  const model = getModel();
// NEW:
  const client = getLLMClient();
  const model = getLLMModel();
```

Remove the `import OpenAI from "openai";` at line 7 (no longer needed directly).

- [ ] **Step 4: Add export to `index.ts`**

Add to `packages/core/src/index.ts`:
```typescript
export * from "./llm-client";
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/llm-client.ts packages/core/src/agents/signal-classifier-agent.ts packages/core/src/agents/narrative-agent.ts packages/core/src/index.ts
git commit -m "refactor: extract shared LLM client from signal-classifier and narrative agents"
```

---

## Task 2: Add concurrency to batchPrefilter and worker (backend)

**Files:**
- Modify: `packages/core/src/agents/kol-prefilter-agent.ts`
- Modify: `packages/core/src/worker.ts`
- Modify: `packages/core/src/setup.ts`

- [ ] **Step 1: Add concurrency to `batchPrefilter`**

In `packages/core/src/agents/kol-prefilter-agent.ts`, replace the `batchPrefilter` function (lines 151-180) with:

```typescript
export async function batchPrefilter(
  subjects: AgentSubject[],
  gmgnDataMap?: Map<string, DiscoveredKOL>,
  concurrency = 5,
): Promise<PrefilterResult[]> {
  console.log(`[prefilter] Running Twitter-First gates on ${subjects.length} KOLs (concurrency=${concurrency})...`);

  const results: PrefilterResult[] = new Array(subjects.length);
  const queue = subjects.map((s, i) => ({ subject: s, index: i }));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const idx = cursor++;
      const { subject, index } = queue[idx];
      const gmgnData = gmgnDataMap?.get(subject.handle);
      results[index] = await prefilterKOL(subject, gmgnData);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, subjects.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const reasons = failed.reduce((acc, r) => {
    const reason = r.failureReason || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(
    `[prefilter] Done: ${passed.length} passed, ${failed.length} rejected` +
    (Object.keys(reasons).length > 0
      ? ` (${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(", ")})`
      : ""),
  );

  return results;
}
```

- [ ] **Step 2: Add concurrency to `worker.ts`**

In `packages/core/src/worker.ts`, replace `runMemeRecallAnalysisCycle` (lines 17-41) with:

```typescript
export async function runMemeRecallAnalysisCycle(): Promise<AnalysisCycleResult> {
  const config = getMemeRecallConfig();
  const processed: AnalysisCycleResult["processed"] = [];

  await Promise.all(
    trackedSubjects.map(async (subject) => {
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
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    reportsDir: config.reportsDir,
    processed,
  };
}
```

- [ ] **Step 3: Make startup non-blocking in `setup.ts`**

In `packages/core/src/setup.ts`, change the startup analysis to be non-blocking (line 17-19):

```typescript
// OLD:
  if (config.runOnStartup) {
    await runMemeRecallAnalysisCycle();
  }
// NEW:
  if (config.runOnStartup) {
    // Non-blocking: don't hold up API startup
    runMemeRecallAnalysisCycle().catch((err) => {
      console.error("[setup] Startup analysis cycle failed:", err instanceof Error ? err.message : err);
    });
  }
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/kol-prefilter-agent.ts packages/core/src/worker.ts packages/core/src/setup.ts
git commit -m "perf: add concurrency to batchPrefilter and worker, non-blocking startup"
```

---

## Task 3: Add all missing CSS classes (frontend)

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add missing CSS classes**

Append the following to the end of `apps/web/app/globals.css`:

```css
/* ================================================================
   ANALYSIS DETAIL PAGE — missing classes
   ================================================================ */

.hero-grid {
  grid-template-columns: 340px minmax(0, 1fr) 320px;
  width: calc(100% - 48px);
  margin: 18px 24px 0;
}

@media (max-width: 1100px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }
}

.insight-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: insight;
}

.insight-list li {
  counter-increment: insight;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--panel-2);
  border: 1px solid var(--line-soft);
  color: var(--muted-2);
  line-height: 1.55;
  font-size: 14px;
}

.insight-list li::before {
  content: counter(insight) ".";
  color: var(--green);
  font-weight: 800;
  margin-right: 8px;
}

.signal-funnel {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--panel-2);
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-2);
  flex-wrap: wrap;
}

.signal-funnel .funnel-arrow {
  color: var(--muted);
  font-size: 14px;
}

/* ---- Red flags ---- */

.red-flags-row {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 102, 135, 0.18);
  background: rgba(255, 102, 135, 0.04);
}

.flag-label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--red);
  margin-bottom: 10px;
}

.flag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.flag-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.flag-high {
  color: var(--red);
  border: 1px solid rgba(255, 102, 135, 0.34);
  background: rgba(255, 102, 135, 0.08);
}

.flag-medium {
  color: var(--amber);
  border: 1px solid rgba(255, 212, 90, 0.32);
  background: rgba(255, 212, 90, 0.06);
}

.flag-low {
  color: var(--muted-2);
  border: 1px solid var(--line);
  background: var(--panel-2);
}

.flag-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flag-detail {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--panel-2);
}

.flag-detail.flag-high {
  border-color: rgba(255, 102, 135, 0.24);
  background: rgba(255, 102, 135, 0.04);
}

.flag-detail.flag-medium {
  border-color: rgba(255, 212, 90, 0.2);
  background: rgba(255, 212, 90, 0.03);
}

.flag-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.flag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.flag-dot-high {
  background: var(--red);
  box-shadow: 0 0 8px rgba(255, 102, 135, 0.4);
}

.flag-dot-medium {
  background: var(--amber);
  box-shadow: 0 0 8px rgba(255, 212, 90, 0.3);
}

.flag-dot-low {
  background: var(--muted);
}

.flag-description {
  color: var(--muted-2);
  line-height: 1.55;
  font-size: 13px;
  margin: 0;
}

/* ---- Score color classes (standalone) ---- */

.score-green { color: var(--green); }
.score-yellow { color: var(--amber); }
.score-orange { color: #f59e42; }
.score-red { color: var(--red); }

/* ---- Misc analysis page ---- */

.action-badge {
  display: inline-flex;
  margin-top: 12px;
  font-size: 14px;
  padding: 6px 16px;
}

.sub-heading {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 10px;
  color: var(--muted-2);
}

.token-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  margin: 2px 4px 2px 0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  background: var(--panel-3);
  border: 1px solid var(--line-soft);
  color: var(--text);
}

.wide-tooltip {
  max-width: 520px !important;
  white-space: normal;
  line-height: 1.5;
}

.insights-panel {
  min-height: 320px;
}
```

- [ ] **Step 2: Verify the CSS renders**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run --filter=web dev`

Open `http://localhost:3001/analysis/0xwilliam888` in browser. Check that:
- Insight list has numbered items with green numbers
- Red flags have colored chips
- Signal funnel shows horizontal flow
- Score colors (green/yellow/orange/red) render correctly

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "fix: add 25+ missing CSS classes for analysis detail page"
```

---

## Task 4: Create shared Nav component and fix navigation (frontend)

**Files:**
- Create: `apps/web/app/components/nav.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create the Nav component**

```typescript
// apps/web/app/components/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Leaderboard" },
  { href: "/watchroom", label: "Watchroom" },
  { href: "/submit", label: "Submit KOL" },
];

export function Nav() {
  const pathname = usePathname();

  // Analysis pages count as "Leaderboard" context
  const activeHref = navItems.find((item) => {
    if (item.href === "/" && (pathname === "/" || pathname.startsWith("/analysis"))) return true;
    return pathname.startsWith(item.href) && item.href !== "/";
  })?.href || "/";

  return (
    <header className="terminal-topbar">
      <div className="terminal-brand">
        <Link href="/">
          <img className="brand-logo" src="/assets/memerecall-logo.svg" alt="MemeRecall" />
        </Link>
        <Link href="/" className="brand-name">
          MemeRecall <small>v3.0</small>
        </Link>
      </div>
      <nav className="terminal-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${activeHref === item.href ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Remove per-page headers from all pages**

In `apps/web/app/page.tsx`:
- Remove the entire `<header className="terminal-topbar">...</header>` block (lines 358-370 and the empty-state version at lines 337-341).
- Replace both with just `<Nav />` import at top:
```typescript
import { Nav } from "./components/nav";
```
Use `<Nav />` at the start of both the empty-state and data return blocks (right after `<main className="terminal-shell">`).
- Remove the `terminal-actions` div (the "Updated X ago" is nice but belongs in the funnel stats area, not the nav). Move the timestamp into the `FunnelStats` component instead.

In `apps/web/app/analysis/[handle]/page.tsx`:
- Remove the `<header>` blocks (both the data view at lines 199-217 and the not-found view at lines 157-162).
- Add: `import { Nav } from "../../components/nav";`
- Place `<Nav />` right after each `<main className="terminal-shell">`.

In `apps/web/app/submit/page.tsx`:
- Remove the `<header>` block inside `SubmitForm` (lines 51-60).
- Add: `import { Nav } from "../components/nav";`
- Place `<Nav />` right after `<main className="terminal-shell">`.

In `apps/web/app/watchroom/watchroom-client.tsx`:
- Remove the `<header>` block (lines 282-297).
- Add: `import { Nav } from "../components/nav";`
- Place `<Nav />` right after `<main className="terminal-shell">`.

- [ ] **Step 3: Verify navigation works**

Run dev server, click through:
- `/` Leaderboard tab active, can click Watchroom and Submit
- `/watchroom` Watchroom tab active, can click back to Leaderboard
- `/submit` Submit KOL tab active
- `/analysis/xxx` Leaderboard tab highlighted

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/nav.tsx apps/web/app/page.tsx apps/web/app/analysis/[handle]/page.tsx apps/web/app/submit/page.tsx apps/web/app/watchroom/watchroom-client.tsx
git commit -m "fix: replace broken span nav with shared Link-based Nav component"
```

---

## Task 5: Fix hardcoded API URL in Submit page (frontend)

**Files:**
- Modify: `apps/web/app/submit/page.tsx`

- [ ] **Step 1: Replace hardcoded URL with env var**

At the top of the `SubmitForm` function (after the state declarations), add:

```typescript
const API = process.env.NEXT_PUBLIC_MEMERECALL_API || "http://localhost:4049";
```

Change the fetch call (line 26):
```typescript
// OLD:
      const res = await fetch("http://localhost:4049/analyze", {
// NEW:
      const res = await fetch(`${API}/analyze`, {
```

- [ ] **Step 2: Replace inline styles with CSS classes**

Replace the entire `<form>` block (lines 69-165) with one that uses the existing `simple-form` CSS classes:

```tsx
        <form onSubmit={handleSubmit} className="simple-form">
          <label>
            Twitter Handle
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. thejester"
              required
            />
          </label>

          <label>
            Wallet Address
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="e.g. 5Lc1H18PT9NDCqeh9pnhkwm6xyWw1X4btzRcTcVP2ZNk"
              required
              style={{ fontFamily: "monospace" }}
            />
          </label>

          <label>
            Chain
            <select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="sol">Solana (SOL)</option>
              <option value="eth">Ethereum (ETH)</option>
              <option value="bsc">BSC</option>
              <option value="base">Base</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={status === "loading"}
            className="primary-action"
          >
            {status === "loading" ? "Analyzing... (this may take 1-2 minutes)" : "Start Analysis"}
          </button>

          {status === "error" && (
            <div className="danger-soft" style={{ padding: 12, borderRadius: 6, fontSize: 13 }}>
              {errorMsg}
            </div>
          )}
        </form>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/submit/page.tsx
git commit -m "fix: use env var for API URL and CSS classes in submit page"
```

---

## Task 6: Add loading.tsx for analysis page (frontend)

**Files:**
- Create: `apps/web/app/analysis/[handle]/loading.tsx`

- [ ] **Step 1: Create loading skeleton**

```typescript
// apps/web/app/analysis/[handle]/loading.tsx
export default function AnalysisLoading() {
  return (
    <main className="terminal-shell">
      <div style={{ padding: "60px 24px", textAlign: "center" }}>
        <div className="avatar-orb" style={{ margin: "0 auto 20px", width: 64, height: 64 }}>
          <img src="/assets/agent-orb.svg" alt="" />
        </div>
        <h2 style={{ margin: "0 0 8px" }}>Analyzing KOL...</h2>
        <p className="muted">
          Collecting tweets, classifying signals, verifying wallet activity.
          This typically takes 1-2 minutes.
        </p>
        <div style={{ marginTop: 24 }}>
          <div style={{
            width: 200,
            height: 4,
            margin: "0 auto",
            borderRadius: 2,
            background: "var(--panel-3)",
            overflow: "hidden",
          }}>
            <div style={{
              width: "40%",
              height: "100%",
              borderRadius: 2,
              background: "var(--green)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add pulse animation to globals.css**

Add at the end of `apps/web/app/globals.css`:

```css
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: translateX(-60%); }
  50% { opacity: 1; transform: translateX(160%); }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/analysis/[handle]/loading.tsx apps/web/app/globals.css
git commit -m "feat: add loading skeleton for analysis page SSR"
```

---

## Task 7: Delete dead pages (frontend)

**Files:**
- Delete: `apps/web/app/kol/[handle]/page.tsx`
- Delete: `apps/web/app/token/[contract]/page.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm apps/web/app/kol/\[handle\]/page.tsx
rmdir apps/web/app/kol/\[handle\]
rmdir apps/web/app/kol
rm apps/web/app/token/\[contract\]/page.tsx
rmdir apps/web/app/token/\[contract\]
rmdir apps/web/app/token
```

- [ ] **Step 2: Verify no imports reference these pages**

Run: `grep -r "kol/\[handle\]\|/kol/" apps/web/ --include="*.tsx" --include="*.ts"`
Run: `grep -r "token/\[contract\]\|/token/" apps/web/ --include="*.tsx" --include="*.ts"`

Expected: No results (these pages had no inbound links).

- [ ] **Step 3: Check that `kolProfiles` and `tokenProfiles` are still exported from core**

These exports are still used by the API routes `/trust/:handle` and `/revival/:contract`. The `data.ts` file stays; only the frontend pages are deleted.

- [ ] **Step 4: Verify build**

Run: `cd /Users/mac/PycharmProjects/ai_music_2025/memerecall && bun run typecheck`

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/app/kol apps/web/app/token
git commit -m "chore: remove dead KOL trust card and token revival pages (static mock data)"
```

---

## Task 8: Wire interactive QuickCard on Leaderboard (frontend)

**Files:**
- Create: `apps/web/app/leaderboard-client.tsx`
- Modify: `apps/web/app/page.tsx`

The Leaderboard is an SSR page but needs client interactivity for row selection. Extract the interactive part to a client component.

- [ ] **Step 1: Create leaderboard client component**

```typescript
// apps/web/app/leaderboard-client.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Re-declare types needed (these match the SSR page types)
interface LeaderboardEntry {
  rank: number;
  handle: string;
  displayName: string;
  tier: string;
  action: string;
  rankScore: number;
  scores: {
    composite: number;
    authenticity: number;
    followerAlpha: number | null;
    coverage: number;
    discipline: number;
  };
  medianROI: number | null;
  winRate: number;
  signalFrequency: number;
  chains: string[];
  redFlagCount: number;
  redFlags: string[];
  verifiedSignals: number;
  gmgnProfit7d: number;
}

type KOLArchetype = "signal_caller" | "silent_whale" | "noise_maker";

function getArchetype(entry: LeaderboardEntry): KOLArchetype {
  if (entry.signalFrequency >= 3) return "signal_caller";
  if (entry.gmgnProfit7d > 0 && entry.signalFrequency < 3) return "silent_whale";
  return "noise_maker";
}

function archetypeLabel(type: KOLArchetype): { emoji: string; label: string; variant: "default" | "positive" | "warning" | "negative" | "outline" } {
  switch (type) {
    case "signal_caller": return { emoji: "", label: "Signal Caller", variant: "positive" };
    case "silent_whale": return { emoji: "", label: "Silent Whale", variant: "outline" };
    case "noise_maker": return { emoji: "", label: "Noise Maker", variant: "negative" };
  }
}

function actionBadge(action: string): { label: string; variant: "default" | "positive" | "warning" | "negative" | "outline" } {
  switch (action) {
    case "auto_copy": return { label: "AUTO COPY", variant: "positive" };
    case "watchlist": return { label: "WATCHLIST", variant: "warning" };
    case "narrative_only": return { label: "NARRATIVE", variant: "outline" };
    case "avoid": return { label: "AVOID", variant: "negative" };
    default: return { label: "N/A", variant: "default" };
  }
}

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPct(v: number | null): string {
  if (v === null) return "N/A";
  return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

function toneClass(v: number | null): string {
  if (v === null) return "is-neutral";
  return v > 0 ? "is-positive" : v < 0 ? "is-negative" : "is-neutral";
}

function scoreBarWidth(v: number): string {
  return `${Math.max(2, Math.min(100, v))}%`;
}

function scoreBarColor(v: number): string {
  if (v >= 70) return "#7ee6a1";
  if (v >= 40) return "#f5c542";
  if (v >= 20) return "#f59e42";
  return "#ff6687";
}

function chainPill(chain: string): string {
  switch (chain) {
    case "sol": return "chain-sol";
    case "eth": return "chain-eth";
    case "bsc": return "chain-bsc";
    default: return "chain-unknown";
  }
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: scoreBarWidth(value), backgroundColor: scoreBarColor(value) }} />
      </div>
      <span className="score-bar-value">{value}</span>
    </div>
  );
}

function QuickCard({ entry }: { entry: LeaderboardEntry }) {
  const archetype = getArchetype(entry);
  const arch = archetypeLabel(archetype);
  const isWhale = archetype === "silent_whale";

  return (
    <div className="quick-card">
      <div className="qc-header">
        <div>
          <h3><Link href={`/analysis/${entry.handle}`}>@{entry.handle}</Link></h3>
          <span className="muted">{entry.displayName}</span>
        </div>
        <Badge variant={arch.variant}>{arch.label}</Badge>
      </div>
      <div className="qc-hero">
        <div className={`qc-score ${entry.scores.composite >= 60 ? "score-green" : entry.scores.composite >= 40 ? "score-yellow" : "score-red"}`}>
          <span className="qc-score-num">{entry.scores.composite}</span>
          <span className="qc-score-label">/100</span>
        </div>
        <Badge variant={actionBadge(entry.action).variant} className="action-badge-lg">
          {actionBadge(entry.action).label}
        </Badge>
      </div>
      {isWhale ? (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Wallet PnL (7d)</span>
          <span className={`qc-metric-value ${toneClass(entry.gmgnProfit7d)}`}>{formatUsd(entry.gmgnProfit7d)}</span>
          <p className="qc-whale-note">Silent Whale. Monitor wallet directly.</p>
        </div>
      ) : (
        <div className="qc-metric-highlight">
          <span className="qc-metric-label">Follower Alpha (30d median)</span>
          <span className={`qc-metric-value ${toneClass(entry.medianROI)}`}>{formatPct(entry.medianROI)}</span>
          <span className="qc-metric-sub">{entry.verifiedSignals} verified / {entry.signalFrequency} signals</span>
        </div>
      )}
      <div className="qc-scores">
        <ScoreBar label="Authenticity" value={entry.scores.authenticity} />
        <ScoreBar label="Alpha" value={entry.scores.followerAlpha !== null ? Math.max(0, Math.min(100, entry.scores.followerAlpha + 50)) : 0} />
        <ScoreBar label="Coverage" value={entry.scores.coverage} />
        <ScoreBar label="Discipline" value={entry.scores.discipline} />
      </div>
      {entry.redFlagCount > 0 && (
        <div className="qc-flags">
          {entry.redFlags.map((f) => (
            <span key={f} className="flag-chip flag-high">{f.replaceAll("_", " ")}</span>
          ))}
        </div>
      )}
      <div className="qc-chains">
        {entry.chains.map((c) => (
          <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardInteractive({ entries }: { entries: LeaderboardEntry[] }) {
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);

  const callers = entries.filter((e) => getArchetype(e) === "signal_caller");
  const whales = entries.filter((e) => getArchetype(e) === "silent_whale");
  const noisy = entries.filter((e) => getArchetype(e) === "noise_maker");

  function renderTab(data: LeaderboardEntry[]) {
    const selected = data.find((e) => e.handle === selectedHandle) || data[0];

    return (
      <div className="leaderboard-layout">
        <div className="leaderboard-table-area">
          <ScrollArea className="terminal-table-scroll terminal-table-scroll-lg">
            <div className="terminal-table-wrap">
              <table className="terminal-table leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>KOL</th>
                    <th>Type</th>
                    <th>
                      <Tooltip><TooltipTrigger>Wallet PnL</TooltipTrigger>
                      <TooltipContent>7-day realized profit from GMGN</TooltipContent></Tooltip>
                    </th>
                    <th>
                      <Tooltip><TooltipTrigger>Alpha</TooltipTrigger>
                      <TooltipContent>Median ROI if followers copy-traded</TooltipContent></Tooltip>
                    </th>
                    <th>Signals</th>
                    <th>Chain</th>
                    <th>Action</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((entry) => {
                    const arch = archetypeLabel(getArchetype(entry));
                    const act = actionBadge(entry.action);
                    const isSelected = entry.handle === selected?.handle;
                    return (
                      <tr
                        key={entry.handle}
                        className={`leaderboard-row ${isSelected ? "row-selected" : ""}`}
                        onClick={() => setSelectedHandle(entry.handle)}
                      >
                        <td className="rank-cell"><span className="rank-num">{entry.rank}</span></td>
                        <td>
                          <Link href={`/analysis/${entry.handle}`} className="kol-cell">
                            <div className="kol-avatar">{entry.displayName.slice(0, 1).toUpperCase()}</div>
                            <div>
                              <strong>@{entry.handle}</strong>
                              <small className="muted">{entry.displayName}</small>
                            </div>
                          </Link>
                        </td>
                        <td><Badge variant={arch.variant}>{arch.label}</Badge></td>
                        <td className={toneClass(entry.gmgnProfit7d)}><strong>{formatUsd(entry.gmgnProfit7d)}</strong></td>
                        <td className={toneClass(entry.medianROI)}>
                          {entry.medianROI !== null ? <strong>{formatPct(entry.medianROI)}</strong> : <span className="muted">N/A</span>}
                        </td>
                        <td>{entry.verifiedSignals} / {entry.signalFrequency}</td>
                        <td>
                          {entry.chains.map((c) => (
                            <span key={c} className={`chain-pill-sm ${chainPill(c)}`}>{c.toUpperCase()}</span>
                          ))}
                        </td>
                        <td><Badge variant={act.variant}>{act.label}</Badge></td>
                        <td>{entry.redFlagCount > 0 ? <span className="flag-count">{entry.redFlagCount}</span> : <span className="muted">0</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
        <aside className="leaderboard-sidebar">
          {selected && <QuickCard entry={selected} />}
        </aside>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tabs defaultValue="all" className="leaderboard-tabs">
        <TabsList>
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          <TabsTrigger value="callers">Signal Callers ({callers.length})</TabsTrigger>
          <TabsTrigger value="whales">Silent Whales ({whales.length})</TabsTrigger>
          {noisy.length > 0 && <TabsTrigger value="noisy">Noise ({noisy.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="all">{renderTab(entries)}</TabsContent>
        <TabsContent value="callers">{renderTab(callers)}</TabsContent>
        <TabsContent value="whales">{renderTab(whales)}</TabsContent>
        {noisy.length > 0 && <TabsContent value="noisy">{renderTab(noisy)}</TabsContent>}
      </Tabs>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Simplify `page.tsx` to use the client component**

Replace the entire content of `apps/web/app/page.tsx` with:

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Nav } from "./components/nav";
import { LeaderboardInteractive } from "./leaderboard-client";

interface Leaderboard {
  generatedAt: string;
  kolCount: number;
  discoveredCount: number;
  prefilterPassedCount: number;
  analyzedCount: number;
  entries: Array<{
    rank: number;
    handle: string;
    displayName: string;
    tier: string;
    action: string;
    rankScore: number;
    scores: { composite: number; authenticity: number; followerAlpha: number | null; coverage: number; discipline: number };
    medianROI: number | null;
    winRate: number;
    signalFrequency: number;
    chains: string[];
    redFlagCount: number;
    redFlags: string[];
    verifiedSignals: number;
    gmgnProfit7d: number;
  }>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadLeaderboard(): Promise<Leaderboard | null> {
  const candidates = [
    path.resolve(process.cwd(), "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "..", "..", "data", "leaderboard", "latest.json"),
    path.resolve(process.cwd(), "data-leaderboard-latest.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Leaderboard;
    } catch { continue; }
  }
  return null;
}

export default async function HomePage() {
  const lb = await loadLeaderboard();

  if (!lb || lb.entries.length === 0) {
    return (
      <main className="terminal-shell">
        <Nav />
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>No leaderboard data yet</h2>
          <p className="muted">Run <code>bun run leaderboard:run</code> to generate the first leaderboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="terminal-shell">
      <Nav />
      <div className="funnel-stats">
        <div className="funnel-step"><span className="funnel-num">{lb.discoveredCount}</span><span className="funnel-label">Discovered</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.prefilterPassedCount}</span><span className="funnel-label">Prefiltered</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.analyzedCount}</span><span className="funnel-label">Analyzed</span></div>
        <span className="funnel-arrow">&rarr;</span>
        <div className="funnel-step"><span className="funnel-num">{lb.kolCount}</span><span className="funnel-label">Ranked</span></div>
        <span className="funnel-arrow" />
        <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>Updated {timeAgo(lb.generatedAt)}</span>
      </div>
      <LeaderboardInteractive entries={lb.entries} />
      <footer className="terminal-footer">
        <span><span className="status-dot" /> MemeRecall v3.0</span>
        <span>GMGN + GPT Signal Classifier + RankScore</span>
        <span>{lb.generatedAt.replace("T", " ").slice(0, 19)} UTC</span>
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Open `http://localhost:3001`. Click different rows in the table — the QuickCard sidebar should update to show the selected KOL.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/leaderboard-client.tsx apps/web/app/page.tsx
git commit -m "feat: interactive QuickCard selection on leaderboard rows"
```

---

## Summary

| Task | Scope | What it fixes |
|------|-------|---------------|
| 1 | Backend | DRY: shared LLM client |
| 2 | Backend | Perf: concurrent prefilter + worker, non-blocking startup |
| 3 | Frontend | Visual: 25+ missing CSS classes |
| 4 | Frontend | P0 Nav: all pages linked with working navigation |
| 5 | Frontend | P0 Deploy: API URL from env var, consistent styling |
| 6 | Frontend | UX: loading skeleton during SSR analysis |
| 7 | Frontend | Cleanup: remove dead mock-data pages |
| 8 | Frontend | UX: interactive QuickCard follows row selection |
