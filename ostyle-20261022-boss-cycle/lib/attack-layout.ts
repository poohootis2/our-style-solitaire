export function getAttackTravelY(
  screenHeight: number,
  startBottom: number,
  cardHeight: number,
  targetTop: number,
  travelMultiplier = 1,
): number {
  const startTop = screenHeight - startBottom - cardHeight;
  const baseDistance = Math.max(180, Math.round(startTop - targetTop));
  return -Math.round(baseDistance * Math.max(1, travelMultiplier));
}
