import { useEffect, useRef, useState } from "react";
import { Alert, Animated, AppState, Easing, Image, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as ScreenOrientation from "expo-screen-orientation";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { AdBanner } from "@/components/ad-banner";
import { getCardBackTheme, type CardBackTheme } from "@/lib/card-back-theme";
import { getGameLayout } from "@/lib/game-layout";
import { haptic } from "@/lib/haptics";
import {
  autoComplete,
  cloneGameState,
  createPlayableGame,
  drawFromStock,
  flipTableauCard,
  findHint,
  getDifficulty,
  getChapterForStage,
  isWon,
  moveFoundationToTableau,
  moveAceToFoundation,
  moveTableauToTableau,
  moveToFoundation,
  moveWasteToTableau,
  rankLabels,
  suitNames,
  suitSymbols,
  type Card,
  type CardSource,
  type Suit,
  SUITS,
} from "@/lib/solitaire";
import { getBattleContent, getCompanionRoster, type BattleAsset } from "@/lib/battle-content";
import { companionAttackColors, getCompanionAttackStyle, type CompanionAttackStyle } from "@/lib/companion-attack";
import { getAttackTravelY } from "@/lib/attack-layout";

type Selection = CardSource & { cardId: string };
type Sheet = "menu" | "rules" | "records" | "sound" | "companions" | null;
type Records = { wins: number; bestScore: number; bestTimeSeconds: number | null };

const CARD_RATIO = 1.42;
const ACTIVE_GAME_KEY = "our-style-solitaire:active-game";
const ACTIVE_GAME_SAVE_VERSION = 3;
const RECORDS_KEY = "our-style-solitaire:records";
const SOUND_ENABLED_KEY = "our-style-solitaire:sound-enabled";
const BACKGROUND_MUSIC_ENABLED_KEY = "our-style-solitaire:background-music-enabled";
const SOUND_EFFECTS_VOLUME_KEY = "our-style-solitaire:sound-effects-volume";
const BACKGROUND_MUSIC_VOLUME_KEY = "our-style-solitaire:background-music-volume";
const CARD_SELECT_VIBRATION_KEY = "our-style-solitaire:card-select-vibration";
const SELECTED_COMPANION_KEY = "our-style-solitaire:selected-companion";
const PHYSICAL_EDGE_INSET = 52;
const MAX_UNDO_STEPS = 3;
const CARD_ATTACK_FLIGHT_DURATION = 1500;
const FLYING_CARD_DURATION = CARD_ATTACK_FLIGHT_DURATION;
const emptyRecords: Records = { wins: 0, bestScore: 0, bestTimeSeconds: null };

function cardLabel(card: Card): string {
  return `${rankLabels[card.rank]} ${suitNames[card.suit]}`;
}

function playingCardColor(card: Card): string {
  return card.suit === "diamonds" || card.suit === "hearts" ? "#E94B5F" : "#1A2030";
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RoyalPortrait({ rank, chapter = 1 }: { rank: 11 | 12 | 13; chapter?: number }) {
  const isJack = rank === 11;
  const isQueen = rank === 12;
  const chapterPalette = [
    { outfit: "#314A76", trim: "#FF8A76", crown: "#F3C969" },
    { outfit: "#275C68", trim: "#77D6C3", crown: "#A5F0DF" },
    { outfit: "#563D7A", trim: "#B9C9FF", crown: "#D0C4FF" },
    { outfit: "#70402C", trim: "#F3C969", crown: "#FFE7A2" },
  ][Math.max(0, Math.min(3, chapter - 1))];
  const outfit = isJack ? chapterPalette.outfit : isQueen ? "#7A416B" : "#295D66";
  const trim = isJack ? chapterPalette.trim : isQueen ? "#E785B5" : chapterPalette.crown;
  const hair = isJack ? "#56392B" : isQueen ? "#4A2543" : "#302A25";

  return (
    <View pointerEvents="none" style={styles.royalPortrait}>
      <Svg width="100%" height="100%" viewBox="0 0 100 128">
        <Rect x="10" y="62" width="80" height="61" rx="17" fill={outfit} />
        <Path d="M14 111 L28 75 L50 96 L72 75 L86 111" fill={trim} opacity="0.9" />
        <Path d="M33 78 L50 96 L67 78" fill="#FFF3D1" />
        <Circle cx="50" cy="48" r="24" fill="#F3BF99" />
        <Path d={isQueen ? "M25 54 C23 19 40 16 50 26 C60 16 77 19 75 54 L67 45 C62 31 38 31 33 45 Z" : "M25 49 C25 19 42 19 50 27 C58 19 75 19 75 49 L69 42 C58 30 42 30 31 42 Z"} fill={hair} />
        {isJack ? <Path d="M32 29 L43 15 L50 27 L57 15 L68 29 L62 31 L50 25 L38 31 Z" fill={trim} /> : null}
        {isQueen ? <Path d="M27 29 L34 10 L43 23 L50 7 L57 23 L66 10 L73 29 Z" fill={chapterPalette.crown} /> : null}
        {rank === 13 ? <Path d="M23 31 L30 8 L41 23 L50 5 L59 23 L70 8 L77 31 Z" fill={chapterPalette.crown} /> : null}
        {chapter >= 3 ? <Circle cx="50" cy="12" r="4" fill={chapterPalette.trim} /> : null}
        <Circle cx="41" cy="49" r="2.2" fill="#1A2030" />
        <Circle cx="59" cy="49" r="2.2" fill="#1A2030" />
        <Path d={isQueen ? "M42 61 Q50 66 58 61" : "M42 61 Q50 65 58 61"} stroke="#B96862" strokeWidth="2" fill="none" strokeLinecap="round" />
        {rank === 13 ? <Path d="M38 66 Q50 76 62 66 L59 78 L41 78 Z" fill={hair} /> : null}
        <Path d="M50 93 L50 116" stroke="#F3C969" strokeWidth="3" />
        <Circle cx="50" cy="95" r="5" fill="#FFF3D1" stroke="#F3C969" strokeWidth="2" />
      </Svg>
    </View>
  );
}

type MedievalIconName = "auto" | "new" | "orientation" | "sound" | "soundOff" | "menu" | "hint" | "undo";

function MedievalBackdrop({ source }: { source: number }) {
  return (
    <View pointerEvents="none" style={styles.medievalBackdrop}>
      <Image source={source} resizeMode="cover" style={styles.medievalBackdropImage} />
      <View style={styles.medievalBackdropDim} />
    </View>
  );
}

function CompanionAnchor({ companion, size, left, bottom }: { companion: BattleAsset; size: number; left: number; bottom: number }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: -1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift]);
  const translateX = drift.interpolate({ inputRange: [-1, 0, 1], outputRange: [-5, 0, 5] });
  const translateY = drift.interpolate({ inputRange: [-1, 0, 1], outputRange: [2, 0, -2] });
  const rotate = drift.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-2deg", "0deg", "2deg"] });
  return <Animated.View pointerEvents="none" style={[styles.companionAnchor, { width: size, height: size, left, bottom, transform: [{ translateX }, { translateY }, { rotate }] }]}><Image source={companion.image} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={`${companion.name}, 전투 동료`} /></Animated.View>;
}

function MedievalIcon({ name, size = 22 }: { name: MedievalIconName; size?: number }) {
  const gold = "#F3C969";
  const teal = "#77D6C3";
  const coral = "#FF8A76";
  const common = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {name === "auto" ? <><Path d="M7 24 L21 10" stroke={gold} strokeWidth="5" strokeLinecap="round" /><Path d="M19 6 L20 10 L24 11 L20 12 L19 16 L18 12 L14 11 L18 10 Z" fill={teal} {...common} /><Circle cx="8" cy="24" r="3" fill={coral} {...common} /></> : null}
      {name === "new" ? <><Path d="M7 27 V10 L12 5 H21 L25 10 V27 Z" fill="#5C87A7" {...common} /><Path d="M6 10 H26" stroke={gold} strokeWidth="4" {...common} /><Path d="M16 13 V23 M11 18 H21" stroke="#FFF3D1" strokeWidth="3" strokeLinecap="round" /></> : null}
      {name === "orientation" ? <><Rect x="8" y="5" width="16" height="22" rx="3" fill="#314A76" {...common} /><Path d="M5 11 Q5 6 11 6 M10 3 L13 6 L10 9" stroke={teal} strokeWidth="3" fill="none" {...common} /><Path d="M27 21 Q27 26 21 26 M22 29 L19 26 L22 23" stroke={coral} strokeWidth="3" fill="none" {...common} /></> : null}
      {name === "sound" ? <><Path d="M13 6 V24" stroke={gold} strokeWidth="3" {...common} /><Path d="M13 7 Q23 9 23 17 Q23 24 16 25" stroke={gold} strokeWidth="3" fill="none" {...common} /><Circle cx="11" cy="25" r="4" fill={coral} {...common} /><Path d="M25 11 Q30 16 25 21" stroke={teal} strokeWidth="2.5" fill="none" strokeLinecap="round" /></> : null}
      {name === "soundOff" ? <><Path d="M13 6 V24" stroke="#7C8BA5" strokeWidth="3" {...common} /><Path d="M13 7 Q23 9 23 17 Q23 24 16 25" stroke="#7C8BA5" strokeWidth="3" fill="none" {...common} /><Circle cx="11" cy="25" r="4" fill="#7C8BA5" {...common} /><Path d="M6 6 L27 27" stroke={coral} strokeWidth="4" strokeLinecap="round" /></> : null}
      {name === "menu" ? <><Path d="M16 4 L27 9 V17 Q25 25 16 29 Q7 25 5 17 V9 Z" fill="#314A76" {...common} /><Circle cx="16" cy="11" r="2" fill={gold} /><Circle cx="16" cy="17" r="2" fill={gold} /><Circle cx="16" cy="23" r="2" fill={gold} /></> : null}
      {name === "hint" ? <><Path d="M10 13 Q10 5 16 5 Q22 5 22 13 V19 H10 Z" fill={gold} {...common} /><Path d="M13 22 H19 M14 26 H18" stroke={teal} strokeWidth="3" strokeLinecap="round" /><Circle cx="16" cy="13" r="3" fill="#FFF3D1" /></> : null}
      {name === "undo" ? <><Path d="M25 10 H12 Q7 10 7 16 Q7 22 13 22 H23" stroke={gold} strokeWidth="4" fill="none" {...common} /><Path d="M12 5 L6 10 L12 15" stroke={coral} strokeWidth="4" fill="none" {...common} /><Path d="M16 13 V19" stroke={teal} strokeWidth="2" strokeLinecap="round" /></> : null}
    </Svg>
  );
}

