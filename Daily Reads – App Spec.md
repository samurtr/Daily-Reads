# Daily Reads – App Spec

Nov 5, 2026 · @Samuel

## Overview

Daily Reads is a mobile-first web app for personal use. Every day it offers 5 fresh article titles, 4 from the user's own topics and 1 random exploration topic, and writes the full English article (4–5 minute read, about 900–1,150 words) only when the user taps a title. Thumbs-up articles are saved to a library and steer future angles and writing style.

**Goals**

- Give the user one genuinely interesting read per day with near-zero effort.
- Keep AI cost low: generate full articles on demand only, never in advance.
- Learn both *what* the user likes (topics, angles) and *how* (tone, structure, depth) from liked articles.

**Non-goals (v1)**

- No social features, comments or sharing.
- Single user, personal project: no accounts, sign-up or payments.
- No push notifications.
- No native iOS/Android app; it is a web app that can be installed to the home screen.
- No images or audio in articles.

## User flows

The app runs one daily loop: titles, one article, a rating, and the rating feeds tomorrow's titles.

&#91;embedded content: daily loop · onboarding once, then titles → article → rating → profile\]

**First launch**

1. Welcome screen explains the idea in one line.
2. User types in their own topics (at least 4); each becomes a removable chip. Optional suggestion chips can be tapped to add a topic quickly.
3. App saves topics, creates an empty taste profile and goes straight to today's titles.

**Every day**

1. User opens the app. If no titles exist for today, the app draws 4 of the user's topics uniformly at random without replacement, plus 1 exploration topic that is not in their list. The AI writes one title per topic (\~10–15 s including the fact check; show skeleton cards).
2. User taps a title; a research step runs first (\~15–40 s, with live status), then the article streams in on the reading screen.
3. At the end, thumbs up saves it to the Library; thumbs down hides it. Either way the taste profile is updated in the background.
4. User can go back and open other titles from today; each opened article is cached.

## Features & requirements

Six features make up v1; F1–F5 are must-haves, F6 is nice-to-have.

| ID | Feature | Requirements |
| --- | --- | --- |
| F1 | Topic onboarding | Free-text input: the user types their own topics (max 40 chars each, min 4, up to 30). Each shows as a removable chip. A few optional suggestion chips (e.g. Space, Psychology, History) speed things up. Editable later in Settings. |
| F2 | Daily titles | On first open each calendar day (local time), draw 4 distinct topics from the user's list (uniform, without replacement) plus 1 exploration topic not in the list, then generate one title per topic. Each card shows topic, article type(s) and a one-line teaser. Titles persist for the whole day; card order is shuffled. |
| F3 | On-demand article | Tap a title → show research status ("Researching… 4 sources found… Writing…"), then stream the English article live on a reading screen, with a numbered Sources list at the end. 900–1,150 words, estimated read time shown (words ÷ 230 wpm). Once generated, it is cached so re-opening it costs nothing. |
| F4 | Feedback | Thumbs up / thumbs down at the end of each article. Thumbs up saves it to the Library and adds it to the taste signal. Thumbs down is stored as a negative signal (not saved to the Library). Feedback can be undone. |
| F5 | Library | List of liked articles, newest first, searchable by title, filterable by topic. Tap to re-read. Swipe or click to remove (also removes it from the taste signal). |
| F6 | Refresh titles | "Give me 5 others" runs a fresh, independent draw (same rules as F2), limited to 2 per day to cap cost. Rejected titles count as a weak negative signal for style, not for topic odds. |

## AI generation & personalization

Personalization works through a compact **taste profile** that is rebuilt after every thumbs up or down, then injected into both prompts. Sending whole liked articles each time would be slow and expensive; the profile keeps prompts small.

### Topic draw (uniform, without replacement)

The app's own code chooses the 5 topics, not the AI, so the draw is truly random:

