import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { buildConfig } from "./config";
import { ServerManager } from "./server-manager";
import { createApiServer } from "./api-server";
import { registerBotHandlers } from "./bot-handlers";

dotenv.config();

let config;
try {
  config = buildConfig();
} catch (error) {
  console.error(`❌ Error: ${(error as Error).message}`);
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });
const serverManager = new ServerManager(config);

console.log("🎮 Dread Hunger Server Bot is starting...");

createApiServer(config, serverManager);
registerBotHandlers(bot, config, serverManager);

process.on("SIGINT", () => {
  console.log("\n🛑 Stopping bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Stopping bot...");
  bot.stopPolling();
  process.exit(0);
});

console.log("✅ Dread Hunger Server Bot is running! Press Ctrl+C to stop.");
