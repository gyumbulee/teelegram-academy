"use client";

// A plain <button type="submit"> inside a server-action <form> has no way to
// ask "are you sure?" first — that needs a client-side confirm(), hence this
// is the one small client component on an otherwise server-rendered admin.
export function DeleteCourseButton({ courseTitle }: { courseTitle: string }) {
  return (
    <button
      className="btn btn-danger"
      type="submit"
      onClick={(e) => {
        if (
          !confirm(
            `Delete "${courseTitle}"? This can't be undone. Courses with past orders can't be deleted — unpublish those instead.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Delete
    </button>
  );
}
