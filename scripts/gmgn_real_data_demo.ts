import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type TwitterMessage = {
  id: string;
  tw_type: string;
  tweet_id?: string;
  tw_timestamp: string;
  user?: {
    screen_name?: string;
    name?: string;
    avatar?: string;
    followers?: number;
  };
  user_tags?: string[];
  content?: {
    text?: string;
  };
  source_user?: {
    screen_name?: string;
    name?: string;
  };
  source_content?: {
    text?: string;
  };
  token?: {
    chain?: string;
    symbol?: string;
    ca?: string;
    price?: string;
    mcap?: string;
  };
  translation?: {
    "zh-CN"?: {
      content?: string;
      source_content?: string;
    };
  };
};

type TwitchKolResponse = Record<string, Record<string, { channel_name: string }>>;

type NormalizedKolSignal = {
  id: string;
  timestamp: number;
  handle: string;
  name: string;
  followers: number;
  tags: string[];
  twType: string;
  text: string;
  translatedText: string | null;
  tokenSymbol: string | null;
  tokenCa: string | null;
  tokenChain: string | null;
  sourceHandle: string | null;
};

type NormalizedKolWallet = {
  chain: string;
  wallet: string;
  channelName: string;
};

type DemoOutput = {
  generatedAt: string;
  sourcePage: string;
  messageCount: number;
  walletMapCount: number;
  topSignals: NormalizedKolSignal[];
  walletMappings: NormalizedKolWallet[];
  joinedPreview: Array<{
    handle: string;
    matchedWallets: NormalizedKolWallet[];
    latestSignal: NormalizedKolSignal | null;
  }>;
};

async function runBb(command: string[]): Promise<string> {
  const proc = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${stderr || stdout}`);
  }
  return stdout.trim();
}

async function bbFetch(url: string): Promise<unknown> {
  const output = await runBb(["bb-browser", "fetch", url]);
  return JSON.parse(output);
}

function normalizeSignals(messages: TwitterMessage[]): NormalizedKolSignal[] {
  return messages
    .filter((item) => item.user?.screen_name)
    .map((item) => ({
      id: item.id,
      timestamp: Number(item.tw_timestamp),
      handle: item.user?.screen_name || "unknown",
      name: item.user?.name || item.user?.screen_name || "unknown",
      followers: item.user?.followers || 0,
      tags: item.user_tags || [],
      twType: item.tw_type,
      text: item.content?.text || item.source_content?.text || "",
      translatedText:
        item.translation?.["zh-CN"]?.content ||
        item.translation?.["zh-CN"]?.source_content ||
        null,
      tokenSymbol: item.token?.symbol || null,
      tokenCa: item.token?.ca || null,
      tokenChain: item.token?.chain || null,
      sourceHandle: item.source_user?.screen_name || null,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function normalizeWallets(input: TwitchKolResponse): NormalizedKolWallet[] {
  const rows: NormalizedKolWallet[] = [];
  for (const [chain, wallets] of Object.entries(input)) {
    for (const [wallet, meta] of Object.entries(wallets)) {
      rows.push({
        chain,
        wallet,
        channelName: meta.channel_name,
      });
    }
  }
  return rows;
}

function buildJoinedPreview(
  signals: NormalizedKolSignal[],
  wallets: NormalizedKolWallet[],
): DemoOutput["joinedPreview"] {
  const groupedSignals = new Map<string, NormalizedKolSignal[]>();
  for (const signal of signals) {
    const key = signal.handle.toLowerCase();
    const list = groupedSignals.get(key) || [];
    list.push(signal);
    groupedSignals.set(key, list);
  }

  const groupedWallets = new Map<string, NormalizedKolWallet[]>();
  for (const wallet of wallets) {
    const key = wallet.channelName.toLowerCase();
    const list = groupedWallets.get(key) || [];
    list.push(wallet);
    groupedWallets.set(key, list);
  }

  const handles = Array.from(new Set([...groupedSignals.keys(), ...groupedWallets.keys()])).slice(
    0,
    20,
  );

  return handles.map((handle) => ({
    handle,
    matchedWallets: groupedWallets.get(handle) || [],
    latestSignal: groupedSignals.get(handle)?.[0] || null,
  }));
}

async function main(): Promise<void> {
  const outDir = path.resolve(process.cwd(), "data", "real-demo");
  await mkdir(outDir, { recursive: true });

  const messagesJson = await bbFetch(
    "https://gmgn.ai/vas/api/v1/twitter/messages?has_token=false&user_tags=kol&user_tags=trader&user_tags=master&user_tags=politics&user_tags=media&user_tags=companies&user_tags=founder&user_tags=exchange&user_tags=celebrity&user_tags=binance_square&user_tags=other&tw_types=tweet&tw_types=repost&tw_types=quote&tw_types=reply&tw_types=delete_post&tw_types=pin&tw_types=unpin&tw_types=follow&tw_types=unfollow&tw_types=banner&tw_types=photo&tw_types=name&tw_types=handle&tw_types=description",
  ) as { code: number; data: TwitterMessage[] };

  const walletJson = await bbFetch("https://gmgn.ai/api/v1/live/twitch_kol") as {
    code: number;
    data: TwitchKolResponse;
  };

  if (messagesJson.code !== 0 || walletJson.code !== 0) {
    throw new Error("GMGN API returned non-zero code.");
  }

  const normalizedSignals = normalizeSignals(messagesJson.data);
  const normalizedWallets = normalizeWallets(walletJson.data);
  const joinedPreview = buildJoinedPreview(normalizedSignals, normalizedWallets);

  const output: DemoOutput = {
    generatedAt: new Date().toISOString(),
    sourcePage: "https://gmgn.ai/follow?chain=sol&ref=a55d1u2f",
    messageCount: normalizedSignals.length,
    walletMapCount: normalizedWallets.length,
    topSignals: normalizedSignals.slice(0, 30),
    walletMappings: normalizedWallets.slice(0, 50),
    joinedPreview,
  };

  await writeFile(
    path.join(outDir, "gmgn-twitter-messages.raw.json"),
    JSON.stringify(messagesJson, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outDir, "gmgn-twitch-kol.raw.json"),
    JSON.stringify(walletJson, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(outDir, "gmgn-real-data-demo.json"),
    JSON.stringify(output, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outDir,
        messageCount: output.messageCount,
        walletMapCount: output.walletMapCount,
        joinedPreview: output.joinedPreview.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

await main();
