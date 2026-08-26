import { describe, expect, it } from "vitest";

import { getCardBackTheme } from "../lib/card-back-theme";

describe("스테이지 카드 뒷면 테마", () => {
  it("레벨이 바뀌면 다음 카드 뒷면 테마를 제공한다", () => {
    expect(getCardBackTheme(1).name).not.toBe(getCardBackTheme(2).name);
  });

  it("테마는 여섯 레벨마다 순환한다", () => {
    expect(getCardBackTheme(1)).toEqual(getCardBackTheme(7));
  });
});
