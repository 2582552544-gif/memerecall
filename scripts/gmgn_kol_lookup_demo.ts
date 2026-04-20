import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type TwitterMessage = {
  id: string;
  tw_type: string;
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
  translation?: {
    "zh-CN"?: {
      content?: string;
      source_content?: string;
    };
  };
  token?: {
    chain?: string;
    symbol?: string;
    ca?: string;
    mcap?: string;
  };
};

type TwitchKolMap = Record<string, Record<string, { channel_name: string }>>;

async function runBb(command: string[]): Promise<string> {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${stderr || stdout}`);
  }
  return stdout.trim();
}

async function bbFetchJson(url: string): Promise<unknown> {
  const output = await runBb(["bb-browser", "fetch", url]);
  return JSON.parse(output);
}

function normalizeHandle(input: string): string {
  return input.replace(/^@/, "").trim().toLowerCase();
}

async function main(): Promise<void> {
  const targetHandle = normalizeHandle(process.argv[2] || "@0xWilliam888");
  const outDir = path.resolve(process.cwd(), "data", "kol-lookup");
  await mkdir(outDir, { recursive: true });

  const messages = (await bbFetchJson(
    "https://gmgn.ai/vas/api/v1/twitter/messages?has_token=false&user_tags=kol&user_tags=trader&user_tags=master&user_tags=politics&user_tags=media&user_tags=companies&user_tags=founder&user_tags=exchange&user_tags=celebrity&user_tags=binance_square&user_tags=other&tw_types=tweet&tw_types=repost&tw_types=quote&tw_types=reply&tw_types=delete_post&tw_types=pin&tw_types=unpin&tw_types=follow&tw_types=unfollow&tw_types=banner&tw_types=photo&tw_types=name&tw_types=handle&tw_types=description",
  )) as { code: number; data: TwitterMessage[] };

  const twitchKol = (await bbFetchJson(
    "https://gmgn.ai/api/v1/live/twitch_kol",
  )) as { code: number; data: TwitchKolMap };

  const targetMessages = messages.data.filter(
    (item) => normalizeHandle(item.user?.screen_name || "") === targetHandle,
  );

  const walletMatches = Object.entries(twitchKol.data).flatMap(([chain, wallets]) =>
    Object.entries(wallets)
      .filter(([, meta]) => normalizeHandle(meta.channel_name) === targetHandle)
      .map(([wallet, meta]) => ({
        chain,
        wallet,
        channelName: meta.channel_name,
      })),
  );

  const summary = {
    targetHandle,
    foundInTwitterMessages: targetMessages.length > 0,
    foundInWalletMap: walletMatches.length > 0,
    twitterMessageCount: targetMessages.length,
    walletMatchCount: walletMatches.length,
    notes: [
      "If twitterMessageCount is 0, the handle is not present in the current GMGN social feed window.",
      "If walletMatchCount is 0, GMGN live/twitch_kol does not currently expose a wallet mapping for the handle.",
      "A complete Trust Score chain requires both a social event and a wallet mapping, plus wallet trade history.",
    ],
    sampleMessages: targetMessages.slice(0, 5).map((item) => ({
      id: item.id,
      twType: item.tw_type,
      timestamp: Number(item.tw_timestamp),
      name: item.user?.name || null,
      followers: item.user?.followers || 0,
      tags: item.user_tags || [],
      text: item.content?.text || item.source_content?.text || "",
      translated:
        item.translation?.["zh-CN"]?.content ||
        item.translation?.["zh-CN"]?.source_content ||
        null,
      token: item.token || null,
      sourceHandle: item.source_user?.screen_name || null,
    })),
    walletMatches,
  };

  await writeFile(
    path.join(outDir, `${targetHandle}.json`),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log(JSON.stringify(summary, null, 2));
}

await main();
