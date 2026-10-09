# Abeekey Academy

Paid training academy run through Telegram — see project context for full details.

## Layout

- `db/` — PostgreSQL schema and migrations
- `bot/` — Telegram bot (grammY)
- `web/` — Next.js landing page + webhook + cron — admin dashboard coming later

## Setup so far

1. `db/schema.sql` — Phase 1 core schema: users, courses, lessons, orders,
   virtual_accounts, channel_access, bookings.

Run it against a fresh PostgreSQL database with:

```
psql -d telegram_academy -f db/schema.sql
```

2. `bot/` — grammY bot covering: `/start` → capture Telegram user →
   list courses → select course → create pending order → generate a
   Paystack dynamic virtual account and send payment details.

```
cd bot
cp .env.example .env   # fill in BOT_TOKEN, DATABASE_URL, PAYSTACK_SECRET_KEY
npm install
npm run dev
```

Note: the bot never marks an order as paid itself — that happens in the
webhook handler, which listens for Paystack's payment confirmation and
then generates the channel invite link.

**Resubscribe / duplicate-order handling** (in `bot/src/handlers/courses.ts`
and `order.ts`):
- The course list marks courses the user already has active access to (✅),
  and tapping into one shows "you already have access until DATE" with a
  **Resend my invite link** button instead of a payment button — useful if
  they left the channel by accident, since one-time invite links can't be
  reused.
- If access has expired, the normal payment flow is offered again as a
  renewal.
- Tapping "Proceed to payment" twice in a row reuses the existing pending
  order's virtual account rather than generating a second one (checked
  server-side in the order handler too, not just hidden by the UI, since
  callback buttons can get tapped out of order).

