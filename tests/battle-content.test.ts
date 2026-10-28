import { describe, expect, it } from "vitest";

import { getChapterForStage, isChapterBossStage } from "../lib/solitaire";
import { getCompanionAttackStyle, getPetAttackStyle } from "../lib/companion-attack";
import { getPostStoryBossSlot, POST_STORY_BOSS_COUNT } from "../lib/post-story-boss";

describe("스테이지 전투 콘텐츠 규칙", () => {
  it("스테이지가 네 챕터 범위로 이어진다", () => {
    expect([1, 3].map(getChapterForStage)).toEqual([1, 1]);
    expect([4, 6].map(getChapterForStage)).toEqual([2, 2]);
    expect([7, 10].map(getChapterForStage)).toEqual([3, 3]);
    expect(getChapterForStage(11)).toBe(4);
  });

  it("일반 몬스터 14마리 후와 116 이후 순환에서 보스 플래그가 켜진다", () => {
    expect([15, 30, 45, 60, 75, 90, 105, 116, 135].every(isChapterBossStage)).toBe(true);
    expect([1, 2, 14, 16, 29, 31, 106, 115].some(isChapterBossStage)).toBe(false);
  });

  it("116부터는 15종 일반 보스와 킹 보스를 순서대로 반복한다", () => {
    const slots = Array.from({ length: POST_STORY_BOSS_COUNT }, (_, index) => getPostStoryBossSlot(116 + index));
    expect(slots.map((slot) => slot?.kind)).toEqual([
      "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss", "boss",
      "kingBoss", "kingBoss", "kingBoss", "emperor",
    ]);
    expect(slots.slice(0, 15).map((slot) => slot?.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(slots.slice(15).map((slot) => slot?.index)).toEqual([0, 1, 2, 0]);
    expect(getPostStoryBossSlot(115)).toBeNull();
    expect(getPostStoryBossSlot(135)).toEqual({ kind: "boss", index: 0 });
  });

  it("수집 펫 ID에 따라 네 가지 속성 공격 카드가 순환한다", () => {
    expect(["pet-004", "pet-005", "pet-006", "pet-007"].map(getPetAttackStyle)).toEqual(["red", "blue", "orange", "white"]);
  });

  it("동료 공격 효과는 빨강·파랑·주황·하양 4색 슬롯을 지원한다", () => {
    const asset = { attackStyle: undefined };
    expect(getCompanionAttackStyle({ ...asset, attackStyle: "red" })).toBe("red");
    expect(getCompanionAttackStyle(asset, 1)).toBe("blue");
    expect(getCompanionAttackStyle({ ...asset, attackStyle: "orange" })).toBe("orange");
    expect(getCompanionAttackStyle({ ...asset, attackStyle: "white" })).toBe("white");
  });
});
