import { NextRequest, NextResponse } from "next/server";
import { verifyKorapaySignature } from "@/lib/verifyKorapaySignature";
import { findOrderByReference } from "@/lib/orders";
import { fulfillPaidOrder } from "@/lib/fulfillOrder";

// Korapay's Bank Transfer API echoes back the exact `reference` we sent
// when creating the charge, in data.reference — so matching is a direct
// lookup, same pattern as Flutterwave's tx_ref.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const signature = req.headers.get("x-korapay-signature");

  if (!verifyKorapaySignature(body.data, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (body.event !== "charge.success" || body.data?.status !== "success") {
    return NextResponse.json({ received: true });
  }

  const reference: string | undefined = body.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "No reference on event" }, { status: 400 });
  }

  const order = await findOrderByReference(reference);
  if (!order) {
    console.error(`Korapay webhook: no order found for reference ${reference}`);
    return NextResponse.json({ received: true });
  }

  // Idempotency: don't fulfil twice if Korapay retries the event.
  if (order.order_status === "paid") {
    return NextResponse.json({ received: true });
  }

  await fulfillPaidOrder(order);

  return NextResponse.json({ received: true });
}
