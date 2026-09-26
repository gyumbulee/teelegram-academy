import "dotenv/config";
import { createBot } from "./bot.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set — check your .env file");
}

const bot = createBot(token);

// Long polling for local dev. Once deployed to the VPS behind the Next.js
// app, this can switch to a webhook (bot.api.setWebhook) pointed at a
// route your Next.js server exposes, so the bot doesn't need its own
// always-open connection.
bot.start();
console.log("Telegram Academy bot is running (long polling)...");
