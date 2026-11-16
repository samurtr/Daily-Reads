// Uniform random integer in [0, max) using crypto, without modulo bias
export function randomInt(max: number): number {
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
export function sampleWithoutReplacement<T>(items: T[], k: number): T[] {
  if (k > items.length) throw new Error("Not enough items to draw from");
  const a = [...items];
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

export type DrawnTopic = { topic: string; isExploration: boolean };

export function drawDailyTopics(
  userTopics: string[],
  explorationPool: string[],
  recentExploration: string[],
): DrawnTopic[] {
  const mine: DrawnTopic[] = sampleWithoutReplacement(userTopics, 4).map((t) => ({
    topic: t,
    isExploration: false,
  }));

  const own = new Set(userTopics.map((t) => t.toLowerCase()));
  const recent = new Set(recentExploration.map((t) => t.toLowerCase()));
  let candidates = explorationPool.filter(
    (t) => !own.has(t.toLowerCase()) && !recent.has(t.toLowerCase()),
  );
  if (candidates.length === 0) {
    candidates = explorationPool.filter((t) => !own.has(t.toLowerCase()));
  }
  const [explore] = sampleWithoutReplacement(candidates, 1);

  // Shuffle all 5 so the exploration card lands in a random position
  return sampleWithoutReplacement([...mine, { topic: explore, isExploration: true }], 5);
}
