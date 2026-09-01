export function getAttackTravelY(screenHeight: number, startBottom: number, cardHeight: number, targetTop: number): number {
  const startTop = screenHeight - startBottom - cardHeight;
  return -Math.max(180, Math.round(startTop - targetTop));
}
