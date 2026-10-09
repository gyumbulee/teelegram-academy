import { Context } from "grammy";
import { upsertUser } from "../db/queries.js";
import { sendCourseDetail } from "./courses.js";
import { mainMenuKeyboard } from "./menu.js";
import { t, Lang } from "../i18n.js";

// Every user must go through /start at least once before buying anything —
// this is how we capture their telegram_id and attach it to future orders.
//
// If they arrived via a landing-page link (https://t.me/bot?start=course_5),
// Telegram passes "course_5" as the command's argument — skip the generic
// menu and go straight to that course's detail screen.
export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const user = await upsertUser(from.id, from.username, from.first_name);
  const lang: Lang = user.language;
  const name = from.first_name ? `, ${from.first_name}` : "";

  const payload = ctx.match;
  const courseMatch = typeof payload === "string" ? payload.match(/^course_(\d+)$/) : null;

  // The persistent menu (📚 Courses / 🧾 My access / 🌐 Language / ❓ Help)
  // is attached here so it's visible from someone's very first message,
  // not just after they've found their way to a course list.
  await ctx.reply(t(lang, "welcome", { name }), { reply_markup: mainMenuKeyboard(lang) });

  if (courseMatch) {
    await sendCourseDetail(ctx, Number(courseMatch[1]));
    return;
  }

  await ctx.reply(t(lang, "welcome_intro"), { parse_mode: "Markdown" });
  if (process.env.LANDING_PAGE_URL) {
    await ctx.reply(t(lang, "landing_page_hint", { url: process.env.LANDING_PAGE_URL }));
  }
}
