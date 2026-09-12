import { describe, expect, it } from "vitest";

import { getGameLayout } from "../lib/game-layout";
import { getAttackTravelY } from "../lib/attack-layout";

describe("반응형 게임 테이블 레이아웃", () => {
  it("공격 카드가 캐릭터 시작점에서 몬스터 하단까지 이동할 거리를 계산한다", () => {
    expect(getAttackTravelY(800, 116, 70, 150)).toBe(-464);
    expect(getAttackTravelY(800, 640, 70, 150)).toBe(-180);
    expect(getAttackTravelY(800, 116, 70, 150, 1.2)).toBe(-557);
  });

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

  it("모바일 가로 화면은 좌측 레일을 제외한 영역에서 카드를 더 크게 표시한다", () => {
    const layout = getGameLayout(800, 360);
    expect(layout.sideRailWidth).toBeGreaterThan(0);
    expect(layout.cardWidth).toBeGreaterThan(64);
    expect(layout.cardWidth).toBeGreaterThan(64);
    expect(layout.boardWidth).toBeLessThanOrEqual(540);
    expect(layout.stackOffset).toBeGreaterThanOrEqual(10);
  });

  it("태블릿 가로 화면은 모바일 전용 좌측 레일을 사용하지 않는다", () => {
    const layout = getGameLayout(1024, 768);
    expect(layout.sideRailWidth).toBe(0);
    expect(layout.cardWidth).toBeGreaterThan(80);
  });

  it("가로 화면에서 상단 배너와 하단 조작부를 남겨도 가장 아래 카드가 안전 영역 안에 들어간다", () => {
    const safeHeight = 427;
    const reservedSystemAndRootPadding = 60;
    const headerBannerAllowance = 18;
    const layout = getGameLayout(768, safeHeight, reservedSystemAndRootPadding, true, headerBannerAllowance);
    const cardHeight = layout.cardWidth * layout.cardRatio;
    const boardHeight = cardHeight + 6 + cardHeight + layout.stackOffset * 6;
    expect(boardHeight).toBeLessThanOrEqual(safeHeight - reservedSystemAndRootPadding - 84 - headerBannerAllowance);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(30);
  });

  it("짧은 일반 휴대폰 가로 화면에서도 배너·홈바 여백을 제외한 보드 높이를 넘지 않는다", () => {
    const screenHeight = 360;
    const rootAndHomeBarPadding = 60;
    const headerBannerAllowance = 18;
    const layout = getGameLayout(800, screenHeight, rootAndHomeBarPadding, true, headerBannerAllowance);
    const cardHeight = layout.cardWidth * layout.cardRatio;
    const boardHeight = cardHeight + 6 + cardHeight + layout.stackOffset * 6;
    expect(boardHeight).toBeLessThanOrEqual(screenHeight - rootAndHomeBarPadding - 84 - headerBannerAllowance);
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

  it("갤럭시 폴드 초광폭 화면만 카드·UI 축소 프로필을 사용한다", () => {
    const fold = getGameLayout(768, 1812, 52, false, 0, "SM-F936N", { left: 10, right: 758 });
    const tablet = getGameLayout(768, 1812, 52, false, 0, "iPad13,4", { left: 10, right: 758 });
    expect(fold.foldUltraWide).toBe(true);
    expect(tablet.foldUltraWide).toBe(false);
    expect(fold.cardWidth).toBeLessThan(tablet.cardWidth);
    expect(fold.uiScale).toBeLessThan(tablet.uiScale);
  });

  it("측정된 점수-옵션 기준점 사이 폭을 세로 화면 카드 7열에 우선 배분한다", () => {
    const layout = getGameLayout(768, 1812, 52, false, 0, "", { left: 10, right: 758 });
    expect(layout.cardWidth).toBeGreaterThanOrEqual(99);
    expect(layout.boardWidth).toBeLessThanOrEqual(748);
    expect(layout.boardWidth).toBeGreaterThan(700);
  });

  it.each([
    { name: "일반 태블릿 세로", width: 600, height: 1024, inset: 52, landscape: false, maxBoard: 580 },
    { name: "Fold 펼침 세로", width: 768, height: 1812, inset: 52, landscape: false, maxBoard: 748 },
    { name: "태블릿 가로", width: 1024, height: 768, inset: 52, landscape: true, maxBoard: 1004 },
    { name: "일반 휴대폰 가로", width: 800, height: 360, inset: 60, landscape: true, maxBoard: 540 },
  ])("$name에서도 카드 보드가 사용 가능한 가로폭 안에 들어간다", ({ width, height, inset, landscape, maxBoard }) => {
    const layout = getGameLayout(width, height, inset, landscape);
    expect(layout.boardWidth).toBeLessThanOrEqual(maxBoard);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(landscape ? 30 : 34);
    expect(layout.boardWidth).toBeGreaterThan(layout.cardWidth * 6);
  });
});