function CardFace({
  card,
  width,
  cardRatio = CARD_RATIO,
  selected,
  onPress,
  onDoublePress,
  onDragEnd,
  chapter = 1,
}: {
  card: Card;
  width: number;
  cardRatio?: number;
  selected?: boolean;
  onPress?: () => void;
  onDoublePress?: () => void;
  onDragEnd?: (dx: number, dy: number) => void;
  chapter?: number;
}) {
  const height = width * cardRatio;
  const color = playingCardColor(card);
  const rankSize = Math.max(10, Math.round(width * 0.26));
  const suitSize = Math.max(9, Math.round(width * 0.22));
  const centerSize = Math.max(21, Math.round(width * 0.52));
  const markInset = Math.max(4, Math.round(width * 0.075));
  const suitTopOffset = Math.max(16, rankSize + Math.round(width * 0.12));
  const isRoyal = card.rank >= 11;
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragEndRef = useRef(onDragEnd);
  dragEndRef.current = onDragEnd;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Boolean(dragEndRef.current && (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8)),
    onPanResponderRelease: (_, gesture) => dragEndRef.current?.(gesture.dx, gesture.dy),
  })).current;

  const handlePress = () => {
    if (!onDoublePress) {
      onPress?.();
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoublePress();
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onPress?.();
    }, 220);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cardLabel(card)} 카드`}
      onPress={handlePress}
      {...(onDragEnd ? panResponder.panHandlers : {})}
      style={({ pressed }) => [
        styles.card,
        { width, height, borderColor: selected ? "#FF7A66" : "#F1EEE6" },
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.rankTop, { color, top: markInset, left: markInset, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
      <Text style={[styles.suitTop, { color, top: suitTopOffset, left: markInset, fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      {isRoyal ? <RoyalPortrait rank={card.rank as 11 | 12 | 13} chapter={chapter} /> : <Text style={[styles.suitCenter, { color, fontSize: centerSize }]}>{suitSymbols[card.suit]}</Text>}
      <View style={[styles.bottomMark, { right: markInset, bottom: markInset * 0.65 }]}>
        <Text style={[styles.rankBottom, { color, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
        <Text style={[styles.suitBottom, { color, fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      </View>
    </Pressable>
  );
}

function VolumeSlider({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const updateFromLocation = (locationX: number) => {
    if (!trackWidth) return;
    onChange(Math.max(0, Math.min(1, locationX / trackWidth)));
  };
  return (
    <View style={[styles.volumeSliderRow, disabled && styles.volumeSliderDisabled]}>
      <View style={styles.volumeSliderHeader}><Text style={styles.volumeSliderLabel}>{label}</Text><Text style={styles.volumeSliderValue}>{Math.round(value * 100)}%</Text></View>
      <View
        style={styles.volumeSliderTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => updateFromLocation(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromLocation(event.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label} 볼륨`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      >
        <View style={[styles.volumeSliderFill, { width: `${value * 100}%` }]} />
        <View style={[styles.volumeSliderThumb, { left: `${value * 100}%` }]} />
      </View>
    </View>
  );
}

function CardBack({ width, cardRatio = CARD_RATIO, theme, onPress }: { width: number; cardRatio?: number; theme: CardBackTheme; onPress: () => void }) {
  const height = width * cardRatio;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="카드 뒷면, 탭하여 공개"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardBack, { width, height, backgroundColor: theme.outer, borderColor: theme.border }, pressed && styles.pressed]}
    >
      <View style={[styles.backInner, { backgroundColor: theme.inner, borderColor: theme.border }]}>
        <Text style={[styles.backMark, { color: theme.mark }]}>{theme.glyph}</Text>
      </View>
    </Pressable>
  );
}

function FlyingCard({ card, width, cardRatio = CARD_RATIO, progress, travelX = 0, travelY = -180, startLeft = 16, startBottom = 44, flightColor }: { card: Card; width: number; cardRatio?: number; progress: Animated.Value; travelX?: number; travelY?: number; startLeft?: number; startBottom?: number; flightColor?: string }) {
  const color = playingCardColor(card);
  const glow: Record<Suit, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const cardHeight = width * cardRatio;
  const distance = Math.max(48, Math.sqrt(travelX * travelX + travelY * travelY));
  const glowColor = flightColor ?? glow[card.suit];
  const angle = `${Math.atan2(travelY, travelX) * (180 / Math.PI)}deg`;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelY] });
  const scale = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [1, 1.08, 0.5] });
  const opacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });
  const trailTranslateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelX * 0.22] });
  const trailTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelY * 0.22] });
  const trailScale = progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.2, 1, 0.42] });
  const trailOpacity = progress.interpolate({ inputRange: [0, 0.18, 0.72, 1], outputRange: [0, 0.9, 0.55, 0] });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.flyingTrail, { left: startLeft + width * 0.5 - distance * 0.5, bottom: startBottom + cardHeight * 0.5 - 2, width: distance, backgroundColor: glowColor, opacity: trailOpacity, transform: [{ translateX: trailTranslateX }, { translateY: trailTranslateY }, { rotate: angle }, { scaleX: trailScale }] }]} />
      <Animated.View pointerEvents="none" style={[styles.flyingCard, { left: startLeft, bottom: startBottom, width, height: cardHeight, opacity, borderColor: glowColor, shadowColor: glowColor, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}> 
        <Text style={[styles.flyingRank, { color }]}>{rankLabels[card.rank]}</Text>
        <Text style={[styles.flyingSuit, { color }]}>{suitSymbols[card.suit]}</Text>
      </Animated.View>
    </>
  );
}

function FireworkParticle({ index, visible }: { index: number; visible: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const angle = (index / 18) * Math.PI * 2;
  const radius = 92 + (index % 4) * 17;
  const colors = ["#FF7A66", "#77D6C3", "#F3C969", "#9C85EE", "#FF9AD5"];

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: 920 + (index % 3) * 120, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [index, progress, visible]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * radius] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * radius] });
  const opacity = progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1, 0.45] });
  return <Animated.View pointerEvents="none" style={[styles.fireworkParticle, { backgroundColor: colors[index % colors.length], opacity, transform: [{ translateX }, { translateY }, { scale }] }]} />;
}

function VictoryFireworks({ visible }: { visible: boolean }) {
  return (
    <View pointerEvents="none" style={styles.fireworkLayer}>
      {Array.from({ length: 36 }, (_, index) => <FireworkParticle key={index} index={index} visible={visible} />)}
      {visible ? <Text style={styles.victoryText}>STAGE CLEAR</Text> : null}
    </View>
  );
}

