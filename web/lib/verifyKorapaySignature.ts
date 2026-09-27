import { createHmac, timingSafeEqual } from "crypto";

// Korapay signs webhooks differently from Flutterwave: the HMAC-SHA256 is
// computed over ONLY the `data` object from the payload (not the whole
// body), hex-encoded, sent in the x-korapay-signature header.
// Docs: https://developers.korapay.com/docs/webhooks
export function verifyKorapaySignature(
  data: unknown,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", process.env.KORAPAY_SECRET_KEY ?? "")
    .update(JSON.stringify(data))
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
