import type { DashboardData, EvidenceItem, KOLProfile, ScoreFactor, TokenProfile } from "./types";

function factor(
  key: string,
  label: string,
  value: number,
  weight: number,
  note: string,
): ScoreFactor {
  return {
    key,
    label,
    value,
    weight,
    contribution: Math.round((value * weight) / 100),
    note,
  };
}

function evidence(
  id: string,
  type: EvidenceItem["type"],
  title: string,
  detail: string,
  timestamp: string,
  source: string,
): EvidenceItem {
  return { id, type, title, detail, timestamp, source };
}

const notableKols: KOLProfile[] = [
  {
    id: "kol-1",
    handle: "apeoracle",
    displayName: "Ape Oracle",
    primaryWallet: "0xApe000000000000000000000000000000000001",
    walletConfidence: 92,
    followerBucket: "100k+",
    labels: ["seed", "trusted"],
    riskFlags: [],
    score: 82,
    sayDoScore: 88,
    winRateScore: 76,
    rugScore: 84,
    bundlerScore: 78,
    timingScore: 79,
    factors: [
      factor("say_do", "Say-Do Consistency", 88, 30, "Calls align with wallet accumulation in most tracked cases."),
      factor("win_rate", "24h Win Rate", 76, 25, "12 of 18 tracked calls reached +20% within 24h."),
      factor("rug", "Rug Exposure", 84, 20, "Low rug exposure across tracked calls."),
      factor("bundler", "Bundler Cleanliness", 78, 15, "Mostly clean launches, low wallet-cluster contamination."),
      factor("timing", "Timing Edge", 79, 10, "Enters early without obvious dump pattern."),
    ],
    evidence: [
      evidence("ape-1", "wallet_link", "Wallet mapping confirmed", "Arkham tag and self-disclosed wallet match.", "2026-04-17T08:10:00Z", "Arkham + X"),
      evidence("ape-2", "tweet", "Called $REBORN", "Tweeted conviction thread before first volume recovery spike.", "2026-04-16T03:20:00Z", "X"),
      evidence("ape-3", "trade", "Accumulated before breakout", "Wallet added 14 minutes before public call, then held 36h.", "2026-04-16T03:06:00Z", "Bitquery"),
    ],
    sampleCalls: 18,
    wins24h: 12,
    dumpChains: 0,
  },
  {
    id: "kol-2",
    handle: "moonharpoon",
    displayName: "Moon Harpoon",
    primaryWallet: "0xMoon000000000000000000000000000000000002",
    walletConfidence: 87,
    followerBucket: "50k-100k",
    labels: ["seed", "watch"],
    riskFlags: ["timing-risk"],
    score: 71,
    sayDoScore: 74,
    winRateScore: 69,
    rugScore: 72,
    bundlerScore: 66,
    timingScore: 70,
    factors: [
      factor("say_do", "Say-Do Consistency", 74, 30, "Usually aligned, with a few ambiguous exits."),
      factor("win_rate", "24h Win Rate", 69, 25, "Moderate hit rate in fast-moving launches."),
      factor("rug", "Rug Exposure", 72, 20, "Some exposure to low-quality launches."),
      factor("bundler", "Bundler Cleanliness", 66, 15, "Occasional cluster risk."),
      factor("timing", "Timing Edge", 70, 10, "Good at entry timing, weaker on exits."),
    ],
    evidence: [
      evidence("moon-1", "wallet_link", "Wallet linked by GMGN", "GMGN and bio address cross-match.", "2026-04-14T10:00:00Z", "GMGN"),
      evidence("moon-2", "tweet", "Called $SPARK", "Public call came after first wallet entry.", "2026-04-18T09:20:00Z", "X"),
    ],
    sampleCalls: 14,
    wins24h: 8,
    dumpChains: 1,
  },
  {
    id: "kol-3",
    handle: "exitliquidityking",
    displayName: "Exit Liquidity King",
    primaryWallet: "0xExit000000000000000000000000000000000003",
    walletConfidence: 95,
    followerBucket: "100k+",
    labels: ["seed", "dumper"],
    riskFlags: ["dumper", "delete-risk"],
    score: 28,
    sayDoScore: 18,
    winRateScore: 34,
    rugScore: 26,
    bundlerScore: 38,
    timingScore: 22,
    factors: [
      factor("say_do", "Say-Do Consistency", 18, 30, "Repeatedly told followers to buy while the wallet distributed."),
      factor("win_rate", "24h Win Rate", 34, 25, "Only 3 wins in 15 tracked calls."),
      factor("rug", "Rug Exposure", 26, 20, "High association with failed launches."),
      factor("bundler", "Bundler Cleanliness", 38, 15, "Multiple calls touched clustered launches."),
      factor("timing", "Timing Edge", 22, 10, "Frequently sells into own call windows."),
    ],
    evidence: [
      evidence("exit-1", "tweet", "Public buy call on $GHOST", "Posted 'sending this higher' to 120k followers.", "2026-04-12T11:02:00Z", "X"),
      evidence("exit-2", "trade", "Wallet dumped 94% within 8 minutes", "Primary wallet sold into the call window.", "2026-04-12T11:10:00Z", "Bitquery"),
      evidence("exit-3", "timeline", "Tweet later deleted", "Original call is absent from timeline but stored in snapshot.", "2026-04-12T13:02:00Z", "Snapshot archive"),
    ],
    sampleCalls: 15,
    wins24h: 3,
    dumpChains: 2,
  },
  {
    id: "kol-4",
    handle: "bundlerbaron",
    displayName: "Bundler Baron",
    primaryWallet: "0xBund000000000000000000000000000000000004",
    walletConfidence: 89,
    followerBucket: "20k-50k",
    labels: ["seed", "dumper"],
    riskFlags: ["bundler-risk", "dumper"],
    score: 31,
    sayDoScore: 29,
    winRateScore: 41,
    rugScore: 30,
    bundlerScore: 19,
    timingScore: 35,
    factors: [
      factor("say_do", "Say-Do Consistency", 29, 30, "Behavior diverges from public narrative."),
      factor("win_rate", "24h Win Rate", 41, 25, "Some wins, overwhelmed by poor-quality launches."),
      factor("rug", "Rug Exposure", 30, 20, "High exposure to rug-like launches."),
      factor("bundler", "Bundler Cleanliness", 19, 15, "Frequently linked to clustered wallets."),
      factor("timing", "Timing Edge", 35, 10, "Often exits early after social call."),
    ],
    evidence: [
      evidence("bundle-1", "trade", "Clustered wallets entered first", "Five linked wallets bought before the public call.", "2026-04-10T04:40:00Z", "Bubblemaps"),
      evidence("bundle-2", "tweet", "Promoted $ASH", "Tweet framed launch as organic momentum.", "2026-04-10T04:48:00Z", "X"),
      evidence("bundle-3", "trade", "Lead wallet sold into bounce", "Wallet offloaded 71% in 16 minutes.", "2026-04-10T05:04:00Z", "Bitquery"),
    ],
    sampleCalls: 11,
    wins24h: 4,
    dumpChains: 1,
  },
  {
    id: "kol-5",
    handle: "silentalpha",
    displayName: "Silent Alpha",
    primaryWallet: "0xSil0000000000000000000000000000000000005",
    walletConfidence: 81,
    followerBucket: "10k-20k",
    labels: ["seed", "trusted"],
    riskFlags: [],
    score: 76,
    sayDoScore: 81,
    winRateScore: 74,
    rugScore: 75,
    bundlerScore: 73,
    timingScore: 77,
    factors: [
      factor("say_do", "Say-Do Consistency", 81, 30, "Mostly accumulates and holds around calls."),
      factor("win_rate", "24h Win Rate", 74, 25, "7 of 10 tracked ideas worked."),
      factor("rug", "Rug Exposure", 75, 20, "Low exposure to obvious rugs."),
      factor("bundler", "Bundler Cleanliness", 73, 15, "Generally clean launch selection."),
      factor("timing", "Timing Edge", 77, 10, "Strong entry discipline."),
    ],
    evidence: [
      evidence("silent-1", "wallet_link", "Mapped by behavior fingerprint", "Wallet repeatedly buys within 20 minutes before public thread.", "2026-04-11T14:00:00Z", "Heuristic"),
      evidence("silent-2", "trade", "Held through first volatility wave", "No immediate dump detected on $EMBER.", "2026-04-17T07:18:00Z", "Bitquery"),
    ],
    sampleCalls: 10,
    wins24h: 7,
    dumpChains: 0,
  },
];

