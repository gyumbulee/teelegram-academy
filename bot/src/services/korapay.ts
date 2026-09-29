// Wrapper around Korapay's Bank Transfer API — generates a dynamic,
// single-use virtual account per transaction. This is the product your
// merchant account is actually enabled for (confirmed by Korapay
// support), distinct from their separate "Virtual Bank Account" product
// (permanent, customer-linked, needs a separate activation form).
// Docs: https://developers.korapay.com/docs/bank-transfers

const KORA_BASE = "https://api.korapay.com/merchant/api/v1";

interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
  expiresAt: Date;
}

async function korapayFetch(path: string, body: unknown) {
  const res = await fetch(`${KORA_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.status !== true) {
    throw new Error(`Korapay error: ${data.message ?? res.statusText}`);
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
  // Course slug makes the reference readable in Korapay's dashboard;
  // the order id keeps it unique even across repeat purchases of the
  // same course. Comfortably over Korapay's 8-character minimum either way.
  const reference = params.courseSlug
    ? `order-${params.courseSlug}-${params.orderId}`
    : `order-${String(params.orderId).padStart(6, "0")}`;

  const charge = await korapayFetch("/charges/bank-transfer", {
    reference,
    amount: params.amountNgn,
    currency: "NGN",
    customer: {
      name: params.firstName ?? "Telegram Academy Customer",
      email: params.email,
    },
    merchant_bears_cost: false,
  });

  return {
    accountNumber: charge.bank_account.account_number,
    bankName: charge.bank_account.bank_name,
    reference,
    expiresAt: new Date(charge.bank_account.expiry_date_in_utc),
  };
}
