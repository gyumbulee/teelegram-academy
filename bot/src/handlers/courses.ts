import { Context, InlineKeyboard } from "grammy";
import {
  listActiveCourses,
  getCourseById,
  getLatestAccess,
  getUserLanguage,
  updateInviteLink,
  isAccessActive,
  AccessStatus,
} from "../db/queries.js";
import { t, Lang } from "../i18n.js";

export function formatExpiry(expiresAt: string | null, lang: Lang): string {
  if (expiresAt === null) return t(lang, "access_lifetime");
  const date = new Date(expiresAt).toLocaleDateString(lang === "ha" ? "ha" : "en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return t(lang, "access_valid_until", { date });
}

export async function handleShowCourses(ctx: Context) {
  const telegramId = ctx.from?.id;
  const lang = telegramId ? await getUserLanguage(telegramId) : "en";
  const courses = await listActiveCourses();

  if (courses.length === 0) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    await ctx.reply(t(lang, "no_courses"));
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const course of courses) {
    let suffix = "";
    if (course.type !== "one_on_one" && telegramId) {
      const access = await getLatestAccess(telegramId, course.id);
      if (isAccessActive(access)) {
        suffix = " ✅";
      }
    }

    const priceLabel =
      course.access_duration_days === null ? `₦${course.price_ngn}` : `₦${course.price_ngn}/mo`;
    const label =
      course.type === "one_on_one"
        ? `🎓 ${course.title} — ₦${course.price_ngn} (1-on-1)`
        : `${course.title} — ${priceLabel}${suffix}`;
    keyboard.text(label, `buy_course_${course.id}`).row();
  }

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
  await ctx.reply(t(lang, "course_list_header"), { reply_markup: keyboard });
}

// Shared by the callback-query flow (tapping a course button) and the
// /start deep-link flow (arriving from the landing page with a course
// already chosen) — both end up showing the same course detail screen.
//
// If the user already has active access to this course, we don't offer
// to pay again — instead we offer to reissue their invite link, since the
// original one-time link can't be reused if they left the channel by
// mistake. This applies the same way whether that access is lifetime
// (expires_at null) or a still-current monthly period.
export async function sendCourseDetail(ctx: Context, courseId: number) {
  const telegramId = ctx.from?.id;
  const lang = telegramId ? await getUserLanguage(telegramId) : "en";

  const course = await getCourseById(courseId);
  if (!course) {
    await ctx.reply(t(lang, "course_unavailable"));
    return;
  }

  const access: AccessStatus | null =
    course.type !== "one_on_one" && telegramId
      ? await getLatestAccess(telegramId, course.id)
      : null;

  if (isAccessActive(access)) {
    const keyboard = new InlineKeyboard().text(
      t(lang, "resend_invite_button"),
      `resend_invite_${course.id}`,
    );
    await ctx.reply(
      t(lang, "already_have_access", {
        title: course.title,
        expiry: formatExpiry(access.expires_at, lang),
      }),
      { reply_markup: keyboard, parse_mode: "Markdown" },
    );
    return;
  }

  const keyboard = new InlineKeyboard().text(t(lang, "pay_button"), `confirm_order_${course.id}`);

  const accessNote =
    course.type === "one_on_one"
      ? t(lang, "access_note_one_on_one")
      : course.access_duration_days === null
        ? t(lang, "access_note_lifetime")
        : access
          ? t(lang, "access_note_renew", { days: course.access_duration_days })
          : t(lang, "access_note_duration", { days: course.access_duration_days });

  await ctx.reply(
    t(lang, "course_detail", { title: course.title, price: course.price_ngn, accessNote }),
    { reply_markup: keyboard, parse_mode: "Markdown" },
  );
}

// Fired when the user taps a specific course button.
export async function handleCourseSelected(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const courseId = data ? Number(data.replace("buy_course_", "")) : NaN;

  if (!Number.isFinite(courseId)) {
    const lang = ctx.from ? await getUserLanguage(ctx.from.id) : "en";
    await ctx.answerCallbackQuery({ text: t(lang, "course_unavailable") });
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
  const lang = telegramId ? await getUserLanguage(telegramId) : "en";

  if (!Number.isFinite(courseId) || !telegramId) {
    await ctx.answerCallbackQuery({ text: t(lang, "generic_error") });
    return;
  }

  const course = await getCourseById(courseId);
  const access = await getLatestAccess(telegramId, courseId);

  if (!course?.telegram_channel_id || !access) {
    await ctx.answerCallbackQuery({ text: t(lang, "resend_invite_none") });
    return;
  }

  await ctx.answerCallbackQuery();

  const inviteLink = await ctx.api.createChatInviteLink(course.telegram_channel_id, {
    member_limit: 1,
  });
  await updateInviteLink(access.channel_access_id, inviteLink.invite_link);

  await ctx.reply(
    t(lang, "resend_invite_sent", {
      title: course.title,
      expiry: formatExpiry(access.expires_at, lang),
      link: inviteLink.invite_link,
    }),
  );
}
