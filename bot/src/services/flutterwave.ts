// Wrapper around Flutterwave's Virtual Account Numbers API.
// Docs: https://developer.flutterwave.com/docs/ngn-virtual-accounts
//
// We use a *dynamic* (temporary) virtual account per order — no BVN
// required, unlike static/permanent accounts. Passing `amount` makes
// Flutterwave auto-expire the account after roughly an hour, which fits
// the "pay within this window" flow we want per order.

const FLW_BASE = "https://api.flutterwave.com/v3";

interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
}

async function flutterwaveFetch(path: string, body: unknown) {
  const res = await fetch(`${FLW_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(`Flutterwave error: ${data.message ?? res.statusText}`);
  }
  return data.data;
}

export async function createVirtualAccountForOrder(params: {
  orderId: number;
  amountNgn: number;
  email: string; // Flutterwave requires an email; synthesized from telegram_id if the user has none
  firstName?: string;
}): Promise<VirtualAccountResult> {
  const reference = `order-${params.orderId}`;

  const account = await flutterwaveFetch("/virtual-account-numbers", {
    email: params.email,
    tx_ref: reference,
    amount: params.amountNgn, // presence of `amount` makes this a one-time account, ~1hr expiry
    is_permanent: false,
    firstname: params.firstName ?? "Customer",
    lastname: "Telegram",
    // Flutterwave requires a phone number field; we don't collect one from
    // Telegram, so a placeholder is used. Fine for test mode — worth
    // collecting a real number from the user before going live.
    phonenumber: "08000000000",
    narration: `Telegram Academy order #${params.orderId}`,
  });

  return {
    accountNumber: account.account_number,
    bankName: account.bank_name,
    reference,
  };
}
