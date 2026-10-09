import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, createSessionCookieValue } from "@/lib/adminSession";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  async function login(formData: FormData) {
    "use server";

    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "") || "/admin";

    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      redirect(
        `/admin/login?error=${encodeURIComponent("Wrong username or password.")}&next=${encodeURIComponent(next)}`,
      );
    }

    cookies().set(ADMIN_SESSION_COOKIE, await createSessionCookieValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days, matches adminSession.ts's TTL
    });

    redirect(next);
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="wrap">
          <h1>Abeekey Academy — Admin</h1>
        </div>
      </header>

      <main className="admin-main">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500, marginBottom: 20 }}>
          Log in
        </h2>

        {searchParams.error && <p className="admin-error">{searchParams.error}</p>}

        <form className="admin-form" action={login}>
          <input type="hidden" name="next" value={searchParams.next ?? "/admin"} />

          <label>
            <span>Username</span>
            <input name="username" autoComplete="username" required autoFocus />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <div className="form-actions">
            <button className="btn" type="submit">
              Log in
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
