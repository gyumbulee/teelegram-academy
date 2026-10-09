import "dotenv/config";
import { createBot } from "./bot.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set — check your .env file");
}

const bot = createBot(token);

// Shows up as Telegram's own "/" command menu button next to the message
// box — one more way to find your way around besides the persistent
// reply-keyboard menu (handlers/menu.ts), for anyone who's used to typing
// commands or who clears/hides the reply keyboard by accident.
bot.api
  .setMyCommands([
    { command: "start", description: "Restart / main menu" },
    { command: "help", description: "How to use this bot" },
    { command: "language", description: "English / Hausa" },
  ])
  .catch((err) => console.error("Failed to set bot command menu:", err));

// Long polling for local dev. Once deployed to the VPS behind the Next.js
// app, this can switch to a webhook (bot.api.setWebhook) pointed at a
// route your Next.js server exposes, so the bot doesn't need its own
// always-open connection.
bot.start();
console.log("Abeekey Academy bot is running (long polling)...");
