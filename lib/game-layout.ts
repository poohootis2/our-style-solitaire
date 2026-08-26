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

export function getGameLayout(width: number, height: number, verticalEdgeInset = 0, forceLandscape = false): GameLayout {
  const isLandscape = forceLandscape || width > height;
  const isTablet = Math.min(width, height) >= 600;
  const outerPadding = isLandscape ? 32 : isTablet ? 36 : 12;
  const tableauGap = isTablet ? 9 : isLandscape ? 7 : 3;
  const maxBoardWidth = isTablet ? 680 : isLandscape ? 720 : 560;
  const availableWidth = Math.max(260, Math.min(width - outerPadding, maxBoardWidth));
  const maxCardWidth = isTablet ? 80 : isLandscape ? (height >= 520 ? 72 : 52) : 64;
  const rawCardWidth = (availableWidth - tableauGap * 6) / 7;
  const cardWidth = Math.floor(clamp(rawCardWidth, 34, maxCardWidth));
  const boardWidth = cardWidth * 7 + tableauGap * 6;
  const verticalRoom = Math.max(isLandscape ? 145 : 156, height - verticalEdgeInset - (isTablet ? 250 : isLandscape ? 118 : 214));
  const stackOffset = Math.floor(clamp((verticalRoom - cardWidth * CARD_RATIO) / 6, isLandscape ? 13 : 24, cardWidth * 0.74));

  return {
    boardWidth,
    cardWidth,
    tableauGap,
    stackOffset,
    uiScale: isTablet ? 1.22 : width >= 420 ? 1.08 : 1,
    compact: width < 390,
  };
}
