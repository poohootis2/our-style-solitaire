export type GameLayout = {
  boardWidth: number;
  cardWidth: number;
  cardRatio: number;
  tableauGap: number;
  stackOffset: number;
  uiScale: number;
  compact: boolean;
  /** Width reserved for the compact phone-landscape control rail. */
  sideRailWidth: number;
};

const CARD_RATIO = 1.42;
const TABLEAU_COLUMNS = 7;
const TABLEAU_STEPS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates a board that fits both narrow cover screens and tall foldable inner screens.
 * The vertical constraint includes the top piles plus the deepest tableau column, so the
 * final card always remains above the Android system navigation area and action controls.
 */
export function getGameLayout(width: number, height: number, verticalEdgeInset = 0, forceLandscape = false, extraReservedHeight = 0): GameLayout {
  const isLandscape = forceLandscape || width > height;
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  const isFoldedCover = !isLandscape && width <= 430;
  const isPhoneLandscape = isLandscape && !isTablet;
  const sideRailWidth = isPhoneLandscape ? clamp(Math.round(width * 0.30), 190, 248) : 0;
  const cardRatio = isLandscape ? 1.18 : CARD_RATIO;
  const outerPadding = isPhoneLandscape ? 8 : isLandscape ? 24 : isTablet ? 30 : isFoldedCover ? 8 : 12;
  const tableauGap = isTablet ? 8 : isLandscape ? 6 : isFoldedCover ? 2 : 4;
  const maxBoardWidth = isPhoneLandscape ? Math.max(320, width - sideRailWidth - outerPadding * 2 - 8) : isTablet ? 680 : isLandscape ? 720 : 560;
  const availableWidth = Math.max(260, Math.min(width - outerPadding * 2 - sideRailWidth, maxBoardWidth));
  const rawCardWidth = (availableWidth - tableauGap * TABLEAU_STEPS) / TABLEAU_COLUMNS;
  const widthCardLimit = isPhoneLandscape ? 84 : isLandscape ? (height >= 520 ? 80 : 64) : isTablet ? 80 : isFoldedCover ? 56 : 68;

  // In landscape the compact HUD, controls, and optional ad banner are reserved before
  // cards are measured. This avoids using the full physical window height beneath a
  // gesture or three-button navigation bar.
  const reservedHeight = (isPhoneLandscape ? 84 : isLandscape ? 116 : isTablet ? 250 : isFoldedCover ? 230 : 214) + extraReservedHeight;
  const usableTableauHeight = Math.max(isLandscape ? 118 : 210, height - verticalEdgeInset - reservedHeight);
  const topPilesGap = isLandscape ? 6 : 16;
  const minimumStackOffset = isPhoneLandscape ? 10 : isLandscape ? 8 : isFoldedCover ? 19 : 22;
  // The board contains a top-pile card, a gap, and the deepest seven-card tableau.
  const heightCardLimit = (usableTableauHeight - topPilesGap - TABLEAU_STEPS * minimumStackOffset) / (cardRatio * 2);
  const foldableOrLandscapeReduction = isPhoneLandscape ? 1 : isLandscape || (isTablet && !isFoldedCover) ? 0.9 : 1;
  const minimumCardWidth = isLandscape ? 30 : 34;
  const cardWidth = Math.floor(clamp(Math.min(rawCardWidth, widthCardLimit, heightCardLimit) * foldableOrLandscapeReduction, minimumCardWidth, widthCardLimit));
  const cardHeight = cardWidth * cardRatio;
  const availableStackOffset = (usableTableauHeight - topPilesGap - cardHeight * 2) / TABLEAU_STEPS;
  const stackOffset = Math.floor(clamp(availableStackOffset, minimumStackOffset, cardWidth * (isLandscape ? 0.62 : 0.74)));

  return {
    boardWidth: cardWidth * TABLEAU_COLUMNS + tableauGap * TABLEAU_STEPS,
    cardWidth,
    cardRatio,
    tableauGap,
    stackOffset,
    uiScale: isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width <= 430,
    sideRailWidth,
  };
}
