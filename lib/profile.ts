import { postJSON } from "./api";
import { DAY_MS } from "./date";
import { db, getSetting, setSetting } from "./db";
import type { FeedbackItem, ProfileRequest, ProfileResponse } from "./schemas";
import { excerpt } from "./text";
import type { Article, TasteProfile } from "./types";

const MAX_SIGNAL_ARTICLES = 20;
const MAX_SKIPPED_TITLES = 15;
const EXCERPT_WORDS = 150;

/** With zero likes the profile is just the selected topics plus a neutral default style. */
export function defaultProfile(topics: string[]): TasteProfile {
  return {
    favorite_topics: topics,
    liked_angles: [],
    disliked_angles: [],
    style: {
      tone: "clear, curious and friendly",
      structure: "opens with a hook, 3–4 sections, ends with a takeaway",
      depth: "concrete facts and examples, little jargon",
    },
    example_liked_titles: [],
  };
}

async function activeTopicNames(): Promise<string[]> {
  return (await db.topics.toArray()).filter((t) => t.is_active).map((t) => t.name);
}

/** The taste signal: rated articles since the profile was last reset, most recent first. */
async function tasteSignal(): Promise<{ liked: Article[]; disliked: Article[] }> {
  const resetAt = (await getSetting<number>("profile_reset_at")) ?? 0;
  const rated = (await db.articles.toArray()).filter(
    (a) => a.feedback !== null && a.created_at > resetAt,
  );
  return {
    liked: rated
      .filter((a) => a.feedback === "up")
      .sort((a, b) => (b.saved_at ?? 0) - (a.saved_at ?? 0)),
    disliked: rated.filter((a) => a.feedback === "down").sort((a, b) => b.created_at - a.created_at),
  };
}

/** 1–2 excerpts of the most recently liked articles, as style examples for the writing prompt. */
export async function likedExcerpts(): Promise<string[]> {
  const { liked } = await tasteSignal();
  return liked.slice(0, 2).map((a) => excerpt(a.body_markdown, EXCERPT_WORDS));
}

function toFeedbackItem(a: Article): FeedbackItem {
  return {
    title: a.title,
    topic: a.topic,
    types: a.types,
    summary: a.summary,
    style_note: a.style_note,
  };
}

async function rebuild(): Promise<void> {
  const topics = await activeTopicNames();
  const { liked, disliked } = await tasteSignal();
  const now = Date.now();

  // Nothing rated: back to the selected topics plus the neutral default style.
  if (liked.length === 0 && disliked.length === 0) {
    await db.taste_profile.put({ id: 1, profile_json: defaultProfile(topics), updated_at: now });
    return;
  }

  const resetAt = (await getSetting<number>("profile_reset_at")) ?? 0;
  const skipped = (
    await db.title_ideas
      .where("created_at")
      .above(Math.max(resetAt, now - 30 * DAY_MS))
      .toArray()
  )
    .filter((t) => t.status === "skipped")
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, MAX_SKIPPED_TITLES);

  const request: ProfileRequest = {
    current_profile: (await db.taste_profile.get(1))?.profile_json ?? defaultProfile(topics),
    recent_feedback: {
      liked: liked.slice(0, MAX_SIGNAL_ARTICLES).map(toFeedbackItem),
      disliked: disliked.slice(0, MAX_SIGNAL_ARTICLES).map(toFeedbackItem),
      skipped_titles: skipped.map((t) => t.title),
    },
  };
  const { profile } = await postJSON<ProfileResponse>("/api/profile", request);

  await db.taste_profile.put({
    id: 1,
    profile_json: {
      ...profile,
      // Up to 10 most recent liked titles, straight from the Library.
      example_liked_titles: liked.slice(0, 10).map((a) => a.title),
    },
    updated_at: Date.now(),
  });
}

/**
 * After the topic list changes: while nothing has been rated, the profile is
 * just the selected topics plus the default style, so keep it in step.
 */
export async function syncDefaultProfile(): Promise<void> {
  const { liked, disliked } = await tasteSignal();
  if (liked.length > 0 || disliked.length > 0) return;
  await db.taste_profile.put({
    id: 1,
    profile_json: defaultProfile(await activeTopicNames()),
    updated_at: Date.now(),
  });
}

/**
 * Settings → Reset taste profile: back to the default profile. Articles rated
 * before the reset stay in the Library but no longer count toward the profile.
 */
export async function resetProfile(): Promise<void> {
  const now = Date.now();
  await setSetting("profile_reset_at", now);
  await db.taste_profile.put({
    id: 1,
    profile_json: defaultProfile(await activeTopicNames()),
    updated_at: now,
  });
}

let running: Promise<void> | null = null;
let queued = false;

/**
 * Rebuilds the taste profile in the background after a feedback event.
 * Failures are silent: the next feedback event rebuilds it again.
 */
export function rebuildProfile(): void {
  if (running) {
    queued = true;
    return;
  }
  running = rebuild()
    .catch((err) => console.error("Taste profile update failed:", err))
    .finally(() => {
      running = null;
      if (queued) {
        queued = false;
        rebuildProfile();
      }
    });
}
