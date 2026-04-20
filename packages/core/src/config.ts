import path from "node:path";

export interface MemeRecallConfig {
  reportsDir: string;
  runOnStartup: boolean;
  maxHoldings: number;
  watchDataDir: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  notifyDryRun: boolean;
}

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw);
}

function envInt(name: string, defaultValue: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min) return defaultValue;
  return parsed;
}

function resolveProjectRoot(): string {
  return path.resolve(import.meta.dir, "../../..");
}

export function getMemeRecallConfig(): MemeRecallConfig {
  const rootDir = resolveProjectRoot();
  return {
    reportsDir:
      process.env.MEMERECALL_REPORTS_DIR?.trim() ||
      path.join(rootDir, "data", "reports"),
    runOnStartup: envBool("MEMERECALL_RUN_ON_STARTUP", true),
    maxHoldings: envInt("MEMERECALL_MAX_HOLDINGS", 20, 1),
    watchDataDir:
      process.env.MEMERECALL_WATCH_DATA_DIR?.trim() ||
      path.join(rootDir, "data", "watch"),
    telegramBotToken:
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      process.env.MEMERECALL_TELEGRAM_BOT_TOKEN?.trim() ||
      null,
    telegramChatId:
      process.env.TELEGRAM_HOME_CHANNEL?.trim() ||
      process.env.TELEGRAM_CHAT_ID?.trim() ||
      process.env.MEMERECALL_TELEGRAM_CHAT_ID?.trim() ||
      null,
    notifyDryRun: envBool("MEMERECALL_NOTIFY_DRY_RUN", true),
  };
}
