import { describe, expect, it } from "vitest";

import { getChapterForStage, isChapterBossStage } from "../lib/solitaire";
import { getCompanionAttackStyle, getPetAttackStyle } from "../lib/companion-attack";

describe("스테이지 전투 콘텐츠 규칙", () => {
  it("스테이지가 네 챕터 범위로 이어진다", () => {
    expect([1, 3].map(getChapterForStage)).toEqual([1, 1]);
    expect([4, 6].map(getChapterForStage)).toEqual([2, 2]);
    expect([7, 10].map(getChapterForStage)).toEqual([3, 3]);
    expect(getChapterForStage(11)).toBe(4);
  });

  it("챕터가 바뀌는 스테이지에서만 보스 플래그가 켜진다", () => {
    expect([4, 7, 11].every(isChapterBossStage)).toBe(true);
    expect([1, 2, 3, 5, 6, 8, 10, 12].some(isChapterBossStage)).toBe(false);
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
