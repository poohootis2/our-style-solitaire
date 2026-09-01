export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
};

export type FoundationMap = Record<Suit, Card[]>;

export type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: FoundationMap;
  tableau: Card[][];
  score: number;
  moves: number;
  level: number;
  recycles: number;
};

export type CardSource =
  | { kind: "tableau"; column: number; index: number }
  | { kind: "waste" }
  | { kind: "foundation"; suit: Suit };

export type Hint = {
  message: string;
  source?: CardSource;
  targetColumn?: number;
  action: "foundation" | "tableau" | "flip" | "draw";
};

export const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

export const suitSymbols: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export const suitNames: Record<Suit, string> = {
  clubs: "클럽",
  diamonds: "다이아몬드",
  hearts: "하트",
  spades: "스페이드",
};

export const rankLabels: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

export type Difficulty = { drawCount: number; maxRecycles: number; label: string };

/**
 * The stored `level` field represents the current stage for backward compatibility.
 * This helper exposes the player's four visual chapters without changing saved-game shape.
 * Stage 6 belongs to chapter 2; chapter 3 therefore starts at stage 7 to avoid overlap.
 */
export function getChapterForStage(stage: number): number {
  if (stage <= 3) return 1;
  if (stage <= 6) return 2;
  if (stage <= 10) return 3;
  return 4;
}

export function isChapterBossStage(stage: number): boolean {
  return stage === 4 || stage === 7 || stage === 11;
}

export function getDifficulty(level: number): Difficulty {
  if (level <= 3) return { drawCount: 1, maxRecycles: Number.POSITIVE_INFINITY, label: level === 1 ? "입문" : "도전" };
  if (level <= 5) return { drawCount: 2, maxRecycles: Math.max(1, 6 - level), label: "전문가" };
  return {
    drawCount: 3,
    maxRecycles: Math.max(0, 6 - Math.min(level, 6)),
    label: "마스터",
  };
}

function makeDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, offset) => ({
      id: `${suit}-${offset + 1}`,
      suit,
      rank: (offset + 1) as Rank,
      faceUp: false,
    })),
  );
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function emptyFoundations(): FoundationMap {
  return { clubs: [], diamonds: [], hearts: [], spades: [] };
}

function cloneGame(game: GameState): GameState {
  return {
    stock: [...game.stock],
    waste: [...game.waste],
    foundations: {
      clubs: [...game.foundations.clubs],
      diamonds: [...game.foundations.diamonds],
      hearts: [...game.foundations.hearts],
      spades: [...game.foundations.spades],
    },
    tableau: game.tableau.map((pile) => [...pile]),
    score: game.score,
    moves: game.moves,
    level: game.level ?? 1,
    recycles: game.recycles ?? 0,
  };
}

export function cloneGameState(game: GameState): GameState {
  return cloneGame(game);
}

function withMove(game: GameState, scoreDelta = 0): GameState {
  return { ...game, moves: game.moves + 1, score: Math.max(0, game.score + scoreDelta) };
}

export function createNewGame(level = 1): GameState {
  // Every level starts from a fresh Fisher–Yates shuffle. Difficulty changes
  // only the stock draw rule, never the card order, so low levels do not reveal
  // predictable A-2-3-4 sequences.
  const deck = shuffle(makeDeck());
  const tableau: Card[][] = [];
  let deckIndex = 0;

  for (let column = 0; column < 7; column += 1) {
    const pile = deck.slice(deckIndex, deckIndex + column + 1).map((card, index) => ({
      ...card,
      faceUp: index === column,
    }));
    tableau.push(pile);
    deckIndex += column + 1;
  }

  return {
    stock: deck.slice(deckIndex).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: emptyFoundations(),
    tableau,
    score: 0,
    moves: 0,
    level,
    recycles: 0,
  };
}

export function isRed(card: Card): boolean {
  return card.suit === "diamonds" || card.suit === "hearts";
}

export function canPlaceOnTableau(card: Card, destination: Card | undefined): boolean {
  if (!destination) return card.rank === 13;
  return destination.faceUp && isRed(card) !== isRed(destination) && card.rank === destination.rank - 1;
}

export function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  const topCard = foundation.at(-1);
  if (!topCard) return card.rank === 1;
  return topCard.suit === card.suit && card.rank === topCard.rank + 1;
}

