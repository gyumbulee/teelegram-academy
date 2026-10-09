import { Context, InlineKeyboard, Keyboard } from "grammy";
import { getUserLanguage, setUserLanguage, listActiveAccessForUser } from "../db/queries.js";
import { t, menuLabel, Lang, LANGUAGE_NAMES } from "../i18n.js";
import { formatExpiry } from "./courses.js";

// The persistent menu shown at the bottom of the chat (a reply keyboard,
// not inline buttons under one message) — it stays put across every
// message, so there's always something to tap without scrolling back or
// remembering a command. resize_keyboard keeps it compact instead of
// taking over half the screen.
export function mainMenuKeyboard(lang: Lang) {
  return new Keyboard()
    .text(menuLabel("courses", lang))
    .text(menuLabel("myAccess", lang))
    .row()
    .text(menuLabel("language", lang))
    .text(menuLabel("help", lang))
    .resized();
}

export async function handleHelp(ctx: Context) {
  const telegramId = ctx.from?.id;
  const lang = telegramId ? await getUserLanguage(telegramId) : "en";
  await ctx.reply(t(lang, "help_text"), { parse_mode: "Markdown" });
}

export async function handleLanguagePrompt(ctx: Context) {
  const telegramId = ctx.from?.id;
  const lang = telegramId ? await getUserLanguage(telegramId) : "en";

  const keyboard = new InlineKeyboard()
    .text(LANGUAGE_NAMES.en, "set_lang_en")
    .text(LANGUAGE_NAMES.ha, "set_lang_ha");

  await ctx.reply(t(lang, "language_prompt"), { reply_markup: keyboard });
}

export async function handleLanguageSelected(ctx: Context) {
  const telegramId = ctx.from?.id;
  const data = ctx.callbackQuery?.data;
  const lang: Lang | null = data === "set_lang_en" ? "en" : data === "set_lang_ha" ? "ha" : null;

  if (!telegramId || !lang) {
    await ctx.answerCallbackQuery({ text: "Something went wrong, try again." });
    return;
  }

  await setUserLanguage(telegramId, lang);
  await ctx.answerCallbackQuery();
  await ctx.reply(t(lang, "language_set"), { reply_markup: mainMenuKeyboard(lang) });
}

export async function handleMyAccess(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const lang = await getUserLanguage(telegramId);

  const rows = await listActiveAccessForUser(telegramId);
  if (rows.length === 0) {
    await ctx.reply(t(lang, "my_access_empty"), { parse_mode: "Markdown" });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const row of rows) {
    keyboard
      .text(`${row.title} — ${formatExpiry(row.expires_at, lang)}`, `resend_invite_${row.course_id}`)
      .row();
  }

  await ctx.reply(t(lang, "my_access_header"), { reply_markup: keyboard });
}
