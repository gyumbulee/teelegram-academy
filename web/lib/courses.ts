import { pool } from "./db";

export interface LandingCourse {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price_ngn: string;
  type: "course" | "one_on_one";
  access_duration_days: number;
}

export async function listCoursesForLanding(): Promise<LandingCourse[]> {
  const { rows } = await pool.query<LandingCourse>(
    `SELECT id, title, slug, description, price_ngn, type, access_duration_days
     FROM courses
     WHERE is_active = true
     ORDER BY created_at ASC`,
  );
  return rows;
}
