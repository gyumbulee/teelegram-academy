import { Context, InlineKeyboard } from "grammy";
import {
  listActiveCourses,
  getCourseById,
  getLatestAccess,
  updateInviteLink,
} from "../db/queries.js";

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function handleShowCourses(ctx: Context) {
  const courses = await listActiveCourses();
  const telegramId = ctx.from?.id;

  if (courses.length === 0) {
    await ctx.answerCallbackQuery?.();
    await ctx.reply("No courses available right now — check back soon.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const course of courses) {
    let suffix = "";
    if (course.type !== "one_on_one" && telegramId) {
      const access = await getLatestAccess(telegramId, course.id);
      if (access && access.status === "active" && new Date(access.expires_at) > new Date()) {
        suffix = " ✅";
      }
    }

    const label =
      course.type === "one_on_one"
        ? `🎓 ${course.title} — ₦${course.price_ngn} (1-on-1)`
        : `${course.title} — ₦${course.price_ngn}/mo${suffix}`;
    keyboard.text(label, `buy_course_${course.id}`).row();
  }

  await ctx.answerCallbackQuery?.();
  await ctx.reply(
    "Here's what's available (✅ = you already have active access):",
    { reply_markup: keyboard },
  );
}

// Shared by the callback-query flow (tapping a course button) and the
// /start deep-link flow (arriving from the landing page with a course
// already chosen) — both end up showing the same course detail screen.
//
// If the user already has active (non-expired) access to this course, we
// don't offer to pay again — instead we offer to reissue their invite
// link, since the original one-time link can't be reused if they left
// the channel by mistake.
export async function sendCourseDetail(ctx: Context, courseId: number) {
  const course = await getCourseById(courseId);
  if (!course) {
    await ctx.reply("That course isn't available anymore.");
    return;
  }

  const telegramId = ctx.from?.id;
  const access =
    course.type !== "one_on_one" && telegramId
      ? await getLatestAccess(telegramId, course.id)
      : null;

  const isActive =
    access && access.status === "active" && new Date(access.expires_at) > new Date();

  if (isActive && access) {
    const keyboard = new InlineKeyboard().text(
      "🔗 Resend my invite link",
      `resend_invite_${course.id}`,
    );
    await ctx.reply(
      `*${course.title}*\nYou already have access to this course, valid until ${formatExpiry(access.expires_at)}.\n\nLost the invite or left the channel by accident? Tap below for a fresh link.`,
      { reply_markup: keyboard, parse_mode: "Markdown" },
    );
    return;
  }

  const keyboard = new InlineKeyboard().text(
    "💳 Proceed to payment",
    `confirm_order_${course.id}`,
  );

  const accessNote =
    course.type === "one_on_one"
      ? "You'll be able to book a session after payment."
      : access
        ? `Your previous access expired ${formatExpiry(access.expires_at)} — this renews it for another ${course.access_duration_days} days.`
        : `You'll get ${course.access_duration_days}-day access to the course channel.`;

  await ctx.reply(
    `*${course.title}*\nPrice: ₦${course.price_ngn}\n${accessNote}`,
    { reply_markup: keyboard, parse_mode: "Markdown" },
  );
}

// Fired when the user taps a specific course button.
export async function handleCourseSelected(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const courseId = data ? Number(data.replace("buy_course_", "")) : NaN;

  if (!Number.isFinite(courseId)) {
    await ctx.answerCallbackQuery({ text: "That course isn't available anymore." });
    return;
  }

  await ctx.answerCallbackQuery();
  await sendCourseDetail(ctx, courseId);
}

// Fired when a user with existing active access asks for their invite
// link again. A fresh one-time link is generated (the old one may have
// already been consumed) but the access record's expiry is untouched.
export async function handleResendInvite(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const courseId = data ? Number(data.replace("resend_invite_", "")) : NaN;
  const telegramId = ctx.from?.id;

  if (!Number.isFinite(courseId) || !telegramId) {
    await ctx.answerCallbackQuery({ text: "Something went wrong, try again." });
    return;
  }

  const course = await getCourseById(courseId);
  const access = await getLatestAccess(telegramId, courseId);

  if (!course?.telegram_channel_id || !access) {
    await ctx.answerCallbackQuery({ text: "No active access found." });
    return;
  }

  await ctx.answerCallbackQuery();

  const inviteLink = await ctx.api.createChatInviteLink(course.telegram_channel_id, {
    member_limit: 1,
  });
  await updateInviteLink(access.channel_access_id, inviteLink.invite_link);

  await ctx.reply(
    `Here's a fresh invite link for *${course.title}* (valid until ${formatExpiry(access.expires_at)}):\n${inviteLink.invite_link}`,
    { parse_mode: "Markdown" },
  );
}
