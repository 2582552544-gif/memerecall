# MemeRecall

**The Verified Signal Layer for Crypto Twitter**

Alpha discovery through KOL tweet verification, on-chain wallet matching, and follower profit simulation — powered by GPT signal classification.

## What is MemeRecall?

MemeRecall is a funnel engine that continuously discovers crypto KOLs, classifies their Twitter signals using GPT, verifies claims against on-chain wallet activity, and outputs a ranked leaderboard of **verified signal callers** — KOLs who tweet what they trade, trade what they tweet, and make money doing it.

The system applies a **Triple Filter** to every KOL:

| Filter | Question | Without it |
|---|---|---|
| **Signal Detection** | Does this person actually tweet trading signals? | → Just a wallet tracker (Nansen) |
| **Wallet Verification** | Do they buy what they claim to buy? | → Just sentiment analysis (LunarCrush) |
| **Profit Validation** | Would followers profit by copy-trading? | → Just Twitter noise |

Only KOLs passing all three filters appear on the leaderboard.

## Key Features

### GPT-Powered Signal Classification
- Analyzes 100 tweets per KOL using GPT-4o in batch mode
- Classifies intent levels S0-S4 (Noise → Mention → Opinion → Claimed Buy → Claimed Exit)
- Detects negation ("I didn't buy"), analogy references ("like $KEKIUS"), noise symbols ("CA" = contract address)
- Identifies red flags: celebrity FOMO triggers, undisclosed affiliates, self-contradictions

### Multi-Chain Wallet Verification
- Supports multiple wallets per KOL across SOL, ETH, BSC, Base chains
- Chain-routed matching: signal tokens matched to same-chain wallet activity first
- 6-tier time window analysis: buy_before_signal → immediate → quick → delayed → late → unrelated
- Cross-chain symbol fallback with scoring penalty

### Four-Dimensional Scoring

| Dimension | Measures | Key Metric |
|---|---|---|
| **Authenticity** | Say-do consistency | % of S3/S4 signals verified by wallet |
| **Follower Alpha** | Copy-trade profitability | Median ROI of verified signals |
| **Coverage** | Data completeness | Signal chains covered by wallets |
| **Discipline** | Risk management | Penalty for quick flips after shilling |

### Twitter-First Prefilter
- 5 rule-based gates, zero GPT cost
- G1: Signal frequency (S3+S4 ≥ 3 or token mentions ≥ 5)
- G4: Chain coverage validation
- Saves 94% of GPT budget by rejecting Silent Whales before analysis

### Five Action Tiers

| Tier | Condition | Meaning |
|---|---|---|
| `auto_copy` | Composite ≥ 75 & Authenticity ≥ 60 | Safe to auto-copy trade |
| `watchlist` | Composite 50-75 | Manual confirmation recommended |
| `narrative_only` | Low composite, adequate coverage | Read for narratives, don't copy |
| `avoid` | Quick flip detected & Authenticity < 30 | Suspected distribution/pump-dump |
| `insufficient_data` | Chain mismatch or low coverage | Need more wallet data |

### Red Flag Detection
- `CHAIN_MISMATCH` — Signal chains not covered by any mapped wallet
- `CLAIMED_BUY_NO_TRADE` — KOL claimed to buy but no wallet trade found
- `QUICK_FLIP_AFTER_SHILL` — Sold shortly after promoting
- `CELEBRITY_FOMO_TRIGGER` — Leveraging celebrity names for FOMO
- `UNDISCLOSED_AFFILIATE` — Suspected paid promotion
- `SELF_CONTRADICTION` — Explicitly denied buying tokens they promoted
- `MICRO_WALLET` — Total trading volume below $1,000

### Leaderboard Ranking

```
RankScore = log(1 + MedianROI) × (WinRate / 0.5) × (Auth / 100)² × P_risk × P_sample
```

- Uses **median** ROI (not mean) to resist meme coin outliers
- Authenticity squared to heavily penalize fakers
- Sample penalty: need ≥ 10 verified signals for full score

## Architecture

```
Tier 0: Discovery (GMGN KOL Ranking API)
  │  Fetch KOL-tagged wallets with twitter binding
  ▼
Tier 1: Prefilter (rule-based, $0 GPT cost)
  │  G1: Tweet signal frequency check
  │  G2: Bot detection
  │  G3: Wallet exists
  │  G4: Chain coverage validation
  │  G5: Wallet activity threshold
  ▼
Tier 2: Full Analysis Pipeline (~$0.15/KOL)
  │  bird-twitter → 100 tweets
  │  GPT signal classification (S0-S4)
  │  GMGN multi-wallet holdings + activity
  │  Chain-routed matching
  │  4-dimensional scoring + red flags
  │  GPT narrative generation (insights + thesis)
  ▼
Tier 3: Ranking + Leaderboard
  │  RankScore computation
  │  S/A/B tier assignment
  ▼
Output: Verified Signal Callers Leaderboard
```

