import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCourseDetail,
  updateCourse,
  listLessons,
  addLesson,
  deleteLesson,
} from "@/lib/admin";

export default async function EditCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const course = await getCourseDetail(id);
  if (!course) notFound();

  const lessons = await listLessons(id);

  async function save(formData: FormData) {
    "use server";
    const channelId = String(formData.get("telegramChannelId") ?? "").trim();

    await updateCourse(id, {
      title: String(formData.get("title") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      priceNgn: Number(formData.get("priceNgn")),
      type: formData.get("type") === "one_on_one" ? "one_on_one" : "course",
      accessDurationDays: Number(formData.get("accessDurationDays") ?? 30),
      telegramChannelId: channelId ? channelId : null,
    });

    revalidatePath(`/admin/courses/${id}`);
    revalidatePath("/admin");
    revalidatePath("/");
  }

  async function addLessonAction(formData: FormData) {
    "use server";
    const title = String(formData.get("lessonTitle") ?? "").trim();
    if (!title) return;

    const fileUrlsRaw = String(formData.get("fileUrls") ?? "").trim();
    const fileUrls = fileUrlsRaw
      ? fileUrlsRaw.split("\n").map((u) => u.trim()).filter(Boolean)
      : [];

    await addLesson(id, title, lessons.length + 1, fileUrls);
    revalidatePath(`/admin/courses/${id}`);
  }

  async function deleteLessonAction(formData: FormData) {
    "use server";
    await deleteLesson(Number(formData.get("lessonId")));
    revalidatePath(`/admin/courses/${id}`);
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="wrap">
          <h1>{course.title}</h1>
          <nav>
            <a href="/admin">Back to courses</a>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <a className="admin-back" href="/admin">
          ← All courses
        </a>

        <form className="admin-form" action={save}>
          <label>
            <span>Title</span>
            <input name="title" defaultValue={course.title} required />
          </label>

          <label>
            <span>Slug</span>
            <input name="slug" defaultValue={course.slug} required />
          </label>

          <label>
            <span>Description</span>
            <textarea name="description" defaultValue={course.description ?? ""} />
          </label>

          <div className="admin-form-row">
            <label>
              <span>Type</span>
              <select name="type" defaultValue={course.type}>
                <option value="course">Course (video series)</option>
                <option value="one_on_one">1-on-1 (booking)</option>
              </select>
            </label>
            <label>
              <span>Price (₦)</span>
              <input
                name="priceNgn"
                type="number"
                min="0"
                step="1"
                defaultValue={course.price_ngn}
                required
              />
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              <span>Access length (days)</span>
              <input
                name="accessDurationDays"
                type="number"
                min="1"
                defaultValue={course.access_duration_days}
              />
            </label>
            <label>
              <span>Telegram channel ID</span>
              <input
                name="telegramChannelId"
                defaultValue={course.telegram_channel_id ?? ""}
                placeholder="-1001234567890"
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn" type="submit">
              Save changes
            </button>
          </div>
        </form>

        <div className="admin-toolbar" style={{ marginTop: 40 }}>
          <h2>Lessons</h2>
        </div>

        {lessons.length === 0 ? (
          <p className="admin-empty">
            No lessons listed yet — these are just titles and optional file
            links; the videos themselves live in the Telegram channel.
          </p>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {lessons.map((lesson) => (
              <div className="lesson-row" key={lesson.id}>
                <span>
                  <span className="lesson-order">{lesson.order_index}</span>
                  {lesson.title}
                </span>
                <form action={deleteLessonAction}>
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <button className="btn btn-quiet" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <form className="admin-form" action={addLessonAction}>
          <label>
            <span>Lesson title</span>
            <input name="lessonTitle" placeholder="e.g. Setting up your first widget" />
          </label>
          <label>
            <span>File links (one per line, optional)</span>
            <textarea name="fileUrls" placeholder="https://..." />
          </label>
          <div className="form-actions">
            <button className="btn btn-quiet" type="submit">
              Add lesson
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
