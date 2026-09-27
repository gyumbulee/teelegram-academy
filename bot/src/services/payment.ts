// Single switch point for which payment provider is active. Both
// services export a createVirtualAccountForOrder with the identical
// signature, so switching providers is just changing PAYMENT_PROVIDER in
// .env — nothing else in the bot needs to change.
import { createVirtualAccountForOrder as createFlutterwaveAccount } from "./flutterwave.js";
import { createVirtualAccountForOrder as createKorapayAccount } from "./korapay.js";

export interface VirtualAccountParams {
  orderId: number;
  amountNgn: number;
  email: string;
  firstName?: string;
}

export interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  reference: string;
}

export function activeProviderName(): "flutterwave" | "korapay" {
  return process.env.PAYMENT_PROVIDER === "korapay" ? "korapay" : "flutterwave";
}

export async function createVirtualAccountForOrder(
  params: VirtualAccountParams,
): Promise<VirtualAccountResult> {
  return activeProviderName() === "korapay"
    ? createKorapayAccount(params)
    : createFlutterwaveAccount(params);
}
