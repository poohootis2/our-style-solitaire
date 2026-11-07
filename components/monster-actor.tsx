import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { chooseMonsterPlacement, isMonsterPlacementSafe, monsterTargetFromPlacement, type MonsterGeometry, type MonsterPlacement } from "../lib/monster-placement";

type Target = ReturnType<typeof monsterTargetFromPlacement>;
export const MonsterActor = memo(function MonsterActor({ geometry, image, name, monsterId, paused, lowPerformance, damage, impactToken, targetRef, targetFrameRef }: {
  geometry: MonsterGeometry | null;
  image: ImageSourcePropType;
  name: string;
  monsterId: string;
  paused: boolean;
  lowPerformance: boolean;
  damage: number;
  impactToken: number;
  targetRef: RefObject<View | null>;
  targetFrameRef: { current: Target | null };
}) {
  const [frame, setFrame] = useState<MonsterPlacement | null>(null);
  const frameRef = useRef<MonsterPlacement | null>(null);
  const geometryRef = useRef(geometry);
  const [facingLeft, setFacingLeft] = useState(true);
  const [showDamage, setShowDamage] = useState(false);
  const damageProgress = useRef(new Animated.Value(0)).current;
  const choose = () => {
    const currentGeometry = geometryRef.current;
    if (!currentGeometry) return;
    const next = chooseMonsterPlacement(currentGeometry, frameRef.current);
    // No unchecked name-panel fallback. Only safe root-coordinate placements.
    if (next) {
      setFacingLeft(frameRef.current ? next.left < frameRef.current.left : true);
      frameRef.current = next;
      setFrame(next);
    } else if (!frameRef.current || !isMonsterPlacementSafe(frameRef.current, currentGeometry)) {
      frameRef.current = null;
      setFrame(null);
    }
  };
  useLayoutEffect(() => {
    geometryRef.current = geometry;
    // New card layout only relocates an unsafe monster, never resets the timer.
    if (geometry && (!frameRef.current || !isMonsterPlacementSafe(frameRef.current, geometry))) choose();
  }, [geometry]);
  useLayoutEffect(() => {
    // Rendered left/top/size and the projectile/combo target have one source.
    targetFrameRef.current = frame ? monsterTargetFromPlacement(frame) : null;
  }, [frame, targetFrameRef]);
  useEffect(() => {
    if (paused) return;
    choose();
    const timer = setInterval(choose, lowPerformance ? 3000 : 1800);
    return () => clearInterval(timer);
  }, [paused, lowPerformance, monsterId]);
  useEffect(() => () => { targetFrameRef.current = null; }, [targetFrameRef]);
  useEffect(() => {
    if (!impactToken) return;
    setShowDamage(true);
    damageProgress.setValue(0);
    const animation = Animated.timing(damageProgress, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) setShowDamage(false); });
    return () => animation.stop();
  }, [damageProgress, impactToken]);
  if (!frame) return null;
  return <View pointerEvents="none" style={styles.overlay}>
    <View ref={targetRef} collapsable={false} accessibilityLabel={name} style={[styles.actor, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }]}>
      <View style={[styles.shadow, { width: frame.width * 0.65, height: Math.max(4, frame.height * 0.06) }]} />
      <Image source={image} fadeDuration={0} resizeMode="contain" style={[styles.image, { transform: [{ scaleX: facingLeft ? -1 : 1 }] }]} />
      {showDamage ? <Animated.Text allowFontScaling={false} style={[styles.damage, { opacity: damageProgress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: damageProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) }] }]}>−{damage}</Animated.Text> : null}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  // A direct root child, not nested inside stats/name or board stacking contexts.
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 8000, elevation: 8000 },
  actor: { position: "absolute", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  shadow: { position: "absolute", bottom: 0, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.3)" },
  damage: { position: "absolute", top: 0, color: "#FFF3D1", fontSize: 18, fontWeight: "900", textShadowColor: "#481C18", textShadowRadius: 2 },
});
