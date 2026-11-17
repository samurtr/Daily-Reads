import { z } from "zod";
import { ARTICLE_TYPES, type ArticleType, type FactCheck, type TasteProfile } from "./types";

export const ArticleTypeSchema = z.enum(ARTICLE_TYPES);

export const ProfileSchema = z.object({
  favorite_topics: z.array(z.string()),
  liked_angles: z.array(z.string()),
  disliked_angles: z.array(z.string()),
  style: z.object({
    tone: z.string(),
    structure: z.string(),
    depth: z.string(),
  }),
  example_liked_titles: z.array(z.string()),
});

/** One title idea, as returned by the AI. */
export const IdeaSchema = z.object({
  title: z.string(),
  topic: z.string(),
  types: z.array(ArticleTypeSchema),
  teaser: z.string(),
  angle: z.string(),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const IdeasSchema = z.object({ ideas: z.array(IdeaSchema) });

export const DrawnTopicSchema = z.object({
  topic: z.string().min(1).max(60),
  is_exploration: z.boolean(),
});

export const TitlesRequestSchema = z.object({
  drawn_topics: z.array(DrawnTopicSchema).length(5),
  profile: ProfileSchema,
  recent_titles: z.array(z.string()),
  date: z.string(),
});
export type TitlesRequest = z.infer<typeof TitlesRequestSchema>;

export interface TitlesResponse {
  ideas: (Idea & { is_exploration: boolean; fact_check: FactCheck | null })[];
}

export interface ArticleRequest {
  title: string;
  teaser: string;
  angle: string;
  types: ArticleType[];
  style: TasteProfile["style"];
  /** 1–2 excerpts of liked articles, as style examples. */
  excerpts: string[];
  /** The title's confirmed fact check, or null when it still has to be checked. */
  fact_check: FactCheck | null;
}

/** Stored with each article for later profile updates. */
export const ArticleNotesSchema = z.object({
  summary: z.string(),
  style_note: z.string(),
});

/** What the profile update sees of a rated article: title, summary and style note. */
export const FeedbackItemSchema = z.object({
  title: z.string(),
  topic: z.string(),
  types: z.array(ArticleTypeSchema),
  summary: z.string(),
  style_note: z.string(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

export const ProfileRequestSchema = z.object({
  current_profile: ProfileSchema,
  recent_feedback: z.object({
    liked: z.array(FeedbackItemSchema),
    disliked: z.array(FeedbackItemSchema),
    /** Titles rejected with "Give me 5 others": a weak negative signal for style only. */
    skipped_titles: z.array(z.string()),
  }),
});
export type ProfileRequest = z.infer<typeof ProfileRequestSchema>;
