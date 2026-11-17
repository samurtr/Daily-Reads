import { generateTitles } from "./ai/titles";
import { DAY_MS } from "./date";
import { db } from "./db";
import { drawDailyTopics } from "./draw";
import explorationPool from "./exploration-pool.json";
import { defaultProfile } from "./profile";
import type { TitlesResponse } from "./schemas";
import { isTooSimilar } from "./similarity";
import type { DailyBatch, TitleIdea } from "./types";

const TITLES_TIMEOUT_MS = 60_000;

/** "Give me 5 others" is limited to 2 per day to cap cost. */
export const MAX_REFRESHES = 2;

/** The set of titles currently shown for a batch: the most recently created one. */
export async function currentTitles(batchId: number): Promise<TitleIdea[]> {
  const all = await db.title_ideas.where("batch_id").equals(batchId).toArray();
  const latest = Math.max(...all.map((t) => t.created_at));
  return all.filter((t) => t.created_at === latest).sort((a, b) => a.id - b.id);
}

export async function loadToday(
  date: string,
): Promise<{ batch: DailyBatch | null; titles: TitleIdea[] }> {
  const batch = await db.daily_batches.where("date").equals(date).first();
  if (!batch) return { batch: null, titles: [] };
  return { batch, titles: await currentTitles(batch.id) };
}

/** Draws 5 topics in the browser, then asks Claude for one fact-checked title per topic. */
async function requestTitleSet(date: string): Promise<TitlesResponse["ideas"]> {
  const now = Date.now();
  const topics = (await db.topics.toArray()).filter((t) => t.is_active).map((t) => t.name);
  const recentIdeas = await db.title_ideas
    .where("created_at")
    .above(now - 30 * DAY_MS)
    .toArray();
  const recentTitles = recentIdeas.map((i) => i.title);
  const recentExploration = recentIdeas
    .filter((i) => i.is_exploration && i.created_at > now - 14 * DAY_MS)
    .map((i) => i.topic);

  const drawn = drawDailyTopics(topics, explorationPool, recentExploration);
  const profile =
    (await db.taste_profile.get(1))?.profile_json ?? defaultProfile(topics);

  const request = (avoid: string[]) =>
    generateTitles(
      {
        drawn_topics: drawn.map((d) => ({ topic: d.topic, is_exploration: d.isExploration })),
        profile,
        recent_titles: avoid,
        date,
      },
      TITLES_TIMEOUT_MS,
    );

  let ideas = await request(recentTitles);

  // Similarity check on the client: if a new title is too close to a recent one, ask once more.
  const tooSimilar = ideas.filter((idea) =>
    recentTitles.some((recent) => isTooSimilar(idea.title, recent)),
  );
  if (tooSimilar.length > 0) {
    ideas = await request([...recentTitles, ...tooSimilar.map((i) => i.title)]);
  }
  return ideas;
}

function addTitles(batchId: number, ideas: TitlesResponse["ideas"], now: number) {
  return db.title_ideas.bulkAdd(
    ideas.map((idea) => ({
      batch_id: batchId,
      title: idea.title,
      topic: idea.topic,
      is_exploration: idea.is_exploration,
      types: idea.types,
      teaser: idea.teaser,
      angle: idea.angle,
      fact_check: idea.fact_check,
      status: "shown" as const,
      created_at: now,
    })),
  );
}

async function createBatch(date: string): Promise<void> {
  if (await db.daily_batches.where("date").equals(date).first()) return;
  const ideas = await requestTitleSet(date);
  const now = Date.now();
  await db.transaction("rw", db.daily_batches, db.title_ideas, async () => {
    const batchId = await db.daily_batches.add({ date, refresh_count: 0, created_at: now });
    await addTitles(batchId, ideas, now);
  });
}

/**
 * "Give me 5 others": a fresh, independent draw under the same date, at most
 * MAX_REFRESHES times a day. Nothing changes unless the new titles arrive, so a
 * failed refresh never loses the day's titles.
 */
async function replaceTitles(date: string): Promise<void> {
  const batch = await db.daily_batches.where("date").equals(date).first();
  if (!batch || batch.refresh_count >= MAX_REFRESHES) return;
  const previous = await currentTitles(batch.id);
  const ideas = await requestTitleSet(date);
  const now = Date.now();
  await db.transaction("rw", db.daily_batches, db.title_ideas, async () => {
    // Rejected titles count as a weak negative signal for style, not for topic odds.
    for (const title of previous) {
      if (title.status === "shown") {
        await db.title_ideas.update(title.id, { status: "skipped" });
      }
    }
    await addTitles(batch.id, ideas, now);
    await db.daily_batches.update(batch.id, { refresh_count: batch.refresh_count + 1 });
  });
}

const inFlight = new Map<string, Promise<void>>();

function once(key: string, task: () => Promise<void>): Promise<void> {
  let pending = inFlight.get(key);
  if (!pending) {
    pending = task().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Creates today's titles if they don't exist yet. Concurrent calls share one request. */
export function ensureTodayBatch(date: string): Promise<void> {
  return once(`create:${date}`, () => createBatch(date));
}

export function refreshTitles(date: string): Promise<void> {
  return once(`refresh:${date}`, () => replaceTitles(date));
}
