import { NextRequest, NextResponse } from "next/server";
import { verifyFlutterwaveSignature } from "@/lib/verifyFlutterwaveSignature";
import { findOrderByReference } from "@/lib/orders";
import { fulfillPaidOrder } from "@/lib/fulfillOrder";

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

  await fulfillPaidOrder(order);

  return NextResponse.json({ received: true });
}
