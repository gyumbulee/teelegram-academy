import {
  OrderForFulfillment,
  markOrderPaid,
  grantChannelAccess,
  createPendingBooking,
} from "./orders";
import { createOneTimeInviteLink, sendTelegramMessage } from "./telegram";

// Called by every provider's webhook once a payment is confirmed. Kept in
// one place so adding/switching payment providers never means duplicating
// the actual fulfillment logic (invite generation, booking creation,
// messaging) — only the provider-specific signature verification and
// order lookup differ between webhook routes.
export async function fulfillPaidOrder(order: OrderForFulfillment): Promise<void> {
  await markOrderPaid(order.order_id);

  if (order.course_type === "one_on_one") {
    await createPendingBooking({
      userId: order.user_id,
      courseId: order.course_id,
      orderId: order.order_id,
    });
    await sendTelegramMessage(
      order.telegram_id,
      `✅ Payment received for *${order.title}*! We'll follow up here shortly to schedule your session.`,
    );
    return;
  }

  if (!order.telegram_channel_id) {
    console.error(`Course ${order.course_id} has no telegram_channel_id set`);
    return;
  }

  const inviteLink = await createOneTimeInviteLink(order.telegram_channel_id);

  await grantChannelAccess({
    userId: order.user_id,
    courseId: order.course_id,
    orderId: order.order_id,
    inviteLink,
    durationDays: order.access_duration_days,
  });

  await sendTelegramMessage(
    order.telegram_id,
    `✅ Payment received for ${order.title}!\n\nJoin here (one-time link, valid for one use):\n${inviteLink}\n\nYour access runs for ${order.access_duration_days} days.`,
    false,
  );
}