function makeGenericKol(index: number): KOLProfile {
  const base = 55 + (index % 19);
  const handle = `seedkol${index}`;
  return {
    id: `kol-${index}`,
    handle,
    displayName: `Seed KOL ${index}`,
    primaryWallet: `0x${index.toString().padStart(40, "0")}`,
    walletConfidence: 62 + (index % 30),
    followerBucket: index % 3 === 0 ? "20k-50k" : "5k-20k",
    labels: ["seed"],
    riskFlags: base < 60 ? ["watch"] : [],
    score: base,
    sayDoScore: Math.max(30, base - 2),
    winRateScore: Math.max(35, base - 4),
    rugScore: Math.max(32, base - 5),
    bundlerScore: Math.max(28, base - 8),
    timingScore: Math.max(35, base - 3),
    factors: [
      factor("say_do", "Say-Do Consistency", Math.max(30, base - 2), 30, "Seeded benchmark data for MVP."),
      factor("win_rate", "24h Win Rate", Math.max(35, base - 4), 25, "Seeded benchmark data for MVP."),
      factor("rug", "Rug Exposure", Math.max(32, base - 5), 20, "Seeded benchmark data for MVP."),
      factor("bundler", "Bundler Cleanliness", Math.max(28, base - 8), 15, "Seeded benchmark data for MVP."),
      factor("timing", "Timing Edge", Math.max(35, base - 3), 10, "Seeded benchmark data for MVP."),
    ],
    evidence: [
      evidence(`${handle}-1`, "wallet_link", "Seed wallet mapping", "Mapped from MVP seed dataset.", "2026-04-15T00:00:00Z", "Seed"),
    ],
    sampleCalls: 6 + (index % 8),
    wins24h: 3 + (index % 5),
    dumpChains: base < 45 ? 1 : 0,
  };
}

