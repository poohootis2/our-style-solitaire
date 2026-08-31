import { describe, expect, it } from "vitest";

import { getGameLayout } from "../lib/game-layout";

describe("반응형 게임 테이블 레이아웃", () => {
  it("갤럭시 S26급 세로 화면에서 카드 열이 안전 영역 안에 들어간다", () => {
    const layout = getGameLayout(360, 780);
    expect(layout.boardWidth).toBeLessThanOrEqual(348);
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
    expect(layout.cardWidth).toBeLessThanOrEqual(64);
    expect(layout.boardWidth).toBeLessThanOrEqual(720);
    expect(layout.stackOffset).toBeGreaterThanOrEqual(8);
  });

  it("가로 화면에서 상단 배너와 하단 조작부를 남겨도 가장 아래 카드가 안전 영역 안에 들어간다", () => {
    const safeHeight = 427;
    const reservedSystemAndRootPadding = 60;
    const headerBannerAllowance = 18;
    const layout = getGameLayout(768, safeHeight, reservedSystemAndRootPadding, true, headerBannerAllowance);
    const cardHeight = layout.cardWidth * layout.cardRatio;
    const boardHeight = cardHeight + 6 + cardHeight + layout.stackOffset * 6;
    expect(boardHeight).toBeLessThanOrEqual(safeHeight - reservedSystemAndRootPadding - 116 - headerBannerAllowance);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(30);
  });

  it("짧은 일반 휴대폰 가로 화면에서도 배너·홈바 여백을 제외한 보드 높이를 넘지 않는다", () => {
    const screenHeight = 360;
    const rootAndHomeBarPadding = 60;
    const headerBannerAllowance = 18;
    const layout = getGameLayout(800, screenHeight, rootAndHomeBarPadding, true, headerBannerAllowance);
    const cardHeight = layout.cardWidth * layout.cardRatio;
    const boardHeight = cardHeight + 6 + cardHeight + layout.stackOffset * 6;
    expect(boardHeight).toBeLessThanOrEqual(screenHeight - rootAndHomeBarPadding - 116 - headerBannerAllowance);
  });

  it("세로 화면에서 하단 배너와 조작부를 함께 남겨도 마지막 카드가 안전 영역 안에 들어간다", () => {
    const screenHeight = 780;
    const rootPadding = 166;
    const portraitBannerAllowance = 58;
    const layout = getGameLayout(360, screenHeight, rootPadding, false, portraitBannerAllowance);
    const cardHeight = layout.cardWidth * layout.cardRatio;
    const boardHeight = cardHeight + 16 + cardHeight + layout.stackOffset * 6;
    expect(boardHeight).toBeLessThanOrEqual(screenHeight - rootPadding - 214 - portraitBannerAllowance);
  });

  it("상하 안전 여백을 적용해도 카드 쌓임 간격이 사용 가능한 범위에 머문다", () => {
    const layout = getGameLayout(360, 780, 104);
    expect(layout.stackOffset).toBeGreaterThanOrEqual(21);
    expect(layout.stackOffset).toBeLessThanOrEqual(layout.cardWidth * 0.74);
  });

  it("Fold4 접은 전면 화면에서는 7열 보드가 좌우를 넘지 않는다", () => {
    const layout = getGameLayout(360, 748, 52);
    expect(layout.boardWidth).toBeLessThanOrEqual(344);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(34);
  });

  it("Fold4 펼친 내부 화면에서는 가장 깊은 tableau도 하단을 넘지 않는다", () => {
    const layout = getGameLayout(768, 1812, 52);
    const deepestColumnHeight = layout.cardWidth * 1.42 + layout.stackOffset * 6;
    expect(deepestColumnHeight).toBeLessThanOrEqual(1812 - 52 - 250);
  });
});
