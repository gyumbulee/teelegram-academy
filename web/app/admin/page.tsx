import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listCoursesWithStats, setCourseActive, deleteCourse } from "@/lib/admin";
import { DeleteCourseButton } from "./DeleteCourseButton";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const courses = await listCoursesWithStats();

  const totalRevenue = courses.reduce((sum, c) => sum + Number(c.revenue_ngn), 0);
  const totalSubscribers = courses.reduce((sum, c) => sum + Number(c.active_subscribers), 0);

  async function togglePublish(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    const nextState = formData.get("nextState") === "true";
    await setCourseActive(id, nextState);
    revalidatePath("/admin");
  }

  async function deleteCourseAction(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));

    try {
      await deleteCourse(id);
    } catch (err) {
      // Postgres 23503 = foreign_key_violation — this course has orders,
      // channel_access or bookings referencing it (see the comment on
      // deleteCourse in lib/admin.ts). Any other error gets its own message
      // instead of a raw stack trace.
      const message =
        (err as { code?: string })?.code === "23503"
          ? "Can't delete — this course has order history. Unpublish it instead."
          : err instanceof Error
            ? err.message
            : "Failed to delete course.";
      redirect(`/admin?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/admin");
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="wrap">
          <h1>Telegram Academy — Admin</h1>
          <nav>
            <a href="/">View site</a>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        {searchParams.error && <p className="admin-error">{searchParams.error}</p>}

        <div className="admin-toolbar">
          <h2>
            Courses · ₦{totalRevenue.toLocaleString("en-NG")} total · {totalSubscribers} active
          </h2>
          <Link className="btn" href="/admin/courses/new">
            New course
          </Link>
        </div>

        {courses.length === 0 ? (
          <p className="admin-empty">
            No courses yet. Create your first one to get it onto the landing
            page.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Status</th>
                <th className="num">Price</th>
                <th className="num">Active</th>
                <th className="num">Revenue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>{course.title}</td>
                  <td>
                    <span
                      className={`status-pill ${course.is_active ? "active" : "draft"}`}
                    >
                      {course.is_active ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="num">
                    ₦{Number(course.price_ngn).toLocaleString("en-NG")}
                  </td>
                  <td className="num">{course.active_subscribers}</td>
                  <td className="num">
                    ₦{Number(course.revenue_ngn).toLocaleString("en-NG")}
                  </td>
                  <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Link className="btn btn-quiet" href={`/admin/courses/${course.id}`}>
                      Edit
                    </Link>
                    <form action={togglePublish}>
                      <input type="hidden" name="id" value={course.id} />
                      <input
                        type="hidden"
                        name="nextState"
                        value={(!course.is_active).toString()}
                      />
                      <button className="btn btn-quiet" type="submit">
                        {course.is_active ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteCourseAction}>
                      <input type="hidden" name="id" value={course.id} />
                      <DeleteCourseButton courseTitle={course.title} />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
