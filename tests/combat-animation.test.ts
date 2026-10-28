import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app/(tabs)/index.tsx", import.meta.url), "utf8");

describe("combat animation wiring", () => {
  it("does not freeze monster movement for attacks or hit effects", () => {
    expect(source).not.toMatch(/motionFrozen|monsterMotionFreezeCount|setMonsterMotionFrozen/);
    expect(source).toContain("}, [monsterMotion]);");
    expect(source).toContain("}, [verticalMonsterMotion, verticalTravel]);");
  });

  it("keeps horizontal and vertical movement on the native driver", () => {
    expect(source).toMatch(/Animated\.timing\(monsterMotion,[^\n]+useNativeDriver: true/);
    expect(source).toMatch(/Animated\.timing\(verticalMonsterMotion,[^\n]+useNativeDriver: true/);
  });

  it("launches the pet projectile from the measured pet center above the monster", () => {
    const anchor = source.slice(source.indexOf("styles.monsterProjectileAnchor"), source.indexOf("styles.monsterInfo, compact"));
    expect(anchor).not.toContain("FlyingCard");
    expect(anchor).not.toContain("<HitExplosion");
    expect(source).toContain("FlyingPetImpact");
    expect(source).toContain("measureInWindow");
    expect(source).toContain("zIndex: 6000");
    expect(source).toContain("companionRef={companionAnchorRef}");
    expect(source).toContain("targetViewRef={monsterTargetRef}");
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