## Project Structure

```
memerecall/
├── packages/core/src/
│   ├── agents/
│   │   ├── kol-discovery-agent.ts      # GMGN KOL discovery
│   │   ├── kol-prefilter-agent.ts      # Twitter-First prefilter (5 gates)
│   │   ├── signal-classifier-agent.ts  # GPT S0-S4 batch classification
│   │   ├── kol-full-agent.ts           # Main pipeline orchestrator
│   │   ├── narrative-agent.ts          # GPT insights + thesis generation
│   │   ├── kol-ranking-agent.ts        # RankScore computation
│   │   ├── kol-analysis-agent.ts       # Multi-wallet GMGN analysis
│   │   ├── gmgn-social-agent.ts        # Tweet collection via bird-twitter
│   │   ├── gmgn-activity-agent.ts      # Multi-chain wallet activity
│   │   └── social-investment-agent.ts  # Signal-wallet matching engine
│   ├── kol-report-types.ts             # KOLReport, ActionTier, RedFlag, etc.
│   ├── leaderboard-types.ts            # LeaderboardEntry, PrefilterResult
│   ├── agent-catalog.ts                # Multi-wallet KOL definitions
│   └── gmgn-client.ts                  # GMGN API client (OpenAPI + bb-browser)
├── apps/
│   ├── api/src/index.ts                # Elysia REST API (port 4049)
│   └── web/app/                        # Next.js leaderboard dashboard
│       ├── page.tsx                    # Leaderboard main page
│       └── analysis/[handle]/page.tsx  # KOL detail card (3-tier progressive)
├── scripts/
│   ├── run_leaderboard_demo.ts         # Full funnel: discover → rank
│   ├── run_full_report_demo.ts         # Single KOL v2.0 deep analysis
│   └── run_kol_analysis_demo.ts        # Wallet-only analysis
├── data/                               # Runtime data (gitignored)
│   ├── leaderboard/latest.json
│   ├── reports/
│   ├── social/
│   └── analysis/
└── hermes/                             # Hermes agent orchestration config
```

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Bun 1.3 + TypeScript |
| Backend API | Elysia (Bun-native web framework) |
| Frontend | Next.js 14 (App Router, Server Components) |
| UI | shadcn/ui + Tailwind CSS + ECharts |
| LLM | OpenAI-compatible API (GPT-4o via proxy) |
| Tweet Data | bird-twitter CLI |
| Wallet Data | GMGN OpenAPI + bb-browser |
| Monorepo | Turborepo + Bun workspaces |

## API Reference

| Endpoint | Description |
|---|---|
| `GET /leaderboard?limit=10` | Full funnel: discover → prefilter → analyze → rank |
| `GET /kol/:handle/report` | Single KOL deep analysis (v2.0 pipeline) |
| `GET /analysis/:handle` | Cached or live wallet analysis |
| `GET /analysis/:handle/live` | Force fresh wallet analysis |
| `GET /investment/:handle` | Signal-wallet matching report |
| `GET /timeline/:handle` | Evidence timeline |
| `GET /watchlist` | Token price watchlist |
| `POST /watch/run` | Trigger token watch cycle |
| `POST /watchlist/add` | Add token to watch |

## Getting Started

### Prerequisites
- Bun (latest)
- `bird-twitter` CLI in PATH
- `bb-browser` CLI in PATH

### Local Development

```bash
git clone <repo-url>
cd memerecall
bun install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see below)

# Run the full leaderboard funnel
bun run leaderboard:run

# Or analyze a single KOL
bun run report:will

# Start API + Dashboard
bun run dev
# Dashboard: http://localhost:3001
# API: http://localhost:4049
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MEMERECALL_LLM_API_KEY` | Yes | OpenAI-compatible API key |
| `MEMERECALL_LLM_BASE_URL` | No | LLM endpoint (default: `https://yunwu.ai/v1`) |
| `MEMERECALL_LLM_MODEL` | No | Model name (default: `gpt-4o`) |
| `GMGN_API_KEY` | Yes | GMGN API key (also reads `~/.config/gmgn/.env`) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot for price alerts |
| `TELEGRAM_HOME_CHANNEL` | No | Telegram chat ID |

## Key Learnings

1. **GMGN KOL wallets are 94% Silent Whales** — profitable on-chain but don't tweet signals. Only 6% are actual Signal Callers. Data source matters more than algorithm quality.
2. **Twitter-First prefilter saves 94% of GPT budget** — checking S3/S4 signal frequency before spending $0.15/KOL on full analysis.
3. **The triple filter intersection is naturally sparse** — expect ~30-50 qualified KOLs globally. This is a feature: a 30-person high-value whitelist beats a 500-person noise leaderboard.
4. **Selection bias is the biggest risk** — ranking by wallet PnL selects for silent traders; ranking by tweet volume selects for shillers. The product's value is in the AND intersection.
