// Signed, httpOnly session cookie for /admin — replaces HTTP Basic Auth
// (the browser's native username/password popup, which some admins found
// confusing/alert-like) with a normal login form at /admin/login.
//
// The cookie value is "<expiryMs>.<hex hmac>", where the hmac covers the
// expiry timestamp using ADMIN_SESSION_SECRET (falls back to
// ADMIN_PASSWORD if that's not set, so existing deployments don't need a
// new env var to keep working — but setting a dedicated secret is
// recommended). Uses Web Crypto (crypto.subtle) rather than Node's
// `crypto` module so this works unchanged in both the Edge-runtime
// middleware and ordinary server actions.

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "Set ADMIN_SESSION_SECRET (or ADMIN_PASSWORD) in web/.env before using admin login.",
    );
  }
  return secret;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionCookieValue(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = await hmac(String(expiresAt));
  return `${expiresAt}.${signature}`;
}

export async function verifySessionCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [expiresAtRaw, signature] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;
  const expected = await hmac(expiresAtRaw);
  return expected === signature;
}
