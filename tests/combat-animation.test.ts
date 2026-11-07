import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/(tabs)/index.tsx", import.meta.url), "utf8");
const actor = readFileSync(new URL("../components/monster-actor.tsx", import.meta.url), "utf8");

describe("combat animation wiring", () => {
  it("renders the monster outside stats/name and board parents", () => {
    const stats = source.slice(source.indexOf("ref={monsterStatsRef}"), source.indexOf("<Animated.View style={[styles.boardTransition"));
    expect(stats).not.toContain("<MonsterActor");
    expect(source.indexOf("<MonsterActor")).toBeGreaterThan(source.indexOf("ref={monsterTableauRef}"));
    expect(actor).toContain("...StyleSheet.absoluteFillObject, zIndex: 8000, elevation: 8000");
    expect(actor).toContain('pointerEvents="none"');
    expect(source).not.toContain("battleFrame.width - monsterBoxSize");
    expect(source).not.toContain("safeLeftDistance");
    expect(source).not.toContain("safePositionReady");
  });
  it("uses measured full-root card geometry, with no name-panel fallback", () => {
    expect(source).toContain("Promise.all(views.map(measureViewInWindow))");
    expect(source).toContain("buildMonsterGeometry(root, uiRects, tableau, occupiedHeight, controls");
    expect(source).toContain("const uiRects = [header, stats, piles]");
    expect(source).toContain("uiRects.push(ranking)");
    expect(actor).toContain("chooseMonsterPlacement(currentGeometry, frameRef.current)");
    expect(actor).toContain("setInterval(choose, lowPerformance ? 3000 : 1800)");
  });
  it("shares one target between rendered monster, projectile and combo impact", () => {
    expect(actor).toContain("targetFrameRef.current = frame ? monsterTargetFromPlacement(frame) : null");
    expect(source).toContain("targetFrameRef={monsterTargetFrameRef}");
    expect(source).toContain("frameRef={monsterTargetFrameRef}");
    expect(source).toContain("left: frame.goalX - impactSize / 2");
    expect(source).toContain("top: frame.goalY - impactSize / 2");
    expect(source).not.toContain("targetViewRef={monsterTargetRef}");
    expect(source).toContain("source={HIT_EXPLOSION_ART_BY_STYLE[attackStyle]}");
    expect(source).toContain("companionRef={companionAnchorRef}");
  });
  it("stops random spawn, combo and projectile tracking timers on cleanup", () => {
    expect(actor).toContain("return () => clearInterval(timer)");
    expect(source).toContain("completeRef.current(token)");
    expect(source).toContain("progress.removeListener(listener)");
    expect(source).toContain("animation.stop()");
  });
  it("caps the animated pet attack scale at 150 percent, including combos", () => {
    expect(source).toContain("const MAX_COMPANION_ATTACK_SCALE = 1.5;");
    expect(source).toMatch(/Animated\.timing\(comboCompanionScale, \{ toValue: MAX_COMPANION_ATTACK_SCALE/);
    expect(source).toContain('outputRange: [1, MAX_COMPANION_ATTACK_SCALE], extrapolate: "clamp"');
    expect(source).toContain("{ scale: attackScale }");
    expect(source).not.toMatch(/Animated\.timing\(comboCompanionScale, \{ toValue: 3/);
    expect(source).toMatch(/Animated\.timing\(comboCompanionScale, \{ toValue: 1, duration: 520/);
  });
});
