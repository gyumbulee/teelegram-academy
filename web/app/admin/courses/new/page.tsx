import { redirect } from "next/navigation";
import { createCourse } from "@/lib/admin";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NewCoursePage() {
  async function create(formData: FormData) {
    "use server";

    const title = String(formData.get("title") ?? "").trim();
    const type = formData.get("type") === "one_on_one" ? "one_on_one" : "course";
    const channelId = String(formData.get("telegramChannelId") ?? "").trim();

    const { id } = await createCourse({
      title,
      slug: slugify(title),
      description: String(formData.get("description") ?? ""),
      priceNgn: Number(formData.get("priceNgn")),
      type,
      accessDurationDays: Number(formData.get("accessDurationDays") ?? 30),
      telegramChannelId: channelId ? channelId : null,
    });

    redirect(`/admin/courses/${id}`);
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="wrap">
          <h1>New course</h1>
          <nav>
            <a href="/admin">Back to courses</a>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <form className="admin-form" action={create}>
          <label>
            <span>Title</span>
            <input name="title" required placeholder="e.g. Flutter Basics" />
          </label>

          <label>
            <span>Description</span>
            <textarea
              name="description"
              placeholder="What this course covers — shown on the landing page."
            />
          </label>

          <div className="admin-form-row">
            <label>
              <span>Type</span>
              <select name="type" defaultValue="course">
                <option value="course">Course (video series)</option>
                <option value="one_on_one">1-on-1 (booking)</option>
              </select>
            </label>
            <label>
              <span>Price (₦)</span>
              <input name="priceNgn" type="number" min="0" step="1" required />
            </label>
          </div>

          <div className="admin-form-row">
            <label>
              <span>Access length (days)</span>
              <input
                name="accessDurationDays"
                type="number"
                min="1"
                defaultValue={30}
              />
            </label>
            <label>
              <span>Telegram channel ID</span>
              <input
                name="telegramChannelId"
                placeholder="-1001234567890 (leave blank for 1-on-1)"
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="btn" type="submit">
              Create course
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