export function drawFromStock(game: GameState): GameState {
  const next = cloneGame(game);
  const difficulty = getDifficulty(next.level);
  if (next.stock.length === 0) {
    if (next.waste.length === 0) return game;
    if (next.recycles >= difficulty.maxRecycles) return game;
    next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    next.waste = [];
    next.recycles += 1;
    return withMove(next);
  }

  for (let count = 0; count < difficulty.drawCount; count += 1) {
    const drawn = next.stock.pop();
    if (!drawn) break;
    next.waste.push({ ...drawn, faceUp: true });
  }
  return withMove(next);
}

export function flipTableauCard(game: GameState, column: number): GameState | null {
  const pile = game.tableau[column];
  const topCard = pile?.at(-1);
  if (!topCard || topCard.faceUp) return null;

  const next = cloneGame(game);
  next.tableau[column][next.tableau[column].length - 1] = { ...topCard, faceUp: true };
  return withMove(next, 5);
}

export function moveTableauToTableau(
  game: GameState,
  fromColumn: number,
  fromIndex: number,
  toColumn: number,
): GameState | null {
  if (fromColumn === toColumn) return null;
  const sourcePile = game.tableau[fromColumn];
  const targetPile = game.tableau[toColumn];
  const moving = sourcePile?.slice(fromIndex);
  const firstCard = moving?.[0];
  if (!firstCard || !firstCard.faceUp || moving.some((card) => !card.faceUp)) return null;
  if (!canPlaceOnTableau(firstCard, targetPile?.at(-1))) return null;

  const next = cloneGame(game);
  next.tableau[fromColumn] = next.tableau[fromColumn].slice(0, fromIndex);
  next.tableau[toColumn] = [...next.tableau[toColumn], ...moving];
  return withMove(next);
}

export function moveWasteToTableau(game: GameState, toColumn: number): GameState | null {
  const card = game.waste.at(-1);
  if (!card || !canPlaceOnTableau(card, game.tableau[toColumn]?.at(-1))) return null;
  const next = cloneGame(game);
  next.waste.pop();
  next.tableau[toColumn].push(card);
  return withMove(next, 5);
}

export function moveFoundationToTableau(game: GameState, suit: Suit, toColumn: number): GameState | null {
  const card = game.foundations[suit].at(-1);
  if (!card || !canPlaceOnTableau(card, game.tableau[toColumn]?.at(-1))) return null;
  const next = cloneGame(game);
  next.foundations[suit].pop();
  next.tableau[toColumn].push(card);
  return withMove(next, -15);
}

function cardFromSource(game: GameState, source: CardSource): Card | undefined {
  if (source.kind === "waste") return game.waste.at(-1);
  if (source.kind === "foundation") return game.foundations[source.suit].at(-1);
  const pile = game.tableau[source.column];
  if (source.index !== pile.length - 1) return undefined;
  return pile[source.index];
}

export function moveToFoundation(game: GameState, source: CardSource): GameState | null {
  const card = cardFromSource(game, source);
  if (!card || !canPlaceOnFoundation(card, game.foundations[card.suit])) return null;

  const next = cloneGame(game);
  if (source.kind === "waste") next.waste.pop();
  if (source.kind === "foundation") return null;
  if (source.kind === "tableau") next.tableau[source.column].pop();
  next.foundations[card.suit].push(card);
  return withMove(next, 10);
}

export function moveAceToFoundation(game: GameState, source: CardSource): GameState | null {
  const card = cardFromSource(game, source);
  if (!card || card.rank !== 1) return null;
  return moveToFoundation(game, source);
}

export function moveAvailableAcesToFoundation(game: GameState): GameState {
  let next = game;
  let moved = true;
  while (moved) {
    moved = false;
    const wasteMove = moveAceToFoundation(next, { kind: "waste" });
    if (wasteMove) {
      next = wasteMove;
      moved = true;
      continue;
    }
    for (let column = 0; column < next.tableau.length; column += 1) {
      const pile = next.tableau[column];
      const topCard = pile.at(-1);
      if (topCard?.rank !== 1) continue;
      const tableauMove = moveAceToFoundation(next, { kind: "tableau", column, index: pile.length - 1 });
      if (tableauMove) {
        next = tableauMove;
        moved = true;
        break;
      }
    }
  }
  return next;
}

export function createPlayableGame(level = 1): GameState {
  // Keep all four foundations empty at the start. Aces can still be moved
  // automatically when they are drawn or when the player requests it.
  return createNewGame(level);
}

