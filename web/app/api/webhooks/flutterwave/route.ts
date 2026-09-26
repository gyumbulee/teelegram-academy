import { NextRequest, NextResponse } from "next/server";
import { verifyFlutterwaveSignature } from "@/lib/verifyFlutterwaveSignature";
import { findOrderByReference, markOrderPaid, grantChannelAccess, createPendingBooking } from "@/lib/orders";
import { createOneTimeInviteLink, sendTelegramMessage } from "@/lib/telegram";

// Flutterwave sends a "charge.completed" event for virtual-account funding
// too (a bank transfer into the dedicated account is treated as a charge).
// Verification here is a plain equality check against the verif-hash
// header — see lib/verifyFlutterwaveSignature.ts for why.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("verif-hash");

  if (!verifyFlutterwaveSignature(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = await req.json();

  if (event.event !== "charge.completed" || event.data?.status !== "successful") {
    return NextResponse.json({ received: true });
  }

  const reference: string | undefined = event.data?.tx_ref;
  if (!reference) {
    return NextResponse.json({ error: "No tx_ref on event" }, { status: 400 });
  }

  const order = await findOrderByReference(reference);
  if (!order) {
    console.error(`Webhook: no order found for reference ${reference}`);
    return NextResponse.json({ received: true });
  }

  // Idempotency: Flutterwave can send the same event more than once.
  if (order.order_status === "paid") {
    return NextResponse.json({ received: true });
  }

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
  } else {
    if (!order.telegram_channel_id) {
      console.error(`Course ${order.course_id} has no telegram_channel_id set`);
      return NextResponse.json({ received: true });
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
      `✅ Payment received for *${order.title}*!\n\nJoin here (one-time link, valid for one use):\n${inviteLink}\n\nYour access runs for ${order.access_duration_days} days.`,
    );
  }

  return NextResponse.json({ received: true });
}
