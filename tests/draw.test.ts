import { describe, expect, it } from "vitest";
import { drawDailyTopics } from "../lib/draw";
import explorationPool from "../lib/exploration-pool.json";

describe("drawDailyTopics", () => {
  it("draws each user topic with frequency 4/n (±1 percentage point) over 100,000 draws", () => {
    const n = 10;
    const draws = 100_000;
    const userTopics = Array.from({ length: n }, (_, i) => `Topic ${i + 1}`);
    const counts = new Map<string, number>(userTopics.map((t) => [t, 0]));

    for (let i = 0; i < draws; i++) {
      for (const drawn of drawDailyTopics(userTopics, explorationPool, [])) {
        if (!drawn.isExploration) {
          counts.set(drawn.topic, counts.get(drawn.topic)! + 1);
        }
      }
    }

    const expected = 4 / n;
    for (const topic of userTopics) {
      const frequency = counts.get(topic)! / draws;
      expect(Math.abs(frequency - expected)).toBeLessThanOrEqual(0.01);
    }
  });
});