function CardAttackEffect({ kind, combo, travelX, travelY, startLeft = 16, startBottom = 44, effectColor }: { kind: AttackKind; combo: boolean; travelX: number; travelY: number; startLeft?: number; startBottom?: number; effectColor?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const symbols: Record<AttackKind, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  const colors: Record<AttackKind, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const effectTone = effectColor ?? colors[kind];
  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: CARD_ATTACK_FLIGHT_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [combo, progress]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelY] });
  const scale = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0.8, 1.06, 0.76] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "900deg"] });
  const opacity = progress.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });
  return <Animated.View pointerEvents="none" style={[styles.attackCard, { left: startLeft, bottom: startBottom, opacity, borderColor: effectTone, shadowColor: effectTone, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
    <Text style={[styles.attackCardRank, { color: effectTone }]}>A</Text>
    <Text style={[styles.attackCardSuit, { color: effectTone }]}>{symbols[kind]}</Text>
  </Animated.View>;
}

type AttackKind = Suit;

function MonsterBattle({ hp, damage, attackKind, attackToken, combo, compact = false, landscape = false, phoneLandscape = false, travelDistance = 24, monster, isBoss, cardSize }: { hp: number; damage: number; attackKind: AttackKind; attackToken: number; combo: boolean; compact?: boolean; landscape?: boolean; phoneLandscape?: boolean; travelDistance?: number; monster: BattleAsset; isBoss: boolean; cardSize: number }) {
  const monsterMotion = useRef(new Animated.Value(0)).current;
  const attackProgress = useRef(new Animated.Value(0)).current;
  const [attackVisible, setAttackVisible] = useState(false);
  const [damageVisible, setDamageVisible] = useState(false);
  const [defeatVisible, setDefeatVisible] = useState(false);
  const damageProgress = useRef(new Animated.Value(0)).current;
  const defeatProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(monsterMotion, { toValue: 1, duration: 2145, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(monsterMotion, { toValue: 0, duration: 2145, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [monsterMotion]);

  useEffect(() => {
    if (!attackToken) return;
    setAttackVisible(true);
    setDamageVisible(true);
    attackProgress.setValue(0);
    damageProgress.setValue(0);
    Animated.parallel([
      Animated.timing(attackProgress, { toValue: 1, duration: combo ? 520 : 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(damageProgress, { toValue: 1, duration: 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { setAttackVisible(false); setDamageVisible(false); });
  }, [attackToken, attackProgress, damageProgress, combo]);

  useEffect(() => {
    const defeated = hp <= 0;
    setDefeatVisible(defeated);
    if (defeated) {
      defeatProgress.setValue(0);
      Animated.timing(defeatProgress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [defeatProgress, hp]);

  const monsterTranslate = monsterMotion.interpolate({ inputRange: [0, 1], outputRange: [-travelDistance, travelDistance] });
  const projectileTranslate = attackProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 92] });
  const projectileScale = attackProgress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.15, 0.2] });
  const damageTranslateY = damageProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const damageOpacity = damageProgress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 1, 0] });
  const defeatScale = defeatProgress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.3, 1.6, 2.8] });
  const defeatOpacity = defeatProgress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1, 0] });
  const attackColors: Record<AttackKind, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const attackSymbols: Record<AttackKind, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  const spriteSize = Math.max(34, Math.round(cardSize * 0.9));
  const companionSize = Math.max(24, Math.round(cardSize * 0.62));
  const infoWidth = Math.max(54, Math.round(cardSize * 1.02));

  return (
    <View style={[styles.monsterBattle, landscape && styles.monsterBattleLandscape, compact && !landscape && styles.monsterBattleCompact, phoneLandscape && styles.monsterBattlePhoneLandscape]} accessibilityLabel={`몬스터 체력 ${Math.round(hp)}퍼센트`}>
      <Animated.View style={[styles.monsterSpriteWrap, compact && styles.monsterSpriteWrapCompact, { width: spriteSize, height: spriteSize, transform: [{ translateX: monsterTranslate }] }]}>
        <Image source={monster.image} resizeMode="contain" style={[styles.monsterSprite, { width: spriteSize, height: spriteSize }, compact && styles.monsterSpriteCompact, defeatVisible && styles.monsterDefeated]} accessibilityLabel={monster.name} />
        {attackVisible ? <Animated.Text style={[styles.monsterProjectile, { color: attackColors[attackKind], transform: [{ translateX: projectileTranslate }, { scale: projectileScale }] }]}>{attackSymbols[attackKind]}</Animated.Text> : null}
        {damageVisible ? <Animated.Text style={[styles.damageText, { opacity: damageOpacity, transform: [{ translateY: damageTranslateY }] }]}>−{damage}</Animated.Text> : null}
        {defeatVisible ? <Animated.View pointerEvents="none" style={[styles.defeatBurst, { opacity: defeatOpacity, transform: [{ scale: defeatScale }] }]}>{Array.from({ length: 12 }, (_, index) => <Text key={index} style={[styles.defeatSpark, { transform: [{ rotate: `${index * 30}deg` }, { translateY: -24 }] }]}>{index % 2 ? "✦" : "•"}</Text>)}</Animated.View> : null}
      </Animated.View>
      <View style={[styles.monsterInfo, { width: infoWidth }, compact && styles.monsterInfoCompact, !landscape && styles.monsterInfoPortrait]}>
        <View style={styles.monsterNameRow}><Text style={styles.monsterName} numberOfLines={2}>{monster.name.toUpperCase()}</Text>{isBoss ? <Text style={styles.bossBadge}>BOSS</Text> : null}</View>
        <View style={styles.monsterBar}><View style={[styles.monsterBarFill, { width: `${Math.max(0, Math.min(100, hp))}%` }]} /></View>
        <Text style={styles.monsterHp}>{Math.round(hp)}%</Text>
      </View>
    </View>
  );
}

