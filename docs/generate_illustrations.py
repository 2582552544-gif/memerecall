"""
Generate high-density informational infographics for MemeRecall docs.
Focus: data-rich, instructional, with real numbers and decision guidance.
"""

import asyncio
import sys
sys.path.insert(0, "/Users/mac/PycharmProjects/ai_music_2025/libs")

from ai_mv.character.image_generator import GeminiImageGenerator

OUTPUT_DIR = "/Users/mac/PycharmProjects/ai_music_2025/memerecall/docs/images"

ILLUSTRATIONS = [
    {
        "name": "pipeline-overview",
        "prompt": """Create a HIGH-DENSITY technical infographic showing a 4-tier data pipeline funnel with REAL NUMBERS and annotations.

LAYOUT: Vertical funnel, left-to-right data flow annotations on each tier.

TIER 0 - DISCOVERY (top, widest section, light green):
- Title: "DISCOVERY"
- Left annotation: "GMGN KOL Ranking API"
- Right annotation: "200 wallets/chain x 4 chains"
- Data: "Input: 800 wallets | Output: ~200 unique KOLs (deduplicated)"
- Icon: radar scanning

TIER 1 - PREFILTER (narrower, cyan):
- Title: "TWITTER-FIRST PREFILTER"
- 5 gate labels stacked: "G1: Signal Freq | G2: Bot Check | G3: Wallet Exists | G4: Chain Match | G5: Active"
- Right annotation: "Cost: $0 (regex only, no GPT)"
- Data: "94% rejected as Silent Whales | ~12 KOLs pass"
- Callout box: "SAVES 94% OF GPT BUDGET"

TIER 2 - FULL ANALYSIS (narrower, teal):
- Title: "FULL ANALYSIS PIPELINE"
- Left stack: "100 tweets -> GPT S0-S4 classification -> Chain-routed matching -> 4-dim scoring -> Evidence chains"
- Right annotation: "Cost: ~$0.15/KOL | Time: ~30s/KOL"
- Data: "LLM: 4 batches x 25 tweets | APIs: GMGN + bird-twitter"

TIER 3 - LEADERBOARD (bottom, narrowest, bright green):
- Title: "VERIFIED LEADERBOARD"
- Data: "Output: ~9-12 ranked KOLs with evidence-backed scores"
- Labels: "auto_copy | watchlist | narrative_only | avoid"

BOTTOM STATS BAR:
- "Total cost per run: ~$2" | "Time: 2-5 min" | "Data sources: 3 APIs + 1 LLM"

Style: Dark background #0d1117, neon green #7ee6a1 and cyan #16ead9 accents. Clean sans-serif typography. Every section must have DATA NUMBERS visible. 16:9 landscape. Professional tech infographic style like those from a16z or Messari research reports.""",
    },
    {
        "name": "triple-filter",
        "prompt": """Create a HIGH-DENSITY Venn diagram infographic with detailed annotations explaining the Triple Filter concept for crypto KOL verification.

THREE CIRCLES with clear labels and DATA:

CIRCLE 1 (left, cyan outline, "SIGNAL DETECTION"):
- "Tweets trading signals (S3+S4)"
- "Tool: GPT-4o classifier"
- "Detects: buy claims, exit signals, FOMO triggers"
- Shows example: '@KOL: "Just aped into $TOKEN"' -> "S3: Claimed Buy"

CIRCLE 2 (right, green outline, "WALLET VERIFICATION"):
- "On-chain wallet matches tweet claims"
- "Tool: GMGN multi-chain activity"
- "Checks: buy timing, sell timing, position size"
- Shows: "Tweet at 14:00 -> Wallet buy at 14:03 = VERIFIED"

CIRCLE 3 (bottom, purple outline, "PROFIT VALIDATION"):
- "Followers would actually profit"
- "Tool: Median ROI calculation"
- "Measures: copy-trade simulation, win rate"
- Shows: "Median ROI +23%, Win Rate 65% = PROFITABLE"

INTERSECTION LABELS (in the overlapping areas):
- Signal + Wallet (no profit): "Honest Loser - trades match tweets but loses money (WATCHLIST)"
- Signal + Profit (no wallet): "Shill Suspect - tweets profits but wallet doesn't match (AVOID)"
- Wallet + Profit (no signal): "Silent Whale - profitable but doesn't tweet signals (94% of GMGN KOLs)"
- CENTER (all 3): "VERIFIED SIGNAL CALLER - the 6% sweet spot (AUTO COPY)"

BOTTOM ANNOTATION:
"Key insight: 94% of GMGN KOL wallets are Silent Whales. Only 6% tweet actionable signals that match their wallet activity."

Style: Dark background #0d1117, each circle has distinct neon color. Dense text annotations. Every region has actionable labels. 16:9 landscape. Research-report quality infographic.""",
    },
    {
        "name": "signal-classification",
        "prompt": """Create a detailed DECISION MATRIX infographic showing the 5-level signal classification system (S0-S4) with examples, detection logic, and downstream actions.

LAYOUT: 5 horizontal rows, each representing one intent level. Each row has columns:

HEADER ROW: "Level | Intent | Detection Keywords | Example Tweet | Action Taken"

S0 ROW (gray background):
- "S0 | NOISE | RT, gm, meme, emoji-only | 'gm frens LFG' | SKIP - not a signal"

S1 ROW (blue background):
- "S1 | MENTION | $SYMBOL without opinion | 'Watching $PEPE today' | LOG - track for pattern"

S2 ROW (yellow/amber background):
- "S2 | OPINION | bullish, bearish, moon, 100x | 'Super bullish on $WIF' | MONITOR - opinion only, no action claim"

S3 ROW (green background, highlighted):
- "S3 | CLAIMED BUY | bought, aped, loaded, picked up | 'Just loaded a bag of $BONK' | VERIFY - match against wallet activity"

S4 ROW (red background, highlighted):
- "S4 | CLAIMED EXIT | sold, TP, exited, took profit | 'Took profits on $DOGE, 3x' | VERIFY - check wallet sell + P&L"

RIGHT SIDE ANNOTATIONS:
- Arrow from S0-S1 area: "Filtered out by prefilter (G1 gate)"
- Arrow from S2: "Tracked for narrative analysis"
- Arrow from S3-S4: "Core verification pipeline - matched against on-chain data"

BOTTOM STATS:
- "Typical distribution per 100 tweets: S0=45, S1=20, S2=18, S3=12, S4=5"
- "Only S3+S4 (17%) trigger wallet verification"
- "GPT batch size: 25 tweets/request, 4 requests per KOL"

EDGE CASE BOX (small, bottom right):
- "Negation detection: 'I did NOT buy $X' -> S0 (not S3)"
- "Analogy: 'reminds me of $DOGE' -> S1 (not S2)"
- "Noise symbol: 'Send CA' -> S0 (CA = contract address, not a ticker)"

Style: Dark background, color-coded rows, dense data table format. Professional, like a Bloomberg terminal reference card. 16:9 landscape.""",
    },
    {
        "name": "scoring-radar",
        "prompt": """Create a HIGH-DENSITY infographic showing the 4-dimensional KOL scoring system with formulas, weights, and a comparison example.

LEFT HALF - SCORING DIMENSIONS (4 boxes stacked):

BOX 1 - AUTHENTICITY (35% weight, green):
- "Formula: (S3+S4 matched by wallet) / (S3+S4 total)"
- "Measures: Say-do consistency"
- "Example: 8 buy claims, 6 verified in wallet = 75/100"
- "Penalty: Quadratic in RankScore -> (75/100)^2 = 56% credit"

BOX 2 - FOLLOWER ALPHA (35% weight, cyan):
- "Formula: Median ROI of verified signals"
- "Measures: Would copy-traders profit?"
- "Example: 6 verified picks, median ROI = +23%"
- "Note: Uses MEDIAN not MEAN to resist meme coin outliers"

BOX 3 - COVERAGE (15% weight, blue):
- "Formula: Signal chains covered by wallets / Signal chains total"
- "Measures: Data completeness"
- "Example: Tweets about SOL+ETH, wallet only on SOL = 50/100"
- "Red flag: CHAIN_MISMATCH if missing chains"

BOX 4 - DISCIPLINE (15% weight, purple):
- "Formula: 100 - (20 per quick flip after shill)"
- "Measures: Risk management"
- "Example: 1 quick flip detected = 80/100"
- "Red flag: QUICK_FLIP_AFTER_SHILL"

RIGHT HALF - COMPARISON RADAR CHART:
- Two overlapping radar shapes on 4 axes
- GREEN shape: "Good KOL" - Auth:85, Alpha:70, Coverage:90, Discipline:100 -> Composite: 82 -> AUTO COPY
- RED shape: "Bad KOL" - Auth:20, Alpha:-10, Coverage:40, Discipline:40 -> Composite: 18 -> AVOID

BOTTOM - COMPOSITE FORMULA:
"Composite = 0.35 x Authenticity + 0.35 x Alpha + 0.15 x Coverage + 0.15 x Discipline"
"RankScore = log(1+MedianROI) x (WinRate/0.5) x (Auth/100)^2 x P_risk x P_sample x 100"

ACTION TIER MAPPING:
">= 75 & Auth >= 60: AUTO COPY | 50-75: WATCHLIST | Low + covered: NARRATIVE ONLY | Quick flip + Auth < 30: AVOID"

Style: Dark background, color-coded dimension boxes, radar chart with clear axis labels. Dense with formulas and real numbers. 16:9 landscape. Data dashboard aesthetic.""",
    },
]


async def main():
    generator = GeminiImageGenerator(output_dir=OUTPUT_DIR)

    try:
        for item in ILLUSTRATIONS:
            print(f"\n{'='*60}")
            print(f"Generating: {item['name']}")
            print(f"{'='*60}")

            try:
                image = await generator.generate(
                    prompt=item["prompt"],
                    system_prompt="You are a world-class infographic designer specializing in high-density technical documentation. Create information-rich diagrams that TEACH, not just decorate. Every pixel should convey information. Include real numbers, formulas, decision criteria, and examples. Output ONLY the infographic artwork. NO UI, NO software interface. Dark background, neon accent colors, professional research-report quality.",
                )
                save_path = generator.save_image(image, item["name"])
                print(f"Saved: {save_path} ({len(image.image_data)/1024:.1f} KB)")
            except Exception as e:
                print(f"Failed: {e}")

    finally:
        await generator.close()

    print(f"\nDone! Images saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
