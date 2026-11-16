import { db } from "./db";
import { rebuildProfile } from "./profile";
import type { Feedback } from "./types";

/**
 * Thumbs up saves the article to the Library; thumbs down is stored as a negative
 * signal; null undoes either (and removes the article from the Library).
 */
export async function setFeedback(articleId: number, feedback: Feedback): Promise<void> {
  await db.articles.update(articleId, {
    feedback,
    saved_at: feedback === "up" ? Date.now() : null,
  });
  // Either way, the taste profile is updated in the background.
  rebuildProfile();
}
