import Link from "next/link";
import { TYPE_LABELS, type TitleIdea } from "@/lib/types";

export function Tag({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "accent" | "new";
}) {
  const tones = {
    plain: "border border-border text-muted",
    accent: "bg-accent-soft text-accent",
    new: "bg-accent text-accent-fg",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function TitleCard({ idea }: { idea: TitleIdea }) {
  const opened = idea.status === "opened";
  return (
    <Link
      href={`/article?id=${idea.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-colors active:bg-accent-soft"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone="accent">{idea.topic}</Tag>
        {idea.types.map((type) => (
          <Tag key={type}>{TYPE_LABELS[type]}</Tag>
        ))}
        {idea.is_exploration && <Tag tone="new">Something new</Tag>}
      </div>
      <h2 className="mt-3 font-serif text-xl leading-snug font-semibold">{idea.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{idea.teaser}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>~5 min</span>
        {opened && (
          <span className="flex items-center gap-1 text-accent" aria-label="Opened">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 8.5l3.2 3.2L13 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Read
          </span>
        )}
      </div>
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-5" aria-hidden="true">
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-border" />
        <div className="h-5 w-24 rounded-full bg-border" />
      </div>
      <div className="mt-4 h-5 w-11/12 rounded bg-border" />
      <div className="mt-2 h-5 w-2/3 rounded bg-border" />
      <div className="mt-3 h-3.5 w-full rounded bg-border" />
      <div className="mt-4 h-3 w-10 rounded bg-border" />
    </div>
  );
}
