import { Context } from "grammy";
import {
  getCourseById,
  upsertUser,
  createOrder,
  attachVirtualAccount,
  findRecentPendingOrder,
  getLatestAccess,
  isAccessActive,
} from "../db/queries.js";
import { createVirtualAccountForOrder, activeProviderName } from "../services/payment.js";

// User has tapped "Proceed to payment" for a specific course.
// This creates the pending order, requests a virtual account from
// whichever payment provider is active (see services/payment.ts), and
// sends the account details to the user. Actual payment confirmation
// happens later, via that provider's webhook — this handler never marks
// an order as paid itself.
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
    if (isAccessActive(access)) {
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
  const provider = activeProviderName();

  // Both providers require an email; synthesize a placeholder tied to the
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
    provider,
    account.accountNumber,
    account.bankName,
    account.reference,
    account.expiresAt,
  );

  const minutesLeft = Math.round((account.expiresAt.getTime() - Date.now()) / 60000);
  const validityNote =
    minutesLeft >= 60
      ? `This account is valid for about ${Math.round(minutesLeft / 60)} hour(s).`
      : `This account is valid for about ${minutesLeft} minutes.`;

  await ctx.reply(
    `To complete your order for *${course.title}*, pay ₦${course.price_ngn} to:\n\n` +
      `🏦 *${account.bankName}*\n` +
      `💳 \`${account.accountNumber}\`\n\n` +
      `${validityNote} You'll get an invite link automatically once payment is confirmed — no need to send a receipt.`,
    { parse_mode: "Markdown" },
  );
}
