export type GameLayout = {
  boardWidth: number;
  cardWidth: number;
  tableauGap: number;
  stackOffset: number;
  uiScale: number;
  compact: boolean;
};

const CARD_RATIO = 1.42;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getGameLayout(width: number, height: number, verticalEdgeInset = 0): GameLayout {
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;
  const outerPadding = isLandscape ? 32 : isTablet ? 36 : 24;
  const tableauGap = isTablet ? 9 : 6;
  const maxBoardWidth = isTablet ? 680 : isLandscape ? 720 : 560;
  const availableWidth = Math.max(260, Math.min(width - outerPadding, maxBoardWidth));
  const maxCardWidth = isTablet ? 80 : isLandscape ? 48 : 58;
  const rawCardWidth = (availableWidth - tableauGap * 6) / 7;
  const cardWidth = Math.floor(clamp(rawCardWidth, 34, maxCardWidth));
  const boardWidth = cardWidth * 7 + tableauGap * 6;
  const verticalRoom = Math.max(isLandscape ? 132 : 156, height - verticalEdgeInset - (isTablet ? 250 : isLandscape ? 136 : 214));
  const stackOffset = Math.floor(clamp((verticalRoom - cardWidth * CARD_RATIO) / 6, isLandscape ? 12 : 21, cardWidth * 0.62));

  return {
    boardWidth,
    cardWidth,
    tableauGap,
    stackOffset,
    uiScale: isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width < 390,
  };
}
