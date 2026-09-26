import { listCoursesForLanding } from "@/lib/courses";

// Deep-links straight into the bot with a start payload, so tapping a
// specific course on the landing page opens Telegram already on that
// course's payment step rather than the generic /start menu.
// See bot/src/handlers/start.ts for the payload handling.
function telegramLinkFor(courseId: number) {
  const username = process.env.BOT_USERNAME;
  return `https://t.me/${username}?start=course_${courseId}`;
}

function telegramLinkGeneric() {
  const username = process.env.BOT_USERNAME;
  return `https://t.me/${username}`;
}

export default async function HomePage() {
  const courses = await listCoursesForLanding();

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="wordmark" href="/">
            TELEGRAM ACADEMY
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>
            Learn the skill.
            <br />
            <em>Get it working.</em>
          </h1>
          <p>
            Practical tech and business training, taught in short video lessons
            and run entirely on Telegram. Pick a course, pay for the month you
            need, and get straight to work.
          </p>
          <span className="hero-note">
            No app to install — everything happens in a chat you already have.
          </span>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>The program</h2>
          <p className="section-lead">
            Each course is a private Telegram channel with video lessons and
            downloadable files, added as they're ready. Access runs monthly.
          </p>

          {courses.length === 0 ? (
            <p className="empty-note">
              Nothing published yet — check back soon, or follow the free
              channel for updates.
            </p>
          ) : (
            <div className="course-list">
              {courses.map((course) => (
                <article className="course-card" key={course.id}>
                  <span
                    className={`course-tag ${course.type === "one_on_one" ? "one-on-one" : ""}`}
                  >
                    {course.type === "one_on_one" ? "1-on-1" : "course"}
                  </span>
                  <h3>{course.title}</h3>
                  {course.description && <p>{course.description}</p>}
                  <div className="course-meta">
                    <span className="course-price">
                      ₦{Number(course.price_ngn).toLocaleString("en-NG")}
                      <span className="duration">
                        {course.type === "one_on_one"
                          ? "per session"
                          : `${course.access_duration_days}-day access`}
                      </span>
                    </span>
                    <a className="course-cta" href={telegramLinkFor(course.id)}>
                      Start on Telegram
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>How it works</h2>
          <div className="steps">
            <div className="step">
              <span className="step-index">01</span>
              <p>
                <strong>Message the bot on Telegram</strong>
                Tap a course above, or open the bot directly and pick one from
                the menu.
              </p>
            </div>
            <div className="step">
              <span className="step-index">02</span>
              <p>
                <strong>Pay into your own account number</strong>
                The bot generates a dedicated account for your order — pay
                that exact amount and it's confirmed automatically.
              </p>
            </div>
            <div className="step">
              <span className="step-index">03</span>
              <p>
                <strong>Get your invite instantly</strong>
                As soon as payment clears, you'll get a link to the course
                channel — no waiting, no manual approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          Telegram Academy — built by Abeekey.{" "}
          <a href={telegramLinkGeneric()}>Message the bot</a>
        </div>
      </footer>
    </>
  );
}