1. Draw 4 topics from the user's active list uniformly at random without replacement. Every 4-topic subset is equally likely, so with n topics each one appears on a given day with probability 4/n.
2. Draw 1 exploration topic uniformly from a built-in pool of \~100 broad topics, excluding anything in the user's list (case-insensitive) and anything used for exploration in the last 14 days.
3. Shuffle the 5 so the exploration card isn't always in the same position.

The taste profile never changes the topic odds; it only shapes angles, article types and style within each topic.

```typescript
// Uniform random integer in [0, max) using crypto, without modulo bias
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

// Draw k items uniformly without replacement (partial Fisher–Yates shuffle)
function sampleWithoutReplacement<T>(items: T[], k: number): T[] {
  if (k > items.length) throw new Error("Not enough items to draw from");
  const a = [...items];
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

type DrawnTopic = { topic: string; isExploration: boolean };

function drawDailyTopics(
  userTopics: string[],
  explorationPool: string[],
  recentExploration: string[]
): DrawnTopic[] {
  const mine: DrawnTopic[] = sampleWithoutReplacement(userTopics, 4)
    .map(t => ({ topic: t, isExploration: false }));

  const own = new Set(userTopics.map(t => t.toLowerCase()));
  const recent = new Set(recentExploration.map(t => t.toLowerCase()));
  let candidates = explorationPool.filter(
    t => !own.has(t.toLowerCase()) && !recent.has(t.toLowerCase())
  );
  if (candidates.length === 0) {
    candidates = explorationPool.filter(t => !own.has(t.toLowerCase()));
  }
  const [explore] = sampleWithoutReplacement(candidates, 1);

  // Shuffle all 5 so the exploration card lands in a random position
  return sampleWithoutReplacement([...mine, { topic: explore, isExploration: true }], 5);
}
```

Add a unit test: run 100,000 draws and check that each topic's frequency is within ±1 percentage point of 4/n.

### Article types

Every title gets one or more of these four types, chosen by the AI to fit the topic. Across the 5 daily titles, at least 3 different types must appear.

| Type key | What it means | Example title |
| --- | --- | --- |
| `random_facts` | A string of surprising, true facts around one theme | On Venus, a day lasts longer than a year |
| `should_know` | Something many people don't know but really should | The Doctor Who Drank Bacteria to Win a Nobel Prize |
| `understand_world` | Helps the reader make sense of how the world works | Why some countries drive on the left |
| `how_it_works` | Explains the mechanism behind something | How noise-cancelling headphones erase sound |

### Taste profile

After each feedback event, one cheap AI call updates a short JSON profile from the liked/disliked articles' titles, summaries and style notes:

```json
{
  "favorite_topics": ["Space", "Inventions"],
  "liked_angles": ["surprising origin stories", "counterintuitive science"],
  "disliked_angles": ["listicles", "celebrity trivia"],
  "style": {
    "tone": "curious, lightly humorous",
    "structure": "opens with a hook anecdote, 3–4 sections, ends with a takeaway",
    "depth": "concrete numbers and names, little jargon"
  },
  "example_liked_titles": ["...up to 10 most recent..."]
}
```

With zero likes the profile is just the selected topics plus a neutral default style.

### Prompt 1 — daily titles

Inputs: topics, taste profile, titles from the last 30 days (to avoid repeats), today's date.

> You write titles for short, fascinating non-fiction articles in English. Write exactly one article idea for each of these 5 topics, in this order: {drawn\_topics, each marked exploration or not}. Each idea has one or more of these types: random\_facts, should\_know, understand\_world, how\_it\_works. Use at least 3 different types across the 5 ideas. Taste profile (use it for angles and style, never to change the topics): {profile}. Do not repeat or closely resemble: {recent\_titles}. Each idea must be a specific, true, verifiable fact or story, not a vague theme. For exploration topics, pick an angle a newcomer can enjoy. Return JSON in the same order: \[{"title", "topic", "types", "teaser" (max 20 words), "angle"}\].

