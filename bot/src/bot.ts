import { Bot } from "grammy";
import { handleStart } from "./handlers/start.js";
import {
  handleShowCourses,
  handleCourseSelected,
  handleResendInvite,
} from "./handlers/courses.js";
import { handleConfirmOrder } from "./handlers/order.js";

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command("start", handleStart);

  bot.callbackQuery("show_courses", handleShowCourses);
  bot.callbackQuery(/^buy_course_\d+$/, handleCourseSelected);
  bot.callbackQuery(/^confirm_order_\d+$/, handleConfirmOrder);
  bot.callbackQuery(/^resend_invite_\d+$/, handleResendInvite);

  // Handy for onboarding a new course channel: once the bot is added as
  // admin, post anything in that channel and its numeric ID (needed for
  // courses.telegram_channel_id) prints here.
  bot.on("channel_post", (ctx) => {
    console.log(
      `Channel post received from "${ctx.channelPost.chat.title}" — chat id: ${ctx.channelPost.chat.id}`,
    );
  });

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  return bot;
}
