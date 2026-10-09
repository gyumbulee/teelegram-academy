import { Bot } from "grammy";
import { handleStart } from "./handlers/start.js";
import {
  handleShowCourses,
  handleCourseSelected,
  handleResendInvite,
} from "./handlers/courses.js";
import { handleConfirmOrder } from "./handlers/order.js";
import {
  handleHelp,
  handleLanguagePrompt,
  handleLanguageSelected,
  handleMyAccess,
} from "./handlers/menu.js";
import { MENU_LABELS } from "./i18n.js";

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("language", handleLanguagePrompt);

  // The persistent reply-keyboard menu (see handlers/menu.ts) sends back
  // plain text when tapped, in whichever language it was shown — so each
  // button is matched against both languages' labels, not just one.
  bot.hears([MENU_LABELS.courses.en, MENU_LABELS.courses.ha], handleShowCourses);
  bot.hears([MENU_LABELS.myAccess.en, MENU_LABELS.myAccess.ha], handleMyAccess);
  bot.hears([MENU_LABELS.language.en, MENU_LABELS.language.ha], handleLanguagePrompt);
  bot.hears([MENU_LABELS.help.en, MENU_LABELS.help.ha], handleHelp);

  bot.callbackQuery("show_courses", handleShowCourses);
  bot.callbackQuery(/^buy_course_\d+$/, handleCourseSelected);
  bot.callbackQuery(/^confirm_order_\d+$/, handleConfirmOrder);
  bot.callbackQuery(/^resend_invite_\d+$/, handleResendInvite);
  bot.callbackQuery(/^set_lang_(en|ha)$/, handleLanguageSelected);

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