Use structured JSON output so the app can parse it reliably. Then run a quick fact check with the small model and the web search tool (1 search per title): if a title's core claim can't be confirmed, regenerate that one title for the same topic (max 1 retry).

### Prompt 2 — article: research, then write

Articles are generated in two steps to minimise hallucinations. Both steps use the largest model (e.g. `claude-opus-5-5`) with extended thinking at a moderate budget; at about one article a day the cost stays small.

**Step A — research** (web search tool enabled, max \~5 searches). Inputs: title, teaser, angle, types.

> Research the article "{title}" ({teaser}). Use web search to find 3–6 reliable sources (encyclopedias, universities, museums, reputable news outlets, original papers; avoid content farms). Return JSON: {"verdict": "ok" | "premise\_false" | "not\_enough\_sources", "facts": \[{"claim", "source\_ids", "confidence": "high" | "disputed"}\], "sources": \[{"id", "title", "url"}\], "corrected\_angle" (only if the title's premise needs adjusting)}. Only include claims that a source supports.

If the verdict is not `ok`, nothing is written: the app shows "Couldn't verify this one" and offers another title.

**Step B — write** (no tools; streams to the screen). Inputs: research JSON, types, taste profile style block, 1–2 liked excerpts.

> Write a 900–1,150 word article in English titled "{title}", using only the facts in these research notes: {facts}. Do not add names, dates or numbers that are not in the notes; if a fact is marked disputed, say so in the text. Article type(s): {types}. For random\_facts, pack in surprising facts. For should\_know, make clear why it matters in the reader's own life. For understand\_world, connect it to the bigger picture. For how\_it\_works, explain the mechanism step by step with a simple analogy. Match this reader's preferred style: {style}. Style examples of articles they loved: {excerpts}. Requirements: start with a hook, use 2–4 subheadings in Markdown, end with a memorable takeaway. No preamble and no source list (the app adds it).

After generation, store a 1-sentence summary and a short style note (made in the same call or a follow-up) for later profile updates.

### Accuracy

Grounding reduces errors but doesn't remove them: sources can be wrong, and the model can misread them. Every article ends with its numbered sources (from the research JSON, so the links are real) and a small "AI-generated, may contain mistakes" note.

## Data model

Five tables cover v1; all are stored in the browser (IndexedDB) on the user's device.

| Table | Fields | Notes |
| --- | --- | --- |
| `topics` | id, name, is\_active, created\_at | All entered by the user; editable in Settings. At least 4 must stay active. |
| `daily_batches` | id, date (YYYY-MM-DD, local), refresh\_count, created\_at | One per day; a refresh creates a new set of titles under the same date. |
| `title_ideas` | id, batch\_id, title, topic, is\_exploration, types (array), teaser, angle, status (shown / opened / skipped), created\_at | Last 30 days of titles go into the titles prompt to prevent repeats. Exploration topics from the last 14 days are excluded from the next draw. |
| `articles` | id, title\_idea\_id, title, topic, types, body\_markdown, word\_count, summary, style\_note, research\_json, sources (array of title + URL), feedback (up / down / null), saved\_at, created\_at | Library = articles where feedback = up. |
| `taste_profile` | id (single row), profile\_json, updated\_at | Rebuilt after each feedback event. |

The exploration pool (\~100 broad topics such as Geology, Linguistics, Economics, Ancient Rome, Mycology) ships as a static JSON file in the code, not as a table.

Also store `settings` (onboarding\_done, theme, font size) as simple key–value pairs.

## Screens & UI

Five screens with a bottom tab bar (Today · Library · Settings). The feel is calm and editorial, like a good magazine: generous whitespace, a serif font for article text, light and dark mode.

1. **Welcome / onboarding** — one-line pitch, a text input to type your own topics (each becomes a removable chip), a few optional suggestion chips, "Start reading" button (enabled at 4+ topics).
2. **Today** — date header, 5 title cards (topic tag, type tag, title, teaser, \~5 min badge). The exploration card carries a "Something new" tag. "Give me 5 others" link. Opened cards show a check mark. Skeleton cards while loading.
3. **Article** — title, topic, read time, streaming Markdown body, reading progress bar at the top, numbered Sources list and thumbs up / down at the bottom, AI note. While researching, a step indicator shows progress.
4. **Library** — search bar, topic filter chips, list of saved articles (title, topic, date). Empty state: "Thumbs-up an article to keep it here."
5. **Settings** — manage topics, reset taste profile, theme, font size, export / import data as JSON, clear all data.

## Tech stack & architecture

Build it as a Next.js web app that runs in the phone's browser and can be installed to the home screen (PWA). Data lives in the browser; the AI API key stays on the server in Next.js API routes and never reaches the browser.

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js (App Router, TypeScript) + Tailwind CSS | UI and API in one project; AI coding tools know it well. |
| Installable | PWA manifest + service worker (e.g. Serwist) | Home-screen icon; Library readable offline. |
| Local storage | IndexedDB via Dexie.js | Topics, titles, articles and profile persist in the browser. |
| Backend | Next.js API routes, hosted on Vercel (free Hobby plan is enough for personal use) | Hides the API key, streams responses. |
| AI | Claude API: a larger model (e.g. `claude-opus-5-5`) with web search and extended thinking for research and articles, a small fast one (e.g. `claude-haiku-5-5`) for titles, title fact checks and profile updates | Quality where it shows, low cost elsewhere. |
| Markdown rendering | react-markdown | Renders the streamed article body. |

Endpoints on the server function:

- `POST /api/titles` — {drawn\_topics (5, each with is\_exploration), profile, recent\_titles} → 5 fact-checked title ideas (JSON)
- `POST /api/article` — {title, teaser, angle, types, style, excerpts} → runs research, then streams status events (researching / sources found / writing), the Markdown body and the sources list
- `POST /api/profile` — {current\_profile, recent\_feedback} → updated profile JSON

The topic draw runs in the browser before calling `/api/titles`.

Access: since it's a personal app, protect the API routes with one passcode stored as an environment variable (entered once, remembered in the browser), so strangers who find the URL can't spend your API credits. Also set a monthly spending limit in the API console as a backstop.

## Edge cases, MVP scope & open questions

**Edge cases**

- No internet → show cached titles and the Library (service worker); disable generation with a friendly message.
- Generation fails or times out → retry button; never lose the day's titles.
- Research says the premise is false or finds too few sources → don't write; show "Couldn't verify this one" and offer another title.
- Research takes longer than 60 s → show what was found so far and offer to keep waiting or pick another title.
- App open across midnight → new titles only on next open or when the tab comes back to the foreground.
- Fewer than 4 topics → onboarding blocks; Settings won't let you deactivate below 4.
- Exactly 4 topics → all 4 appear every day (only order and the exploration topic vary); gently suggest adding more.
- Custom topic is offensive or unsafe → model refuses gracefully; show "Couldn't write about that, pick another."
- Titles too similar day to day → recent-titles list in the prompt plus a similarity check on the client.
- Article too short/long → accept 800–1,300 words; outside that, regenerate once (reusing the research).
- Browser data cleared → Library is gone; JSON export/import in Settings is the backup.

**MVP build order (suggested prompts for your vibe-coding session)**

- [ ] Next.js project + onboarding where you type your topics, saved to IndexedDB
- [ ] Topic draw (uniform, without replacement, + exploration topic) with a unit test of the distribution
- [ ] `/api/titles`; Today screen shows 5 cards
- [ ] `/api/article` (research step, then writing step with streaming); Article screen with status indicator and sources
- [ ] Thumbs up/down + Library
- [ ] `/api/profile` and feeding the profile into both prompts
- [ ] Polish: PWA install, passcode, dark mode, loading states, error handling, refresh limit, JSON export
