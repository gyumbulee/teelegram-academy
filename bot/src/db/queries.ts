import { pool } from "./pool.js";
import type { Lang } from "../i18n.js";

export interface DbUser {
  id: number;
  telegram_id: number;
  language: Lang;
}

export interface DbCourse {
  id: number;
  title: string;
  slug: string;
  price_ngn: string;
  type: "course" | "one_on_one";
  access_duration_days: number | null; // null = lifetime access
  telegram_channel_id: number | null;
}

// Creates the user on first contact, or returns the existing one.
// telegram_id is the anchor everything else (orders, access) hangs off.
export async function upsertUser(
  telegramId: number,
  username: string | undefined,
  firstName: string | undefined,
): Promise<DbUser> {
  const { rows } = await pool.query<DbUser>(
    `INSERT INTO users (telegram_id, telegram_username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET telegram_username = EXCLUDED.telegram_username,
                   first_name = EXCLUDED.first_name
     RETURNING id, telegram_id, language`,
    [telegramId, username ?? null, firstName ?? null],
  );
  return rows[0];
}

// Looked up on practically every interaction (to pick which language to
// reply in), keyed by telegram_id directly so handlers don't need the
// internal user id on hand. Defaults to English for a telegram_id that
// hasn't messaged the bot yet — shouldn't normally happen since /start
// always upserts first, but keeps callers safe either way.
export async function getUserLanguage(telegramId: number): Promise<Lang> {
  const { rows } = await pool.query<{ language: Lang }>(
    `SELECT language FROM users WHERE telegram_id = $1`,
    [telegramId],
  );
  return rows[0]?.language ?? "en";
}

export async function setUserLanguage(telegramId: number, language: Lang): Promise<void> {
  await pool.query(`UPDATE users SET language = $2 WHERE telegram_id = $1`, [
    telegramId,
    language,
  ]);
}

export async function listActiveCourses(): Promise<DbCourse[]> {
  const { rows } = await pool.query<DbCourse>(
    `SELECT id, title, slug, price_ngn, type, access_duration_days, telegram_channel_id
     FROM courses
     WHERE is_active = true
     ORDER BY created_at DESC`,
  );
  return rows;
}

export async function getCourseById(id: number): Promise<DbCourse | null> {
  const { rows } = await pool.query<DbCourse>(
    `SELECT id, title, slug, price_ngn, type, access_duration_days, telegram_channel_id
     FROM courses WHERE id = $1 AND is_active = true`,
    [id],
  );
  return rows[0] ?? null;
}

export interface AccessStatus {
  channel_access_id: number;
  status: "active" | "expired" | "removed";
  expires_at: string | null; // null = lifetime access, never expires
  invite_link: string | null;
}

// A lifetime access row (expires_at null) is always considered active as
// long as its status hasn't been manually changed; anything else is
// active only while status is 'active' and the expiry hasn't passed.
export function isAccessActive(access: AccessStatus | null): access is AccessStatus {
  if (!access || access.status !== "active") return false;
  return access.expires_at === null || new Date(access.expires_at) > new Date();
}

// Most recent access record for this user+course, if any. Courses are
// looked up by telegram_id directly rather than requiring the caller to
// have already resolved the internal user id.
export async function getLatestAccess(
  telegramId: number,
  courseId: number,
): Promise<AccessStatus | null> {
  const { rows } = await pool.query<AccessStatus>(
    `SELECT ca.id AS channel_access_id, ca.status, ca.expires_at, ca.invite_link
     FROM channel_access ca
     JOIN users u ON u.id = ca.user_id
     WHERE u.telegram_id = $1 AND ca.course_id = $2
     ORDER BY ca.expires_at DESC
     LIMIT 1`,
    [telegramId, courseId],
  );
  return rows[0] ?? null;
}

export interface ActiveAccessRow {
  course_id: number;
  title: string;
  channel_access_id: number;
  status: "active" | "expired" | "removed";
  expires_at: string | null;
}

// Everything a user currently has working access to — for the "🧾 My
// access" menu button, so someone who's forgotten what they bought (or
// lost their invite link) can find it in one tap instead of re-browsing
// the whole course list. Deliberately not filtered by courses.is_active:
// if a course gets unpublished from new sales, existing buyers should
// still see and reach what they already paid for.
export async function listActiveAccessForUser(telegramId: number): Promise<ActiveAccessRow[]> {
  const { rows } = await pool.query<ActiveAccessRow>(
    `SELECT c.id AS course_id, c.title, ca.id AS channel_access_id, ca.status, ca.expires_at
     FROM channel_access ca
     JOIN users u ON u.id = ca.user_id
     JOIN courses c ON c.id = ca.course_id
     WHERE u.telegram_id = $1
       AND ca.status = 'active'
       AND (ca.expires_at IS NULL OR ca.expires_at > now())
     ORDER BY ca.expires_at ASC NULLS FIRST`,
    [telegramId],
  );
  return rows;
}

export async function updateInviteLink(
  channelAccessId: number,
  newLink: string,
): Promise<void> {
  await pool.query(`UPDATE channel_access SET invite_link = $2 WHERE id = $1`, [
    channelAccessId,
    newLink,
  ]);
}

export interface PendingOrder {
  order_id: number;
  account_number: string;
  bank_name: string;
  amount_ngn: string;
}

// An order created in roughly the last hour with a virtual account still
// attached — reused instead of spinning up a second account if the user
// taps "Proceed to payment" more than once for the same course.
export async function findRecentPendingOrder(
  userId: number,
  courseId: number,
): Promise<PendingOrder | null> {
  const { rows } = await pool.query<PendingOrder>(
    `SELECT o.id AS order_id, va.account_number, va.bank_name, o.amount_ngn
     FROM orders o
     JOIN virtual_accounts va ON va.order_id = o.id
     WHERE o.user_id = $1
       AND o.course_id = $2
       AND o.status = 'pending'
       AND o.created_at > now() - interval '1 hour'
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [userId, courseId],
  );
  return rows[0] ?? null;
}

// Creates a pending order for this user + course. Amount is snapshotted
// from the course at order time so later price changes don't affect it.
export async function createOrder(
  userId: number,
  course: DbCourse,
): Promise<{ id: number }> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO orders (user_id, course_id, amount_ngn, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [userId, course.id, course.price_ngn],
  );
  return rows[0];
}

export async function attachVirtualAccount(
  orderId: number,
  provider: string,
  accountNumber: string,
  bankName: string,
  providerReference: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO virtual_accounts
       (order_id, provider, account_number, bank_name, provider_reference, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, provider, accountNumber, bankName, providerReference, expiresAt],
  );
}
