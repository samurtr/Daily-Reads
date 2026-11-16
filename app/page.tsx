"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import TabBar from "@/components/TabBar";
import TitleCard, { SkeletonCard } from "@/components/TitleCard";
import { errorMessage } from "@/lib/api";
import { formatLongDate, localDate } from "@/lib/date";
import { db } from "@/lib/db";
import { ensureTodayBatch, loadToday, MAX_REFRESHES, refreshTitles } from "@/lib/today";
import { MIN_TOPICS } from "@/lib/topics";
import { useOnline } from "@/lib/useOnline";

export default function TodayPage() {
  const [today, setToday] = useState(() => localDate());
  const online = useOnline();
  const data = useLiveQuery(() => loadToday(today), [today]);
  const activeTopics = useLiveQuery(
    async () => (await db.topics.toArray()).filter((t) => t.is_active).length,
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // App open across midnight: new titles only when the tab comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setToday(localDate());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const generate = useCallback(() => {
    setError(null);
    ensureTodayBatch(today).catch((err) => setError(errorMessage(err)));
  }, [today]);

  // First open of the day: no titles yet, so draw topics and generate them.
  const missing = data !== undefined && data.batch === null;
  useEffect(() => {
    if (missing && online) generate();
  }, [missing, online, generate]);

  function refresh() {
    setError(null);
    setRefreshing(true);
    refreshTitles(today)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setRefreshing(false));
  }

  const loading = data === undefined || refreshing || (missing && online && !error);
  const refreshesLeft = data?.batch ? MAX_REFRESHES - data.batch.refresh_count : 0;

  return (
    <>
      <main className="mx-auto max-w-xl px-5 pt-10 pb-28">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Today</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold">{formatLongDate(today)}</h1>

        {!online && (
          <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted">
            {missing
              ? "You're offline. Today's titles will appear as soon as you're back online."
              : "You're offline. Articles you've already opened and your Library still work; new ones need a connection."}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {error && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-muted">{error}</p>
              <button
                type="button"
                onClick={missing ? generate : refresh}
                className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
              >
                Retry
              </button>
            </div>
          )}

          {loading
            ? Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
            : data?.titles.map((idea) => <TitleCard key={idea.id} idea={idea} />)}
        </div>

        {data?.batch && !loading && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshesLeft <= 0 || !online}
              className="text-sm font-medium text-accent underline underline-offset-4 disabled:text-muted disabled:no-underline"
            >
              Give me 5 others
            </button>
            <p className="mt-1.5 text-xs text-muted">
              {refreshesLeft > 0
                ? `${refreshesLeft} of ${MAX_REFRESHES} left today`
                : "No refreshes left today"}
            </p>
          </div>
        )}

        {activeTopics === MIN_TOPICS && (
          <p className="mt-8 text-center text-sm text-muted">
            With exactly {MIN_TOPICS} topics, the same {MIN_TOPICS} appear every day.{" "}
            <Link href="/settings" className="text-accent underline underline-offset-4">
              Add more
            </Link>{" "}
            for more variety.
          </p>
        )}
      </main>
      <TabBar />
    </>
  );
}
