"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import TabBar from "@/components/TabBar";
import { formatShortDate } from "@/lib/date";
import { db } from "@/lib/db";
import { setFeedback } from "@/lib/feedback";
import type { Article } from "@/lib/types";

const SWIPE_REMOVE_PX = 110;

export default function LibraryPage() {
  // Library = articles where feedback = up, newest first.
  const articles = useLiveQuery(async () =>
    (await db.articles.orderBy("saved_at").reverse().toArray()).filter(
      (a) => a.feedback === "up",
    ),
  );
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const topics = [...new Set((articles ?? []).map((a) => a.topic))].sort((a, b) =>
    a.localeCompare(b),
  );
  const activeTopic = topic && topics.includes(topic) ? topic : null;
  const needle = query.trim().toLowerCase();
  const visible = (articles ?? []).filter(
    (a) =>
      (!activeTopic || a.topic === activeTopic) &&
      (!needle || a.title.toLowerCase().includes(needle)),
  );

  return (
    <>
      <main className="mx-auto max-w-xl px-5 pt-10 pb-28">
        <h1 className="font-serif text-3xl font-semibold">Library</h1>

        {articles && articles.length === 0 && (
          <p className="mt-16 text-center font-serif text-lg text-muted">
            Thumbs-up an article to keep it here.
          </p>
        )}

        {articles && articles.length > 0 && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title"
              aria-label="Search by title"
              className="mt-6 w-full rounded-full border border-border bg-card px-4 py-2.5 text-base outline-none focus:border-accent"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip active={activeTopic === null} onClick={() => setTopic(null)}>
                All
              </FilterChip>
              {topics.map((t) => (
                <FilterChip key={t} active={activeTopic === t} onClick={() => setTopic(t)}>
                  {t}
                </FilterChip>
              ))}
            </div>

            <ul className="mt-6 space-y-3">
              {visible.map((article) => (
                <LibraryRow key={article.id} article={article} />
              ))}
            </ul>

            {visible.length === 0 && (
              <p className="mt-10 text-center text-muted">No saved articles match.</p>
            )}
          </>
        )}
      </main>
      <TabBar />
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active ? "bg-accent text-accent-fg" : "border border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}

/** Tap to re-read; swipe left or press × to remove. */
function LibraryRow({ article }: { article: Article }) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  // Removing from the Library also removes the article from the taste signal.
  const remove = () => void setFeedback(article.id, null);

  return (
    <li className="relative overflow-hidden rounded-2xl bg-danger">
      <span className="absolute inset-y-0 right-5 flex items-center text-sm font-medium text-white">
        Remove
      </span>
      <div
        className="relative flex items-stretch rounded-2xl border border-border bg-card"
        style={{
          transform: `translateX(${offset}px)`,
          transition: start.current ? "none" : "transform 0.2s",
          touchAction: "pan-y",
        }}
        onTouchStart={(e) => {
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          swiping.current = false;
        }}
        onTouchMove={(e) => {
          if (!start.current) return;
          const dx = e.touches[0].clientX - start.current.x;
          const dy = e.touches[0].clientY - start.current.y;
          if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            swiping.current = true;
          }
          if (swiping.current) setOffset(Math.min(0, dx));
        }}
        onTouchEnd={() => {
          start.current = null;
          if (offset <= -SWIPE_REMOVE_PX) remove();
          else setOffset(0);
        }}
        onTouchCancel={() => {
          start.current = null;
          setOffset(0);
        }}
      >
        <Link
          href={`/article?id=${article.title_idea_id}`}
          onClick={(e) => {
            if (swiping.current) e.preventDefault();
          }}
          className="min-w-0 flex-1 py-4 pl-5"
        >
          <h2 className="font-serif text-lg leading-snug font-semibold">{article.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {article.topic} · {formatShortDate(article.saved_at ?? article.created_at)}
          </p>
        </Link>
        <button
          type="button"
          aria-label={`Remove ${article.title} from Library`}
          onClick={remove}
          className="flex w-12 shrink-0 items-center justify-center text-xl text-muted"
        >
          ×
        </button>
      </div>
    </li>
  );
}
