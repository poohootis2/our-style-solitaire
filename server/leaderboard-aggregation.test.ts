import { describe, expect, it } from "vitest";
import { aggregateOverallLeaderboardRows, type LeaderboardAggregateRow } from "./leaderboard-aggregation";

const row = (overrides: Partial<LeaderboardAggregateRow>): LeaderboardAggregateRow => ({
  id: 1,
  userId: 1,
  mode: "unlimited",
  score: 0,
  timeSeconds: null,
  stage: 1,
  name: "Player",
  countryCode: "KR",
  ...overrides,
});

describe("aggregateOverallLeaderboardRows", () => {
  it("adds every submitted stage for each user and returns one ordered row per user", () => {
    const result = aggregateOverallLeaderboardRows([
      row({ id: 1, userId: 10, score: 120, stage: 1, timeSeconds: 90, name: "A" }),
      row({ id: 2, userId: 10, score: 200, stage: 2, timeSeconds: 82, name: "A" }),
      row({ id: 3, userId: 20, score: 310, stage: 1, timeSeconds: 94, name: "B" }),
    ], [], "unlimited");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ userId: 10, score: 320, stage: 2, timeSeconds: 82 });
    expect(result[1]).toMatchObject({ userId: 20, score: 310, stage: 1 });
  });

  it("keeps legacy-only users and never lowers a partially migrated user's total", () => {
    const result = aggregateOverallLeaderboardRows([
      row({ id: 1, userId: 10, score: 120, stage: 1, name: "A" }),
    ], [
      row({ id: 2, userId: 10, score: 500, stage: 4, timeSeconds: 100, name: "A" }),
      row({ id: 3, userId: 20, score: 300, stage: 3, timeSeconds: 110, name: "Legacy" }),
    ], "unlimited");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ userId: 10, score: 500, stage: 4 });
    expect(result[1]).toMatchObject({ userId: 20, score: 300, stage: 3 });
  });

  it("ranks time attack by highest stage before aggregate score", () => {
    const result = aggregateOverallLeaderboardRows([
      row({ id: 1, userId: 10, mode: "timeAttack", score: 500, stage: 3, timeSeconds: 105 }),
      row({ id: 2, userId: 20, mode: "timeAttack", score: 900, stage: 2, timeSeconds: 80 }),
    ], [], "timeAttack");

    expect(result.map((entry) => entry.userId)).toEqual([10, 20]);
  });
});
