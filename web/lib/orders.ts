import { pool } from "./db";

export interface OrderForFulfillment {
  order_id: number;
  order_status: string;
  user_id: number;
  telegram_id: number;
  course_id: number;
  course_type: "course" | "one_on_one";
  telegram_channel_id: number | null;
  access_duration_days: number;
  title: string;
}

// Looks up everything needed to fulfil an order, keyed off the payment
// provider's reference embedded at order-creation time (order-<id>).
// Works for any provider — Flutterwave's tx_ref and Korapay's reference
// both echo back exactly what we sent when creating the charge.
export async function findOrderByReference(
  reference: string,
): Promise<OrderForFulfillment | null> {
  const { rows } = await pool.query<OrderForFulfillment>(
    `SELECT
       o.id AS order_id,
       o.status AS order_status,
       u.id AS user_id,
       u.telegram_id,
       c.id AS course_id,
       c.type AS course_type,
       c.telegram_channel_id,
       c.access_duration_days,
       c.title
     FROM virtual_accounts va
     JOIN orders o ON o.id = va.order_id
     JOIN users u ON u.id = o.user_id
     JOIN courses c ON c.id = o.course_id
     WHERE va.provider_reference = $1`,
    [reference],
  );
  return rows[0] ?? null;
}

export async function markOrderPaid(orderId: number): Promise<void> {
  await pool.query(
    `UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1`,
    [orderId],
  );
}

export async function grantChannelAccess(params: {
  userId: number;
  courseId: number;
  orderId: number;
  inviteLink: string;
  durationDays: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO channel_access
       (user_id, course_id, order_id, invite_link, expires_at, status)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, 'active')`,
    [params.userId, params.courseId, params.orderId, params.inviteLink, params.durationDays],
  );
}

export async function createPendingBooking(params: {
  userId: number;
  courseId: number;
  orderId: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO bookings (user_id, course_id, order_id, status)
     VALUES ($1, $2, $3, 'pending')`,
    [params.userId, params.courseId, params.orderId],
  );
}

export interface StalePendingOrder {
  order_id: number;
  telegram_id: number;
  course_id: number;
  title: string;
}

// Orders past their virtual account's ~1hr window that never got paid.
// 65 minutes gives a small buffer past Flutterwave's own account expiry
// so we don't race a payment that's still mid-flight.
export async function findStalePendingOrders(): Promise<StalePendingOrder[]> {
  const { rows } = await pool.query<StalePendingOrder>(
    `SELECT o.id AS order_id, u.telegram_id, c.id AS course_id, c.title
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN courses c ON c.id = o.course_id
     WHERE o.status = 'pending'
       AND o.created_at < now() - interval '65 minutes'`,
  );
  return rows;
}

export async function markOrderExpired(orderId: number): Promise<void> {
  await pool.query(`UPDATE orders SET status = 'expired' WHERE id = $1`, [orderId]);
}
