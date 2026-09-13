export type GameLayout = {
  boardWidth: number;
  cardWidth: number;
  cardRatio: number;
  tableauGap: number;
  stackOffset: number;
  uiScale: number;
  compact: boolean;
  /** Whether the layout uses the enlarged wide-device card profile. */
  wideCardProfile: boolean;
  /** Width reserved for the compact phone-landscape control rail. */
  sideRailWidth: number;
  foldUltraWide: boolean;
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
export function getGameLayout(width: number, height: number, verticalEdgeInset = 0, forceLandscape = false, extraReservedHeight = 0, deviceModel = "", horizontalBounds?: { left: number; right: number }): GameLayout {
  const isLandscape = forceLandscape || width > height;
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  // Device models are intentionally ignored: the actual reported window size is the source of truth.
  const isFoldedCover = !isLandscape && width <= 430;
  const isFoldDevice = /^SM-F/i.test(deviceModel);
  const foldUltraWide = !isLandscape && isTablet && isFoldDevice && width >= 600;
  const isWidePortraitPhone = !isLandscape && !isTablet && width >= 350;
  const wideCardProfile = true;
  const isPhoneLandscape = isLandscape && !isTablet;
  const landscapeAspect = width / Math.max(1, height);
  // Narrow phone-landscape windows need tighter tableau overlap to keep the cards readable.
  // Wide windows preserve the more generous spacing used by the previous Fold/tablet layout.
  const phoneLandscapeOverlap = isPhoneLandscape ? clamp(landscapeAspect / 2.2, 0.78, 1) : 1;
  const sideRailWidth = isPhoneLandscape ? clamp(Math.round(width * 0.30), 190, 248) : 0;
  // Wide devices enlarge card width by 10%; the ratio compensates so total card height grows by 15%.
  const cardRatio = isLandscape ? 1.18 : CARD_RATIO;
  // Use measured score/option anchors when available; otherwise keep 10px side padding.
  const outerPadding = 10;
  const leftBound = clamp(horizontalBounds?.left ?? outerPadding, outerPadding, Math.max(outerPadding, width - outerPadding));
  const rightBound = clamp(horizontalBounds?.right ?? width - outerPadding, leftBound + 220, width - outerPadding);
  const availableWidth = Math.max(260, rightBound - leftBound - sideRailWidth);
  const tableauGap = clamp(Math.round(availableWidth * 0.012), 4, 14);
  const maxBoardWidth = availableWidth;
  const rawCardWidth = (availableWidth - tableauGap * TABLEAU_STEPS) / TABLEAU_COLUMNS;
  // Portrait card width is governed by the measured horizontal anchors. The vertical
  // stack is allowed to overlap more on wide phones/foldables instead of shrinking
  // every card and leaving unused horizontal space.
  const widthCardLimit = isLandscape ? 180 : isTablet ? 220 : 180;

  // In landscape the compact HUD, controls, and optional ad banner are reserved before
  // cards are measured. This avoids using the full physical window height beneath a
  // gesture or three-button navigation bar.
  const reservedHeight = (isPhoneLandscape ? 84 : isLandscape ? 116 : isTablet ? 250 : isFoldedCover ? 230 : 214) + extraReservedHeight;
  const usableTableauHeight = Math.max(isLandscape ? 118 : 210, height - verticalEdgeInset - reservedHeight);
  const topPilesGap = isLandscape ? 6 : 16;
  const minimumStackOffset = isPhoneLandscape ? Math.max(8, Math.round(10 * phoneLandscapeOverlap)) : isLandscape ? 8 : isFoldedCover ? 19 : 22;
  // The board contains a top-pile card, a gap, and the deepest seven-card tableau.
  const heightCardLimit = (usableTableauHeight - topPilesGap - TABLEAU_STEPS * minimumStackOffset) / (cardRatio * 2);
  // The measured width is already the final usable width; do not apply model-specific shrink factors.
  const foldableOrLandscapeReduction = 1;
  const minimumCardWidth = isLandscape ? 30 : 34;
  const horizontalCardWidth = clamp(rawCardWidth * foldableOrLandscapeReduction * (foldUltraWide ? 0.7 : 1), minimumCardWidth, widthCardLimit);
  const cardWidth = Math.floor(isLandscape ? Math.min(horizontalCardWidth, heightCardLimit) : horizontalCardWidth);
  const cardHeight = cardWidth * cardRatio;
  const availableStackOffset = (usableTableauHeight - topPilesGap - cardHeight * 2) / TABLEAU_STEPS;
  const stackOffset = Math.floor(clamp(availableStackOffset, minimumStackOffset, cardWidth * (isLandscape ? 0.62 * phoneLandscapeOverlap : 0.74)));

  return {
    boardWidth: cardWidth * TABLEAU_COLUMNS + tableauGap * TABLEAU_STEPS,
    cardWidth,
    cardRatio,
    tableauGap,
    stackOffset,
    uiScale: foldUltraWide ? 0.85 : isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width <= 430,
    wideCardProfile,
    sideRailWidth,
    foldUltraWide,
  };
}
