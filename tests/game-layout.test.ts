import { describe, expect, it } from "vitest";

import { getGameLayout } from "../lib/game-layout";

describe("반응형 게임 테이블 레이아웃", () => {
  it("갤럭시 S26급 세로 화면에서 카드 열이 안전 영역 안에 들어간다", () => {
    const layout = getGameLayout(360, 780);
    expect(layout.boardWidth).toBeLessThanOrEqual(336);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(34);
  });

  it("태블릿에서는 카드와 인터페이스가 더 크게 표시된다", () => {
    const phone = getGameLayout(412, 915);
    const tablet = getGameLayout(768, 1024);
    expect(tablet.cardWidth).toBeGreaterThan(phone.cardWidth);
    expect(tablet.uiScale).toBeGreaterThan(phone.uiScale);
  });

  it("가로 화면에서도 카드 폭과 쌓임 간격을 제한한다", () => {
    const layout = getGameLayout(800, 360);
    expect(layout.cardWidth).toBeLessThanOrEqual(44);
    expect(layout.stackOffset).toBeGreaterThanOrEqual(21);
  });
});
