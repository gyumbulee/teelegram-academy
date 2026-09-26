import { Context } from "grammy";
import {
  getCourseById,
  upsertUser,
  createOrder,
  attachVirtualAccount,
  findRecentPendingOrder,
  getLatestAccess,
} from "../db/queries.js";
import { createVirtualAccountForOrder } from "../services/flutterwave.js";

// User has tapped "Proceed to payment" for a specific course.
// This creates the pending order, requests a dynamic virtual account
// from Flutterwave, and sends the account details to the user.
// Actual payment confirmation happens later, via the Flutterwave webhook —
// this handler never marks an order as paid itself.
export async function handleConfirmOrder(ctx: Context) {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  const courseId = data ? Number(data.replace("confirm_order_", "")) : NaN;

  if (!from || !Number.isFinite(courseId)) {
    await ctx.answerCallbackQuery({ text: "Something went wrong, try again." });
    return;
  }

  const course = await getCourseById(courseId);
  if (!course) {
    await ctx.answerCallbackQuery({ text: "That course isn't available anymore." });
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
    if (access && access.status === "active" && new Date(access.expires_at) > new Date()) {
      await ctx.reply(
        `You already have active access to *${course.title}* — no need to pay again. Use "View courses" to get your invite link resent if needed.`,
        { parse_mode: "Markdown" },
      );
      return;
    }
  }

  // Reuse a still-open pending order instead of creating a duplicate
  // virtual account if the user taps this more than once in a row.
  const existing = await findRecentPendingOrder(user.id, course.id);
  if (existing) {
    await ctx.reply(
      `You already have a payment in progress for *${course.title}*:\n\n` +
        `🏦 *${existing.bank_name}*\n` +
        `💳 \`${existing.account_number}\`\n\n` +
        `Pay ₦${existing.amount_ngn} to that account — no need to start a new one.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  const order = await createOrder(user.id, course);

  // Flutterwave requires an email; synthesize a placeholder tied to the
  // telegram id since most users won't have one on hand mid-chat.
  const placeholderEmail = `tg${from.id}@users.abeekey.com`;

  const account = await createVirtualAccountForOrder({
    orderId: order.id,
    amountNgn: Number(course.price_ngn),
    email: placeholderEmail,
    firstName: from.first_name,
  });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Flutterwave dynamic accounts expire in ~1hr
  await attachVirtualAccount(
    order.id,
    "flutterwave",
    account.accountNumber,
    account.bankName,
    account.reference,
    expiresAt,
  );

  await ctx.reply(
    `To complete your order for *${course.title}*, pay ₦${course.price_ngn} to:\n\n` +
      `🏦 *${account.bankName}*\n` +
      `💳 \`${account.accountNumber}\`\n\n` +
      `This account is valid for about an hour. You'll get an invite link automatically once payment is confirmed — no need to send a receipt.`,
    { parse_mode: "Markdown" },
  );
}
