import { describe, expect, it } from "vitest";
import { buildMonsterGeometry, chooseMonsterPlacement, isMonsterPlacementSafe, monsterTargetFromPlacement, type MonsterGeometry, type MonsterPlacement } from "../lib/monster-placement";

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const layouts: Record<string, MonsterGeometry> = {
  phone: { bounds: { left: 8, top: 24, width: 344, height: 690 }, baseSize: 48, obstacles: [
    { left: 10, top: 24, width: 330, height: 120 },
    { left: 14, top: 174, width: 330, height: 72 },
    { left: 14, top: 262, width: 330, height: 204 },
  ] },
  tablet: { bounds: { left: 8, top: 24, width: 784, height: 930 }, baseSize: 80, obstacles: [
    { left: 12, top: 24, width: 760, height: 160 },
    { left: 80, top: 200, width: 630, height: 115 },
    { left: 80, top: 332, width: 630, height: 272 },
  ] },
  landscape: { bounds: { left: 8, top: 8, width: 784, height: 336 }, baseSize: 46, obstacles: [
    { left: 12, top: 8, width: 180, height: 160 },
    { left: 222, top: 38, width: 550, height: 65 },
    { left: 222, top: 113, width: 550, height: 145 },
  ] },
  // Reproduces a name panel shorter and narrower than a sprite. Its size is
  // intentionally irrelevant to the full-root bounds.
  narrowPanelPhone: { bounds: { left: 8, top: 20, width: 304, height: 720 }, baseSize: 42, obstacles: [
    { left: 10, top: 20, width: 294, height: 126 },
    { left: 246, top: 100, width: 60, height: 40 },
    { left: 12, top: 166, width: 292, height: 64 },
    { left: 12, top: 246, width: 292, height: 198 },
  ] },
};

describe("full-root monster placement", () => {
  it("subtracts screen/root origin once and does not use the flex tableau height", () => {
    const g = buildMonsterGeometry(
      { left: 12, top: 48, width: 360, height: 740 },
      [{ left: 24, top: 210, width: 332, height: 74 }],
      { left: 24, top: 300, width: 332, height: 470 },
      180, { left: 12, top: 748, width: 360, height: 44 }, 48, 40,
    );
    expect(g.bounds).toEqual({ left: 8, top: 16, width: 344, height: 676 });
    expect(g.obstacles[0]).toEqual({ left: 12, top: 162, width: 332, height: 74 });
    expect(g.obstacles[1]).toEqual({ left: 12, top: 252, width: 332, height: 180 });
    const frame = chooseMonsterPlacement(g, null, seeded(73));
    expect(frame).not.toBeNull();
    expect(isMonsterPlacementSafe(frame!, g)).toBe(true);
  });
  for (const [name, geometry] of Object.entries(layouts)) {
    it(`${name}: 250 respawns stay visible, avoid all UI/cards and change location`, () => {
      const random = seeded(731);
      let previous: MonsterPlacement | null = null;
      const positions = new Set<string>();
      for (let n = 0; n < 250; n++) {
        const next = chooseMonsterPlacement(geometry, previous, random);
        expect(next, `${name}: no valid spawn at step ${n}`).not.toBeNull();
        expect(isMonsterPlacementSafe(next!, geometry)).toBe(true);
        if (previous) expect(Math.hypot(next!.left + next!.width / 2 - previous.left - previous.width / 2, next!.top + next!.height / 2 - previous.top - previous.height / 2)).toBeGreaterThanOrEqual(geometry.baseSize - 0.001);
        const target = monsterTargetFromPlacement(next!);
        expect(target.centerX).toBe(next!.left + next!.width / 2);
        expect(target.centerY).toBe(next!.top + next!.height / 2);
        positions.add(`${Math.round(next!.left)}:${Math.round(next!.top)}`);
        previous = next;
      }
      expect(positions.size).toBeGreaterThan(30);
    });
  }
  it("finds a narrow free lane instead of using a colliding fallback", () => {
    const geometry: MonsterGeometry = { bounds: { left: 0, top: 0, width: 300, height: 300 }, baseSize: 40, obstacles: [{ left: 0, top: 0, width: 300, height: 242 }] };
    const next = chooseMonsterPlacement(geometry, null, seeded(1));
    expect(next).not.toBeNull();
    expect(next!.top).toBeGreaterThanOrEqual(250);
    expect(isMonsterPlacementSafe(next!, geometry)).toBe(true);
  });
  it("does not return an unsafe name-panel fallback when the screen is genuinely full", () => {
    const geometry: MonsterGeometry = { bounds: { left: 0, top: 0, width: 200, height: 200 }, baseSize: 40, obstacles: [{ left: 0, top: 0, width: 200, height: 200 }] };
    expect(chooseMonsterPlacement(geometry, null, seeded(1))).toBeNull();
  });
  it("uses the scaled square itself for collision and projectile center", () => {
    const frame = { left: 55, top: 260, width: 120, height: 120 };
    expect(monsterTargetFromPlacement(frame)).toEqual({ centerX: 115, centerY: 320, width: 120, height: 120 });
    expect(isMonsterPlacementSafe(frame, { bounds: { left: 0, top: 0, width: 400, height: 600 }, baseSize: 48, obstacles: [{ left: 170, top: 300, width: 50, height: 70 }] })).toBe(false);
  });
  it("relocates after the card stack grows into the current position", () => {
    const g = layouts.phone;
    const current = { left: 100, top: 490, width: 90, height: 90 };
    const changed = { ...g, obstacles: [...g.obstacles, { left: 14, top: 262, width: 330, height: 328 }] };
    const next = chooseMonsterPlacement(changed, current, seeded(18));
    expect(next).not.toBeNull();
    expect(isMonsterPlacementSafe(next!, changed)).toBe(true);
  });
  it("keeps perspective growth near the bottom in either performance mode", () => {
    const g = { bounds: { left: 0, top: 0, width: 600, height: 600 }, baseSize: 50, obstacles: [] };
    const random = seeded(731);
    const samples = Array.from({ length: 100 }, () => chooseMonsterPlacement(g, null, random)!);
    expect(samples.some((f) => f.width > 90)).toBe(true);
    expect(samples.some((f) => f.width < 65)).toBe(true);
  });
});
