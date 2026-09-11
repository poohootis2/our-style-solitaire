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
export function getGameLayout(width: number, height: number, verticalEdgeInset = 0, forceLandscape = false, extraReservedHeight = 0, deviceModel = ""): GameLayout {
  const isLandscape = forceLandscape || width > height;
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  const normalizedModel = deviceModel.toUpperCase();
  const isFold2To3Model = /SM-F916|SM-F926/.test(normalizedModel);
  const isFold4Model = /SM-F936/.test(normalizedModel);
  const isFold5PlusModel = /SM-F946|SM-F956|SM-F966|SM-F976|SM-F986/.test(normalizedModel);
  const isFoldedCover = !isLandscape && width <= 430;
  const isWidePortraitPhone = !isLandscape && !isTablet && width >= 390;
  const wideCardProfile = !isLandscape && !isFold4Model && (isWidePortraitPhone || isFold2To3Model || isFold5PlusModel);
  const isPhoneLandscape = isLandscape && !isTablet;
  const landscapeAspect = width / Math.max(1, height);
  // Narrow phone-landscape windows need tighter tableau overlap to keep the cards readable.
  // Wide windows preserve the more generous spacing used by the previous Fold/tablet layout.
  const phoneLandscapeOverlap = isPhoneLandscape ? clamp(landscapeAspect / 2.2, 0.78, 1) : 1;
  const sideRailWidth = isPhoneLandscape ? clamp(Math.round(width * 0.30), 190, 248) : 0;
  const cardRatio = isLandscape ? 1.18 : wideCardProfile ? CARD_RATIO * (1.10 / 1.15) : CARD_RATIO;
  const outerPadding = isPhoneLandscape ? 8 : isLandscape ? 24 : isTablet ? (wideCardProfile ? 16 : 30) : isWidePortraitPhone ? 4 : isFoldedCover ? 8 : 12;
  const tableauGap = isTablet ? (wideCardProfile ? 12 : 8) : isLandscape ? 6 : isWidePortraitPhone ? (wideCardProfile ? 4 : 0) : isFoldedCover ? 2 : 4;
  const maxBoardWidth = isPhoneLandscape ? Math.max(320, width - sideRailWidth - outerPadding * 2 - 8) : isTablet ? (wideCardProfile ? Math.min(width - outerPadding * 2, 820) : 680) : isLandscape ? 720 : 560;
  const availableWidth = Math.max(260, Math.min(width - outerPadding * 2 - sideRailWidth, maxBoardWidth));
  const rawCardWidth = (availableWidth - tableauGap * TABLEAU_STEPS) / TABLEAU_COLUMNS;
  const widthCardLimit = isPhoneLandscape ? 84 : isLandscape ? (height >= 520 ? 80 : 64) : isTablet ? (wideCardProfile ? 92 : 80) : isWidePortraitPhone ? (wideCardProfile ? 86 : 74) : isFoldedCover ? 56 : 68;

  // In landscape the compact HUD, controls, and optional ad banner are reserved before
  // cards are measured. This avoids using the full physical window height beneath a
  // gesture or three-button navigation bar.
  const reservedHeight = (isPhoneLandscape ? 84 : isLandscape ? 116 : isTablet ? 250 : isFoldedCover ? 230 : 214) + extraReservedHeight;
  const usableTableauHeight = Math.max(isLandscape ? 118 : 210, height - verticalEdgeInset - reservedHeight);
  const topPilesGap = isLandscape ? 6 : 16;
  const minimumStackOffset = isPhoneLandscape ? Math.max(8, Math.round(10 * phoneLandscapeOverlap)) : isLandscape ? 8 : isFoldedCover ? 19 : 22;
  // The board contains a top-pile card, a gap, and the deepest seven-card tableau.
  const heightCardLimit = (usableTableauHeight - topPilesGap - TABLEAU_STEPS * minimumStackOffset) / (cardRatio * 2);
  const baseCardReduction = isLandscape || (isTablet && !isFoldedCover) ? 0.9 : 1;
  const foldableOrLandscapeReduction = isPhoneLandscape ? 1 : wideCardProfile ? baseCardReduction * 1.15 : baseCardReduction;
  const minimumCardWidth = isLandscape ? 30 : 34;
  const cardWidth = Math.floor(clamp(Math.min(rawCardWidth, widthCardLimit, heightCardLimit) * foldableOrLandscapeReduction, minimumCardWidth, widthCardLimit));
  const cardHeight = cardWidth * cardRatio;
  const availableStackOffset = (usableTableauHeight - topPilesGap - cardHeight * 2) / TABLEAU_STEPS;
  const stackOffset = Math.floor(clamp(availableStackOffset, minimumStackOffset, cardWidth * (isLandscape ? 0.62 * phoneLandscapeOverlap : 0.74)));

  return {
    boardWidth: cardWidth * TABLEAU_COLUMNS + tableauGap * TABLEAU_STEPS,
    cardWidth,
    cardRatio,
    tableauGap,
    stackOffset,
    uiScale: isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width <= 430,
    wideCardProfile,
    sideRailWidth,
  };
}
