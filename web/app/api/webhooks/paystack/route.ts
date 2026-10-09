import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackSignature } from "@/lib/verifyPaystackSignature";
import { findOrderByReference } from "@/lib/orders";
import { fulfillPaidOrder } from "@/lib/fulfillOrder";

// Paystack's Charge API (bank_transfer channel) echoes back the exact
// `reference` we sent when creating the charge, in data.reference — a
// direct lookup against virtual_accounts.provider_reference.
//
// Signature verification needs the RAW body text (see
// lib/verifyPaystackSignature.ts), so this reads req.text() first and
// parses it ourselves, rather than calling req.json() directly.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== "charge.success" || event.data?.status !== "success") {
    return NextResponse.json({ received: true });
  }

  const reference: string | undefined = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "No reference on event" }, { status: 400 });
  }

  const order = await findOrderByReference(reference);
  if (!order) {
    console.error(`Paystack webhook: no order found for reference ${reference}`);
    return NextResponse.json({ received: true });
  }

  // Idempotency: don't fulfil twice if Paystack retries the event.
  if (order.order_status === "paid") {
    return NextResponse.json({ received: true });
  }

  await fulfillPaidOrder(order);

  return NextResponse.json({ received: true });
}