function EmptySlot({ width, cardRatio = CARD_RATIO, label, onPress }: { width: number; cardRatio?: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label || "빈 카드 슬롯"}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, { width, height: width * cardRatio }, pressed && styles.pressed]}
    >
      <Text style={styles.slotLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [deviceOrientation, setDeviceOrientation] = useState<ScreenOrientation.Orientation | null>(null);
  const nativeLandscape = deviceOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || deviceOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT || screenWidth > screenHeight;
  const isLandscape = nativeLandscape;
  const isTablet = Math.min(screenWidth, screenHeight) >= 600;
  const phoneLandscape = isLandscape && !isTablet;
  const safeScreenWidth = Math.max(260, screenWidth - insets.left - insets.right);
  const safeScreenHeight = Math.max(220, screenHeight - insets.top - insets.bottom);
  const compactLandscape = isLandscape && safeScreenHeight <= 460;
  const rootTopPadding = isLandscape ? 4 : PHYSICAL_EDGE_INSET;
  // Some edge-to-edge Android devices report a zero bottom inset while the
  // persistent home or three-button bar still overlays the game window.
  const systemBottomInset = Platform.OS !== "web" ? Math.max(insets.bottom, isLandscape ? 48 : 36) : insets.bottom;
  const rootBottomPadding = isLandscape ? systemBottomInset + 8 : PHYSICAL_EDGE_INSET + 62;
  // Reserve the additional header spacing used by the inline landscape banner.
  // This keeps the banner, title, and action buttons on separate visual lanes.
  const layoutExtraReservedHeight = isLandscape ? (phoneLandscape ? 0 : 18) : 58;
  const bottomControlsBottom = isLandscape ? systemBottomInset + 4 : Math.max(58, systemBottomInset + 16);
  // In portrait, keep the banner below the action buttons while reserving the
  // system navigation inset so it never sits under the home indicator.
  const portraitBannerBottom = Math.max(4, bottomControlsBottom - 52);
  const { boardWidth, cardWidth, cardRatio, compact, stackOffset, tableauGap, uiScale, sideRailWidth } = getGameLayout(
    safeScreenWidth,
    safeScreenHeight,
    rootTopPadding + rootBottomPadding,
    isLandscape,
    layoutExtraReservedHeight,
  );
  const compactControls = compact || compactLandscape;
  const [game, setGame] = useState(createPlayableGame);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [hydrated, setHydrated] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true);
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(0.9);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [cardSelectVibrationEnabled, setCardSelectVibrationEnabled] = useState(true);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [attackKind, setAttackKind] = useState<AttackKind>("clubs");
  const [lastDamage, setLastDamage] = useState(0);
  const [attackToken, setAttackToken] = useState(0);
  const [comboAttack, setComboAttack] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState("cloud-tiger");
  const [showBossWarning, setShowBossWarning] = useState(false);
  const [undoStack, setUndoStack] = useState<typeof game[]>([]);
  const newGameStarted = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const flightProgress = useRef(new Animated.Value(0)).current;
  const layoutTransition = useRef(new Animated.Value(1)).current;
  const bossIntroProgress = useRef(new Animated.Value(0)).current;
  const screenShake = useRef(new Animated.Value(0)).current;
  const bossWarningStageRef = useRef<number | null>(null);
  const selectPlayer = useAudioPlayer(require("../../assets/sounds/card-select.wav"));
  const movePlayer = useAudioPlayer(require("../../assets/sounds/card-move.wav"));
  const attackPlayer = useAudioPlayer(require("../../assets/sounds/card-attack.mp3"));
  const backgroundPlayer = useAudioPlayer(require("../../assets/sounds/medieval-solitaire-loop.mp3"));

  const showTimedHint = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setHintMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setHintMessage(null);
      toastTimeoutRef.current = null;
    }, 2000);
  };

  const setSoundEffectsVolumePreference = (value: number) => {
    const volume = clampVolume(value);
    setSoundEffectsVolume(volume);
    for (const player of [selectPlayer, movePlayer, attackPlayer]) {
      try { player.volume = soundEffectsEnabled ? volume : 0; } catch { /* optional audio */ }
    }
  };

  const setBackgroundMusicVolumePreference = (value: number) => {
    const volume = clampVolume(value);
    setBackgroundMusicVolume(volume);
    try {
      backgroundPlayer.volume = backgroundMusicEnabled ? volume : 0;
    } catch { /* optional audio */ }
  };

  const setSoundEffectsEnabledPreference = (enabled: boolean) => {
    for (const player of [selectPlayer, movePlayer, attackPlayer]) {
      try {
        player.volume = enabled ? soundEffectsVolume : 0;
        if (!enabled) player.pause();
      } catch {
        // Sound state must never block the game when a native player is unavailable.
      }
    }
    setSoundEffectsEnabled(enabled);
    showTimedHint(enabled ? "효과음을 켰습니다." : "효과음을 껐습니다.");
    haptic.light();
  };

  const setBackgroundMusicEnabledPreference = (enabled: boolean) => {
    try {
      backgroundPlayer.volume = enabled ? backgroundMusicVolume : 0;
      if (enabled && !paused) {
        backgroundPlayer.seekTo(0);
        backgroundPlayer.play();
      } else {
        backgroundPlayer.pause();
      }
    } catch {
      // Background music must never block the game when a native player is unavailable.
    }
    setBackgroundMusicEnabled(enabled);
    showTimedHint(enabled ? "배경음을 켰습니다." : "배경음을 껐습니다.");
    haptic.light();
  };

  const setCardSelectVibrationPreference = (enabled: boolean) => {
    setCardSelectVibrationEnabled(enabled);
    showTimedHint(enabled ? "카드 선택 진동을 켰습니다." : "카드 선택 진동을 껐습니다.");
    haptic.light();
  };

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLocalGame = async () => {
      try {
        const [activeGameValue, recordsValue, soundEffectsValue, backgroundMusicValue, soundEffectsVolumeValue, backgroundMusicVolumeValue, cardSelectVibrationValue, selectedCompanionValue] = await AsyncStorage.multiGet([ACTIVE_GAME_KEY, RECORDS_KEY, SOUND_ENABLED_KEY, BACKGROUND_MUSIC_ENABLED_KEY, SOUND_EFFECTS_VOLUME_KEY, BACKGROUND_MUSIC_VOLUME_KEY, CARD_SELECT_VIBRATION_KEY, SELECTED_COMPANION_KEY]);
        if (!mounted) return;
        if (activeGameValue[1] && !newGameStarted.current) {
          const saved = JSON.parse(activeGameValue[1]) as { saveVersion?: number; game?: typeof game; elapsedSeconds?: number };
          if (saved.saveVersion === ACTIVE_GAME_SAVE_VERSION && saved.game?.tableau?.length === 7) {
            setGame({ ...saved.game, level: saved.game.level ?? 1, recycles: saved.game.recycles ?? 0 });
            if (typeof saved.elapsedSeconds === "number") setElapsedSeconds(saved.elapsedSeconds);
          } else {
            // Older builds could retain the previous fixed tutorial arrangement.
            // Do not bring that order into the current random-deal implementation.
            AsyncStorage.removeItem(ACTIVE_GAME_KEY).catch(() => undefined);
          }
        }
        if (recordsValue[1]) setRecords({ ...emptyRecords, ...(JSON.parse(recordsValue[1]) as Records) });
        if (soundEffectsValue[1]) setSoundEffectsEnabled(soundEffectsValue[1] === "true");
        if (backgroundMusicValue[1]) setBackgroundMusicEnabled(backgroundMusicValue[1] === "true");
        if (soundEffectsVolumeValue[1]) setSoundEffectsVolume(clampVolume(Number(soundEffectsVolumeValue[1])));
        if (backgroundMusicVolumeValue[1]) setBackgroundMusicVolume(clampVolume(Number(backgroundMusicVolumeValue[1])));
        if (cardSelectVibrationValue[1]) setCardSelectVibrationEnabled(cardSelectVibrationValue[1] === "true");
        if (selectedCompanionValue[1]) setSelectedCompanionId(selectedCompanionValue[1]);
      } catch {
        // A fresh local game is retained when storage is unavailable or malformed.
      } finally {
        if (mounted) setHydrated(true);
      }
    };
    loadLocalGame();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game, elapsedSeconds })).catch(() => undefined);
    gameRef.current = game;
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds, game, hydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") return;
      AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: gameRef.current, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records)).catch(() => undefined);
  }, [hydrated, records]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SOUND_ENABLED_KEY, String(soundEffectsEnabled)).catch(() => undefined);
  }, [hydrated, soundEffectsEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(BACKGROUND_MUSIC_ENABLED_KEY, String(backgroundMusicEnabled)).catch(() => undefined);
  }, [backgroundMusicEnabled, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SOUND_EFFECTS_VOLUME_KEY, String(soundEffectsVolume)).catch(() => undefined);
  }, [hydrated, soundEffectsVolume]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(BACKGROUND_MUSIC_VOLUME_KEY, String(backgroundMusicVolume)).catch(() => undefined);
  }, [backgroundMusicVolume, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CARD_SELECT_VIBRATION_KEY, String(cardSelectVibrationEnabled)).catch(() => undefined);
  }, [cardSelectVibrationEnabled, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SELECTED_COMPANION_KEY, selectedCompanionId).catch(() => undefined);
  }, [hydrated, selectedCompanionId]);

  useEffect(() => {
    for (const player of [selectPlayer, movePlayer, attackPlayer]) {
      try {
        player.volume = soundEffectsEnabled ? soundEffectsVolume : 0;
        if (!soundEffectsEnabled) player.pause();
      } catch {
        // Keep the persisted preference even if a player is still loading.
      }
    }
  }, [attackPlayer, movePlayer, selectPlayer, soundEffectsEnabled, soundEffectsVolume]);

  useEffect(() => {
    try {
      backgroundPlayer.loop = true;
      backgroundPlayer.volume = backgroundMusicEnabled ? backgroundMusicVolume : 0;
      if (!hydrated || paused || !backgroundMusicEnabled) {
        backgroundPlayer.pause();
      } else {
        backgroundPlayer.play();
      }
    } catch {
      // Background music is optional and must never interrupt gameplay.
    }
  }, [backgroundMusicEnabled, backgroundMusicVolume, backgroundPlayer, hydrated, paused]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    layoutTransition.setValue(0.94);
    const animation = Animated.timing(layoutTransition, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [isLandscape, isTablet, layoutTransition, phoneLandscape, screenHeight, screenWidth]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      setDeviceOrientation(event.orientationInfo.orientation);
    });
    ScreenOrientation.getOrientationAsync().then(setDeviceOrientation).catch(() => undefined);
    return () => ScreenOrientation.removeOrientationChangeListener(subscription);
  }, []);

  useEffect(() => {
    if (paused || !hydrated || isWon(game)) return;
    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [game, hydrated, paused]);

  const startNewGame = (level = game.level) => {
    newGameStarted.current = true;
    bossWarningStageRef.current = null;
    setShowBossWarning(false);
    const freshGame = createPlayableGame(level);
    haptic.light();
    setGame(freshGame);
    setSelection(null);
    setElapsedSeconds(0);
    setPaused(false);
    setSheet(null);
    setShowNewGameConfirm(false);
    setHintMessage(null);
    setUndoStack([]);
    gameRef.current = freshGame;
    elapsedSecondsRef.current = 0;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: freshGame, elapsedSeconds: 0 })).catch(() => undefined);
  };

  const requestNewGame = () => {
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const toggleOrientation = async () => {
    const nextMode = isLandscape ? "portrait" : "landscape";
    haptic.light();
    try {
      if (Platform.OS === "web") {
        await ScreenOrientation.lockPlatformAsync({ screenOrientationLockWeb: nextMode === "landscape" ? ScreenOrientation.WebOrientationLock.LANDSCAPE : ScreenOrientation.WebOrientationLock.PORTRAIT });
      } else {
        const target = nextMode === "landscape" ? ScreenOrientation.OrientationLock.LANDSCAPE_LEFT : ScreenOrientation.OrientationLock.PORTRAIT_UP;
        const supported = await ScreenOrientation.supportsOrientationLockAsync(target);
        if (!supported) throw new Error("unsupported orientation lock");
        await ScreenOrientation.lockAsync(target);
        setDeviceOrientation(await ScreenOrientation.getOrientationAsync());
      }
    } catch {
      Alert.alert("화면 전환", "이 기기에서는 화면 방향을 전환할 수 없습니다.");
    }
  };

  const saveWin = (finishedGame: typeof game) => {
    setRecords((current) => ({
      wins: current.wins + 1,
      bestScore: Math.max(current.bestScore, finishedGame.score),
      bestTimeSeconds: current.bestTimeSeconds === null ? elapsedSeconds : Math.min(current.bestTimeSeconds, elapsedSeconds),
    }));
  };

  const playEffect = (effect: "select" | "move" | "attack") => {
    if (!soundEffectsEnabled) return;
    const player = effect === "select" ? selectPlayer : effect === "move" ? movePlayer : attackPlayer;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound feedback must never interrupt a card move.
    }
  };

  const animateFlight = (card: Card) => {
    setFlyingCard(card);
    flightProgress.setValue(0);
    Animated.timing(flightProgress, { toValue: 1, duration: FLYING_CARD_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setFlyingCard(null));
  };

  const cardFromSource = (source: CardSource): Card | undefined => {
    if (source.kind === "waste") return game.waste.at(-1);
    if (source.kind === "foundation") return game.foundations[source.suit].at(-1);
    return game.tableau[source.column]?.[source.index];
  };

  const showHint = () => {
    const hint = findHint(game);
    if (!hint) {
      showTimedHint("지금은 새로운 이동을 찾기 어렵습니다. 실행 취소를 사용해 보세요.");
      haptic.error();
      return;
    }
    showTimedHint(hint.message);
    if (hint.source && hint.action !== "flip") {
      const card = cardFromSource(hint.source);
      if (card) setSelection({ ...hint.source, cardId: card.id });
    }
    haptic.light();
  };

  const undoLastMove = () => {
    const previousGame = undoStack.at(-1);
    if (!previousGame) {
      haptic.error();
      return;
    }
    setGame(cloneGameState(previousGame));
    setUndoStack((history) => history.slice(0, -1));
    setSelection(null);
    showTimedHint("이전 이동을 되돌렸습니다.");
    gameRef.current = previousGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: previousGame, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    haptic.light();
  };

  const applyGame = (nextGame: typeof game | null, success = false, movedCard?: Card) => {
    if (!nextGame || nextGame === game) {
      haptic.error();
      return;
    }
    const previousFoundationCount = SUITS.reduce((total, suit) => total + game.foundations[suit].length, 0);
    const nextFoundationCount = SUITS.reduce((total, suit) => total + nextGame.foundations[suit].length, 0);
    if (nextFoundationCount > previousFoundationCount) {
      const changedSuit = movedCard?.suit ?? SUITS.find((suit) => nextGame.foundations[suit].length > game.foundations[suit].length) ?? "clubs";
      const damage = (nextFoundationCount - previousFoundationCount) * 5;
      const isCombo = nextFoundationCount - previousFoundationCount > 1;
      setLastDamage(damage);
      setAttackKind(changedSuit);
      setComboAttack(isCombo);
      setAttackToken((token) => token + 1);
      playEffect("attack");
      if (isCombo) setTimeout(() => setComboAttack(false), 900);
    }
    setUndoStack((history) => [...history.slice(-(MAX_UNDO_STEPS - 1)), cloneGameState(game)]);
    gameRef.current = nextGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: nextGame, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    setGame(nextGame);
    setSelection(null);
    playEffect("move");
    if (movedCard) animateFlight(movedCard);
    if (success) {
      haptic.success();
    } else {
      haptic.light();
    }
    if (isWon(nextGame)) {
      saveWin(nextGame);
      const nextStage = nextGame.level + 1;
      const nextChapter = getChapterForStage(nextStage);
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 1550);
      showTimedHint(nextChapter !== battleContent.chapter ? `챕터 ${nextChapter} 보스가 등장합니다. 스테이지 ${nextStage} 시작!` : `스테이지 ${nextStage}로 이동합니다.`);
      setTimeout(() => startNewGame(nextStage), 2350);
    }
  };

  const selectCard = (nextSelection: Selection) => {
    if (cardSelectVibrationEnabled) haptic.light();
    playEffect("select");
    setSelection((current) => (current?.cardId === nextSelection.cardId ? null : nextSelection));
  };

  const moveSelectionToTableau = (toColumn: number) => {
    if (!selection) return;
    const movingCard = cardFromSource(selection);
    if (selection.kind === "tableau") {
      applyGame(moveTableauToTableau(game, selection.column, selection.index, toColumn), false, movingCard);
    } else if (selection.kind === "waste") {
      applyGame(moveWasteToTableau(game, toColumn), false, movingCard);
    } else {
      applyGame(moveFoundationToTableau(game, selection.suit, toColumn), false, movingCard);
    }
  };

  const dragMoveCard = (source: CardSource, dx: number, dy: number) => {
    const movingCard = cardFromSource(source);
    if (!movingCard) return;
    if (dy < -cardWidth * 0.45) {
      applyGame(moveToFoundation(game, source), false, movingCard);
      return;
    }
    if (source.kind !== "tableau") return;
    const targetColumn = Math.max(0, Math.min(6, source.column + Math.round(dx / (cardWidth + tableauGap))));
    if (targetColumn === source.column) return;
    applyGame(moveTableauToTableau(game, source.column, source.index, targetColumn), false, movingCard);
  };

  const autoMoveToFoundation = (source: CardSource) => {
    applyGame(moveToFoundation(game, source), false, cardFromSource(source));
  };

  const drawStockCard = () => {
    const drawnGame = drawFromStock(game);
    const drawnCard = drawnGame.waste.at(-1);
    if (drawnCard?.rank === 1) {
      // Preserve the requested A-card auto move, but move only the A that was
      // just revealed. Never sweep other visible A cards into foundations.
      applyGame(moveAceToFoundation(drawnGame, { kind: "waste" }) ?? drawnGame);
      return;
    }
    applyGame(drawnGame);
  };

  const onTableauPress = (column: number, index: number, card: Card) => {
    const pile = game.tableau[column];
    if (!card.faceUp) {
      const flippedGame = index === pile.length - 1 ? flipTableauCard(game, column) : null;
      const revealedCard = flippedGame?.tableau[column].at(-1);
      if (flippedGame && revealedCard?.rank === 1) {
        applyGame(moveAceToFoundation(flippedGame, { kind: "tableau", column, index: pile.length - 1 }));
      } else {
        applyGame(flippedGame);
      }
      return;
    }
    if (selection) {
      moveSelectionToTableau(column);
      return;
    }
    selectCard({ kind: "tableau", column, index, cardId: card.id });
  };

  const onFoundationPress = (suit: Suit) => {
    if (selection) {
      applyGame(moveToFoundation(game, selection));
      return;
    }
    const card = game.foundations[suit].at(-1);
    if (card) selectCard({ kind: "foundation", suit, cardId: card.id });
  };

  const onWastePress = () => {
    const card = game.waste.at(-1);
    if (card) selectCard({ kind: "waste", cardId: card.id });
  };

  const runAutoComplete = () => {
    const completed = autoComplete(game);
    if (completed === game) {
      showTimedHint("지금은 자동 정리할 수 있는 카드가 없습니다.");
      haptic.error();
      return;
    }
    showTimedHint("가능한 카드를 자동으로 정리했습니다.");
    applyGame(completed, isWon(completed));
  };

  const difficulty = getDifficulty(game.level);
  const cardBackTheme = getCardBackTheme(getChapterForStage(game.level));
  const battleContent = getBattleContent(game.level, isLandscape);
  const companionRoster = getCompanionRoster();
  const selectedCompanion = companionRoster.find((candidate) => candidate.id === selectedCompanionId) ?? battleContent.companion;
  const bossWarningOpacity = bossIntroProgress.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const bossWarningScale = bossIntroProgress.interpolate({ inputRange: [0, 0.22, 0.82, 1], outputRange: [0.82, 1, 1.04, 0.94] });
  const companionAttackStyle = getCompanionAttackStyle(selectedCompanion);
  const companionAttackColor = companionAttackColors[companionAttackStyle];
  const companionSize = Math.max(68, Math.round(cardWidth * 1.64));
  const companionLeft = phoneLandscape ? Math.max(8, Math.round((sideRailWidth - companionSize) * 0.5)) : Math.max(10, Math.round((safeScreenWidth - companionSize) * 0.5));
  const companionBottom = bottomControlsBottom + 52;
  const companionCenterLeft = companionLeft + companionSize * 0.5 - cardWidth * 0.5;
  const companionCenterBottom = companionBottom + companionSize * 0.5 - cardWidth * cardRatio * 0.5;
  const flightStartLeft = companionCenterLeft;
  const flightStartBottom = companionCenterBottom;
  const flightTravelX = phoneLandscape ? 0 : isLandscape ? Math.round(safeScreenWidth * 0.04) : Math.round(safeScreenWidth * 0.05);
  const monsterTargetTop = rootTopPadding + (isLandscape ? (phoneLandscape ? 116 : 82) : 152);
  const flightTravelY = getAttackTravelY(safeScreenHeight, flightStartBottom, cardWidth * cardRatio, monsterTargetTop);

  useEffect(() => {
    if (!hydrated || !battleContent.isBoss || bossWarningStageRef.current === battleContent.stage) return;
    bossWarningStageRef.current = battleContent.stage;
    setShowBossWarning(true);
    bossIntroProgress.setValue(0);
    screenShake.setValue(0);
    const warning = Animated.timing(bossIntroProgress, { toValue: 1, duration: 1150, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const shake = Animated.sequence([
      Animated.delay(110),
      Animated.timing(screenShake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0.75, duration: 70, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -0.55, duration: 70, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0.3, duration: 60, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]);
    Animated.parallel([warning, shake]).start(({ finished }) => {
      if (finished) setShowBossWarning(false);
    });
    return () => { warning.stop(); shake.stop(); };
  }, [battleContent.isBoss, battleContent.stage, bossIntroProgress, hydrated, screenShake]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <Animated.View style={[styles.root, { paddingTop: rootTopPadding, paddingBottom: rootBottomPadding, transform: [{ translateX: screenShake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }] }, isLandscape && styles.rootLandscape, phoneLandscape && styles.rootPhoneLandscape]}>
        <MedievalBackdrop source={battleContent.background} />
        {showBossWarning ? <Animated.View pointerEvents="none" style={[styles.bossWarning, { opacity: bossWarningOpacity, transform: [{ scale: bossWarningScale }] }]}><Text style={styles.bossWarningEyebrow}>WARNING · BOSS INCOMING</Text><Text style={styles.bossWarningTitle}>{battleContent.monster.name}</Text><Text style={styles.bossWarningCopy}>새로운 수호자가 전장에 나타났습니다</Text></Animated.View> : null}
        {flyingCard ? <FlyingCard card={flyingCard} width={cardWidth} cardRatio={cardRatio} progress={flightProgress} travelX={flightTravelX} travelY={flightTravelY} startLeft={flightStartLeft} startBottom={flightStartBottom} flightColor={companionAttackColor} /> : null}
        <VictoryFireworks visible={showFireworks} />
        {attackToken ? <CardAttackEffect key={attackToken} kind={attackKind} combo={comboAttack} effectColor={companionAttackColor} startLeft={flightStartLeft} startBottom={flightStartBottom} travelX={flightTravelX} travelY={flightTravelY} /> : null}
        <View style={[styles.header, isLandscape && styles.headerLandscape, compactLandscape && styles.headerLandscapeCompact, phoneLandscape && styles.headerPhoneLandscape, phoneLandscape && { width: sideRailWidth }]}>
          <View style={phoneLandscape && styles.headerTitlePhoneLandscape}>
            <Text style={styles.eyebrow}>OUR STYLE</Text>
            <View style={styles.titleLine}>
              <Text style={[styles.title, { fontSize: Math.round((compactLandscape ? 23 : 27) * (isLandscape ? 1 : uiScale)), lineHeight: Math.round((compactLandscape ? 27 : 31) * (isLandscape ? 1 : uiScale)) }]}>Solitaire</Text>
              <View style={styles.levelBadge}><Text style={styles.levelText}>LV {battleContent.chapter} · STAGE {game.level}</Text></View>
            </View>
          </View>
          {isLandscape ? <View style={[styles.landscapeHeaderBanner, phoneLandscape && styles.landscapeHeaderBannerPhone]}><AdBanner compact inline /></View> : null}
          <View style={[styles.headerActions, compactControls && styles.headerActionsCompact, phoneLandscape && styles.headerActionsPhoneLandscape]}>
            <Pressable accessibilityRole="button" accessibilityLabel="가능한 카드 자동 정리" onPress={runAutoComplete} style={({ pressed }) => [styles.autoButton, compactControls && styles.autoButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="auto" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="새 게임" onPress={requestNewGame} style={({ pressed }) => [styles.newButton, compactControls && styles.newButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="new" size={23} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={isLandscape ? "세로 모드로 전환" : "가로 모드로 전환"} onPress={toggleOrientation} style={({ pressed }) => [styles.orientationButton, compactControls && styles.iconButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="orientation" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="사운드 설정" onPress={() => { haptic.light(); setPaused(true); setSheet("sound"); }} style={({ pressed }) => [styles.soundButton, compactControls && styles.iconButtonCompact, !soundEffectsEnabled && !backgroundMusicEnabled && styles.soundButtonOff, pressed && styles.pressed]}>
              <MedievalIcon name={soundEffectsEnabled || backgroundMusicEnabled ? "sound" : "soundOff"} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, compactControls && styles.iconButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="menu" size={19} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.stats, isLandscape && styles.statsLandscape, compactLandscape && styles.statsLandscapeCompact, phoneLandscape && styles.statsPhoneLandscape, phoneLandscape && { width: sideRailWidth }]}>
          <View style={[styles.statsSummary, phoneLandscape && styles.statsSummaryPhoneLandscape]}>
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.score}</Text><Text style={styles.statLabel}>점수</Text></View>
            <View style={styles.statDivider} />
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.moves}</Text><Text style={styles.statLabel}>이동</Text></View>
            <View style={styles.statDivider} />
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{formatDuration(elapsedSeconds)}</Text><Text style={styles.statLabel}>시간</Text></View>
          </View>
          <MonsterBattle compact={compact || compactLandscape} landscape={isLandscape} phoneLandscape={phoneLandscape} travelDistance={isLandscape ? Math.max(110, Math.min(260, Math.round(safeScreenWidth * 0.2))) : 44} damage={lastDamage} hp={Math.max(0, 100 - (SUITS.reduce((total, suit) => total + game.foundations[suit].length, 0) / 52) * 100)} attackKind={attackKind} attackToken={attackToken} combo={comboAttack} monster={battleContent.monster} isBoss={battleContent.isBoss} cardSize={cardWidth} />
          <View style={[styles.statusWrap, isLandscape && styles.statusWrapLandscape, compactControls && !isLandscape && styles.statusWrapCompact, phoneLandscape && styles.statusWrapPhoneLandscape]}>
            <View style={[styles.statusDot, selection ? styles.statusDotSelected : styles.statusDotReady]} />
            <Text numberOfLines={1} style={styles.statusText}>{hydrated ? (selection ? "이동할 곳을 탭하세요" : "카드를 선택하세요") : "게임 준비 중"}</Text>
          </View>
        </View>

        <Animated.View style={[styles.boardTransition, { opacity: layoutTransition, transform: [{ scale: layoutTransition }] }]}>
        <View style={[styles.board, { width: boardWidth }, isLandscape && styles.boardLandscape, phoneLandscape && styles.boardPhoneLandscape]}>
        <View style={[styles.topPiles, isLandscape && styles.topPilesLandscape]}>
          <View style={styles.stockWasteGroup}>
            {game.stock.length ? (
              <CardBack width={cardWidth} cardRatio={cardRatio} theme={cardBackTheme} onPress={drawStockCard} />
            ) : (
              <EmptySlot width={cardWidth} cardRatio={cardRatio} label={game.waste.length ? "↻" : ""} onPress={() => applyGame(drawFromStock(game))} />
            )}
            {game.waste.at(-1) ? (
              <CardFace card={game.waste.at(-1)!} width={cardWidth} cardRatio={cardRatio} chapter={battleContent.chapter} selected={selection?.kind === "waste"} onPress={onWastePress} onDoublePress={() => autoMoveToFoundation({ kind: "waste" })} />
            ) : (
              <EmptySlot width={cardWidth} cardRatio={cardRatio} label="" />
            )}
          </View>
          <View style={[styles.foundationGroup, { gap: Math.max(3, Math.round(cardWidth * 0.08)) }]}>
            {SUITS.map((suit) => {
              const card = game.foundations[suit].at(-1);
              return card ? (
                <CardFace key={suit} card={card} width={cardWidth} cardRatio={cardRatio} chapter={battleContent.chapter} selected={selection?.kind === "foundation" && selection.suit === suit} onPress={() => onFoundationPress(suit)} onDragEnd={(dx, dy) => dragMoveCard({ kind: "foundation", suit }, dx, dy)} />
              ) : (
                <EmptySlot key={suit} width={cardWidth} cardRatio={cardRatio} label={suitSymbols[suit]} onPress={() => onFoundationPress(suit)} />
              );
            })}
          </View>
        </View>

        <View style={[styles.tableau, { gap: tableauGap }, isLandscape && styles.tableauLandscape]}>
          {game.tableau.map((pile, column) => (
            <View key={`column-${column}`} style={[styles.tableauColumn, { width: cardWidth, minHeight: cardWidth * cardRatio }]}>
              {pile.length === 0 ? <EmptySlot width={cardWidth} cardRatio={cardRatio} label="K" onPress={() => moveSelectionToTableau(column)} /> : null}
              {pile.map((card, index) => (
                <View key={card.id} style={{ position: "absolute", top: index * stackOffset, left: 0, zIndex: index }}>
                  {card.faceUp ? (
                    <CardFace card={card} width={cardWidth} cardRatio={cardRatio} chapter={battleContent.chapter} selected={selection?.cardId === card.id} onPress={() => onTableauPress(column, index, card)} onDoublePress={() => autoMoveToFoundation({ kind: "tableau", column, index })} onDragEnd={(dx, dy) => dragMoveCard({ kind: "tableau", column, index }, dx, dy)} />
                  ) : (
                    <CardBack width={cardWidth} cardRatio={cardRatio} theme={cardBackTheme} onPress={() => onTableauPress(column, index, card)} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
        </View>
        </Animated.View>

        {!isLandscape ? <View style={[styles.portraitAdBanner, { bottom: portraitBannerBottom }]}><AdBanner /></View> : null}
        <CompanionAnchor companion={selectedCompanion} size={companionSize} left={companionLeft} bottom={companionBottom} />
                <View style={[styles.bottomControls, isLandscape && styles.bottomControlsLandscape, compactLandscape && styles.bottomControlsLandscapeCompact, phoneLandscape && styles.bottomControlsPhoneLandscape, phoneLandscape && { width: sideRailWidth }, { bottom: bottomControlsBottom }]}> 

          <Pressable accessibilityRole="button" accessibilityLabel="힌트 보기" onPress={showHint} style={({ pressed }) => [styles.bottomButton, phoneLandscape && styles.bottomButtonPhoneLandscape, styles.hintButton, pressed && styles.pressed]}>
            <View style={styles.bottomButtonContent}><MedievalIcon name="hint" size={20} /><Text style={styles.bottomButtonText}>힌트</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`실행 취소, ${undoStack.length}회 남음`} disabled={undoStack.length === 0} onPress={undoLastMove} style={({ pressed }) => [styles.bottomButton, phoneLandscape && styles.bottomButtonPhoneLandscape, styles.undoButton, undoStack.length === 0 && styles.undoButtonDisabled, pressed && styles.pressed]}>
            <View style={styles.bottomButtonContent}><MedievalIcon name="undo" size={20} /><Text style={styles.bottomButtonText}>실행 취소 ({undoStack.length})</Text></View>
          </Pressable>
        </View>
        {hintMessage ? <View style={[styles.hintToast, isLandscape && styles.hintToastLandscape, phoneLandscape && { left: 8, right: undefined, width: Math.max(160, sideRailWidth - 16), bottom: 160 }]}><Text style={styles.hintToastText}>{hintMessage}</Text></View> : null}

        <Modal transparent visible={sheet !== null} animationType="fade" onRequestClose={() => { setPaused(false); setSheet(null); }}>
          <View style={styles.modalBackdrop}>
            <View style={styles.sheet}>
              {sheet === "menu" ? (
                <>
                  <Text style={styles.sheetEyebrow}>PAUSED</Text>
                  <Text style={styles.sheetTitle}>잠시 쉬어가세요</Text>
                  <Text style={styles.sheetCopy}>현재 게임은 기기에 자동으로 저장됩니다.</Text>
                  <Pressable onPress={() => { haptic.light(); setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>게임 계속하기</Text></Pressable>
                  <View style={styles.sheetRow}>
                    <Pressable onPress={() => { haptic.light(); setSheet("records"); }} style={({ pressed }) => [styles.sheetSecondaryButton, pressed && styles.pressed]}><Text style={styles.sheetSecondaryText}>기록</Text></Pressable>
                    <Pressable onPress={() => { haptic.light(); setSheet("rules"); }} style={({ pressed }) => [styles.sheetSecondaryButton, pressed && styles.pressed]}><Text style={styles.sheetSecondaryText}>규칙</Text></Pressable>
                  </View>
                  <Pressable onPress={() => { haptic.light(); setSheet("companions"); }} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>전투 캐릭터 선택</Text></Pressable>
                  <Pressable onPress={requestNewGame} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>새 게임 시작</Text></Pressable>
                </>
              ) : null}
              {sheet === "sound" ? (
                <>
                  <Text style={styles.sheetEyebrow}>AUDIO SETTINGS</Text>
                  <Text style={styles.sheetTitle}>소리 설정</Text>
                  <Text style={styles.sheetCopy}>효과음과 배경음을 각각 켜고 끌 수 있습니다.</Text>
                  <View style={styles.soundSettings}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: soundEffectsEnabled }} onPress={() => setSoundEffectsEnabledPreference(!soundEffectsEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, soundEffectsEnabled && styles.checkBoxChecked]}>{soundEffectsEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                      <View style={styles.audioOptionCopy}><Text style={styles.audioOptionTitle}>효과음</Text><Text style={styles.audioOptionSubtitle}>카드 선택·이동·공격 소리</Text></View>
                    </Pressable>
                    <VolumeSlider label="효과음 볼륨" value={soundEffectsVolume} onChange={setSoundEffectsVolumePreference} disabled={!soundEffectsEnabled} />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: backgroundMusicEnabled }} onPress={() => setBackgroundMusicEnabledPreference(!backgroundMusicEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, backgroundMusicEnabled && styles.checkBoxChecked]}>{backgroundMusicEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                      <View style={styles.audioOptionCopy}><Text style={styles.audioOptionTitle}>배경음</Text><Text style={styles.audioOptionSubtitle}>성채 분위기의 반복 배경음</Text></View>
                    </Pressable>
                    <VolumeSlider label="배경음 볼륨" value={backgroundMusicVolume} onChange={setBackgroundMusicVolumePreference} disabled={!backgroundMusicEnabled} />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: cardSelectVibrationEnabled }} onPress={() => setCardSelectVibrationPreference(!cardSelectVibrationEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, cardSelectVibrationEnabled && styles.checkBoxChecked]}>{cardSelectVibrationEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                      <View style={styles.audioOptionCopy}><Text style={styles.audioOptionTitle}>카드 선택 진동</Text><Text style={styles.audioOptionSubtitle}>카드를 선택할 때 가볍게 진동</Text></View>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>닫기</Text></Pressable>
                </>
              ) : null}
              {sheet === "companions" ? (
                <>
                  <Text style={styles.sheetEyebrow}>COMPANION SLOTS</Text>
                  <Text style={styles.sheetTitle}>전투 캐릭터 선택</Text>
                  <Text style={styles.companionPickerCopy}>원하는 동료를 선택하면 다음 공격부터 전투에 함께합니다. 새 캐릭터는 roster에 슬롯을 추가해 확장할 수 있습니다.</Text>
                  <View style={styles.companionGrid}>
                    {companionRoster.map((companion) => {
                      const selected = companion.id === selectedCompanionId;
                      return <Pressable key={companion.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setSelectedCompanionId(companion.id); haptic.light(); }} style={({ pressed }) => [styles.companionChoice, selected && styles.companionChoiceSelected, pressed && styles.pressed]}>
                        <Image source={companion.image} resizeMode="contain" style={styles.companionChoiceImage} accessibilityLabel={companion.name} />
                        <Text style={styles.companionChoiceName} numberOfLines={2}>{companion.name}</Text>
                        {selected ? <Text style={styles.companionChoiceCheck}>✓</Text> : null}
                      </Pressable>;
                    })}
                  </View>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>선택 완료</Text></Pressable>
                </>
              ) : null}
              {sheet === "records" ? (
                <>
                  <Text style={styles.sheetEyebrow}>YOUR PLAY</Text>
                  <Text style={styles.sheetTitle}>내 기록</Text>
                  <View style={styles.recordGrid}>
                    <View style={styles.recordCard}><Text style={styles.recordValue}>{records.wins}</Text><Text style={styles.recordLabel}>승리</Text></View>
                    <View style={styles.recordCard}><Text style={styles.recordValue}>{records.bestScore}</Text><Text style={styles.recordLabel}>최고 점수</Text></View>
                    <View style={styles.recordCard}><Text style={styles.recordValue}>{records.bestTimeSeconds === null ? "—" : formatDuration(records.bestTimeSeconds)}</Text><Text style={styles.recordLabel}>최단 시간</Text></View>
                  </View>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>뒤로</Text></Pressable>
                </>
              ) : null}
              {sheet === "rules" ? (
                <>
                  <Text style={styles.sheetEyebrow}>HOW TO PLAY</Text>
                  <Text style={styles.sheetTitle}>클론다이크 규칙</Text>
                  <Text style={styles.rulesText}>카드는 색을 번갈아 놓으면서 숫자가 하나씩 낮아지게 쌓습니다. 빈 열에는 K만 놓을 수 있습니다. A부터 같은 무늬 순서로 위쪽 파운데이션을 모두 완성하면 승리합니다.</Text>
                  <Text style={styles.rulesHint}>카드를 탭한 뒤 이동할 곳을 탭하세요. 스톡을 탭하면 새 카드가 한 장 나옵니다.</Text>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>알겠습니다</Text></Pressable>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showNewGameConfirm} animationType="fade" onRequestClose={() => { setShowNewGameConfirm(false); setPaused(false); }}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.sheetEyebrow}>NEW GAME</Text>
              <Text style={styles.sheetTitle}>새 게임을 시작할까요?</Text>
              <Text style={styles.sheetCopy}>현재 진행 중인 카드와 점수는 새 게임으로 바뀝니다.</Text>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => { setShowNewGameConfirm(false); setPaused(false); }} style={({ pressed }) => [styles.confirmCancel, pressed && styles.pressed]}><Text style={styles.confirmCancelText}>취소</Text></Pressable>
                <Pressable onPress={() => startNewGame()} style={({ pressed }) => [styles.confirmStart, pressed && styles.pressed]}><Text style={styles.confirmStartText}>새 게임</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11182C", paddingHorizontal: 12 },
  medievalBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  medievalBackdropImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 1 },
  medievalBackdropDim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0, 0, 0, 0.50)" },
  rootLandscape: { paddingHorizontal: 16 },
  rootPhoneLandscape: { paddingHorizontal: 8, position: "relative" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 12 },
  headerLandscape: { paddingTop: 0, paddingBottom: 3 },
  headerLandscapeCompact: { paddingBottom: 1 },
  headerPhoneLandscape: { position: "absolute", left: 0, top: 4, height: 120, paddingTop: 0, paddingBottom: 0, flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", zIndex: 6 },
  headerTitlePhoneLandscape: { height: 42 },
  headerActionsPhoneLandscape: { position: "absolute", left: 0, right: 0, bottom: 0, justifyContent: "flex-start" },
  landscapeHeaderBanner: { flex: 1, minWidth: 0, maxWidth: 320, height: 50, marginHorizontal: 14, alignItems: "center", justifyContent: "center" },
  landscapeHeaderBannerPhone: { flex: 0, width: "100%", maxWidth: 260, height: 42, marginHorizontal: 0, marginVertical: 6 },
  eyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "800", letterSpacing: 2.2 },
  title: { color: "#FFFDF8", fontSize: 27, lineHeight: 31, fontWeight: "800", letterSpacing: -0.7 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  levelText: { color: "#77D6C3", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerActionsCompact: { gap: 3 },
  autoButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 17, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  autoButtonText: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  autoButtonCompact: { paddingHorizontal: 7, minHeight: 30 },
  newButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#FF7A66" },
  newButtonText: { color: "#11182C", fontSize: 22, lineHeight: 24, fontWeight: "600" },
  newButtonCompact: { width: 30, height: 30, borderRadius: 15 },
  orientationButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  orientationButtonText: { color: "#77D6C3", fontSize: 17, lineHeight: 20, fontWeight: "900" },
  iconButtonCompact: { width: 28, height: 28, borderRadius: 14 },
  soundButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  soundButtonOff: { backgroundColor: "#1A2944", borderColor: "#294264" },
  soundButtonText: { color: "#77D6C3", fontSize: 18, lineHeight: 20, fontWeight: "900" },
  menuButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958" },
  menuButtonText: { color: "#FFFDF8", fontSize: 19, lineHeight: 16, fontWeight: "900", marginTop: -8 },
  stats: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#2E4163", paddingVertical: 8, marginBottom: 14 },
  statsSummary: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start" },
  statsSummaryPhoneLandscape: { width: "100%" },
  statsLandscape: { paddingVertical: 3, marginBottom: 6 },
  statsLandscapeCompact: { paddingVertical: 1, marginBottom: 4 },
  statsPhoneLandscape: { position: "absolute", left: 0, top: 128, flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", paddingVertical: 6, marginBottom: 0, zIndex: 5 },
  statValue: { color: "#FFFDF8", fontSize: 15, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  statLabel: { color: "#A6B4CE", fontSize: 9, fontWeight: "700", marginTop: 1, textAlign: "center" },
  statDivider: { width: 1, height: 22, marginHorizontal: 10, backgroundColor: "#2E4163" },
  statusWrap: { flex: 1, minWidth: 92, marginLeft: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  statusWrapLandscape: { flex: 0, width: 140, minWidth: 140 },
  statusWrapCompact: { minWidth: 0, marginLeft: 4, gap: 3 },
  statusWrapPhoneLandscape: { flex: 0, width: "100%", minWidth: 0, marginLeft: 0, marginTop: 14, justifyContent: "flex-start" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotReady: { backgroundColor: "#77D6C3" },
  statusDotSelected: { backgroundColor: "#FF7A66" },
  statusText: { color: "#A6B4CE", fontSize: 10, fontWeight: "600" },
  monsterBattle: { flex: 1.4, minWidth: 154, maxWidth: 236, marginLeft: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, overflow: "visible" },
  monsterBattleLandscape: { flex: 1, minWidth: 250, maxWidth: 9999 },
  monsterBattleCompact: { flex: 1.1, minWidth: 82, maxWidth: 128, marginLeft: 4, gap: 3 },
  monsterBattlePhoneLandscape: { flex: 0, width: "100%", minWidth: 0, maxWidth: 9999, marginLeft: 0, marginTop: 12, justifyContent: "flex-start", gap: 6 },
  monsterSpriteWrap: { width: 50, height: 54, alignItems: "center", justifyContent: "center", position: "relative" },
  monsterSpriteWrapCompact: { width: 32, height: 38 },
  monsterSprite: { width: 50, height: 54 },
  monsterSpriteCompact: { width: 34, height: 38 },
  monsterInfo: { width: 68, alignItems: "flex-start", transform: [{ translateX: 10 }] },
  monsterInfoCompact: { width: 54, transform: [{ translateX: 10 }] },
  monsterInfoPortrait: { transform: [{ translateX: 30 }] },
  companionSprite: { width: 34, height: 38, marginHorizontal: 1 },
  companionSpriteCompact: { width: 27, height: 31 },
  monsterNameRow: { flexDirection: "row", alignItems: "flex-start", gap: 3, width: "100%" },
  monsterName: { flex: 1, color: "#F3C969", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  bossBadge: { color: "#11182C", backgroundColor: "#F3C969", borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1, fontSize: 5, fontWeight: "900" },
  monsterBar: { width: "100%", height: 7, marginTop: 3, overflow: "hidden", borderRadius: 4, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  monsterBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#FF6F8A" },
  monsterHp: { color: "#BCEAE2", fontSize: 8, fontWeight: "800", marginTop: 2 },
  monsterProjectile: { position: "absolute", left: 8, top: 12, fontSize: 24, fontWeight: "900", textShadowColor: "#FFFFFF", textShadowRadius: 7 },
  companionAnchor: { position: "absolute", zIndex: 22, alignItems: "center", justifyContent: "center" },
  attackCard: { position: "absolute", left: "43%", bottom: "14%", zIndex: 45, width: 34, height: 48, borderRadius: 6, borderWidth: 2, backgroundColor: "#FFFDF8", shadowColor: "#FFFFFF", shadowOpacity: 0.9, shadowRadius: 8, elevation: 12 },
  attackCardRank: { position: "absolute", top: 3, left: 4, fontSize: 12, fontWeight: "900" },
  attackCardSuit: { position: "absolute", top: 15, width: "100%", textAlign: "center", fontSize: 21, fontWeight: "900" },
  damageText: { position: "absolute", top: -2, right: -18, color: "#FFD66E", fontSize: 16, fontWeight: "900", textShadowColor: "#5B1F38", textShadowRadius: 4 },
  monsterDefeated: { opacity: 0.28 },
  defeatBurst: { position: "absolute", width: 8, height: 8, left: 22, top: 24, alignItems: "center", justifyContent: "center" },
  defeatSpark: { position: "absolute", color: "#FFD66E", fontSize: 19, fontWeight: "900", textShadowColor: "#FF6F8A", textShadowRadius: 8 },
  boardTransition: { flex: 1, alignItems: "center" },
  board: { alignSelf: "center" },
  boardLandscape: { flex: 1, justifyContent: "flex-start" },
  boardPhoneLandscape: { position: "absolute", right: 8, top: 88, alignSelf: "auto" },
  topPiles: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  topPilesLandscape: { marginBottom: 6 },
  stockWasteGroup: { flexDirection: "row", gap: 6 },
  foundationGroup: { flexDirection: "row", gap: 4 },
  slot: { borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3C557D", alignItems: "center", justifyContent: "center", backgroundColor: "#182744" },
  slotLabel: { color: "#58739D", fontSize: 15, fontWeight: "900" },
  card: { position: "relative", overflow: "hidden", borderRadius: 7, borderWidth: 1, backgroundColor: "#FFFDF8", shadowColor: "#050912", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardSelected: { transform: [{ translateY: -7 }], borderWidth: 2.5, shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  rankTop: { position: "absolute", fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitTop: { position: "absolute", fontSize: 12, lineHeight: 13, fontWeight: "900" },
  suitCenter: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 28, fontWeight: "900" },
  royalPortrait: { position: "absolute", top: "24%", left: "13%", width: "74%", height: "61%" },
  bottomMark: { position: "absolute", right: 5, bottom: 3, transform: [{ rotate: "180deg" }], alignItems: "center" },
  rankBottom: { fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitBottom: { fontSize: 12, lineHeight: 12, fontWeight: "900" },
  cardBack: { borderColor: "#0C1222", backgroundColor: "#77D6C3", padding: 4 },
  backInner: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 4, backgroundColor: "#1E3153", borderWidth: 1, borderColor: "#9BE4D5" },
  backMark: { color: "#77D6C3", fontSize: 26, fontWeight: "900" },
  tableau: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tableauLandscape: { flexGrow: 0 },
  tableauColumn: { position: "relative" },
  portraitAdBanner: { position: "absolute", left: 0, right: 0, zIndex: 9, alignItems: "center" },
  bottomControls: { position: "absolute", left: 0, right: 0, bottom: 58, zIndex: 10, flexDirection: "row", alignSelf: "center", justifyContent: "center", gap: 10 },
  bottomControlsLandscape: { bottom: 4 },
  bottomControlsLandscapeCompact: { gap: 8 },
  bottomControlsPhoneLandscape: { left: 0, flexDirection: "row", alignItems: "stretch", justifyContent: "flex-start", gap: 6 },
  bottomButton: { minWidth: 126, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 15, borderWidth: 1 },
  bottomButtonPhoneLandscape: { flex: 1, minWidth: 0, minHeight: 44 },
  hintButton: { backgroundColor: "#233958", borderColor: "#3D5A85" },
  undoButton: { backgroundColor: "#2A4268", borderColor: "#5B78A5" },
  undoButtonDisabled: { opacity: 0.38 },
  bottomButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  bottomButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hintToast: { position: "absolute", left: 16, right: 16, bottom: 56, zIndex: 20, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  hintToastLandscape: { bottom: 60 },
  hintToastText: { color: "#BCEAE2", fontSize: 12, fontWeight: "700", textAlign: "center" },
  flyingTrail: { position: "absolute", height: 4, borderRadius: 2, zIndex: 29, shadowOpacity: 0.85, shadowRadius: 8, elevation: 8 },
  flyingCard: { position: "absolute", left: 16, bottom: 44, zIndex: 30, overflow: "hidden", borderRadius: 8, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF7A66", shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 9, elevation: 12 },
  flyingRank: { position: "absolute", top: 6, left: 7, fontSize: 16, fontWeight: "900" },
  flyingSuit: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 30, fontWeight: "900" },
  fireworkLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: "center", justifyContent: "center" },
  bossWarning: { position: "absolute", top: "38%", left: 18, right: 18, zIndex: 60, alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: "rgba(94, 28, 48, 0.94)", borderWidth: 2, borderColor: "#F3C969", shadowColor: "#FF6F8A", shadowOpacity: 0.75, shadowRadius: 16, elevation: 16 },
  bossWarningEyebrow: { color: "#FFE7A2", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  bossWarningTitle: { color: "#FFFDF8", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 4, textAlign: "center" },
  bossWarningCopy: { color: "#FFC1B4", fontSize: 11, fontWeight: "800", marginTop: 4, textAlign: "center" },
  fireworkParticle: { position: "absolute", width: 10, height: 10, borderRadius: 5, shadowColor: "#FFFFFF", shadowOpacity: 0.8, shadowRadius: 5, elevation: 10 },
  victoryText: { position: "absolute", top: "43%", color: "#FFFDF8", fontSize: 28, fontWeight: "900", letterSpacing: 1.8, textShadowColor: "#FF7A66", textShadowRadius: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3, 7, 18, 0.76)" },
  sheet: { backgroundColor: "#1E3153", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: "#45628E", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 34 },
  sheetEyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 1.7, marginBottom: 7 },
  sheetTitle: { color: "#FFFDF8", fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.6 },
  sheetCopy: { color: "#A6B4CE", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 21 },
  soundSettings: { gap: 10, marginTop: 2 },
  volumeSliderRow: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: "#12213A", borderWidth: 1, borderColor: "#2E4A70" },
  volumeSliderDisabled: { opacity: 0.45 },
  volumeSliderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  volumeSliderLabel: { color: "#CFE9E4", fontSize: 11, fontWeight: "800" },
  volumeSliderValue: { color: "#77D6C3", fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  volumeSliderTrack: { height: 20, justifyContent: "center", position: "relative" },
  volumeSliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: "#77D6C3" },
  volumeSliderThumb: { position: "absolute", top: 4, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF8A76" },
  audioOption: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  checkBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 2, borderColor: "#58739D", backgroundColor: "#11182C" },
  checkBoxChecked: { borderColor: "#77D6C3", backgroundColor: "#2B6B72" },
  checkMark: { color: "#FFFDF8", fontSize: 16, lineHeight: 18, fontWeight: "900" },
  audioOptionCopy: { flex: 1, marginLeft: 12 },
  audioOptionTitle: { color: "#FFFDF8", fontSize: 15, fontWeight: "900" },
  audioOptionSubtitle: { color: "#A6B4CE", fontSize: 11, fontWeight: "600", marginTop: 3 },
  sheetPrimaryButton: { minHeight: 50, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#FF7A66", marginTop: 21 },
  sheetPrimaryText: { color: "#11182C", fontSize: 15, fontWeight: "900" },
  sheetRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  sheetSecondaryButton: { flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center", borderRadius: 14, backgroundColor: "#2A4268", borderWidth: 1, borderColor: "#45628E" },
  sheetSecondaryText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
  sheetLinkButton: { alignSelf: "center", paddingVertical: 14, marginTop: 7 },
  sheetLinkText: { color: "#FF9E91", fontSize: 13, fontWeight: "800" },
  companionPickerCopy: { color: "#A6B4CE", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 16 },
  companionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  companionChoice: { width: "31%", minHeight: 116, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4, borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  companionChoiceSelected: { backgroundColor: "#2B6B72", borderColor: "#77D6C3", borderWidth: 2 },
  companionChoiceImage: { width: 58, height: 64 },
  companionChoiceName: { color: "#FFFDF8", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 6 },
  companionChoiceCheck: { position: "absolute", top: 6, right: 7, color: "#FFFDF8", fontSize: 16, fontWeight: "900" },
  recordGrid: { flexDirection: "row", gap: 8, marginTop: 20 },
  recordCard: { flex: 1, minHeight: 83, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A", paddingHorizontal: 4 },
  recordValue: { color: "#FFFDF8", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  recordLabel: { color: "#A6B4CE", fontSize: 10, fontWeight: "700", marginTop: 5 },
  rulesText: { color: "#FFFDF8", fontSize: 15, lineHeight: 23, marginTop: 17 },
  rulesHint: { color: "#77D6C3", fontSize: 13, lineHeight: 20, marginTop: 13 },
  confirmBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(3, 7, 18, 0.76)" },
  confirmCard: { borderRadius: 24, borderWidth: 1, borderColor: "#45628E", backgroundColor: "#1E3153", padding: 24 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  confirmCancel: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#2A4268", borderWidth: 1, borderColor: "#45628E" },
  confirmCancelText: { color: "#FFFDF8", fontSize: 15, fontWeight: "900" },
  confirmStart: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#FF7A66" },
  confirmStartText: { color: "#11182C", fontSize: 15, fontWeight: "900" },
});