3. `web/` — Next.js app. The Paystack webhook handler lives at
   `app/api/webhooks/paystack/route.ts`:
   - Verifies the `x-paystack-signature` header (HMAC-SHA512 over the raw
     body, using `PAYSTACK_SECRET_KEY` — the same key used for API calls,
     no separate webhook secret)
   - Looks up the order from `virtual_accounts.provider_reference`
     (matched against Paystack's `reference`, echoed back exactly as sent)
   - Marks the order `paid` (idempotent — safe if Paystack retries the event)
   - Course orders: generates a one-time-use Telegram invite link
     (`member_limit: 1`, so it can't be shared) and records it in
     `channel_access` with its expiry
   - 1-on-1 orders: creates a `pending` booking instead of a channel invite
   - Either way, messages the user on Telegram directly via the Bot API

```
cd web
cp .env.example .env   # DATABASE_URL, PAYSTACK_SECRET_KEY, BOT_TOKEN
npm install
npm run dev
```

Set your Paystack dashboard's webhook URL (Settings → API Keys & Webhooks)
to `https://<your-subdomain>/api/webhooks/paystack` once deployed.

4. **Daily expiry cron** — `app/api/cron/expire-access/route.ts`. Sweeps
   `channel_access` for anything `active` whose `expires_at` has passed,
   removes the user from that course's Telegram channel (ban → immediate
   unban, so they can rejoin on a fresh invite link if they resubscribe),
   marks the row `expired`, and sends a renewal notice. Each user is
   processed independently, so one failure doesn't stop the rest of the
   sweep.

   Protected by a `CRON_SECRET` bearer token — it's meant to be called by
   a cron job on your VPS, not exposed publicly. Set one up with:

   ```
   crontab -e
   # run once a day at 3am
   0 3 * * * curl -s -X POST https://<your-subdomain>/api/cron/expire-access \
     -H "Authorization: Bearer <your CRON_SECRET>"
   ```

5. **Landing page** — `app/page.tsx`. Server-rendered: queries `courses`
   directly from the DB (via `lib/courses.ts`) and lists everything
   `is_active = true`. No caching layer yet, so a new course you seed shows
   up on refresh immediately.

   Each course's "Start on Telegram" button deep-links straight into the
   bot with that course pre-selected
   (`https://t.me/<BOT_USERNAME>?start=course_<id>`) — the bot's `/start`
   handler (`bot/src/handlers/start.ts`) reads that payload and jumps
   straight to the course's payment screen instead of the generic menu.

   Set `BOT_USERNAME` in `web/.env` to your bot's username, without the
   `@` (e.g. `abeekeyacademybot`).

6. **Unpaid-order expiry cron** — `app/api/cron/expire-orders/route.ts`.
   Separate from the daily channel-access sweep: orders left `pending` for
   more than 65 minutes (past Paystack's ~1hr virtual account window)
   get marked `expired`, and the user gets a message + a one-tap "Start a
   new order" button for the same course. Run this one every 10-15
   minutes (not once daily — a stale order going unnoticed for a full day
   would be a poor experience), same `CRON_SECRET` bearer auth as the
   other cron route:

   ```
   */15 * * * * curl -s -X POST https://<your-subdomain>/api/cron/expire-orders \
     -H "Authorization: Bearer <your CRON_SECRET>"
   ```

Still to build: none — Phase 1 and the admin dashboard are both in place.
Phase 3 (custom 1-on-1 scheduling) is next when subscribers start asking for it.

6. **Admin dashboard** — `app/admin/`. Protected by a login form at
   `/admin/login` (`middleware.ts` + `lib/adminSession.ts`) — checked
   against `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `web/.env`, then a
   signed, httpOnly session cookie (7-day expiry) is set so you're not
   re-prompted on every visit. Set `ADMIN_SESSION_SECRET` in `web/.env`
   too (any long random string) — it signs that cookie; without it the
   app falls back to signing with `ADMIN_PASSWORD`, which works but means
   rotating the password also logs everyone out. Change `ADMIN_USERNAME`
   / `ADMIN_PASSWORD` before deploying anywhere public. "Log out" on the
   dashboard clears the cookie.

   - `/admin` — every course with active-subscriber count and total
     revenue, publish/unpublish toggle, delete, link to edit
   - `/admin/courses/new` — create a course (new courses start as a draft;
     publish it from the dashboard once it's ready)
   - `/admin/courses/[id]` — edit course details, and add/remove lessons
     (title + optional file links — the videos themselves still live in
     the Telegram channel, this is just the metadata shown to admins)

   Visit `http://localhost:3000/admin` — you'll be redirected to
   `/admin/login` the first time.

## Payment provider

Paystack is the only payment provider — `services/paystack.ts` (bot side)
and `app/api/webhooks/paystack/route.ts` (web side). Earlier builds also
supported Flutterwave and Korapay behind a provider switch; both were
removed (Flutterwave kept rejecting live charges over an account
compliance issue unrelated to the code, and running three providers was
more to maintain than it was worth once Paystack worked reliably).

Paystack uses the **Charge API** with the `bank_transfer` channel
(`POST /charge`), which generates a dynamic, single-use virtual account per
transaction locked to the exact order amount with a ~1hr expiry
(`account_expires_at`). This is deliberately *not* Paystack's separate
"Dedicated Virtual Account" product — DVAs are permanent, assigned once per
customer forever, and need their own activation on top of a verified
business. Pay-with-Transfer via the Charge API needs no extra activation
beyond a normal Paystack business account. Amounts are in **kobo** (naira ×
100). Requires `PAYSTACK_SECRET_KEY` in both `bot/.env` and `web/.env`.

Order references include the course slug for readability in the Paystack
dashboard — `order-flutter-basics-7`, not just `order-7`.

Set Paystack's webhook URL (in their dashboard, under Settings → API Keys
& Webhooks) to `https://<your-subdomain>/api/webhooks/paystack`. Paystack
signs the raw webhook body with HMAC-SHA512 using your `PAYSTACK_SECRET_KEY`
(sent in the `x-paystack-signature` header) — the same secret key used for
API calls, no separate webhook secret. Matching is a direct lookup on
`data.reference`, which Paystack echoes back exactly as sent.

## Lifetime vs monthly access (per course)

`courses.access_duration_days` can be left blank (NULL) in the admin
dashboard for lifetime access — once paid, that course never expires and
the daily cron sweep skips it entirely. Set it to a number of days (30,
etc.) for the original recurring-monthly model. Both models can coexist
across different courses.

**If upgrading an existing deployment**, run the migration once against
your database (Supabase's SQL Editor, same as `schema.sql`):

```
db/migrations/002_lifetime_access.sql
```

This just drops the `NOT NULL` constraints on `courses.access_duration_days`
and `channel_access.expires_at` — no data is changed, existing monthly
courses keep working exactly as before.

## Adding a new course (repeat for each one)

1. Telegram → New Channel → **Private**. Name it whatever subscribers
   should see.
2. **On your phone** (desktop's admin search has been unreliable):
   Administrators → Add Admin → search your bot's username → add it, with
   "Add Subscribers" checked (that's the permission invite-link generation
   needs).
3. With the bot running (`npm run dev` in `bot/`), post anything in the
   channel. The bot's terminal prints the channel's title and numeric ID
   immediately — no public/private toggling needed. (If that ever doesn't
   fire, forward any message from the channel to **@JsonDumpBot** instead —
   not @userinfobot, which only reports on you, the forwarder — and read
   the ID off `forward_origin.chat.id` in its reply.)
4. In `/admin/courses/new`, paste that ID into "Telegram channel ID"
   along with the title, price, and description. Save, then Publish when
   ready.