export function autoComplete(game: GameState): GameState {
  let next = game;
  let moved = true;
  while (moved) {
    moved = false;
    const wasteMove = moveToFoundation(next, { kind: "waste" });
    if (wasteMove) {
      next = wasteMove;
      moved = true;
      continue;
    }
    for (let column = 0; column < next.tableau.length; column += 1) {
      const pile = next.tableau[column];
      if (!pile.at(-1)?.faceUp) continue;
      const tableauMove = moveToFoundation(next, { kind: "tableau", column, index: pile.length - 1 });
      if (tableauMove) {
        next = tableauMove;
        moved = true;
        break;
      }
    }
  }
  return next;
}

export type AutoFoundationMove = { source: CardSource; card: Card };

/** Returns the next legal top-card move to a foundation, if one exists. */
export function findAutoFoundationMove(game: GameState): AutoFoundationMove | null {
  const wasteCard = game.waste.at(-1);
  if (wasteCard && canPlaceOnFoundation(wasteCard, game.foundations[wasteCard.suit])) {
    return { source: { kind: "waste" }, card: wasteCard };
  }
  for (let column = 0; column < game.tableau.length; column += 1) {
    const pile = game.tableau[column];
    const card = pile.at(-1);
    if (card && card.faceUp && canPlaceOnFoundation(card, game.foundations[card.suit])) {
      return { source: { kind: "tableau", column, index: pile.length - 1 }, card };
    }
  }
  return null;
}

/**
 * Late-game auto-finish is conservative: the stock is empty, every tableau
 * card is revealed, and at least one top-card foundation move is legal.
 */
export function isLateGameAutoFinishReady(game: GameState): boolean {
  return game.stock.length === 0 && game.tableau.every((pile) => pile.every((card) => card.faceUp)) && findAutoFoundationMove(game) !== null;
}

export function findHint(game: GameState): Hint | null {
  const wasteCard = game.waste.at(-1);
  if (wasteCard && canPlaceOnFoundation(wasteCard, game.foundations[wasteCard.suit])) {
    return { action: "foundation", message: `${rankLabels[wasteCard.rank]}${suitSymbols[wasteCard.suit]}를 파운데이션으로 옮기세요.`, source: { kind: "waste" } };
  }

  for (let column = 0; column < game.tableau.length; column += 1) {
    const pile = game.tableau[column];
    const top = pile.at(-1);
    if (!top) continue;
    if (!top.faceUp) return { action: "flip", message: `${column + 1}번째 열의 카드를 뒤집으세요.`, source: { kind: "tableau", column, index: pile.length - 1 } };
    if (canPlaceOnFoundation(top, game.foundations[top.suit])) {
      return { action: "foundation", message: `${rankLabels[top.rank]}${suitSymbols[top.suit]}를 파운데이션으로 옮기세요.`, source: { kind: "tableau", column, index: pile.length - 1 } };
    }
  }

  for (let fromColumn = 0; fromColumn < game.tableau.length; fromColumn += 1) {
    const pile = game.tableau[fromColumn];
    for (let index = 0; index < pile.length; index += 1) {
      const movingCard = pile[index];
      if (!movingCard.faceUp) continue;
      for (let toColumn = 0; toColumn < game.tableau.length; toColumn += 1) {
        if (fromColumn === toColumn) continue;
        if (canPlaceOnTableau(movingCard, game.tableau[toColumn].at(-1))) {
          return { action: "tableau", message: `${rankLabels[movingCard.rank]}${suitSymbols[movingCard.suit]}를 ${toColumn + 1}번째 열로 옮기세요.`, source: { kind: "tableau", column: fromColumn, index }, targetColumn: toColumn };
        }
      }
    }
  }

  if (wasteCard) {
    for (let column = 0; column < game.tableau.length; column += 1) {
      if (canPlaceOnTableau(wasteCard, game.tableau[column].at(-1))) {
        return { action: "tableau", message: `웨이스트의 ${rankLabels[wasteCard.rank]}${suitSymbols[wasteCard.suit]}를 ${column + 1}번째 열로 옮기세요.`, source: { kind: "waste" }, targetColumn: column };
      }
    }
  }

  if (game.stock.length || game.waste.length) return { action: "draw", message: "스톡을 탭해 다음 카드를 확인하세요." };
  return null;
}

export function isWon(game: GameState): boolean {
  return SUITS.every((suit) => game.foundations[suit].length === 13);
}
