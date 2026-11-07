export type PlacementRect = { left: number; top: number; width: number; height: number };
export type MonsterPlacement = PlacementRect;
export type MonsterGeometry = { bounds: PlacementRect; obstacles: PlacementRect[]; baseSize: number };

export function buildMonsterGeometry(root: PlacementRect, uiRects: PlacementRect[], tableau: PlacementRect, occupiedHeight: number, controls: PlacementRect, baseSize: number, topInset: number): MonsterGeometry {
  const local = (rect: PlacementRect): PlacementRect => ({ ...rect, left: rect.left - root.left, top: rect.top - root.top });
  const top = Math.max(8, topInset - 24);
  const bottom = Math.min(root.height - 8, controls.top - root.top - 8);
  return {
    bounds: { left: 8, top, width: root.width - 16, height: Math.max(0, bottom - top) },
    obstacles: [...uiRects.map(local), { ...local(tableau), height: occupiedHeight }],
    baseSize,
  };
}

export function rectsOverlap(a: PlacementRect, b: PlacementRect, padding = 0): boolean {
  return a.left < b.left + b.width + padding && a.left + a.width > b.left - padding
    && a.top < b.top + b.height + padding && a.top + a.height > b.top - padding;
}

export function isMonsterPlacementSafe(frame: MonsterPlacement, geometry: MonsterGeometry): boolean {
  const b = geometry.bounds;
  return [frame.left, frame.top, frame.width, frame.height].every(Number.isFinite)
    && frame.width > 0 && frame.height > 0
    && frame.left >= b.left && frame.top >= b.top
    && frame.left + frame.width <= b.left + b.width + 0.001
    && frame.top + frame.height <= b.top + b.height + 0.001
    && !geometry.obstacles.some((obstacle) => rectsOverlap(frame, obstacle, 8));
}

export function monsterTargetFromPlacement(frame: MonsterPlacement) {
  return { centerX: frame.left + frame.width / 2, centerY: frame.top + frame.height / 2, width: frame.width, height: frame.height };
}

// Search the whole root canvas, not the tiny name/HP panel. Each row is split
// into free horizontal spans so a narrow safe area is not missed by 32 guesses.
export function chooseMonsterPlacement(geometry: MonsterGeometry, previous: MonsterPlacement | null = null, random = Math.random): MonsterPlacement | null {
  const { bounds: b, baseSize, obstacles } = geometry;
  if (b.width <= 0 || b.height <= 0 || baseSize <= 0) return null;
  const candidates: MonsterPlacement[] = [];
  const bottom = b.top + b.height;
  const rows = new Set<number>([b.top]);
  const step = Math.max(6, Math.min(14, baseSize / 4));
  for (let y = b.top; y <= bottom - baseSize; y += step) rows.add(y);
  for (const o of obstacles) rows.add(o.top + o.height + 8);
  for (const top of rows) {
    if (top < b.top || top + baseSize > bottom) continue;
    const depth = Math.max(0, Math.min(1, (top - b.top) / Math.max(1, b.height - baseSize)));
    // Same perspective in both modes: small at the top, up to 250% at the pet.
    const preferredSize = baseSize * (1 + depth * 1.5);
    for (const size of [preferredSize, baseSize]) {
      if (top + size > bottom || size > b.width) continue;
      let spans: [number, number][] = [[b.left, b.left + b.width - size]];
      for (const o of obstacles) {
        if (top >= o.top + o.height + 8 || top + size <= o.top - 8) continue;
        const forbiddenLeft = o.left - size - 8;
        const forbiddenRight = o.left + o.width + 8;
        spans = spans.flatMap(([left, right]) => {
          if (forbiddenRight <= left || forbiddenLeft >= right) return [[left, right]] as [number, number][];
          const result: [number, number][] = [];
          if (forbiddenLeft >= left) result.push([left, Math.min(right, forbiddenLeft)]);
          if (forbiddenRight <= right) result.push([Math.max(left, forbiddenRight), right]);
          return result;
        });
      }
      for (const [left, right] of spans) {
        for (const x of [left, right, left + Math.max(0, Math.min(0.999999, random())) * (right - left)]) {
          const frame = { left: x, top, width: size, height: size };
          if (isMonsterPlacementSafe(frame, geometry)) candidates.push(frame);
        }
      }
      // Prefer the perspective size wherever it fits this row.
      if (candidates.some((c) => c.top === top)) break;
    }
  }
  if (!candidates.length) return previous && isMonsterPlacementSafe(previous, geometry) ? previous : null;
  const distant = previous ? candidates.filter((c) => Math.hypot(c.left + c.width / 2 - previous.left - previous.width / 2, c.top + c.height / 2 - previous.top - previous.height / 2) >= baseSize) : candidates;
  const pool = distant.length ? distant : candidates;
  return pool[Math.floor(Math.max(0, Math.min(0.999999, random())) * pool.length)];
}
