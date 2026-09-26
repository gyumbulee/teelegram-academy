// Flutterwave doesn't HMAC-sign webhook payloads like Paystack does.
// Instead, you set a "Secret Hash" in your Flutterwave dashboard
// (Settings → Webhooks), and every webhook call includes it verbatim in
// the verif-hash header. Verification is just an equality check.
// Docs: https://developer.flutterwave.com/docs/integration-guides/webhooks
export function verifyFlutterwaveSignature(
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  return signatureHeader === process.env.FLUTTERWAVE_SECRET_HASH;
}
