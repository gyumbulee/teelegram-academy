import { Context, InlineKeyboard } from "grammy";
import { upsertUser } from "../db/queries.js";
import { sendCourseDetail } from "./courses.js";

// Every user must go through /start at least once before buying anything —
// this is how we capture their telegram_id and attach it to future orders.
//
// If they arrived via a landing-page link (https://t.me/bot?start=course_5),
// Telegram passes "course_5" as the command's argument — skip the generic
// menu and go straight to that course's detail screen.
export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  await upsertUser(from.id, from.username, from.first_name);

  const payload = ctx.match;
  const courseMatch = typeof payload === "string" ? payload.match(/^course_(\d+)$/) : null;

  if (courseMatch) {
    await ctx.reply(`Welcome${from.first_name ? `, ${from.first_name}` : ""}! 👋`);
    await sendCourseDetail(ctx, Number(courseMatch[1]));
    return;
  }

  const keyboard = new InlineKeyboard().text("📚 View courses", "show_courses");

  await ctx.reply(
    `Welcome${from.first_name ? `, ${from.first_name}` : ""}! 👋\n\n` +
      `Browse available courses below, or visit ${process.env.LANDING_PAGE_URL} to see everything on offer.`,
    { reply_markup: keyboard },
  );
}