const seededKols: KOLProfile[] = [
  ...notableKols,
  ...Array.from({ length: 15 }, (_, offset) => makeGenericKol(offset + 6)),
];

const notableTokens: TokenProfile[] = [
  {
    id: "token-1",
    contract: "0xreborn0000000000000000000000000000000001",
    symbol: "REBORN",
    name: "Reborn Cat",
    lifecycleStage: "reviving",
    score: 79,
    holderGrowthScore: 82,
    volumeRecoveryScore: 76,
    kolReentryScore: 71,
    bundlerCleanlinessScore: 80,
    liquidityReturnScore: 78,
    narrativeScore: 74,
    factors: [
      factor("holder_growth", "Holder Growth", 82, 20, "Net holder count expanded after long stagnation."),
      factor("volume_recovery", "Volume Recovery", 76, 20, "24h volume recovered sharply from base."),
      factor("kol_reentry", "KOL Re-entry", 71, 15, "Trusted KOLs resumed coverage."),
      factor("bundler", "Bundler Cleanliness", 80, 15, "No obvious coordinated wallet cluster."),
      factor("liquidity", "Liquidity Return", 78, 15, "Liquidity returned with tighter spread."),
      factor("narrative", "Narrative Strength", 74, 15, "Narrative momentum returned with community traction."),
    ],
    timeline: [
      evidence("reborn-1", "timeline", "Dead period", "Flat activity for 23 days after 92% drawdown.", "2026-03-20T00:00:00Z", "DexScreener"),
      evidence("reborn-2", "holder", "Holder count inflected", "Holders grew from 312 to 441 in 48 hours.", "2026-04-16T08:00:00Z", "GMGN"),
      evidence("reborn-3", "volume", "Volume regime shift", "24h volume moved 5.8x above 14d baseline.", "2026-04-17T12:00:00Z", "GeckoTerminal"),
      evidence("reborn-4", "tweet", "Trusted KOL re-entry", "@apeoracle revisited the token with position evidence.", "2026-04-18T04:00:00Z", "X"),
    ],
    alerts: ["Revival score > 65", "No bundler contamination"],
    tags: ["case-study", "revival"],
  },
  {
    id: "token-2",
    contract: "0xphoenix00000000000000000000000000000002",
    symbol: "PHNX",
    name: "Phoenix Loop",
    lifecycleStage: "reviving",
    score: 73,
    holderGrowthScore: 75,
    volumeRecoveryScore: 72,
    kolReentryScore: 69,
    bundlerCleanlinessScore: 74,
    liquidityReturnScore: 71,
    narrativeScore: 77,
    factors: [
      factor("holder_growth", "Holder Growth", 75, 20, "Steady organic holder return."),
      factor("volume_recovery", "Volume Recovery", 72, 20, "Momentum reappeared after dead chart period."),
      factor("kol_reentry", "KOL Re-entry", 69, 15, "Selective signal from trusted accounts."),
      factor("bundler", "Bundler Cleanliness", 74, 15, "Acceptably clean launch history."),
      factor("liquidity", "Liquidity Return", 71, 15, "Liquidity normalized above dead-zone threshold."),
      factor("narrative", "Narrative Strength", 77, 15, "Strong second-wave narrative."),
    ],
    timeline: [
      evidence("phnx-1", "timeline", "Ninety percent drawdown", "Collapsed after launch mania, then stabilized.", "2026-03-28T00:00:00Z", "DexScreener"),
      evidence("phnx-2", "volume", "Recovery candle cluster", "Volume increased 4.1x over baseline.", "2026-04-17T10:30:00Z", "GeckoTerminal"),
      evidence("phnx-3", "holder", "New buyer inflow", "New holder net additions sustained over 3 epochs.", "2026-04-18T05:10:00Z", "GMGN"),
    ],
    alerts: ["Second confirmed revival case"],
    tags: ["case-study", "revival"],
  },
  {
    id: "token-3",
    contract: "0xghost0000000000000000000000000000000003",
    symbol: "GHOST",
    name: "Ghost Pump",
    lifecycleStage: "watch",
    score: 41,
    holderGrowthScore: 35,
    volumeRecoveryScore: 58,
    kolReentryScore: 22,
    bundlerCleanlinessScore: 18,
    liquidityReturnScore: 44,
    narrativeScore: 53,
    factors: [
      factor("holder_growth", "Holder Growth", 35, 20, "Weak holder expansion."),
      factor("volume_recovery", "Volume Recovery", 58, 20, "Volume present but inconsistent."),
      factor("kol_reentry", "KOL Re-entry", 22, 15, "Mostly low-trust promotion."),
      factor("bundler", "Bundler Cleanliness", 18, 15, "Bundler contamination detected."),
      factor("liquidity", "Liquidity Return", 44, 15, "Liquidity still fragile."),
      factor("narrative", "Narrative Strength", 53, 15, "Narrative exists, but weak evidence."),
    ],
    timeline: [
      evidence("ghost-1", "trade", "Dumper evidence chain", "Token was used in a public dump pattern by @exitliquidityking.", "2026-04-12T11:10:00Z", "Bitquery"),
      evidence("ghost-2", "security", "Bundler cluster flagged", "Wallet cluster overlap too high for clean revival.", "2026-04-12T11:14:00Z", "Bubblemaps"),
    ],
    alerts: ["Watch only", "Bundler contamination"],
    tags: ["dumper-case"],
  },
];

