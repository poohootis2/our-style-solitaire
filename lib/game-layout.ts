export type GameLayout = {
  boardWidth: number;
  cardWidth: number;
  tableauGap: number;
  stackOffset: number;
  uiScale: number;
  compact: boolean;
};

const CARD_RATIO = 1.42;
const TABLEAU_COLUMNS = 7;
const TABLEAU_STEPS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates a board that fits both narrow cover screens and tall foldable inner screens.
 * The vertical constraint is important because a seven-card tableau must remain visible
 * above the bottom controls instead of being clipped by the screen edge.
 */
export function getGameLayout(width: number, height: number, verticalEdgeInset = 0, forceLandscape = false): GameLayout {
  const isLandscape = forceLandscape || width > height;
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  const isFoldedCover = !isLandscape && width < 390;
  const outerPadding = isLandscape ? 24 : isTablet ? 30 : isFoldedCover ? 8 : 12;
  const tableauGap = isTablet ? 8 : isLandscape ? 6 : isFoldedCover ? 2 : 4;
  const maxBoardWidth = isTablet ? 680 : isLandscape ? 720 : 560;
  const availableWidth = Math.max(260, Math.min(width - outerPadding * 2, maxBoardWidth));
  const rawCardWidth = (availableWidth - tableauGap * TABLEAU_STEPS) / TABLEAU_COLUMNS;
  const widthCardLimit = isTablet ? 80 : isLandscape ? (height >= 520 ? 72 : 52) : isFoldedCover ? 56 : 68;

  // Reserve space for the header, stats, top piles, and bottom action controls.
  // The remaining height must contain the complete deepest tableau column.
  const reservedHeight = isLandscape ? 142 : isTablet ? 250 : isFoldedCover ? 230 : 214;
  const usableTableauHeight = Math.max(210, height - verticalEdgeInset - reservedHeight);
  const heightCardLimit = usableTableauHeight / (CARD_RATIO + TABLEAU_STEPS * 0.62);
  const cardWidth = Math.floor(clamp(Math.min(rawCardWidth, widthCardLimit, heightCardLimit), 34, widthCardLimit));
  const cardHeight = cardWidth * CARD_RATIO;
  const availableStackOffset = (usableTableauHeight - cardHeight) / TABLEAU_STEPS;
  const minimumStackOffset = isFoldedCover ? 19 : isLandscape ? 13 : 22;
  const stackOffset = Math.floor(clamp(availableStackOffset, minimumStackOffset, cardWidth * 0.74));

  return {
    boardWidth: cardWidth * TABLEAU_COLUMNS + tableauGap * TABLEAU_STEPS,
    cardWidth,
    tableauGap,
    stackOffset,
    uiScale: isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width < 390,
  };
}
