import { describe, expect, it } from "vitest";

import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  createNewGame,
  drawFromStock,
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
  it("새 게임은 52장의 카드를 정확히 배치한다", () => {
    const game = createNewGame();
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

  it("레벨 2부터는 스톡에서 세 장씩 공개되어 난이도가 올라간다", () => {
    const game = createNewGame(2);
    const next = drawFromStock(game);
    expect(next.waste).toHaveLength(3);
    expect(getDifficulty(2).drawCount).toBe(3);
    expect(getDifficulty(4).maxRecycles).toBe(2);
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
});
