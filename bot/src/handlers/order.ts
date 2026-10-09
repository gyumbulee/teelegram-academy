import { Context } from "grammy";
import {
  getCourseById,
  upsertUser,
  createOrder,
  attachVirtualAccount,
  findRecentPendingOrder,
  getLatestAccess,
  isAccessActive,
  getUserLanguage,
} from "../db/queries.js";
import { createVirtualAccountForOrder } from "../services/paystack.js";
import { t } from "../i18n.js";

// User has tapped "Proceed to payment" for a specific course.
// This creates the pending order, requests a Paystack virtual account, and
// sends the account details to the user. Actual payment confirmation
// happens later, via Paystack's webhook — this handler never marks
// an order as paid itself.
export async function handleConfirmOrder(ctx: Context) {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  const courseId = data ? Number(data.replace("confirm_order_", "")) : NaN;

  if (!from || !Number.isFinite(courseId)) {
    await ctx.answerCallbackQuery({ text: "Something went wrong, try again." });
    return;
  }

  const lang = await getUserLanguage(from.id);

  const course = await getCourseById(courseId);
  if (!course) {
    await ctx.answerCallbackQuery({ text: t(lang, "course_unavailable") });
    return;
  }

  await ctx.answerCallbackQuery();

  const user = await upsertUser(from.id, from.username, from.first_name);

  // Guard against re-purchasing while still active — the course-detail
  // screen already steers people away from this, but callback buttons can
  // get tapped out of order (e.g. an old message re-opened), so it's
  // checked again here as the actual source of truth.
  if (course.type !== "one_on_one") {
    const access = await getLatestAccess(from.id, course.id);
    if (isAccessActive(access)) {
      await ctx.reply(t(lang, "already_active_no_pay", { title: course.title }), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  // Reuse a still-open pending order instead of creating a duplicate
  // virtual account if the user taps this more than once in a row.
  const existing = await findRecentPendingOrder(user.id, course.id);
  if (existing) {
    await ctx.reply(
      t(lang, "order_in_progress", {
        title: course.title,
        bank: existing.bank_name,
        account: existing.account_number,
        amount: existing.amount_ngn,
      }),
      { parse_mode: "Markdown" },
    );
    return;
  }

  const order = await createOrder(user.id, course);

  // Paystack requires an email; synthesize a placeholder tied to the
  // telegram id since most users won't have one on hand mid-chat.
  const placeholderEmail = `tg${from.id}@users.abeekey.com`;

  const account = await createVirtualAccountForOrder({
    orderId: order.id,
    amountNgn: Number(course.price_ngn),
    email: placeholderEmail,
    firstName: from.first_name,
    courseSlug: course.slug,
  });

  await attachVirtualAccount(
    order.id,
    "paystack",
    account.accountNumber,
    account.bankName,
    account.reference,
    account.expiresAt,
  );

  const minutesLeft = Math.round((account.expiresAt.getTime() - Date.now()) / 60000);
  const validity =
    minutesLeft >= 60
      ? t(lang, "validity_hours", { hours: Math.round(minutesLeft / 60) })
      : t(lang, "validity_minutes", { minutes: minutesLeft });

  await ctx.reply(
    t(lang, "payment_instructions", {
      title: course.title,
      price: course.price_ngn,
      bank: account.bankName,
      account: account.accountNumber,
      validity,
    }),
    { parse_mode: "Markdown" },
  );
}
