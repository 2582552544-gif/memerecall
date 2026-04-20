# Pain Points & Future Work

Honest assessment of current limitations, organized by severity. Each item includes why it matters and potential solutions.

---

## Critical

### Chain Detection Ambiguity

**Problem:** EVM addresses (0x-prefixed) are identical across Ethereum, BSC, and Base. The prefilter and social agent use keyword context ("BNB", "BSC" in tweet text) to guess the chain, but this is unreliable. A tweet about a BSC token might be classified as ETH, causing a false `CHAIN_MISMATCH` red flag.

**Impact:** KOLs active on BSC or Base may be incorrectly flagged or rejected by the prefilter, even when their wallet data is available on those chains.

**Potential Fix:** Use GMGN token lookup API to resolve contract address -> chain mapping before classification. Cost: one API call per unique token address (cacheable).

### No Persistent Cache Between Runs

**Problem:** Every `/leaderboard` call re-discovers KOLs from GMGN, re-fetches tweets, and re-classifies signals. There is no memoization of classification results or wallet data between runs.

**Impact:** Full leaderboard generation takes 30s-2m and hits external APIs heavily. Running frequently risks rate limits. Identical KOLs are re-analyzed even if nothing changed.

**Potential Fix:** SQLite or JSON-based cache keyed by `(handle, tweet_ids_hash)`. Only re-analyze KOLs whose tweet set has changed since last run. Store classification results with TTL.

---

## Moderate

### Activity Collection Non-Atomicity

**Problem:** Wallet activity collection (Stage 5) wraps GMGN API calls in try-catch and returns empty arrays on failure. The pipeline continues without wallet data, which means downstream red flags (`CLAIMED_BUY_NO_TRADE`, `MICRO_WALLET`) won't trigger even when they should.

**Impact:** A KOL could avoid negative flags purely because their wallet data failed to load. The report ships with artificially clean scores.

**Potential Fix:** Track which data sources succeeded/failed per report. Add a `dataCompleteness` field showing which stages had full data vs fallback. Surface this in the UI.

### Prefilter vs Full Analysis Chain Detection Mismatch

**Problem:** The prefilter (Stage 2) uses cheap regex-based chain detection, while full analysis (Stage 4) uses GPT classification. In ~5% of cases, the prefilter's chain guess disagrees with GPT's classification.

**Impact:** Some KOLs may pass the prefilter with an incorrect chain assessment, only to fail chain coverage checks during full analysis. Or worse, rejected by prefilter when GPT would have classified them correctly.

**Potential Fix:** Accept this as an intentional trade-off (the prefilter's job is cheap rejection, not accurate classification). Consider loosening G4 to allow borderline cases through.

### No Retry Logic for External APIs

**Problem:** GMGN API calls, bird-twitter, and LLM requests have no retry logic. A single transient failure (network timeout, rate limit) causes the entire KOL's analysis to degrade.

**Impact:** During high-load periods or API instability, leaderboard quality degrades unpredictably. Failed KOLs get low scores instead of being retried.

**Potential Fix:** Implement exponential backoff with 2-3 retries for external calls. Mark KOLs as "pending retry" instead of shipping degraded reports.

---

## Minor

### Telegram Alert Cooldown Gaps

**Problem:** The watchroom enforces a per-token 30-minute cooldown between alerts. During the cooldown window, threshold hits are logged but not queued.

**Impact:** High-velocity tokens (meme coin pumps) may have alert gaps. A token that crosses +20%, dips, then crosses +30% within 30 minutes triggers only the first alert.

**Potential Fix:** Queue suppressed alerts and send a summary after cooldown expires: "During cooldown, $TOKEN hit +30% (peak) and is now at +22%."

### Hardcoded KOL Alignment in Watch Aggregator

**Problem:** The `watch-signal-aggregator.ts` uses hardcoded KOL alignment scores (e.g., `TIKTOK/RETARD -> 55; others -> 20`). There is no dynamic lookup against the current KOL leaderboard.

**Impact:** Watchroom signal scores don't reflect the live KOL discovery pipeline. A newly discovered high-scoring KOL won't boost token signals until the hardcoded list is updated.

**Potential Fix:** Query the leaderboard data to dynamically score KOL mentions in watch signals.

### Evidence Builder Optional Failure

**Problem:** Evidence building (Stage 10) is wrapped in try-catch with fallback to empty arrays. The report ships without evidence chains, follower simulation, or PnL breakdown if this stage fails.

**Impact:** The leaderboard entry exists but the analysis page lacks its most compelling sections. Users see scores without proof.

**Potential Fix:** Make evidence building a required stage with retry. If it fails after retries, mark the report as "partial" in the UI.

---

## Future Roadmap

### Near-Term

- **Persistent KOL Database** -- SQLite storage for discovered KOLs, classification results, and wallet data. Enable incremental analysis (only re-analyze changed signals).
- **Data Completeness Indicator** -- Surface per-report metadata showing which pipeline stages had full data vs fallback.
- **API Retry Layer** -- Exponential backoff for GMGN, bird-twitter, and LLM calls.

### Medium-Term

- **Multi-Exchange Wallet Support** -- Track CEX deposit/withdrawal addresses alongside on-chain wallets.
- **Historical Leaderboard** -- Store weekly snapshots to show KOL ranking trends over time.
- **Community Wallet Mapping** -- Allow users to submit wallet-KOL associations that the pipeline can verify.

### Long-Term

- **Real-Time Signal Stream** -- Move from batch analysis to streaming tweet processing with sub-minute latency.
- **Automated Copy-Trade Execution** -- For `auto_copy` tier KOLs, execute trades via DEX aggregator with configurable position sizing.
- **Cross-Platform Signals** -- Extend beyond Twitter/X to Telegram groups, Discord channels, and Farcaster.