function makeGenericToken(index: number): TokenProfile {
  const score = 38 + (index % 40);
  return {
    id: `token-${index}`,
    contract: `0x${(index + 1000).toString(16).padStart(40, "0")}`,
    symbol: `TK${index}`,
    name: `Token ${index}`,
    lifecycleStage: score >= 70 ? "reviving" : score >= 55 ? "watch" : "dead",
    score,
    holderGrowthScore: Math.max(20, score + 3),
    volumeRecoveryScore: Math.max(20, score - 1),
    kolReentryScore: Math.max(15, score - 8),
    bundlerCleanlinessScore: Math.max(10, score - 6),
    liquidityReturnScore: Math.max(15, score - 4),
    narrativeScore: Math.max(18, score - 2),
    factors: [
      factor("holder_growth", "Holder Growth", Math.max(20, score + 3), 20, "Seeded benchmark data for MVP."),
      factor("volume_recovery", "Volume Recovery", Math.max(20, score - 1), 20, "Seeded benchmark data for MVP."),
      factor("kol_reentry", "KOL Re-entry", Math.max(15, score - 8), 15, "Seeded benchmark data for MVP."),
      factor("bundler", "Bundler Cleanliness", Math.max(10, score - 6), 15, "Seeded benchmark data for MVP."),
      factor("liquidity", "Liquidity Return", Math.max(15, score - 4), 15, "Seeded benchmark data for MVP."),
      factor("narrative", "Narrative Strength", Math.max(18, score - 2), 15, "Seeded benchmark data for MVP."),
    ],
    timeline: [
      evidence(`token-${index}-1`, "timeline", "Seeded lifecycle event", "Imported from seeded sample set.", "2026-04-15T00:00:00Z", "Seed"),
    ],
    alerts: score >= 65 ? ["revival-threshold"] : [],
    tags: ["seed"],
  };
}

const seededTokens: TokenProfile[] = [
  ...notableTokens,
  ...Array.from({ length: 47 }, (_, offset) => makeGenericToken(offset + 4)),
];

const latestAlerts: EvidenceItem[] = [
  evidence("alert-1", "alert", "High trust call", "@apeoracle crossed trust threshold 80.", "2026-04-19T14:00:00Z", "MemeRecall"),
  evidence("alert-2", "alert", "Revival confirmed", "$REBORN crossed revival threshold 75.", "2026-04-19T14:05:00Z", "MemeRecall"),
  evidence("alert-3", "alert", "Dumper evidence added", "@exitliquidityking added a second dump chain.", "2026-04-19T15:10:00Z", "MemeRecall"),
  evidence("alert-4", "alert", "Second revival case", "$PHNX confirmed as second revival sample.", "2026-04-19T17:20:00Z", "MemeRecall"),
];

export const dashboardData: DashboardData = {
  summary: {
    totalKols: seededKols.length,
    totalTokens: seededTokens.length,
    highTrustCount: seededKols.filter((item) => item.score >= 70).length,
    highRevivalCount: seededTokens.filter((item) => item.score >= 65).length,
    dumperEvidenceChains: 3,
    revivalCases: 2,
  },
  topKols: seededKols.slice().sort((a, b) => b.score - a.score).slice(0, 5),
  topTokens: seededTokens.slice().sort((a, b) => b.score - a.score).slice(0, 5),
  latestAlerts,
};

export const kolProfiles = seededKols;
export const tokenProfiles = seededTokens;
