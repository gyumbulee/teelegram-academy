import { NextRequest, NextResponse } from "next/server";
import { verifyKorapaySignature } from "@/lib/verifyKorapaySignature";
import { findOrderByReference, findOrderByAccountNumber } from "@/lib/orders";
import { fulfillPaidOrder } from "@/lib/fulfillOrder";

// Korapay's exact field name for "which virtual account did this land in"
// isn't fully nailed down from public docs alone (unlike Flutterwave's
// well-documented tx_ref) — this tries the account_reference we set at
// creation first, then falls back to matching by account number. Either
// way, the full data object is logged so the correct field can be
// confirmed and this narrowed down after seeing one real payload.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const signature = req.headers.get("x-korapay-signature");

  if (!verifyKorapaySignature(body.data, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (body.event !== "charge.success" || body.data?.status !== "success") {
    return NextResponse.json({ received: true });
  }

  console.log("Korapay webhook data:", JSON.stringify(body.data));

  const data = body.data ?? {};
  const accountReference: string | undefined =
    data.account_reference ?? data.virtual_bank_account?.account_reference;
  const accountNumber: string | undefined =
    data.account_number ?? data.virtual_bank_account?.account_number;

  const order = accountReference
    ? await findOrderByReference(accountReference)
    : accountNumber
      ? await findOrderByAccountNumber(accountNumber)
      : null;

  if (!order) {
    console.error(
      `Korapay webhook: couldn't match an order. accountReference=${accountReference} accountNumber=${accountNumber}`,
    );
    return NextResponse.json({ received: true });
  }

  // Idempotency: don't fulfil twice if Korapay retries the event.
  if (order.order_status === "paid") {
    return NextResponse.json({ received: true });
  }

  await fulfillPaidOrder(order);

  return NextResponse.json({ received: true });
}
