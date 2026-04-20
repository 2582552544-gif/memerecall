import { sendTelegramTestCard } from "../packages/core/src/index";

const symbol = process.argv[2] || "TEST";
const dryRun = !process.argv.includes("--send");

const result = await sendTelegramTestCard({
  symbol,
  dryRun,
});

console.log(JSON.stringify(result, null, 2));
