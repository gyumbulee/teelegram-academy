import { pool } from "./db";

export interface ExpiredAccessRow {
  channel_access_id: number;
  telegram_id: number;
  telegram_channel_id: number;
  course_title: string;
  course_id: number;
}

// Anything still 'active' whose expiry has passed. Ordered oldest-expired
// first, purely so logs read in a sensible order if this ever needs
// manual review.
export async function findExpiredAccess(): Promise<ExpiredAccessRow[]> {
  const { rows } = await pool.query<ExpiredAccessRow>(
    `SELECT
       ca.id AS channel_access_id,
       u.telegram_id,
       c.telegram_channel_id,
       c.title AS course_title,
       c.id AS course_id
     FROM channel_access ca
     JOIN users u ON u.id = ca.user_id
     JOIN courses c ON c.id = ca.course_id
     WHERE ca.status = 'active'
       AND ca.expires_at <= now()
       AND c.telegram_channel_id IS NOT NULL
     ORDER BY ca.expires_at ASC`,
  );
  return rows;
}

export async function markAccessExpired(channelAccessId: number): Promise<void> {
  await pool.query(
    `UPDATE channel_access SET status = 'expired' WHERE id = $1`,
    [channelAccessId],
  );
}
