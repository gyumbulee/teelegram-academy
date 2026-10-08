import { pool } from "./db";

export interface CourseWithStats {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price_ngn: string;
  type: "course" | "one_on_one";
  access_duration_days: number | null; // null = lifetime access
  telegram_channel_id: string | null;
  is_active: boolean;
  active_subscribers: string;
  revenue_ngn: string;
}

export async function listCoursesWithStats(): Promise<CourseWithStats[]> {
  const { rows } = await pool.query<CourseWithStats>(
    `SELECT
       c.id, c.title, c.slug, c.description, c.price_ngn, c.type,
       c.access_duration_days, c.telegram_channel_id, c.is_active,
       COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'active') AS active_subscribers,
       COALESCE(SUM(o.amount_ngn) FILTER (WHERE o.status = 'paid'), 0) AS revenue_ngn
     FROM courses c
     LEFT JOIN channel_access ca ON ca.course_id = c.id
     LEFT JOIN orders o ON o.course_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
  );
  return rows;
}

export interface CourseDetail {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price_ngn: string;
  type: "course" | "one_on_one";
  access_duration_days: number | null; // null = lifetime access
  telegram_channel_id: string | null;
  is_active: boolean;
}

export async function getCourseDetail(id: number): Promise<CourseDetail | null> {
  const { rows } = await pool.query<CourseDetail>(
    `SELECT id, title, slug, description, price_ngn, type,
            access_duration_days, telegram_channel_id, is_active
     FROM courses WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface Lesson {
  id: number;
  title: string;
  order_index: number;
  file_urls: string[];
}

export async function listLessons(courseId: number): Promise<Lesson[]> {
  const { rows } = await pool.query<Lesson>(
    `SELECT id, title, order_index, file_urls
     FROM lessons WHERE course_id = $1 ORDER BY order_index ASC`,
    [courseId],
  );
  return rows;
}

export interface CourseInput {
  title: string;
  slug: string;
  description: string;
  priceNgn: number;
  type: "course" | "one_on_one";
  accessDurationDays: number | null; // null = lifetime access
  telegramChannelId: string | null;
}

export async function createCourse(input: CourseInput): Promise<{ id: number }> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO courses
       (title, slug, description, price_ngn, type, access_duration_days, telegram_channel_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)
     RETURNING id`,
    [
      input.title,
      input.slug,
      input.description,
      input.priceNgn,
      input.type,
      input.accessDurationDays,
      input.telegramChannelId,
    ],
  );
  return rows[0];
}

export async function updateCourse(id: number, input: CourseInput): Promise<void> {
  await pool.query(
    `UPDATE courses SET
       title = $2, slug = $3, description = $4, price_ngn = $5,
       type = $6, access_duration_days = $7, telegram_channel_id = $8
     WHERE id = $1`,
    [
      id,
      input.title,
      input.slug,
      input.description,
      input.priceNgn,
      input.type,
      input.accessDurationDays,
      input.telegramChannelId,
    ],
  );
}

export async function setCourseActive(id: number, isActive: boolean): Promise<void> {
  await pool.query(`UPDATE courses SET is_active = $2 WHERE id = $1`, [id, isActive]);
}

// Lessons cascade automatically (ON DELETE CASCADE in the schema), but
// orders/channel_access/bookings deliberately do NOT — they're payment and
// access history, and silently cascading those away would erase a record of
// real money changing hands. So this throws a Postgres foreign-key-violation
// error (code 23503) for any course that has ever had an order placed
// against it; the caller is expected to catch that and tell the admin to
// unpublish instead of delete. A course with zero orders (a test course, a
// duplicate, one created by mistake) deletes cleanly.
export async function deleteCourse(id: number): Promise<void> {
  await pool.query(`DELETE FROM courses WHERE id = $1`, [id]);
}

export async function addLesson(
  courseId: number,
  title: string,
  orderIndex: number,
  fileUrls: string[],
): Promise<void> {
  await pool.query(
    `INSERT INTO lessons (course_id, title, order_index, file_urls)
     VALUES ($1, $2, $3, $4)`,
    [courseId, title, orderIndex, JSON.stringify(fileUrls)],
  );
}

export async function deleteLesson(id: number): Promise<void> {
  await pool.query(`DELETE FROM lessons WHERE id = $1`, [id]);
}
