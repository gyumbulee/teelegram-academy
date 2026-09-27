// Wrapper around Korapay's Create Virtual Bank Account API.
// Docs: https://developers.korapay.com/docs/virtual-bank-accounts-ngn
//
// Unlike Flutterwave's dynamic virtual accounts, this endpoint has no
// `amount` field at all — the account isn't locked to a specific figure,
// which sidesteps the whole "invalid amount" failure mode we hit with
// Flutterwave. The account_reference is what our webhook matches back to
// the order, same pattern as the Flutterwave integration.
//
// Note: Korapay's API only supports permanent: true right now (temporary
// accounts aren't available yet per their docs) — we still create a fresh
// one per order and simply don't reuse it after that order completes, the
// same way findRecentPendingOrder already handles reuse-within-a-window
// for whichever provider is active.

const KORA_BASE = "https://api.korapay.com/merchant/api/v1";

interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
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
  amountNgn: number; // unused by Korapay — kept so both providers share one call signature
  email: string;
  firstName?: string;
}): Promise<VirtualAccountResult> {
  const reference = `order-${params.orderId}`;

  const account = await korapayFetch("/virtual-bank-account", {
    account_name: params.firstName ?? "Telegram Academy Customer",
    account_reference: reference,
    permanent: true,
    bank_code: process.env.KORAPAY_BANK_CODE || "035", // 035 = Wema (live); use 000 for Korapay's own sandbox
    currency: "NGN",
    customer: {
      name: params.firstName ?? "Telegram Academy Customer",
      email: params.email,
    },
  });

  return {
    accountNumber: account.bank_account.account_number,
    bankName: account.bank_account.bank_name,
    reference,
  };
}
