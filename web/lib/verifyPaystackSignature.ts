import { createHmac, timingSafeEqual } from "crypto";

// Paystack signs the RAW request body (the exact bytes received, before
// JSON.parse) with HMAC-SHA512 using your secret key, hex-encoded, sent in
// the x-paystack-signature header. Re-serializing a parsed body can change
// key order/whitespace and silently break this check, so the webhook route
// must pass the untouched request text here, not a re-stringified object.
// Docs: https://paystack.com/docs/payments/webhooks/
export function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "")
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
