// Wrapper around Paystack's Charge API, using the "bank_transfer" channel
// to generate a one-time, temporary virtual account per order (exact
// amount, short expiry window).
//
// This is deliberately NOT Paystack's separate "Dedicated Virtual Account"
// product (which assigns one permanent account per customer forever, and
// needs its own activation on top of a verified business). Pay-with-Transfer
// via the Charge API needs no extra activation beyond a normal Paystack
// business account.
// Docs: https://paystack.com/docs/payments/payment-channels/
//
// Gotcha: Paystack amounts are in kobo, not naira.

const PAYSTACK_BASE = "https://api.paystack.co";
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour; Paystack allows 15 min–8 hr

interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
  expiresAt: Date;
}

async function paystackFetch(path: string, body: unknown) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.status !== true) {
    throw new Error(`Paystack error: ${data.message ?? res.statusText}`);
  }
  return data.data;
}

export async function createVirtualAccountForOrder(params: {
  orderId: number;
  amountNgn: number;
  email: string;
  firstName?: string;
  courseSlug?: string;
}): Promise<VirtualAccountResult> {
  // Readable reference for the Paystack dashboard and
  // web/lib/orders.ts's findOrderByReference().
  const reference = params.courseSlug
    ? `order-${params.courseSlug}-${params.orderId}`
    : `order-${params.orderId}`;

  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  const charge = await paystackFetch("/charge", {
    email: params.email,
    amount: String(Math.round(params.amountNgn * 100)), // naira -> kobo
    currency: "NGN",
    reference,
    bank_transfer: {
      account_expires_at: expiresAt.toISOString(),
    },
  });

  return {
    accountNumber: charge.account_number,
    bankName: charge.bank?.name ?? "Unknown bank",
    reference: charge.reference ?? reference,
    expiresAt: charge.account_expires_at ? new Date(charge.account_expires_at) : expiresAt,
  };
}
