import { describe, expect, it } from "vitest";
import { getLastClearedStage } from "../lib/stage-access";

describe("getLastClearedStage", () => {
  it("uses the highest genuine stage record instead of an inflated next-stage browse value", () => {
    expect(getLastClearedStage({
      stageBestTimes: { "1": 90, "2": 88, "3": 86, "4": 84 },
      stageBestScores: { "1": 120, "2": 150, "3": 180, "4": 210 },
    }, 116, 115)).toBe(4);
  });

  it("falls back to the persisted next stage for legacy records without stage history", () => {
    expect(getLastClearedStage({}, 6, 115)).toBe(5);
  });

  it("rejects invalid stage keys and keeps the result inside the story range", () => {
    expect(getLastClearedStage({ stageBestTimes: { "0": 1, "5": 60, "999": 1, "x": 1 } }, 1, 115)).toBe(5);
  });
});
