"use client";

import { setFeedback } from "@/lib/feedback";
import type { Article } from "@/lib/types";

function Thumb({ down = false }: { down?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {down ? (
        <>
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </>
      ) : (
        <>
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </>
      )}
    </svg>
  );
}

/** Thumbs up / thumbs down at the end of an article. Tapping the active thumb undoes it. */
export default function FeedbackButtons({ article }: { article: Article }) {
  const { feedback } = article;

  function toggle(value: "up" | "down") {
    void setFeedback(article.id, feedback === value ? null : value);
  }

  const base =
    "flex h-14 w-14 items-center justify-center rounded-full border transition-colors";
  const idle = "border-border bg-card text-muted";
  const active = "border-accent bg-accent text-accent-fg";

  return (
    <section className="text-center">
      <div className="flex justify-center gap-4">
        <button
          type="button"
          aria-label="Thumbs up"
          aria-pressed={feedback === "up"}
          onClick={() => toggle("up")}
          className={`${base} ${feedback === "up" ? active : idle}`}
        >
          <Thumb />
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          aria-pressed={feedback === "down"}
          onClick={() => toggle("down")}
          className={`${base} ${feedback === "down" ? active : idle}`}
        >
          <Thumb down />
        </button>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {feedback === "up"
          ? "Saved to your Library. Tap again to undo."
          : feedback === "down"
            ? "Noted. Tap again to undo."
            : "Did you enjoy this one?"}
      </p>
    </section>
  );
}
