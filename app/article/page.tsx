"use client";

import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import Markdown from "react-markdown";
import FeedbackButtons from "@/components/FeedbackButtons";
import ReadingProgress from "@/components/ReadingProgress";
import StepIndicator from "@/components/StepIndicator";
import { Tag } from "@/components/TitleCard";
import { db } from "@/lib/db";
import {
  cancelGeneration,
  getGeneration,
  startGeneration,
  subscribe,
  type Generation,
} from "@/lib/generation";
import { readMinutes, stripLeadingTitle } from "@/lib/text";
import { TYPE_LABELS, type Source } from "@/lib/types";
import { useOnline } from "@/lib/useOnline";

export default function ArticlePage() {
  return (
    <Suspense>
      <ArticleView />
    </Suspense>
  );
}

function ArticleView() {
  const router = useRouter();
  const id = Number(useSearchParams().get("id"));
  const idea = useLiveQuery(async () => (await db.title_ideas.get(id)) ?? null, [id]);
  const article = useLiveQuery(
    async () => (await db.articles.where("title_idea_id").equals(id).first()) ?? null,
    [id],
  );
  const generation = useSyncExternalStore(
    subscribe,
    () => getGeneration(id),
    () => undefined,
  );
  const leaving = useRef(false);
  const online = useOnline();

  // Not cached yet: write it now (generation is disabled while offline).
  useEffect(() => {
    if (idea && article === null && !generation && online && !leaving.current) {
      startGeneration(idea);
    }
  }, [idea, article, generation, online]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  function pickAnother() {
    leaving.current = true;
    cancelGeneration(id);
    router.push("/");
  }

  if (idea === undefined || article === undefined) return null;

  const meta = article ?? idea;
  if (!meta) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-16 text-center">
        <p className="text-muted">This article isn&apos;t available.</p>
        <PrimaryButton onClick={() => router.push("/")}>Back to Today</PrimaryButton>
      </main>
    );
  }

  const body = article?.body_markdown ?? generation?.body ?? "";

  return (
    <>
      <ReadingProgress />
      <main className="mx-auto max-w-xl px-5 pt-6 pb-24">
        <button type="button" onClick={goBack} className="py-2 text-sm text-muted">
          ← Back
        </button>

        <header className="mt-4">
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="accent">{meta.topic}</Tag>
            {meta.types.map((type) => (
              <Tag key={type}>{TYPE_LABELS[type]}</Tag>
            ))}
          </div>
          <h1 className="mt-4 font-serif text-3xl leading-tight font-semibold">{meta.title}</h1>
          <p className="mt-3 text-sm text-muted">
            {article ? `${readMinutes(article.word_count)} min read` : "~5 min read"}
          </p>
        </header>

        {!article && generation && generation.stage !== "done" && (
          <GenerationStatus
            generation={generation}
            onRetry={() => idea && (cancelGeneration(id), startGeneration(idea))}
            onPickAnother={pickAnother}
          />
        )}

        {!article && !generation && !online && (
          <Notice message="You're offline. This article can be written as soon as you're back online.">
            <PrimaryButton onClick={pickAnother}>Back to Today</PrimaryButton>
          </Notice>
        )}

        {body && (
          <div className="article-body mt-8">
            <Markdown>{stripLeadingTitle(body)}</Markdown>
          </div>
        )}

        {article && (
          <footer className="mt-12 border-t border-border pt-8">
            <SourcesList sources={article.sources} />
            <div className="mt-10">
              <FeedbackButtons article={article} />
            </div>
            <p className="mt-8 text-center text-xs text-muted">
              AI-generated, may contain mistakes.
            </p>
          </footer>
        )}
      </main>
    </>
  );
}

function GenerationStatus({
  generation,
  onRetry,
  onPickAnother,
}: {
  generation: Generation;
  onRetry: () => void;
  onPickAnother: () => void;
}) {
  if (generation.stage === "unverified") {
    return (
      <Notice message="Couldn't verify this one.">
        <PrimaryButton onClick={onPickAnother}>Pick another title</PrimaryButton>
      </Notice>
    );
  }
  if (generation.stage === "error") {
    return (
      <Notice message={generation.message ?? "Something went wrong. Please try again."}>
        <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
        <SecondaryButton onClick={onPickAnother}>Pick another title</SecondaryButton>
      </Notice>
    );
  }
  return (
    <div className="mt-8">
      <StepIndicator generation={generation} />
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Sources</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {source.title || source.url}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Notice({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
      <p className="font-serif text-lg">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-5 py-2.5 text-sm font-medium"
    >
      {children}
    </button>
  );
}
