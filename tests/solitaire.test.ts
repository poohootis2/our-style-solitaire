import { describe, expect, it } from "vitest";

import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  createNewGame,
  drawFromStock,
  findHint,
  getDifficulty,
  moveAceToFoundation,
  moveAvailableAcesToFoundation,
  moveToFoundation,
  type Card,
  type GameState,
} from "../lib/solitaire";

const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({
  id: `${suit}-${rank}`,
  rank,
  suit,
  faceUp: true,
});

const foundationGame = (waste: Card[], clubs: Card[] = []): GameState => ({
  stock: [],
  waste,
  foundations: { clubs, diamonds: [], hearts: [], spades: [] },
  tableau: [[], [], [], [], [], [], []],
  score: 0,
  moves: 0,
  level: 1,
  recycles: 0,
});

describe("클론다이크 규칙", () => {
  it("고난도 랜덤 새 게임은 52장의 카드를 정확히 배치한다", () => {
    const game = createNewGame(6);
    const totalCards = game.stock.length + game.waste.length + game.tableau.flat().length;
    expect(totalCards).toBe(52);
    expect(game.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(game.tableau.every((pile) => pile.at(-1)?.faceUp)).toBe(true);
  });

  it("타블로는 색이 다른 한 단계 낮은 카드만 받는다", () => {
    expect(canPlaceOnTableau(card(12, "hearts"), card(13, "spades"))).toBe(true);
    expect(canPlaceOnTableau(card(12, "diamonds"), card(13, "hearts"))).toBe(false);
    expect(canPlaceOnTableau(card(12, "clubs"), card(11, "hearts"))).toBe(false);
  });

  it("파운데이션은 A부터 같은 무늬 순서로 쌓는다", () => {
    expect(canPlaceOnFoundation(card(1, "clubs"), [])).toBe(true);
    expect(canPlaceOnFoundation(card(2, "clubs"), [card(1, "clubs")])).toBe(true);
    expect(canPlaceOnFoundation(card(2, "hearts"), [card(1, "clubs")])).toBe(false);
  });

  it("스톡 탭은 웨이스트에 앞면 카드를 한 장 낸다", () => {
    const game = createNewGame();
    const next = drawFromStock(game);
    expect(next.stock.length).toBe(game.stock.length - 1);
    expect(next.waste).toHaveLength(1);
    expect(next.waste[0].faceUp).toBe(true);
  });

  it("레벨 1~3은 표준 7열 보장 배치로 시작한다", () => {
    const game = createNewGame(3);
    expect(game.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(game.tableau.map((pile) => pile.at(-1)?.faceUp)).toEqual([true, true, true, true, true, true, true]);
    expect(game.tableau.flat().filter((card) => card.faceUp)).toHaveLength(7);
    expect(game.stock).toHaveLength(24);
    expect(Object.values(game.foundations).every((pile) => pile.length === 0)).toBe(true);
  });

  it("레벨 1~3은 한 장, 레벨 4~5는 두 장, 레벨 6 이상은 세 장씩 공개한다", () => {
    expect(getDifficulty(1).drawCount).toBe(1);
    expect(getDifficulty(3).drawCount).toBe(1);
    expect(getDifficulty(4).drawCount).toBe(2);
    expect(getDifficulty(5).drawCount).toBe(2);
    expect(getDifficulty(6).drawCount).toBe(3);

    const level3 = drawFromStock(createNewGame(3));
    const level4 = drawFromStock(createNewGame(4));
    const level6 = drawFromStock(createNewGame(6));
    expect(level3.waste).toHaveLength(1);
    expect(level4.waste).toHaveLength(2);
    expect(level6.waste).toHaveLength(3);
  });

  it("A는 가능한 빈 파운데이션으로 자동 이동한다", () => {
    const game = foundationGame([card(1, "hearts")]);
    const next = moveAceToFoundation(game, { kind: "waste" });
    expect(next?.foundations.hearts).toHaveLength(1);
    expect(next?.waste).toHaveLength(0);
  });

  it("같은 무늬의 다음 순서 카드는 파운데이션으로 자동 이동할 수 있다", () => {
    const game = foundationGame([card(2, "clubs")], [card(1, "clubs")]);
    const next = moveToFoundation(game, { kind: "waste" });
    expect(next?.foundations.clubs.map((item) => item.rank)).toEqual([1, 2]);
  });

  it("보이는 A는 모두 가능한 파운데이션으로 자동 배치한다", () => {
    const game = foundationGame([card(1, "hearts")]);
    game.tableau[0] = [card(1, "clubs")];
    const next = moveAvailableAcesToFoundation(game);
    expect(next.foundations.hearts).toHaveLength(1);
    expect(next.foundations.clubs).toHaveLength(1);
  });

  it("힌트는 가능한 파운데이션 이동을 우선 안내한다", () => {
    const game = foundationGame([card(1, "hearts")]);
    expect(findHint(game)).toMatchObject({ action: "foundation", source: { kind: "waste" } });
  });

  it("힌트는 이동이 없을 때 스톡 드로우를 안내한다", () => {
    const game = foundationGame([]);
    game.stock = [card(9, "spades")];
    expect(findHint(game)).toMatchObject({ action: "draw" });
  });
});
