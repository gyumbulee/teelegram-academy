// Single switch point for which payment provider is active. All three
// services export a createVirtualAccountForOrder with the identical
// signature, so switching providers is just changing PAYMENT_PROVIDER in
// .env — nothing else in the bot needs to change.
import { createVirtualAccountForOrder as createFlutterwaveAccount } from "./flutterwave.js";
import { createVirtualAccountForOrder as createKorapayAccount } from "./korapay.js";
import { createVirtualAccountForOrder as createPaystackAccount } from "./paystack.js";

export interface VirtualAccountParams {
  orderId: number;
  amountNgn: number;
  email: string;
  firstName?: string;
  courseSlug?: string;
}

export interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
  expiresAt: Date;
}

export function activeProviderName(): "flutterwave" | "korapay" | "paystack" {
  if (process.env.PAYMENT_PROVIDER === "korapay") return "korapay";
  if (process.env.PAYMENT_PROVIDER === "paystack") return "paystack";
  return "flutterwave";
}

export async function createVirtualAccountForOrder(
  params: VirtualAccountParams,
): Promise<VirtualAccountResult> {
  switch (activeProviderName()) {
    case "korapay":
      return createKorapayAccount(params);
    case "paystack":
      return createPaystackAccount(params);
    default:
      return createFlutterwaveAccount(params);
  }
}
