# Technology Decisions

Each decision is documented with the alternatives considered, why we chose what we did, and the trade-offs accepted.

---

## 1. Bun over Node.js

**Choice:** Bun 1.3 as the JavaScript runtime

**Alternatives:** Node.js 22, Deno

**Why Bun:**
- Native TypeScript execution without a compile step -- critical for rapid iteration on agent logic
- Built-in workspace support that matches Turborepo's expectations
- Faster cold startup (~3x) matters for CLI scripts that run per-KOL analysis
- `bun:test` built-in eliminates separate test runner dependency

**Trade-offs:**
- Smaller ecosystem; some npm packages have edge-case incompatibilities
- Less production battle-testing than Node.js
- Team familiarity curve if onboarding Node.js developers

---

## 2. GMGN as Primary Wallet Data Source

**Choice:** GMGN KOL ranking + OpenAPI for wallet data

**Alternatives:** Nansen, Arkham, raw RPC indexing, Dune Analytics

**Why GMGN:**
- Only source with `tag=kol` filter that guarantees Twitter binding (100% binding rate)
- Provides both wallet activity AND KOL social metadata in one API
- Multi-chain support (SOL, ETH, BSC, Base) without separate integrations
- Free tier for ranking API via bb-browser; paid OpenAPI for detailed activity

**Trade-offs:**
- Single vendor dependency -- if GMGN goes down or changes API, pipeline stops
- No retry logic currently implemented (fragile to transient failures)
- bb-browser scraping is inherently fragile (page structure changes break it)
- Rate limits on OpenAPI require careful batching

---

## 3. GPT Batch Classification (25 tweets/request)

**Choice:** Batch 25 tweets per LLM call for signal classification

**Alternatives:** Individual tweet classification, full-100 single request, embeddings-based classification

**Why 25/batch:**
- Single-tweet calls would cost ~4x more (100 calls vs 4)
- Full-100 degrades classification quality -- GPT loses nuance in long prompts
- 25 is the sweet spot: fits comfortably in context window, maintains per-tweet accuracy
- Structured JSON output remains reliable at this batch size

**Trade-offs:**
- If one tweet in a batch is ambiguous, GPT may "anchor" on it and bias adjacent classifications
- Batch timeout kills all 25 tweets (no partial retry)
- Harder to debug individual misclassifications

---

## 4. Twitter-First Prefilter Architecture

**Choice:** 5-gate rule-based prefilter before any LLM calls

**Alternatives:** LLM-first (classify all KOLs), score-threshold filter, manual curation

**Why prefilter:**
- 94% of GMGN KOL wallets are Silent Whales -- profitable but don't tweet signals
- Full analysis costs ~$0.15/KOL in LLM calls; prefilter costs $0
- Regex-based signal detection (buy/sell keywords) is surprisingly accurate for gate purposes
- Budget ceiling: 200 KOLs * $0.15 = $30/run without prefilter, vs ~$2 with it

**Trade-offs:**
- Regex-based signal detection may false-reject KOLs who use unusual phrasing
- 30-tweet lookback window may miss KOLs who tweet signals infrequently
- Cheap chain detection (keyword + address format) disagrees with GPT classification in ~5% of cases

---

## 5. Median ROI over Mean ROI

**Choice:** Use median ROI of verified signals, not mean

**Alternatives:** Mean ROI, weighted mean, geometric mean

**Why median:**
- Meme coin markets produce extreme outliers (+10,000% on one trade)
- Mean ROI would let a single moonshot mask 20 losing trades
- Median answers the question "if I follow this KOL's typical signal, what do I get?"
- More robust to the fat-tailed distribution of crypto returns

**Trade-offs:**
- Punishes KOLs whose strategy is "high conviction, few trades" (one big winner is the point)
- Less intuitive for users who think in total PnL terms
- Requires >= 3 verified signals to be meaningful (below that, returns null)

---

## 6. Authenticity Squared in RankScore

**Choice:** `(Auth/100)^2` -- quadratic penalty for low authenticity

**Alternatives:** Linear `Auth/100`, threshold cutoff, no penalty

**Why quadratic:**
- Linear penalty is too gentle: a KOL with 30% authenticity (claiming trades they don't make) still gets 30% credit
- Quadratic: 30% authenticity -> 9% credit, 50% -> 25%, 80% -> 64%
- This matches the severity of the problem: a KOL who lies about 70% of their trades is fundamentally untrustworthy, not just "slightly worse"
- Preserves rank differentiation at the top end (80% vs 90% is still meaningful)

**Trade-offs:**
- Harsh on new KOLs with few verified signals (small sample -> noisy authenticity score)
- May over-penalize KOLs with legitimate coverage gaps (missing wallet chains)
- The `P_sample` factor partially mitigates this (need >= 10 signals for full score)

---

## 7. Elysia over Express/Fastify

**Choice:** Elysia as the REST API framework

**Alternatives:** Express, Fastify, Hono, raw Bun.serve

**Why Elysia:**
- Bun-native: zero overhead, uses Bun's built-in HTTP server
- Type-safe route definitions without manual validation boilerplate
- ~2x throughput vs Express on Bun benchmarks
- Minimal API surface -- 20 endpoints don't need a heavyweight framework

**Trade-offs:**
- Small community (fewer Stack Overflow answers, plugins)
- Breaking changes between versions (young framework)
- Team hiring: most backend developers know Express, not Elysia

---

## 8. bb-browser for GMGN Data Collection

**Choice:** bb-browser CLI for browser-based API calls

**Alternatives:** Direct HTTP fetch, Puppeteer/Playwright, GMGN official SDK

**Why bb-browser:**
- GMGN ranking pages require JavaScript rendering -- raw fetch gets empty responses
- bb-browser reuses an existing Chrome instance with cookies/session state
- Handles anti-bot detection that blocks raw HTTP requests
- Same tool used across the project (xhs-nurture, x-growth) -- team familiarity

**Trade-offs:**
- Fragile: depends on GMGN page structure (any DOM change breaks extraction)
- Slower than direct API calls (browser rendering overhead)
- Requires running Chrome instance (resource-heavy on CI/CD)
- Truncated JSON responses require special parsing workarounds

---

## 9. bird-twitter over Official Twitter/X API

**Choice:** bird-twitter CLI for tweet collection

**Alternatives:** Twitter/X API v2, Apify scraper, Nitter

**Why bird-twitter:**
- Zero API cost (no Twitter developer account required)
- Simple CLI interface: `bird-twitter user {handle} --limit N`
- Returns structured JSON with tweet text, timestamps, engagement metrics
- Sufficient for the pipeline's needs (100 tweets per KOL)

**Trade-offs:**
- Rate limits (unclear, undocumented)
- Reliability: may break if Twitter/X changes their frontend
- No access to Twitter API-only features (full-text search, user relationships)
- Legal gray area for scraping
