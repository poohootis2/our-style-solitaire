import { useEffect, useRef, useState } from "react";
import { Alert, Animated, AppState, Easing, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
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
  findAutoFoundationMove,
  isLateGameAutoFinishReady,
  createPlayableGame,
  drawFromStock,
  revealHiddenCardWithHammer,
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
  type GameState,
  type CardSource,
  type Suit,
  SUITS,
} from "@/lib/solitaire";
import { getBattleContent, getCompanionRoster, type BattleAsset } from "@/lib/battle-content";
import { PET_ROSTER } from "@/lib/pet-content";
import { showRewardedAd } from "@/components/rewarded-ad";
import { companionAttackColors, getCompanionAttackStyle, type CompanionAttackStyle } from "@/lib/companion-attack";
import { getAttackTravelY } from "@/lib/attack-layout";
import { isRunningInPreviewIframe } from "@/lib/_core/manus-runtime";

type Selection = CardSource & { cardId: string };
type ActiveFlight = {
  id: string;
  card: Card;
  variant: "normal" | "flaming";
  progress: Animated.Value;
  startLeft: number;
  startBottom: number;
  travelX: number;
  travelY: number;
  flightColor?: string;
};
type Sheet = "menu" | "rules" | "records" | "sound" | "companions" | null;
type Records = { wins: number; bestScore: number; bestTimeSeconds: number | null };

const CARD_RATIO = 1.42;
const ROYAL_SPRITE = require("../../assets/images/royal-card-sprite.png");
const RESET_MODAL_PANEL = { uri: "/manus-storage/solitaire-reset-modal-panel_5afc1a91.png" };
const RESET_BUTTONS_ART = { uri: "/manus-storage/solitaire-reset-buttons_31124c25.png" };
const FLAMING_CARD_ART = require("../../assets/images/flaming-card-attack.png");
const HAMMER_ICON_ART = require("../../assets/images/card-breaker-shark-hammer.png");
const HINT_BUTTON_ART = require("../../assets/images/hint-cartoon-button.webp");
const UNDO_BUTTON_ART = require("../../assets/images/undo-cartoon-button.webp");
const HAMMER_PLUS_ONE_BUTTON_ART = require("../../assets/images/hammer-plus-one-cartoon-button.webp");
const DAILY_CHECKIN_ART = require("../../assets/images/daily-checkin-cartoon-button.png");
const HAMMER_IMPACT_ART = { uri: "/manus-storage/hammer-impact-burst_f5d30cb2.png" };
const COMBO_IMPACT_ARTS = [
  { uri: "/manus-storage/combo-impact-burst-1_48b789ea.png" },
  { uri: "/manus-storage/combo-impact-burst-2_3dab5748.png" },
  { uri: "/manus-storage/combo-impact-burst-3_c70f5265.png" },
];
const ACTIVE_GAME_KEY = "our-style-solitaire:active-game";
const ACTIVE_GAME_SAVE_VERSION = 3;
const RECORDS_KEY = "our-style-solitaire:records";
const SOUND_ENABLED_KEY = "our-style-solitaire:sound-enabled";
const BACKGROUND_MUSIC_ENABLED_KEY = "our-style-solitaire:background-music-enabled";
const SOUND_EFFECTS_VOLUME_KEY = "our-style-solitaire:sound-effects-volume";
const BACKGROUND_MUSIC_VOLUME_KEY = "our-style-solitaire:background-music-volume";
const CARD_SELECT_VIBRATION_KEY = "our-style-solitaire:card-select-vibration";
const SELECTED_COMPANION_KEY = "our-style-solitaire:selected-companion";
const UNLOCKED_PETS_KEY = "our-style-solitaire:unlocked-pets";
const ATTENDANCE_KEY = "our-style-solitaire:attendance";
const INITIAL_UNLOCKED_PET_IDS = ["cloud-tiger", "gumiho-tail", "mochi-rabbit"];
const PHYSICAL_EDGE_INSET = 52;
const MAX_UNDO_STEPS = 3;
const CARD_ATTACK_FLIGHT_DURATION = 1500;
const FLAMING_CARD_FLIGHT_DURATION = CARD_ATTACK_FLIGHT_DURATION * 2;
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

function gameStateFingerprint(state: GameState): string {
  const cards = (pile: Card[]) => pile.map((card) => `${card.id}:${card.faceUp ? 1 : 0}`).join(",");
  return JSON.stringify({
    stock: cards(state.stock),
    waste: cards(state.waste),
    foundations: SUITS.map((suit) => [suit, cards(state.foundations[suit])]),
    tableau: state.tableau.map(cards),
    destroyed: cards(state.destroyedCards ?? []),
  });
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RoyalPortrait({ rank, chapter = 1 }: { rank: 11 | 12 | 13; chapter?: number }) {
  const chapterIndex = Math.max(0, Math.min(3, chapter - 1));
  const rowIndex = rank === 11 ? 0 : rank === 12 ? 1 : 2;

  return (
    <View pointerEvents="none" style={styles.royalPortrait}>
      <Image
        source={ROYAL_SPRITE}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
        style={[
          styles.royalSprite,
          {
            left: `${chapterIndex * -100}%`,
            top: `${rowIndex * -100}%`,
          },
        ]}
      />
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

function CompanionAnchor({ companion, size, left, bottom, horizontalShift, comboScale, onPress }: { companion: BattleAsset; size: number; left: number; bottom: number; horizontalShift: Animated.Value; comboScale: Animated.Value; onPress: () => void }) {
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
  return <Animated.View pointerEvents="box-none" style={[styles.companionAnchor, { width: size, height: size + 58, left, bottom, transform: [{ translateX: horizontalShift }, { scale: comboScale }] }]}> 
    <Pressable accessibilityRole="button" accessibilityLabel={`${companion.name}, 막힘 도움 보기`} onPress={onPress} style={({ pressed }) => [styles.companionPressTarget, pressed && styles.companionPressed]}>
      <Animated.View pointerEvents="none" style={[styles.companionImageFrame, { width: size, height: size, left: 0, top: 0, transform: [{ translateX }, { translateY }, { rotate }] }]}>
        <Image source={companion.image} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={`${companion.name}, 전투 동료`} />
      </Animated.View>
    </Pressable>
  </Animated.View>;
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
  isBoss = false,
}: {
  card: Card;
  width: number;
  cardRatio?: number;
  selected?: boolean;
  onPress?: () => void;
  onDoublePress?: () => void;
  onDragEnd?: (dx: number, dy: number) => void;
  chapter?: number;
  isBoss?: boolean;
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
  const bossShine = useRef(new Animated.Value(-1)).current;
  const dragEndRef = useRef(onDragEnd);
  dragEndRef.current = onDragEnd;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Boolean(dragEndRef.current && (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8)),
    onPanResponderRelease: (_, gesture) => dragEndRef.current?.(gesture.dx, gesture.dy),
  })).current;

  useEffect(() => {
    if (!isBoss) {
      bossShine.setValue(-1);
      return;
    }
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.timing(bossShine, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(bossShine, { toValue: -1, duration: 0, useNativeDriver: true }),
    ]));
    shineLoop.start();
    return () => shineLoop.stop();
  }, [bossShine, isBoss]);


  const shineTranslateX = bossShine.interpolate({ inputRange: [-1, 1], outputRange: [-width * 1.4, width * 1.4] });

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
        isBoss && styles.cardBoss,
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
      {isBoss ? <Animated.View pointerEvents="none" style={[styles.bossCardShine, { opacity: 0.9, transform: [{ translateX: shineTranslateX }, { rotate: "18deg" }] }]} /> : null}
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

function FlyingCard({ card, width, cardRatio = CARD_RATIO, progress, travelX = 0, travelY = -180, startLeft = 16, startBottom = 44, flightColor, flaming = false, monsterMotion, monsterTravelDistance = 0 }: { card: Card; width: number; cardRatio?: number; progress: Animated.Value; travelX?: number; travelY?: number; startLeft?: number; startBottom?: number; flightColor?: string; flaming?: boolean; monsterMotion?: Animated.Value; monsterTravelDistance?: number }) {
  const color = playingCardColor(card);
  const glow: Record<Suit, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const cardHeight = width * cardRatio;
  const glowColor = flightColor ?? glow[card.suit];
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelX] });
  const targetFollow = monsterMotion ? monsterMotion.interpolate({ inputRange: [0, 1], outputRange: [-monsterTravelDistance, monsterTravelDistance] }) : null;
  const followedTranslateX = targetFollow ? Animated.add(translateX, Animated.multiply(progress, targetFollow)) : translateX;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travelY] });
  const scale = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [1, 1.08, 0.5] });
  const opacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });
  const tailOpacity = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.95, 0.85, 0] });
  const tailScale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.05, 0.35] });
  const tailTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [18, -12] });
  const flameParticles = ["✦", "•", "✧", "•", "✦", "•"];
  return (
    <Animated.View pointerEvents="none" style={[flaming ? styles.flamingFlyingCard : styles.flyingCard, { left: startLeft, bottom: startBottom, width, height: flaming ? cardHeight * 1.14 : cardHeight, opacity, borderColor: glowColor, shadowColor: glowColor, transform: [{ translateX: followedTranslateX }, { translateY }, { scale }, { rotate }] }]}> 
      {flaming ? <>
        <Animated.View pointerEvents="none" style={[styles.flamingTailLayer, { opacity: tailOpacity, transform: [{ translateY: tailTranslateY }, { scale: tailScale }] }]}>
          {flameParticles.map((particle, index) => <Text key={`${particle}-${index}`} style={[styles.flamingTailParticle, { left: `${12 + index * 14}%`, top: `${18 + (index % 3) * 24}%`, color: index % 2 ? "#FF7A18" : "#FFD45C", fontSize: 10 + (index % 3) * 5 }]}>{particle}</Text>)}
        </Animated.View>
        <Image source={FLAMING_CARD_ART} resizeMode="contain" style={styles.flamingCardArt} />
      </> : <>
        <Text style={[styles.flyingRank, { color }]}>{rankLabels[card.rank]}</Text>
        <Text style={[styles.flyingSuit, { color }]}>{suitSymbols[card.suit]}</Text>
      </>}
    </Animated.View>
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

function MonsterBattle({ hp, damage, attackKind, attackToken, combo, compact = false, landscape = false, phoneLandscape = false, travelDistance = 24, monster, isBoss, cardSize, motionValue }: { hp: number; damage: number; attackKind: AttackKind; attackToken: number; combo: boolean; compact?: boolean; landscape?: boolean; phoneLandscape?: boolean; travelDistance?: number; monster: BattleAsset; isBoss: boolean; cardSize: number; motionValue?: Animated.Value }) {
  const internalMonsterMotion = useRef(new Animated.Value(1)).current;
  const monsterMotion = motionValue ?? internalMonsterMotion;
  const attackProgress = useRef(new Animated.Value(0)).current;
  const [facingLeft, setFacingLeft] = useState(true);
  const [attackVisible, setAttackVisible] = useState(false);
  const [damageVisible, setDamageVisible] = useState(false);
  const [defeatVisible, setDefeatVisible] = useState(false);
  const [impactVariant, setImpactVariant] = useState(0);
  const damageProgress = useRef(new Animated.Value(0)).current;
  const comboImpactProgress = useRef(new Animated.Value(0)).current;
  const hpFlash = useRef(new Animated.Value(0)).current;
  const defeatProgress = useRef(new Animated.Value(0)).current;
  const bossEntrance = useRef(new Animated.Value(isBoss ? 0 : 1)).current;

  useEffect(() => {
    let cancelled = false;
    const moveRightToLeft = () => {
      if (cancelled) return;
      setFacingLeft(true);
      Animated.timing(monsterMotion, { toValue: 0, duration: 4290, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished }) => {
        if (!finished || cancelled) return;
        setFacingLeft(false);
        Animated.timing(monsterMotion, { toValue: 1, duration: 4290, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished: returned }) => {
          if (returned && !cancelled) moveRightToLeft();
        });
      });
    };
    monsterMotion.setValue(1);
    moveRightToLeft();
    return () => { cancelled = true; monsterMotion.stopAnimation(); };
  }, [monsterMotion]);

  useEffect(() => {
    if (!attackToken) return;
    setAttackVisible(true);
    setDamageVisible(true);
    attackProgress.setValue(0);
    damageProgress.setValue(0);
    comboImpactProgress.setValue(0);
    setImpactVariant(combo ? (attackToken - 1) % COMBO_IMPACT_ARTS.length : (attackToken - 1) % COMBO_IMPACT_ARTS.length);
    hpFlash.setValue(0);
    Animated.parallel([
      Animated.timing(attackProgress, { toValue: 1, duration: combo ? 578 : 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(damageProgress, { toValue: 1, duration: combo ? 867 : 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(comboImpactProgress, { toValue: 1, duration: combo ? 578 : 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { setAttackVisible(false); setDamageVisible(false); });
  }, [attackToken, attackProgress, combo, comboImpactProgress, damageProgress, hpFlash]);

  useEffect(() => {
    bossEntrance.setValue(isBoss ? 0 : 1);
    if (!isBoss) return;
    const entrance = Animated.timing(bossEntrance, { toValue: 1, duration: 1050, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true });
    entrance.start();
    return () => entrance.stop();
  }, [bossEntrance, isBoss, monster.name]);

  useEffect(() => {
    const defeated = hp <= 0;
    setDefeatVisible(defeated);
    if (defeated) {
      defeatProgress.setValue(0);
      Animated.timing(defeatProgress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [defeatProgress, hp]);

  const monsterTranslate = monsterMotion.interpolate({ inputRange: [0, 1], outputRange: [-travelDistance, travelDistance] });
  const monsterScale = monsterMotion.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] });
  const projectileTranslate = attackProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 92] });
  const projectileScale = attackProgress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.15, 0.2] });
  const damageTranslateY = damageProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const damageOpacity = damageProgress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 1, 0] });
  const comboImpactOpacity = comboImpactProgress.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 0.92, 0] });
  const comboImpactScale = comboImpactProgress.interpolate({ inputRange: [0, 0.2, 0.72, 1], outputRange: [0.45, 1, 1.12, 0.72] });
  const comboImpactRotate = comboImpactProgress.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "16deg"] });
  const hpFlashOpacity = hpFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.92] });
  const bossEntranceScale = bossEntrance.interpolate({ inputRange: [0, 0.45, 1], outputRange: [2.6, 1.25, 1] });
  const bossEntranceTranslateY = bossEntrance.interpolate({ inputRange: [0, 1], outputRange: [-86, 0] });
  const bossEntranceOpacity = bossEntrance.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1] });
  const defeatScale = defeatProgress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.3, 1.6, 2.8] });
  const defeatOpacity = defeatProgress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1, 0] });
  const attackColors: Record<AttackKind, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const attackSymbols: Record<AttackKind, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  const spriteSize = Math.max(34, Math.round(cardSize * 0.9 * 1.3));
  const companionSize = Math.max(24, Math.round(cardSize * 0.62));
  const infoWidth = Math.max(54, Math.round(cardSize * 1.02));

  return (
    <View style={[styles.monsterBattle, landscape && styles.monsterBattleLandscape, compact && !landscape && styles.monsterBattleCompact, phoneLandscape && styles.monsterBattlePhoneLandscape]} accessibilityLabel={`몬스터 체력 ${Math.round(hp)}퍼센트`}>
      <Animated.View style={[styles.monsterSpriteWrap, compact && styles.monsterSpriteWrapCompact, { width: spriteSize, height: spriteSize, opacity: bossEntranceOpacity, transform: [{ translateX: monsterTranslate }, { translateY: bossEntranceTranslateY }, { scale: bossEntranceScale }] }]}>
        <Animated.View style={[styles.monsterImageLayer, { width: spriteSize, height: spriteSize, transform: [{ scale: monsterScale }, { scaleX: facingLeft ? -1 : 1 }] }]}>
          <Image source={monster.image} resizeMode="contain" style={[styles.monsterSprite, { width: spriteSize, height: spriteSize }, defeatVisible && styles.monsterDefeated]} accessibilityLabel={monster.name} />
          {attackVisible ? <Animated.View pointerEvents="none" style={[styles.comboImpactOverlay, { width: spriteSize * 0.9, height: spriteSize * 0.9, left: spriteSize * 0.05, top: spriteSize * 0.05, opacity: comboImpactOpacity, transform: [{ scale: comboImpactScale }, { rotate: comboImpactRotate }] }]}><Image source={COMBO_IMPACT_ARTS[impactVariant]} resizeMode="contain" style={styles.comboImpactImage} /></Animated.View> : null}
        </Animated.View>
        {attackVisible ? <Animated.Text style={[styles.monsterProjectile, { color: attackColors[attackKind], transform: [{ translateX: projectileTranslate }, { scale: projectileScale }] }]}>{attackSymbols[attackKind]}</Animated.Text> : null}
        {damageVisible ? <Animated.Text style={[styles.damageText, { opacity: damageOpacity, transform: [{ translateY: damageTranslateY }] }]}>−{damage}</Animated.Text> : null}
        {defeatVisible ? <Animated.View pointerEvents="none" style={[styles.defeatBurst, { opacity: defeatOpacity, transform: [{ scale: defeatScale }] }]}>{Array.from({ length: 12 }, (_, index) => <Text key={index} style={[styles.defeatSpark, { transform: [{ rotate: `${index * 30}deg` }, { translateY: -24 }] }]}>{index % 2 ? "✦" : "•"}</Text>)}</Animated.View> : null}
      </Animated.View>
      <View style={[styles.monsterInfo, { width: infoWidth }, compact && styles.monsterInfoCompact, isBoss && styles.monsterInfoBoss, !landscape && styles.monsterInfoPortrait]}>
        <View style={styles.monsterNameRow}><Text style={styles.monsterName} numberOfLines={2}>{monster.name.toUpperCase()}</Text></View>
        <View style={styles.monsterBar}><View style={[styles.monsterBarFill, { width: `${Math.max(0, Math.min(100, hp))}%` }]} /><Animated.View pointerEvents="none" style={[styles.monsterHpFlash, { opacity: hpFlashOpacity }]} /></View>
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
  // The game is intentionally portrait-only for consistent card sizing and safe touch targets.
  const isLandscape = false;
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
  const layoutExtraReservedHeight = isLandscape ? (phoneLandscape ? 16 : 18) : 58;
  const bottomControlsBottom = isLandscape ? systemBottomInset + 4 : Math.max(92, systemBottomInset + 28);
  // In portrait, keep the banner below the action buttons while reserving the
  // system navigation inset so it never sits under the home indicator.
  const portraitBannerBottom = Math.max(4, bottomControlsBottom - 64);
  const { boardWidth, cardWidth, cardRatio, compact, stackOffset, tableauGap, uiScale, sideRailWidth } = getGameLayout(
    safeScreenWidth,
    safeScreenHeight,
    rootTopPadding + rootBottomPadding,
    isLandscape,
    layoutExtraReservedHeight,
  );
  const compactControls = compact || compactLandscape;
  const monsterTravelDistance = isLandscape ? Math.max(160, Math.min(310, Math.round(safeScreenWidth * 0.2) + 50)) : 94;
  const [game, setGame] = useState(createPlayableGame);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [rulesTab, setRulesTab] = useState<"basic" | "cards" | "items">("basic");
  const [attendanceDay, setAttendanceDay] = useState(0);
  const [lastAttendanceDate, setLastAttendanceDate] = useState<string | null>(null);
  const [showAttendanceClaim, setShowAttendanceClaim] = useState(false);
  const [showAttendanceRewardFlight, setShowAttendanceRewardFlight] = useState(false);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [hydrated, setHydrated] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true);
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(0.9);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [cardSelectVibrationEnabled, setCardSelectVibrationEnabled] = useState(true);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [resetMode, setResetMode] = useState<"current" | "full">("full");
  const [flyingAttacks, setFlyingAttacks] = useState<ActiveFlight[]>([]);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [attackKind, setAttackKind] = useState<AttackKind>("clubs");
  const [lastDamage, setLastDamage] = useState(0);
  const [attackToken, setAttackToken] = useState(0);
  const [comboAttack, setComboAttack] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState("cloud-tiger");
  const [unlockedPetIds, setUnlockedPetIds] = useState<string[]>(INITIAL_UNLOCKED_PET_IDS);
  const [showTwoTouch, setShowTwoTouch] = useState(false);
  const [showNoMovesPopup, setShowNoMovesPopup] = useState(false);
  const [twoTouchOpensUsed, setTwoTouchOpensUsed] = useState(0);
  const [rewardedRevealUsed, setRewardedRevealUsed] = useState(0);
  const [rewardedAdError, setRewardedAdError] = useState<string | null>(null);
  const [rewardedRetrySlot, setRewardedRetrySlot] = useState<1 | 2>(1);
  const [showHammerOffer, setShowHammerOffer] = useState(false);
  const [hammerMode, setHammerMode] = useState(false);
  const [hammerCharges, setHammerCharges] = useState(0);
  const [hammerStrikeTarget, setHammerStrikeTarget] = useState<{ dx: number; dy: number } | null>(null);
  const showPreviewAttackTools = Platform.OS === "web" && (__DEV__ || isRunningInPreviewIframe());
  const [hammerImpactBurstTarget, setHammerImpactBurstTarget] = useState<{ dx: number; dy: number } | null>(null);
  const [showBossWarning, setShowBossWarning] = useState(false);
  const [undoStack, setUndoStack] = useState<typeof game[]>([]);
  const newGameStarted = useRef(false);
  const suppressNextShufflePromptRef = useRef(false);
  const rootRef = useRef<View | null>(null);
  const tableauBottomCardRefs = useRef<Array<View | null>>(Array.from({ length: 7 }, () => null));
  const companionAvoidanceShift = useRef(new Animated.Value(0)).current;
  const companionAvoidanceTargetRef = useRef(0);
  const [companionAvoidanceTarget, setCompanionAvoidanceTarget] = useState(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const flightProgress = useRef(new Animated.Value(0)).current;
  const monsterMotion = useRef(new Animated.Value(1)).current;
  const comboCompanionScale = useRef(new Animated.Value(1)).current;
  const hammerShine = useRef(new Animated.Value(0)).current;
  const hammerIdleMotion = useRef(new Animated.Value(0)).current;
  const hammerImpact = useRef(new Animated.Value(0)).current;
  const hammerStrike = useRef(new Animated.Value(0)).current;
  const hammerImpactBurst = useRef(new Animated.Value(0)).current;
  const hintAttention = useRef(new Animated.Value(0)).current;
  const attendanceRewardFlight = useRef(new Animated.Value(0)).current;
  const attendanceAttention = useRef(new Animated.Value(0)).current;
  const attendanceAttentionLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hintAttentionLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hintIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutTransition = useRef(new Animated.Value(1)).current;
  const bossIntroProgress = useRef(new Animated.Value(0)).current;
  const shuffleMotion = useRef(new Animated.Value(0)).current;
  const screenShake = useRef(new Animated.Value(0)).current;
  const bossWarningStageRef = useRef<number | null>(null);
  const stagnantMovesRef = useRef(0);
  const lastHintKeyRef = useRef<string | null>(null);
  const hintRepeatCountRef = useRef(0);
  const recentGameFingerprintsRef = useRef<string[]>([]);
  const autoFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewComboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishRunningRef = useRef(false);
  const selectPlayer = useAudioPlayer(require("../../assets/sounds/card-select.wav"));
  const movePlayer = useAudioPlayer(require("../../assets/sounds/card-move.wav"));
  const shufflePlayer = useAudioPlayer(require("../../assets/sounds/card-shuffle.wav"));
  const companionAttackPlayer = useAudioPlayer(require("../../assets/sounds/companion-attack.wav"));
  const foundationAttackPlayer = useAudioPlayer(require("../../assets/sounds/foundation-attack.wav"));
  const backgroundPlayer = useAudioPlayer(require("../../assets/sounds/medieval-solitaire-loop.mp3"));

  const stopHintAttention = () => {
    if (hintIdleTimerRef.current) {
      clearTimeout(hintIdleTimerRef.current);
      hintIdleTimerRef.current = null;
    }
    hintAttentionLoopRef.current?.stop();
    hintAttentionLoopRef.current = null;
    hintAttention.stopAnimation();
    hintAttention.setValue(0);
  };

  const resetHintAttention = () => {
    stopHintAttention();
    hintIdleTimerRef.current = setTimeout(() => {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(hintAttention, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(hintAttention, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(900),
      ]));
      hintAttentionLoopRef.current = loop;
      loop.start();
    }, 12000);
  };

  useEffect(() => {
    resetHintAttention();
    return () => stopHintAttention();
  }, []);

  useEffect(() => {
    attendanceAttentionLoopRef.current?.stop();
    attendanceAttention.stopAnimation();
    attendanceAttention.setValue(0);
    if (!hydrated || lastAttendanceDate === localDateKey()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(attendanceAttention, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(attendanceAttention, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(1100),
    ]));
    attendanceAttentionLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      attendanceAttention.stopAnimation();
      attendanceAttention.setValue(0);
    };
  }, [attendanceAttention, hydrated, lastAttendanceDate]);

  useEffect(() => {
    hammerShine.stopAnimation();
    hammerShine.setValue(0);
    if (hammerCharges <= 0) return;
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.timing(hammerShine, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(hammerShine, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(420),
    ]));
    shineLoop.start();
    return () => shineLoop.stop();
  }, [hammerCharges, hammerShine]);

  useEffect(() => {
    hammerIdleMotion.stopAnimation();
    hammerIdleMotion.setValue(0);
    if (hammerCharges <= 0 || hammerStrikeTarget) return;
    const idleLoop = Animated.loop(Animated.sequence([
      Animated.timing(hammerIdleMotion, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hammerIdleMotion, { toValue: -1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hammerIdleMotion, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    idleLoop.start();
    return () => idleLoop.stop();
  }, [hammerCharges, hammerIdleMotion, hammerStrikeTarget]);

  useEffect(() => {
    comboCompanionScale.stopAnimation();
    if (comboAttack) {
      const grow = Animated.timing(comboCompanionScale, { toValue: 3, duration: 1450, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      grow.start();
      return () => grow.stop();
    }
    const reset = Animated.timing(comboCompanionScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    reset.start();
    return () => reset.stop();
  }, [comboAttack, comboCompanionScale]);

  useEffect(() => {
    setFlyingCard(flyingAttacks.at(-1)?.card ?? null);
  }, [flyingAttacks]);

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
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer]) {
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
        for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer]) {
      try { player.volume = enabled ? soundEffectsVolume : 0;

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
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    if (previewComboTimerRef.current) clearTimeout(previewComboTimerRef.current);
    stopHintAttention();
    autoFinishRunningRef.current = false;
  }, []);


  useEffect(() => {
    let mounted = true;
    const loadLocalGame = async () => {
      try {
        const [activeGameValue, recordsValue, soundEffectsValue, backgroundMusicValue, soundEffectsVolumeValue, backgroundMusicVolumeValue, cardSelectVibrationValue, selectedCompanionValue, unlockedPetsValue, attendanceValue] = await AsyncStorage.multiGet([ACTIVE_GAME_KEY, RECORDS_KEY, SOUND_ENABLED_KEY, BACKGROUND_MUSIC_ENABLED_KEY, SOUND_EFFECTS_VOLUME_KEY, BACKGROUND_MUSIC_VOLUME_KEY, CARD_SELECT_VIBRATION_KEY, SELECTED_COMPANION_KEY, UNLOCKED_PETS_KEY, ATTENDANCE_KEY]);
        if (!mounted) return;
        if (activeGameValue[1] && !newGameStarted.current) {
          const saved = JSON.parse(activeGameValue[1]) as { saveVersion?: number; game?: typeof game; elapsedSeconds?: number };
          if (saved.saveVersion === ACTIVE_GAME_SAVE_VERSION && saved.game?.tableau?.length === 7) {
            const restoredGame = { ...saved.game, level: saved.game.level ?? 1, recycles: saved.game.recycles ?? 0 };
            recentGameFingerprintsRef.current = [gameStateFingerprint(restoredGame)];
            setGame(restoredGame);
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
        if (unlockedPetsValue[1]) {
          const savedUnlocked = JSON.parse(unlockedPetsValue[1]);
          if (Array.isArray(savedUnlocked)) {
            const restoredPets = Array.from(new Set([
              ...INITIAL_UNLOCKED_PET_IDS,
              ...savedUnlocked.filter((id): id is string => typeof id === "string"),
            ]));
            setUnlockedPetIds(restoredPets);
          }
        }
        if (attendanceValue[1]) {
          const savedAttendance = JSON.parse(attendanceValue[1]) as { day?: number; lastDate?: string | null };
          setAttendanceDay(typeof savedAttendance.day === "number" ? Math.max(0, savedAttendance.day) : 0);
          setLastAttendanceDate(typeof savedAttendance.lastDate === "string" ? savedAttendance.lastDate : null);
        }
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
    if (!hydrated) return;
    AsyncStorage.setItem(UNLOCKED_PETS_KEY, JSON.stringify(unlockedPetIds)).catch(() => undefined);
  }, [hydrated, unlockedPetIds]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ATTENDANCE_KEY, JSON.stringify({ day: attendanceDay, lastDate: lastAttendanceDate })).catch(() => undefined);
  }, [attendanceDay, hydrated, lastAttendanceDate]);

  useEffect(() => {
    if (!hydrated) return;
    setRulesTab("basic");
    setPaused(true);
    setSheet("rules");
  }, [hydrated]);

  useEffect(() => {
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer]) {
      try {
        player.volume = soundEffectsEnabled ? soundEffectsVolume : 0;
        if (!soundEffectsEnabled) player.pause();
      } catch {
        // Keep the persisted preference even if a player is still loading.
      }
    }
  }, [companionAttackPlayer, foundationAttackPlayer, movePlayer, selectPlayer, shufflePlayer, soundEffectsEnabled, soundEffectsVolume, backgroundPlayer, backgroundMusicEnabled, backgroundMusicVolume]);

  useEffect(() => {
    // Re-apply both independent mixer buses after either slider changes. This
    // prevents platform audio-session updates from leaving the music bus at the
    // effects bus level on some Android audio implementations.
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer]) {
      try { player.volume = soundEffectsEnabled ? soundEffectsVolume : 0; } catch { /* optional audio */ }
    }
    try { backgroundPlayer.volume = backgroundMusicEnabled ? backgroundMusicVolume : 0; } catch { /* optional audio */ }
  }, [backgroundPlayer, backgroundMusicEnabled, backgroundMusicVolume, companionAttackPlayer, foundationAttackPlayer, movePlayer, selectPlayer, shufflePlayer, soundEffectsEnabled, soundEffectsVolume]);

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
    if (paused || !hydrated || isWon(game)) return;
    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [game, hydrated, paused]);

  const startNewGame = (level = game.level, resetProgress = false) => {
    resetHintAttention();
    const manualReset = resetProgress;
    newGameStarted.current = true;
    bossWarningStageRef.current = null;
    setShowBossWarning(false);
    const freshGame = createPlayableGame(level);
    recentGameFingerprintsRef.current = [gameStateFingerprint(freshGame)];
    haptic.light();
    setGame(freshGame);
    setSelection(null);
    setElapsedSeconds(0);
    setPaused(false);
    setSheet(null);
    setShowNewGameConfirm(false);
    setHintMessage(null);
    setShowNoMovesPopup(false);
    setUndoStack([]);
    setShowTwoTouch(false);
    setTwoTouchOpensUsed(0);
    setRewardedRevealUsed(0);
    stagnantMovesRef.current = 0;
    lastHintKeyRef.current = null;
    hintRepeatCountRef.current = 0;
    if (manualReset) {
      setHammerCharges(0);
      setShowHammerOffer(false);
      setHammerMode(false);
      setUnlockedPetIds(INITIAL_UNLOCKED_PET_IDS);
      AsyncStorage.setItem(UNLOCKED_PETS_KEY, JSON.stringify(INITIAL_UNLOCKED_PET_IDS)).catch(() => undefined);
    }
    gameRef.current = freshGame;
    elapsedSecondsRef.current = 0;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: freshGame, elapsedSeconds: 0 })).catch(() => undefined);
  };

  const requestNewGame = () => {
    setResetMode("full");
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const requestCurrentStageRestart = () => {
    setResetMode("current");
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const unlockRandomPets = (count: number) => {
    const locked = PET_ROSTER.filter((pet) => !unlockedPetIds.includes(pet.id));
    const shuffled = [...locked].sort(() => Math.random() - 0.5);
    const newlyUnlocked = shuffled.slice(0, count);
    if (!newlyUnlocked.length) {
      showTimedHint("펫 도감의 모든 펫을 해금했습니다.");
      return;
    }
    const nextIds = [...unlockedPetIds, ...newlyUnlocked.map((pet) => pet.id)];
    setUnlockedPetIds(nextIds);
    showTimedHint(`${newlyUnlocked.length}마리의 펫이 펫 도감에 추가되었습니다.`);
  };

  const saveWin = (finishedGame: typeof game) => {
    setRecords((current) => ({
      wins: current.wins + 1,
      bestScore: Math.max(current.bestScore, finishedGame.score),
      bestTimeSeconds: current.bestTimeSeconds === null ? elapsedSeconds : Math.min(current.bestTimeSeconds, elapsedSeconds),
    }));
  };

  const playShuffleAnimation = () => {
    shuffleMotion.setValue(0);
    Animated.sequence([
      Animated.timing(shuffleMotion, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1650),
      Animated.timing(shuffleMotion, { toValue: 0, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const playEffect = (effect: "select" | "move" | "shuffle" | "companionAttack" | "foundationAttack") => {
    if (!soundEffectsEnabled) return;
    const player = effect === "select" ? selectPlayer : effect === "move" ? movePlayer : effect === "shuffle" ? shufflePlayer : effect === "companionAttack" ? companionAttackPlayer : foundationAttackPlayer;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound feedback must never interrupt a card move.
    }
  };

  const animateFlight = (card: Card, flaming = false) => {
    const progress = new Animated.Value(0);
    const id = `flight-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const flight: ActiveFlight = {
      id,
      card,
      variant: flaming ? "flaming" : "normal",
      progress,
      startLeft: flightStartLeft,
      startBottom: flightStartBottom,
      travelX: flightTravelX,
      travelY: flightTravelY,
      flightColor: companionAttackColor,
    };
    setFlyingAttacks((current) => [...current, flight]);
    Animated.timing(progress, { toValue: 1, duration: flaming ? FLAMING_CARD_FLIGHT_DURATION : FLYING_CARD_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setFlyingAttacks((current) => current.filter((active) => active.id !== id));
    });
  };

  const cardFromSource = (source: CardSource): Card | undefined => {
    if (source.kind === "waste") return game.waste.at(-1);
    if (source.kind === "foundation") return game.foundations[source.suit].at(-1);
    return game.tableau[source.column]?.[source.index];
  };

  const showHint = () => {
    resetHintAttention();
    const hint = findHint(game);
    if (!hint) {
      setShowTwoTouch(true);
      setShowNoMovesPopup(true);
      showTimedHint("더 이상 이동할 카드가 없습니다. 팝업의 망치 기능을 사용하거나 새 게임을 시작하세요.");
      haptic.error();
      return;
    }
    const hintKey = JSON.stringify({ action: hint.action, source: hint.source, targetColumn: hint.targetColumn });
    hintRepeatCountRef.current = lastHintKeyRef.current === hintKey ? hintRepeatCountRef.current + 1 : 1;
    lastHintKeyRef.current = hintKey;
    // 같은 힌트가 반복되어도 실제 합법 이동이 존재하므로
    // 이동 불가 팝업을 열지 않고 현재 힌트만 계속 보여줍니다.
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

  const queueLateGameAutoFinish = (candidate: typeof game) => {
    if (autoFinishRunningRef.current || !isLateGameAutoFinishReady(candidate)) return;
    autoFinishRunningRef.current = true;
    showTimedHint("모든 카드가 공개되었습니다. 콤보 정리를 시작합니다!");
    let cursor = candidate;
    const step = () => {
      const move = findAutoFoundationMove(cursor);
      if (!move) {
        autoFinishRunningRef.current = false;
        autoFinishTimerRef.current = null;
        setComboAttack(false);
        return;
      }
      const next = moveToFoundation(cursor, move.source);
      if (!next) {
        autoFinishRunningRef.current = false;
        autoFinishTimerRef.current = null;
        setComboAttack(false);
        return;
      }
      cursor = next;
      applyGame(next, false, move.card);
      autoFinishTimerRef.current = setTimeout(step, 322);
    };
    autoFinishTimerRef.current = setTimeout(step, 244);
  };

  const applyGame = (nextGame: typeof game | null, success = false, movedCard?: Card) => {
    if (!nextGame || nextGame === game) {
      haptic.error();
      return;
    }
    resetHintAttention();
    const previousFoundationCount = SUITS.reduce((total, suit) => total + game.foundations[suit].length, 0);
    const nextFoundationCount = SUITS.reduce((total, suit) => total + nextGame.foundations[suit].length, 0);
    const foundationMove = nextFoundationCount > previousFoundationCount;
    const changedSuit = movedCard?.suit ?? SUITS.find((suit) => nextGame.foundations[suit].length > game.foundations[suit].length) ?? "clubs";
    const foundationCard = foundationMove ? (movedCard ?? nextGame.foundations[changedSuit].at(-1)) : undefined;
    if (foundationMove) {
      const damage = (nextFoundationCount - previousFoundationCount) * 5;
      const isCombo = autoFinishRunningRef.current || nextFoundationCount - previousFoundationCount > 1;
      setLastDamage(damage);
      setAttackKind(changedSuit);
      setComboAttack(isCombo);
      setAttackToken((token) => token + 1);
      playEffect("foundationAttack");
    }
    const previousProgress = game.foundations.clubs.length + game.foundations.diamonds.length + game.foundations.hearts.length + game.foundations.spades.length + game.tableau.flat().filter((card) => card.faceUp).length;
    const nextProgress = nextGame.foundations.clubs.length + nextGame.foundations.diamonds.length + nextGame.foundations.hearts.length + nextGame.foundations.spades.length + nextGame.tableau.flat().filter((card) => card.faceUp).length;
    if (nextProgress > previousProgress || nextGame.stock.length !== game.stock.length || nextGame.waste.length !== game.waste.length) stagnantMovesRef.current = 0;
    else stagnantMovesRef.current += 1;
    const nextFingerprint = gameStateFingerprint(nextGame);
    const repeatedBoard = recentGameFingerprintsRef.current.includes(nextFingerprint);
    recentGameFingerprintsRef.current = [...recentGameFingerprintsRef.current, nextFingerprint].slice(-8);
    const noMovesLeft = findHint(nextGame) === null;
    if (suppressNextShufflePromptRef.current) {
      suppressNextShufflePromptRef.current = false;
      setShowTwoTouch(false);
      setShowNoMovesPopup(false);
    } else if ((noMovesLeft || repeatedBoard) && !isWon(nextGame)) {
      setShowTwoTouch(true);
      setShowNoMovesPopup(true);
    }
    lastHintKeyRef.current = null;
    hintRepeatCountRef.current = 0;
    setUndoStack((history) => [...history.slice(-(MAX_UNDO_STEPS - 1)), cloneGameState(game)]);
    gameRef.current = nextGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: nextGame, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    setGame(nextGame);
    setSelection(null);
    playEffect("move");
    if (!isWon(nextGame)) queueLateGameAutoFinish(nextGame);
    if (foundationCard || movedCard) {
      const attackCard = foundationCard ?? movedCard;
      if (attackCard) {
        playEffect("companionAttack");
        animateFlight(attackCard, Boolean(foundationCard));
      }
    }
    if (success) {
      haptic.success();
    } else {
      haptic.light();
    }
    if (isWon(nextGame)) {
      saveWin(nextGame);
      unlockRandomPets(battleContent.isBoss ? 2 : 1);
      const nextStage = nextGame.level + 1;
      const nextChapter = getChapterForStage(nextStage);
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 1550);
      showTimedHint(nextChapter !== battleContent.chapter ? `챕터 ${nextChapter} 보스가 등장합니다. 스테이지 ${nextStage} 시작!` : `스테이지 ${nextStage}로 이동합니다.`);
      setTimeout(() => startNewGame(nextStage), 2350);
    }
  };

  const claimAttendance = () => {
    const today = localDateKey();
    if (lastAttendanceDate === today) {
      showTimedHint("오늘 출석은 이미 완료했습니다.");
      setShowAttendanceClaim(false);
      return;
    }
    const nextDay = attendanceDay + 1;
    const reward = nextDay === 10 || nextDay === 20 || nextDay === 30 ? 5 : 2;
    setAttendanceDay(nextDay);
    setLastAttendanceDate(today);
    setHammerCharges((charges) => Math.min(10, charges + reward));
    setShowAttendanceClaim(false);
    attendanceRewardFlight.stopAnimation();
    attendanceRewardFlight.setValue(0);
    setShowAttendanceRewardFlight(true);
    Animated.timing(attendanceRewardFlight, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowAttendanceRewardFlight(false);
    });
    showTimedHint(`${nextDay}일차 출석 완료 · 망치 +${reward}`);
    haptic.success();
  };

  const useShuffleBonus = async (slot: 0 | 1 | 2) => {
    if (!showTwoTouch) return;
    if (slot === 0) {
      if (twoTouchOpensUsed > 0) { showTimedHint("무료 망치는 이미 사용했습니다."); return; }
      setTwoTouchOpensUsed(1);
      setHammerCharges((charges) => Math.min(10, charges + 1));
      setShowTwoTouch(false);
      setShowNoMovesPopup(false);
      beginHammerMode(true);
      showTimedHint("원하는 카드를 클릭하세요");
      return;
    }
      setRewardedRetrySlot(1);
    if (twoTouchOpensUsed === 0) { showTimedHint("먼저 무료 망치를 사용해 주세요."); return; }
    if (rewardedRevealUsed >= 10) {
      showTimedHint("광고 망치는 최대 10개까지 사용할 수 있습니다.");
      return;
    }
    setRewardedAdError(null);
    showTimedHint("보상형 광고를 불러오는 중입니다.");
    const completed = await showRewardedAd();
    if (!completed) {
      setRewardedAdError("광고가 준비되지 않았거나 끝까지 시청되지 않았습니다. 다시 시도해 주세요.");
      return;
    }
    const nextRewardedCount = rewardedRevealUsed + 1;
    setRewardedRevealUsed(nextRewardedCount);
    setHammerCharges((charges) => Math.min(10, charges + 1));
    setShowTwoTouch(false);
    setShowNoMovesPopup(false);
    beginHammerMode(true);
    showTimedHint(`원하는 카드를 클릭하세요 (광고 망치 ${nextRewardedCount}/10)`);
  };

  const claimHammerAdReward = async () => {
    if (hammerCharges >= 10) {
      showTimedHint("망치가 가득 찼습니다. 현재 최대 10개입니다.");
      return;
    }
    setRewardedAdError(null);
    showTimedHint("보상형 광고를 불러오는 중입니다.");
    const completed = await showRewardedAd();
    if (!completed) {
      setRewardedAdError("광고가 준비되지 않았거나 끝까지 시청되지 않았습니다. 다시 시도해 주세요.");
      return;
    }
    setHammerCharges((charges) => Math.min(10, charges + 1));
    showTimedHint(`망치 +1 충전 완료 (${Math.min(10, hammerCharges + 1)}/10)`);
  };

  const beginHammerMode = (allowRepeat = false) => {
    if (!allowRepeat && hammerCharges <= 0) {
      showTimedHint("사용 가능한 망치가 없습니다.");
      haptic.error();
      return;
    }
    if (!allowRepeat && hammerMode) {
      setShowHammerOffer(false);
      showTimedHint("이번 게임에서 망치는 이미 사용했습니다.");
      return;
    }
    setShowHammerOffer(false);
    setShowNoMovesPopup(false);
    hammerImpact.stopAnimation();
    hammerImpact.setValue(0);
    Animated.sequence([
      Animated.timing(hammerImpact, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(hammerImpact, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(hammerImpact, { toValue: 0.7, duration: 60, useNativeDriver: true }),
      Animated.timing(hammerImpact, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start();
    setHammerMode(true);
    setSelection(null);
    showTimedHint("원하는 카드를 클릭하세요");
    haptic.light();
  };

  const useHammerOnCard = (source: CardSource, targetPosition?: { dx: number; dy: number }) => {
    const target = cardFromSource(source);
    const revealedGame = revealHiddenCardWithHammer(game, source);
    if (!revealedGame || !target) {
      showTimedHint("망치 사용 중에는 열지 않은 타블로 카드만 탭할 수 있습니다.");
      haptic.error();
      return;
    }
    setHammerMode(false);
    setHammerCharges((charges) => Math.max(0, charges - 1));
    setShowHammerOffer(false);
    playEffect("foundationAttack");
    haptic.success();
    if (targetPosition) {
      hammerStrike.stopAnimation();
      hammerStrike.setValue(0);
      setHammerStrikeTarget(targetPosition);
      Animated.timing(hammerStrike, { toValue: 1, duration: 1700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setHammerStrikeTarget(null);
        setHammerImpactBurstTarget(targetPosition);
        hammerImpactBurst.setValue(0);
        Animated.timing(hammerImpactBurst, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start(() => setHammerImpactBurstTarget(null));
        applyGame(revealedGame, false, target);
        showTimedHint(`${cardLabel(target)} 카드를 공개해 웨이스트에 놓았습니다.`);
      });
      return;
    }
    applyGame(revealedGame, false, target);
    showTimedHint(`${cardLabel(target)} 카드를 공개해 웨이스트에 놓았습니다.`);
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
    if (hammerMode) {
      showTimedHint("망치 사용 중입니다. 카드를 탭해 파괴하세요.");
      return;
    }
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
    if (drawnCard) playEffect("shuffle");
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
    if (hammerMode) {
      const boardLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5);
      const hammerLeft = boardLeft + cardWidth * 2.25;
      const targetLeft = boardLeft + column * (cardWidth + tableauGap);
      const targetTop = rootTopPadding + 220 + index * stackOffset;
      useHammerOnCard({ kind: "tableau", column, index }, { dx: targetLeft - hammerLeft, dy: targetTop - (rootTopPadding + 132) });
      return;
    }
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
    if (hammerMode) {
      showTimedHint("파운데이션 카드는 파괴할 수 없습니다.");
      return;
    }
    if (selection) {
      applyGame(moveToFoundation(game, selection));
      return;
    }
    const card = game.foundations[suit].at(-1);
    if (card) selectCard({ kind: "foundation", suit, cardId: card.id });
  };

  const onWastePress = () => {
    const card = game.waste.at(-1);
    if (hammerMode) {
      useHammerOnCard({ kind: "waste" });
      return;
    }
    if (card) selectCard({ kind: "waste", cardId: card.id });
  };

  const playPreviewFoundationAttack = () => {
    if (!showPreviewAttackTools) return;
    const previewCard = game.foundations.clubs.at(-1) ?? game.foundations.diamonds.at(-1) ?? game.waste.at(-1) ?? game.tableau.flat().find((card) => card.faceUp);
    if (!previewCard) {
      showTimedHint("미리보기용 카드를 찾을 수 없습니다.");
      return;
    }
    setLastDamage(5);
    setAttackKind(previewCard.suit);
    setComboAttack(false);
    setAttackToken((token) => token + 1);
    playEffect("foundationAttack");
    playEffect("companionAttack");
    animateFlight(previewCard, true);
    showTimedHint("파운데이션 불꽃 카드 공격 미리보기");
  };

  const playPreviewCombo = () => {
    if (!showPreviewAttackTools) return;
    if (previewComboTimerRef.current) clearTimeout(previewComboTimerRef.current);
    const previewCards = game.tableau.flat().filter((card) => card.faceUp).slice(0, 6);
    const attackCount = Math.max(3, Math.min(6, previewCards.length || 3));
    let attackIndex = 0;
    setComboAttack(true);
    showTimedHint("콤보 공격 미리보기");
    const playNext = () => {
      const card = previewCards[attackIndex % Math.max(1, previewCards.length)] ?? game.waste.at(-1);
      setLastDamage(5);
      setAttackKind(card?.suit ?? SUITS[attackIndex % SUITS.length]);
      setAttackToken((token) => token + 1);
      playEffect("companionAttack");
      if (card) animateFlight(card, true);
      attackIndex += 1;
      if (attackIndex < attackCount) {
        previewComboTimerRef.current = setTimeout(playNext, 760);
      } else {
        previewComboTimerRef.current = setTimeout(() => {
          setComboAttack(false);
          previewComboTimerRef.current = null;
        }, 760);
      }
    };
    playNext();
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
  const companionRoster = [...getCompanionRoster(), ...PET_ROSTER];
  const selectedCompanion = companionRoster.find((candidate) => candidate.id === selectedCompanionId) ?? battleContent.companion;
  const bossWarningOpacity = bossIntroProgress.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const bossWarningScale = bossIntroProgress.interpolate({ inputRange: [0, 0.22, 0.82, 1], outputRange: [0.82, 1, 1.04, 0.94] });
  const companionAttackStyle = getCompanionAttackStyle(selectedCompanion);
  const companionAttackColor = companionAttackColors[companionAttackStyle];
  const companionSize = Math.max(61, Math.round(cardWidth * 1.64 * 0.9));
  const companionBaseLeft = Math.max(4, (phoneLandscape ? Math.max(8, Math.round((sideRailWidth - companionSize) * 0.5)) : Math.max(10, Math.round((safeScreenWidth - companionSize) * 0.5))) - 30);
  const companionBottom = bottomControlsBottom + 52 + (!isLandscape ? 1 : 0);
  const renderCardRatio = !isLandscape ? Math.max(0.76, cardRatio * 0.95) : cardRatio;
  const activeShuffleStep: 0 | 1 | 2 = twoTouchOpensUsed === 0 ? 0 : rewardedRevealUsed < 10 ? 1 : 2;
  const shuffleHelpTitle = activeShuffleStep === 0 ? "무료 망치" : `광고 보상 망치 +${activeShuffleStep}`;
  const shuffleHelpCopy = activeShuffleStep === 0
    ? "열지 않은 카드 한 장을 공개해 스톡 옆 공개 영역에 놓습니다."
    : "짧은 광고를 끝까지 시청하면 히든 카드 공개 망치 1회를 추가로 이용할 수 있습니다.";
  const shuffleHelpButton = activeShuffleStep === 0 ? "무료 망치 사용" : "광고 시청 후 망치 +1";
  const companionCenterLeft = companionBaseLeft + companionAvoidanceTarget + companionSize * 0.5 - cardWidth * 0.5;
  const companionCenterBottom = companionBottom + companionSize * 0.5 - cardWidth * renderCardRatio * 0.5;
  const flightStartLeft = companionCenterLeft;
  const flightStartBottom = companionCenterBottom;
  const flightTravelX = phoneLandscape ? 0 : isLandscape ? Math.round(safeScreenWidth * 0.04) : Math.round(safeScreenWidth * 0.05);
  const monsterTargetTop = rootTopPadding + (isLandscape ? (phoneLandscape ? 116 : 82) : 152);
  const flightTravelY = getAttackTravelY(safeScreenHeight, flightStartBottom, cardWidth * cardRatio, monsterTargetTop, 1.2);
  const hammerStartLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5) + cardWidth * 2.25;
  const hammerStartTop = rootTopPadding + 132;
  const hammerStrikeTranslateX = hammerStrike.interpolate({ inputRange: [0, 0.86, 1], outputRange: [0, hammerStrikeTarget?.dx ?? 0, hammerStrikeTarget?.dx ?? 0] });
  const attendanceRewardTranslateX = attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(40, safeScreenWidth * 0.34)] });
  const attendanceRewardTranslateY = attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(150, safeScreenHeight * 0.42)] });
  const attendanceRewardScale = attendanceRewardFlight.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.72, 1.15, 0.56] });
  const attendanceRewardOpacity = attendanceRewardFlight.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const hammerStrikeTranslateY = hammerStrike.interpolate({ inputRange: [0, 0.86, 1], outputRange: [0, hammerStrikeTarget?.dy ?? 0, (hammerStrikeTarget?.dy ?? 0) + 8] });
  const hammerStrikeScale = hammerStrike.interpolate({ inputRange: [0, 0.76, 0.9, 1], outputRange: [1, 2.25, 3, 2.45] });
  const hammerStrikeRotate = hammerStrike.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });

  useEffect(() => {
    let cancelled = false;
    // 카드가 펫에서 몬스터로 날아가는 동안에는 카드 열 재측정으로 인한
    // 회피 이동을 잠가 펫이 제자리에서 공격하는 모습이 유지되게 합니다.
    if (flyingCard) {
      companionAvoidanceShift.stopAnimation();
      return () => { cancelled = true; };
    }
    const animateCompanionTo = (nextShift: number) => {
      if (Math.abs(nextShift - companionAvoidanceTargetRef.current) < 2) return;
      companionAvoidanceTargetRef.current = nextShift;
      setCompanionAvoidanceTarget(nextShift);
      companionAvoidanceShift.stopAnimation();
      Animated.timing(companionAvoidanceShift, { toValue: nextShift, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    };
    const timer = setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      root.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
        if (cancelled || rootWidth <= 0 || rootHeight <= 0) return;
        const cardRefs = tableauBottomCardRefs.current
          .map((node, column) => node ? { node, column } : null)
          .filter((entry): entry is { node: View; column: number } => entry !== null);
        if (!cardRefs.length) { animateCompanionTo(0); return; }
        const frames: Array<{ x: number; y: number; width: number; height: number }> = [];
        cardRefs.forEach(({ node }) => node.measureInWindow((x, y, width, height) => {
          if (cancelled || width <= 0 || height <= 0) return;
          frames.push({ x, y, width, height });
          if (frames.length !== cardRefs.length) return;
          const minLeft = 4;
          const maxLeft = Math.max(minLeft, rootWidth - companionSize - 4);
          const clearance = Math.max(8, Math.round(cardWidth * 0.2));
          const step = Math.max(companionSize * 0.9, cardWidth * 1.15);
          const candidates = Array.from({ length: 9 }, (_, index) => {
            if (index === 0) return companionBaseLeft;
            const direction = index % 2 ? -1 : 1;
            return companionBaseLeft + direction * Math.ceil(index / 2) * step;
          }).map((left) => Math.max(minLeft, Math.min(maxLeft, left)));
          const uniqueCandidates = Array.from(new Set(candidates));
          const bestLeft = uniqueCandidates
            .map((left) => {
              // 펫과 카드가 실제로 세로로 겹치는 경우에만 회피 점수에 반영합니다.
              // 카드 한 장을 뒤집어 열 높이가 바뀌어도 보드와 펫은 보통 서로 다른
              // 세로 영역에 있으므로, 그 이유만으로 펫이 좌우 이동하지 않습니다.
              const companionTop = rootHeight - companionBottom - companionSize;
              const companionBottomEdge = companionTop + companionSize;
              const collision = frames.reduce((total, frame) => {
                const cardLeft = frame.x - rootX - clearance;
                const cardRight = frame.x - rootX + frame.width + clearance;
                const cardTop = frame.y - rootY;
                const cardBottom = cardTop + frame.height;
                const horizontalOverlap = Math.max(0, Math.min(left + companionSize, cardRight) - Math.max(left, cardLeft));
                const verticalOverlap = Math.max(0, Math.min(companionBottomEdge, cardBottom) - Math.max(companionTop, cardTop));
                return total + horizontalOverlap * verticalOverlap;
              }, 0);
              return { left, collision, distance: Math.abs(left - companionBaseLeft) };
            })
            .sort((a, b) => a.collision - b.collision || a.distance - b.distance)[0]?.left ?? companionBaseLeft;
          animateCompanionTo(bestLeft - companionBaseLeft);
        }));
      });
    }, 90);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cardWidth, companionAvoidanceShift, companionBaseLeft, companionBottom, companionSize, flyingCard, game.tableau, isLandscape, safeScreenHeight, safeScreenWidth]);

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
      <Animated.View ref={rootRef} style={[styles.root, { paddingTop: rootTopPadding, paddingBottom: rootBottomPadding, transform: [{ translateX: screenShake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }] }, isLandscape && styles.rootLandscape, phoneLandscape && styles.rootPhoneLandscape]}>
        <MedievalBackdrop source={battleContent.background} />
        {showBossWarning ? <Animated.View pointerEvents="none" style={[styles.bossWarning, { opacity: bossWarningOpacity, transform: [{ scale: bossWarningScale }] }]}><Text style={styles.bossWarningEyebrow}>WARNING · BOSS INCOMING</Text><Text style={styles.bossWarningTitle}>{battleContent.monster.name}</Text><Text style={styles.bossWarningCopy}>새로운 수호자가 전장에 나타났습니다</Text></Animated.View> : null}
        {flyingAttacks.map((flight) => <FlyingCard key={flight.id} card={flight.card} width={cardWidth} cardRatio={renderCardRatio} progress={flight.progress} travelX={flight.travelX} travelY={flight.travelY} startLeft={flight.startLeft} startBottom={flight.startBottom} flightColor={flight.flightColor} flaming={flight.variant === "flaming"} monsterMotion={monsterMotion} monsterTravelDistance={monsterTravelDistance} />)}
        {hammerStrikeTarget ? <Animated.View pointerEvents="none" style={[styles.hammerStrike, { left: hammerStartLeft, top: hammerStartTop, width: cardWidth * 1.08, height: cardWidth * 1.08, transform: [{ translateX: hammerStrikeTranslateX }, { translateY: hammerStrikeTranslateY }, { scale: hammerStrikeScale }, { rotate: hammerStrikeRotate }] }]}> 
          <Image source={HAMMER_ICON_ART} resizeMode="contain" style={styles.hammerStrikeImage} />
        </Animated.View> : null}
        {hammerImpactBurstTarget ? <Animated.View pointerEvents="none" style={[styles.hammerImpactBurst, { left: hammerStartLeft, top: hammerStartTop, width: cardWidth * 1.5, height: cardWidth * 1.5, transform: [{ translateX: hammerImpactBurstTarget.dx }, { translateY: hammerImpactBurstTarget.dy }, { scale: hammerImpactBurst.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0.35, 1.25, 0.1] }) }, { rotate: hammerImpactBurst.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "18deg"] }) }], opacity: hammerImpactBurst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] }) }]}><Image source={HAMMER_IMPACT_ART} resizeMode="contain" style={styles.hammerImpactBurstImage} /></Animated.View> : null}
        {showAttendanceRewardFlight ? <Animated.View pointerEvents="none" style={[styles.attendanceRewardFlight, { left: Math.max(0, safeScreenWidth * 0.5 - 30), top: Math.max(80, safeScreenHeight * 0.58), opacity: attendanceRewardOpacity, transform: [{ translateX: attendanceRewardTranslateX }, { translateY: attendanceRewardTranslateY }, { scale: attendanceRewardScale }, { rotate: attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}><Image source={HAMMER_ICON_ART} resizeMode="contain" style={styles.attendanceRewardFlightImage} /></Animated.View> : null}
        <VictoryFireworks visible={showFireworks} />
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
            <Pressable accessibilityRole="button" accessibilityLabel="출석체크" disabled={lastAttendanceDate === localDateKey()} onPress={() => { haptic.light(); setShowAttendanceClaim(true); }} style={({ pressed }) => [styles.attendanceHeaderButton, compactControls && styles.iconButtonCompact, lastAttendanceDate === localDateKey() && styles.attendanceHeaderButtonDone, pressed && styles.pressed]}>
              <Animated.View pointerEvents="none" style={[styles.attendanceHeaderAnimated, { opacity: attendanceAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 0.64] }), transform: [{ scale: attendanceAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: attendanceAttention.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-3deg", "3deg"] }) }] }]}>
                <Image source={DAILY_CHECKIN_ART} resizeMode="contain" style={[styles.attendanceHeaderImage, lastAttendanceDate === localDateKey() && styles.attendanceHeaderImageDone]} />
              </Animated.View>
              {lastAttendanceDate === localDateKey() ? <View pointerEvents="none" style={styles.attendanceDoneBadge}><Text style={styles.attendanceDoneBadgeText}>✓</Text></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="가능한 카드 자동 정리" onPress={runAutoComplete} style={({ pressed }) => [styles.autoButton, compactControls && styles.autoButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="auto" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="현재 스테이지 초기화" onPress={requestCurrentStageRestart} style={({ pressed }) => [styles.newButton, compactControls && styles.newButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="new" size={23} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="사운드 설정" onPress={() => { haptic.light(); setPaused(true); setSheet("sound"); }} style={({ pressed }) => [styles.soundButton, compactControls && styles.iconButtonCompact, !soundEffectsEnabled && !backgroundMusicEnabled && styles.soundButtonOff, pressed && styles.pressed]}>
              <MedievalIcon name={soundEffectsEnabled || backgroundMusicEnabled ? "sound" : "soundOff"} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, compactControls && styles.iconButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="menu" size={19} />
            </Pressable>
          </View>
        </View>

        {showPreviewAttackTools ? <View style={styles.previewTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="콤보 공격 미리보기" onPress={playPreviewCombo} style={({ pressed }) => [styles.previewToolButton, pressed && styles.pressed]}><Text style={styles.previewToolText}>콤보 공격</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="파운데이션 불꽃 카드 공격 미리보기" onPress={playPreviewFoundationAttack} style={({ pressed }) => [styles.previewToolButton, pressed && styles.pressed]}><Text style={styles.previewToolText}>파운데이션 공격</Text></Pressable>
        </View> : null}

        <View style={[styles.stats, isLandscape && styles.statsLandscape, compactLandscape && styles.statsLandscapeCompact, phoneLandscape && styles.statsPhoneLandscape, phoneLandscape && { width: sideRailWidth }]}>
          <View style={[styles.statsSummary, phoneLandscape && styles.statsSummaryPhoneLandscape]}>
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.score}</Text><Text style={styles.statLabel}>점수</Text></View>
            <View style={styles.statDivider} />
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.moves}</Text><Text style={styles.statLabel}>이동</Text></View>
            <View style={styles.statDivider} />
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{formatDuration(elapsedSeconds)}</Text><Text style={styles.statLabel}>시간</Text></View>
          </View>
          <MonsterBattle compact={compact || compactLandscape} landscape={isLandscape} phoneLandscape={phoneLandscape} travelDistance={monsterTravelDistance} motionValue={monsterMotion} damage={lastDamage} hp={Math.max(0, 100 - ((SUITS.reduce((total, suit) => total + game.foundations[suit].length, 0) + (game.destroyedCards?.length ?? 0)) / 52) * 100)} attackKind={attackKind} attackToken={attackToken} combo={comboAttack} monster={battleContent.monster} isBoss={battleContent.isBoss} cardSize={cardWidth} />
        </View>

        <Animated.View style={[styles.boardTransition, { opacity: layoutTransition, transform: [{ scale: layoutTransition }, { translateX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }, { rotate: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "0.7deg"] }) }] }]}>
        <View style={[styles.board, { width: boardWidth }, isLandscape && styles.boardLandscape, phoneLandscape && styles.boardPhoneLandscape]}>
        <View style={[styles.topPiles, isLandscape && styles.topPilesLandscape]}>
          <View style={styles.stockWasteGroup}>
            {game.stock.length ? (
              <CardBack width={cardWidth} cardRatio={renderCardRatio} theme={cardBackTheme} onPress={drawStockCard} />
            ) : (
              <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label={game.waste.length ? "↻" : ""} onPress={() => applyGame(drawFromStock(game))} />
            )}
            {game.waste.at(-1) ? (
              <CardFace card={game.waste.at(-1)!} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} selected={selection?.kind === "waste"} onPress={onWastePress} onDoublePress={() => autoMoveToFoundation({ kind: "waste" })} />
            ) : (
              <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label="" />
            )}
          </View>
          <Animated.View style={[styles.hammerPilesAnimated, { width: cardWidth, height: cardWidth * renderCardRatio }, { opacity: hammerCharges > 0 ? hammerShine.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) : 0.72 }, { transform: [{ translateX: hammerImpact.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) }, { rotate: hammerImpact.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] }) }, { scale: hammerCharges > 0 ? hammerShine.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) : 1 }] }]}> 
            <Pressable accessibilityRole="button" accessibilityLabel={`망치 ${hammerCharges}개 남음`} onPress={() => beginHammerMode()} style={({ pressed }) => [styles.hammerPilesButton, { width: cardWidth, height: cardWidth * renderCardRatio }, hammerCharges > 0 && styles.hammerPilesButtonReady, pressed && styles.pressed]}>
              <Image source={HAMMER_ICON_ART} resizeMode="contain" style={[styles.hammerPilesIcon, { width: Math.min(cardWidth * 1.3, 84), height: Math.min(cardWidth * 1.3, 84) }, { transform: [{ translateY: hammerIdleMotion.interpolate({ inputRange: [-1, 0, 1], outputRange: [2, 0, -2] }) }] }]} />
              <Text style={[styles.hammerPilesCount, { fontSize: Math.max(15, Math.round(cardWidth * 0.18) + 5) }]}>{hammerCharges}/10</Text>
            </Pressable>
          </Animated.View>
          <View style={[styles.foundationGroup, { gap: Math.max(3, Math.round(cardWidth * 0.08)) }]}>
            {SUITS.map((suit) => {
              const card = game.foundations[suit].at(-1);
              return card ? (
                <CardFace key={suit} card={card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} selected={selection?.kind === "foundation" && selection.suit === suit} onPress={() => onFoundationPress(suit)} onDragEnd={(dx, dy) => dragMoveCard({ kind: "foundation", suit }, dx, dy)} />
              ) : (
                <EmptySlot key={suit} width={cardWidth} cardRatio={renderCardRatio} label={suitSymbols[suit]} onPress={() => onFoundationPress(suit)} />
              );
            })}
          </View>
        </View>

        <View style={[styles.tableau, { gap: tableauGap }, isLandscape && styles.tableauLandscape]}>
          {game.tableau.map((pile, column) => (
            <Animated.View key={`column-${column}`} style={[styles.tableauColumn, { width: cardWidth, minHeight: cardWidth * renderCardRatio, transform: [{ translateX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [0, (3 - column) * (cardWidth + tableauGap)] }) }, { scaleY: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) }, { scaleX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }]}> 
              {pile.length === 0 ? <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label="K" onPress={() => moveSelectionToTableau(column)} /> : null}
              {pile.map((card, index) => (
                <View ref={index === pile.length - 1 ? (node) => { tableauBottomCardRefs.current[column] = node; } : undefined} key={card.id} style={{ position: "absolute", top: index * stackOffset, left: 0, zIndex: index }}>
                  {card.faceUp ? (
                    <CardFace card={card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} selected={selection?.cardId === card.id} onPress={() => onTableauPress(column, index, card)} onDoublePress={() => autoMoveToFoundation({ kind: "tableau", column, index })} onDragEnd={(dx, dy) => dragMoveCard({ kind: "tableau", column, index }, dx, dy)} />
                  ) : (
                    <CardBack width={cardWidth} cardRatio={renderCardRatio} theme={cardBackTheme} onPress={() => onTableauPress(column, index, card)} />
                  )}
                </View>
              ))}
            </Animated.View>
          ))}
        </View>
        </View>
        </Animated.View>

        {!isLandscape ? <View style={[styles.portraitAdBanner, { bottom: portraitBannerBottom }]}><AdBanner /></View> : null}
        <CompanionAnchor companion={selectedCompanion} size={companionSize} left={companionBaseLeft} bottom={companionBottom} horizontalShift={companionAvoidanceShift} comboScale={comboCompanionScale} onPress={() => undefined} />
                <View style={[styles.bottomControls, isLandscape && styles.bottomControlsLandscape, compactLandscape && styles.bottomControlsLandscapeCompact, phoneLandscape && styles.bottomControlsPhoneLandscape, phoneLandscape && { width: sideRailWidth }, { bottom: bottomControlsBottom }]}> 

          <Pressable accessibilityRole="button" accessibilityLabel={hammerCharges >= 10 ? "망치가 가득 참" : "광고 시청 후 망치 하나 받기"} disabled={hammerCharges >= 10} onPress={() => { haptic.light(); void claimHammerAdReward(); }} style={({ pressed }) => [styles.cartoonActionButton, styles.cartoonHammerButton, phoneLandscape && styles.bottomButtonPhoneLandscape, hammerCharges >= 10 && styles.cartoonActionButtonDisabled, pressed && styles.pressed]}>
            <Image source={HAMMER_PLUS_ONE_BUTTON_ART} resizeMode="contain" style={styles.cartoonActionImage} />
          </Pressable>
          <Animated.View style={[styles.hintAttentionWrap, { opacity: hintAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }), transform: [{ scale: hintAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }, { rotate: hintAttention.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-2deg"] }) }] }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="힌트 보기" onPress={showHint} style={({ pressed }) => [styles.cartoonActionButton, styles.cartoonHintButton, phoneLandscape && styles.bottomButtonPhoneLandscape, pressed && styles.pressed]}>
              <Image source={HINT_BUTTON_ART} resizeMode="contain" style={styles.cartoonActionImage} />
            </Pressable>
          </Animated.View>
          <Pressable accessibilityRole="button" accessibilityLabel={`실행 취소, ${undoStack.length}회 남음`} disabled={undoStack.length === 0} onPress={undoLastMove} style={({ pressed }) => [styles.cartoonActionButton, styles.cartoonUndoButton, phoneLandscape && styles.bottomButtonPhoneLandscape, undoStack.length === 0 && styles.undoButtonDisabled, pressed && styles.pressed]}>
            <Image source={UNDO_BUTTON_ART} resizeMode="contain" style={styles.cartoonActionImage} />
          </Pressable>
        </View>
        {hintMessage ? <View style={[styles.hintToast, isLandscape && styles.hintToastLandscape, phoneLandscape && { left: 8, right: undefined, width: Math.max(160, sideRailWidth - 16), bottom: 160 }]}><Text style={styles.hintToastText}>{hintMessage}</Text></View> : null}
        


        <Modal transparent visible={showHammerOffer} animationType="fade" onRequestClose={() => setShowHammerOffer(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.hammerOfferCard}>
              <Pressable accessibilityRole="button" accessibilityLabel="망치 안내 닫기" onPress={() => setShowHammerOffer(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              <Text style={styles.hammerOfferTitle}>히든 카드를 열어 길을 만들까요?</Text>
              <Text style={styles.hammerOfferCopy}>망치로 열지 않은 카드 1장을 즉시 공개해 스톡 옆 공개 영역에 놓을 수 있습니다.</Text>
              <View style={styles.noMovesPopupActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="망치 사용" onPress={() => { setHammerCharges((charges) => Math.min(10, charges + 1)); beginHammerMode(true); }} style={({ pressed }) => [styles.hammerOfferPrimary, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>망치 사용</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="새로 시작" onPress={() => { setShowHammerOffer(false); requestNewGame(); }} style={({ pressed }) => [styles.noMovesPopupSecondary, pressed && styles.pressed]}><Text style={styles.noMovesPopupSecondaryText}>새로 시작</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showNoMovesPopup} animationType="fade" onRequestClose={() => setShowNoMovesPopup(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.noMovesPopupCard}>
              <Pressable accessibilityRole="button" accessibilityLabel="이동 불가 안내 닫기" onPress={() => setShowNoMovesPopup(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              <Text style={styles.noMovesPopupTitle}>더 이상 이동할 수 없습니다.</Text>
              {activeShuffleStep === 0 ? <Text style={styles.noMovesPopupCopy}>무료 망치 1번 사용 가능</Text> : activeShuffleStep < 2 ? <Text style={styles.noMovesPopupCopy}>광고시청후 망치 1번 사용 가능</Text> : <Text style={styles.noMovesPopupCopy}>게임을 새로시작하세요.</Text>}
              <View style={styles.noMovesPopupActions}>
                {activeShuffleStep === 0 ? <Pressable accessibilityRole="button" accessibilityLabel="무료 망치" onPress={() => { setShowNoMovesPopup(false); void useShuffleBonus(0); }} style={({ pressed }) => [styles.noMovesPopupPrimary, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>무료 망치</Text></Pressable> : activeShuffleStep < 2 ? <Pressable accessibilityRole="button" accessibilityLabel="광고 시청 후 망치 사용" onPress={() => { setShowNoMovesPopup(false); void useShuffleBonus(activeShuffleStep as 1 | 2); }} style={({ pressed }) => [styles.noMovesPopupPrimary, styles.noMovesPopupAd, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>광고 망치</Text></Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityLabel="새로 시작" onPress={() => { setShowNoMovesPopup(false); requestNewGame(); }} style={({ pressed }) => [styles.noMovesPopupSecondary, pressed && styles.pressed]}><Text style={styles.noMovesPopupSecondaryText}>새로 시작</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={rewardedAdError !== null} animationType="fade" onRequestClose={() => setRewardedAdError(null)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.rewardedErrorCard}>
              <Text style={styles.rewardedErrorTitle}>광고를 불러오지 못했어요</Text>
              <Text style={styles.rewardedErrorCopy}>{rewardedAdError}</Text>
              <View style={styles.rewardedErrorActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="보상형 광고 다시 시도" onPress={() => { setRewardedAdError(null); void useShuffleBonus(rewardedRetrySlot); }} style={({ pressed }) => [styles.rewardedRetryButton, pressed && styles.pressed]}><Text style={styles.rewardedRetryText}>다시 시도</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="광고 안내 닫기" onPress={() => setRewardedAdError(null)} style={({ pressed }) => [styles.rewardedCloseButton, pressed && styles.pressed]}><Text style={styles.rewardedCloseText}>닫기</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showAttendanceClaim} animationType="fade" onRequestClose={() => setShowAttendanceClaim(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={styles.attendanceCard}>
              <Pressable accessibilityRole="button" accessibilityLabel="출석체크 닫기" onPress={() => setShowAttendanceClaim(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              <Image source={DAILY_CHECKIN_ART} resizeMode="contain" style={styles.attendanceModalImage} />
              <Text style={styles.attendanceTitle}>출석체크</Text>
              <Text style={styles.attendanceCopy}>{lastAttendanceDate === localDateKey() ? `오늘 출석 완료 · ${attendanceDay}일차` : `다음 출석 보상 · ${attendanceDay + 1}일차`}</Text>
              <Text style={styles.attendanceReward}>{lastAttendanceDate === localDateKey() ? "오늘 보상은 이미 받았습니다." : `망치 +${attendanceDay + 1 === 10 || attendanceDay + 1 === 20 || attendanceDay + 1 === 30 ? 5 : 2} · 최대 10개 보유`}</Text>
              <Pressable disabled={lastAttendanceDate === localDateKey()} onPress={claimAttendance} style={({ pressed }) => [styles.attendanceClaimButton, lastAttendanceDate === localDateKey() && styles.attendanceClaimButtonDisabled, pressed && styles.pressed]}><Text style={styles.attendanceClaimText}>{lastAttendanceDate === localDateKey() ? "오늘 출석 완료" : "오늘 출석 받기"}</Text></Pressable>
            </View>
          </View>
        </Modal>


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
                  <View style={styles.sheetRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="펫 도감 열기" onPress={() => { haptic.light(); setSheet("companions"); }} style={({ pressed }) => [styles.sheetSecondaryButton, pressed && styles.pressed]}><Text style={styles.sheetSecondaryText}>펫 도감</Text></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="게임 초기화" onPress={requestNewGame} style={({ pressed }) => [styles.sheetSecondaryButton, styles.resetButton, pressed && styles.pressed]}><Text style={styles.sheetSecondaryText}>게임 초기화</Text></Pressable>
                  </View>
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
                  <Text style={styles.sheetTitle}>펫 도감</Text>
                  <Text style={styles.companionPickerCopy}>스테이지를 클리어하면 펫이 랜덤으로 해금됩니다. 해금된 펫을 선택하면 다음 공격부터 함께합니다.</Text>
                  <ScrollView style={styles.petGridScroll} contentContainerStyle={styles.companionGrid} showsVerticalScrollIndicator={false}>
                    {companionRoster.map((companion) => {
                      const unlocked = unlockedPetIds.includes(companion.id);
                      const selected = unlocked && companion.id === selectedCompanionId;
                      return <Pressable key={companion.id} accessibilityRole="radio" accessibilityState={{ selected, disabled: !unlocked }} disabled={!unlocked} onPress={() => { setSelectedCompanionId(companion.id); haptic.light(); }} style={({ pressed }) => [styles.companionChoice, selected && styles.companionChoiceSelected, !unlocked && styles.companionChoiceLocked, pressed && styles.pressed]}>
                        <Image source={companion.image} resizeMode="contain" style={[styles.companionChoiceImage, !unlocked && styles.companionChoiceSilhouette]} accessibilityLabel={unlocked ? companion.name : "잠긴 펫"} />
                        <Text style={styles.companionChoiceName} numberOfLines={2}>{unlocked ? companion.name : "???"}</Text>
                        {selected ? <Text style={styles.companionChoiceCheck}>✓</Text> : null}
                      </Pressable>;
                    })}
                  </ScrollView>
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
                  <Pressable accessibilityRole="button" accessibilityLabel="게임 룰 닫기" onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.rulesClose, pressed && styles.pressed]}><Text style={styles.rulesCloseText}>×</Text></Pressable>
                  <Text style={styles.sheetEyebrow}>HOW TO PLAY</Text>
                  <Text style={styles.sheetTitle}>게임 룰</Text>
                  <View style={styles.rulesTabs}>
                    {([["basic", "기본 규칙"], ["cards", "카드 이동"], ["items", "공격·아이템"]] as const).map(([tab, label]) => <Pressable key={tab} onPress={() => setRulesTab(tab)} style={({ pressed }) => [styles.rulesTab, rulesTab === tab && styles.rulesTabActive, pressed && styles.pressed]}><Text style={[styles.rulesTabText, rulesTab === tab && styles.rulesTabTextActive]}>{label}</Text></Pressable>)}
                  </View>
                  {rulesTab === "basic" ? <Text style={styles.rulesText}>A부터 같은 무늬 순서로 위쪽 파운데이션을 완성하면 승리합니다. 카드는 색을 번갈아 놓고 숫자가 하나씩 낮아지게 쌓습니다.</Text> : null}
                  {rulesTab === "cards" ? <Text style={styles.rulesText}>카드를 탭한 뒤 이동할 곳을 탭하세요. 빈 열에는 K만 놓을 수 있습니다. 스톡을 탭하면 새 카드가 나오며, 힌트와 실행 취소로 진행을 도울 수 있습니다.</Text> : null}
                  {rulesTab === "items" ? <><Text style={styles.rulesText}>카드가 몬스터에게 날아가며 파운데이션 카드와 콤보 공격은 피해를 줍니다. 망치는 히든 카드 공개에 사용하고, 출석과 보상형 광고로 최대 10개까지 충전할 수 있습니다.</Text><Text style={styles.rulesHint}>출석체크: 게임에 접속한 날 출석 버튼을 눌러 보상을 받습니다. 일반 출석은 망치 2개, 10·20·30일차는 망치 5개를 받으며, 당일 출석은 한 번만 인정됩니다.</Text><Text style={styles.rulesHint}>망치 획득: 출석체크 또는 보상형 광고 시청으로 충전됩니다. 망치는 최대 10개까지 보유할 수 있습니다.</Text></> : null}
                  <Pressable onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>게임 시작하기</Text></Pressable>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showNewGameConfirm} animationType="fade" onRequestClose={() => { setShowNewGameConfirm(false); setPaused(false); }}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <Image source={RESET_MODAL_PANEL} resizeMode="stretch" style={styles.resetModalPanelArt} />
              </View>
              <Text style={styles.sheetEyebrow}>{resetMode === "current" ? "STAGE RESTART" : "GAME RESET"}</Text>
              <Text style={styles.sheetTitle}>{resetMode === "current" ? `현재 스테이지 ${game.level}을(를) 다시 시작할까요?` : "게임을 초기화할까요?"}</Text>
              <Text style={styles.sheetCopy}>{resetMode === "current" ? `스테이지 ${game.level}부터 다시 시작됩니다` : "스테이지 1부터 다시 시작됩니다"}</Text>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => { setShowNewGameConfirm(false); setPaused(false); }} style={({ pressed }) => [styles.confirmCancel, pressed && styles.pressed]}>
                  <View pointerEvents="none" style={styles.confirmButtonArtClip}><Image source={RESET_BUTTONS_ART} resizeMode="stretch" style={[styles.confirmButtonArt, { top: 0 }]} /></View>
                  <Text style={styles.confirmCancelText}>취소</Text>
                </Pressable>
                <Pressable onPress={() => startNewGame(resetMode === "current" ? game.level : 1, resetMode === "full")} style={({ pressed }) => [styles.confirmStart, pressed && styles.pressed]}>
                  <View pointerEvents="none" style={styles.confirmButtonArtClip}><Image source={RESET_BUTTONS_ART} resizeMode="stretch" style={[styles.confirmButtonArt, { top: "-100%" }]} /></View>
                  <Text style={styles.confirmStartText}>초기화</Text>
                </Pressable>
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
  previewTools: { position: "absolute", top: 86, left: 12, right: 12, zIndex: 60, flexDirection: "row", justifyContent: "center", gap: 8 },
  previewToolButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#F3C969", backgroundColor: "rgba(24, 39, 68, 0.94)" },
  previewToolText: { color: "#FFF3D1", fontSize: 10, fontWeight: "900" },
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
  monsterImageLayer: { alignItems: "center", justifyContent: "center" },
  bossCardShine: { position: "absolute", top: "-45%", bottom: "-45%", left: "-12%", width: 11, backgroundColor: "rgba(255, 246, 180, 0.92)", shadowColor: "#FFFFFF", shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  monsterInfo: { width: 68, alignItems: "flex-start", transform: [{ translateX: 50 }] },
  monsterInfoCompact: { width: 54, transform: [{ translateX: 50 }] },
  monsterInfoBoss: { width: 92 },
  monsterInfoPortrait: { transform: [{ translateX: 70 }] },
  companionSprite: { width: 34, height: 38, marginHorizontal: 1 },
  companionSpriteCompact: { width: 27, height: 31 },
  monsterNameRow: { flexDirection: "row", alignItems: "flex-start", gap: 3, width: "100%" },
  monsterName: { flex: 1, color: "#F3C969", fontSize: 12, lineHeight: 14, fontWeight: "900", letterSpacing: 0.5 },
  bossBadge: { minWidth: 42, color: "#11182C", backgroundColor: "#F3C969", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, lineHeight: 12, fontWeight: "900", textAlign: "center", letterSpacing: 0.4 },
  monsterBar: { width: "100%", height: 7, marginTop: 3, overflow: "hidden", borderRadius: 4, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  monsterBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#FF6F8A" },
  monsterHpFlash: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 3, backgroundColor: "#FF1F3D" },
  monsterRedFlash: { position: "absolute", left: "8%", top: "8%", width: "84%", height: "84%", borderRadius: 999, backgroundColor: "#FF1F3D" },
  comboImpactOverlay: { position: "absolute", zIndex: 8, alignItems: "center", justifyContent: "center" },
  comboImpactImage: { width: "100%", height: "100%" },
  monsterHp: { color: "#BCEAE2", fontSize: 11, fontWeight: "800", marginTop: 2 },
  monsterProjectile: { position: "absolute", left: 8, top: 12, fontSize: 24, fontWeight: "900", textShadowColor: "#FFFFFF", textShadowRadius: 7 },
  companionAnchor: { position: "absolute", zIndex: 22, alignItems: "center", justifyContent: "center" },
  companionPressTarget: { width: "100%", height: "100%" },
  companionPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  companionTapFrame: { position: "absolute", borderWidth: 3, borderRadius: 999, shadowColor: "#FFD86B", shadowOpacity: 0.95, shadowRadius: 12, elevation: 14 },
  companionImageFrame: { position: "absolute", alignItems: "center", justifyContent: "center" },
  shuffleBurstFrame: { position: "absolute", zIndex: 0, alignItems: "center", justifyContent: "center" },
  shuffleBurstImage: { width: "100%", height: "100%" },
  bonusBubbleColumn: { position: "absolute", top: -14, zIndex: 5, alignItems: "flex-end", gap: 5 },
  bonusBubble: { minWidth: 70, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#FFD86B", borderRadius: 13, borderWidth: 2, borderColor: "#FFF7C7", shadowColor: "#FFB629", shadowOpacity: 0.9, shadowRadius: 7, elevation: 9, transform: [{ rotate: "-4deg" }] },
  bonusBubbleText: { color: "#1A1B2E", fontSize: 11, fontWeight: "900", textAlign: "center", textShadowColor: "#FFF7C7", textShadowRadius: 2 },
  bonusBubbleArrow: { position: "absolute", right: -13, top: "50%", marginTop: -7, color: "#FFD86B", fontSize: 16, fontWeight: "900", textShadowColor: "#FFF7C7", textShadowRadius: 3 },
  attackCard: { position: "absolute", left: "43%", bottom: "14%", zIndex: 70, width: 34, height: 48, borderRadius: 6, borderWidth: 2, backgroundColor: "#FFFDF8", shadowColor: "#FFFFFF", shadowOpacity: 0.9, shadowRadius: 8, elevation: 20 },
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
  cardBoss: { backgroundColor: "#D5A73A", borderColor: "#FFE39A", shadowColor: "#F3C969", shadowOpacity: 0.55, shadowRadius: 6 },
  rankTop: { position: "absolute", fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitTop: { position: "absolute", fontSize: 12, lineHeight: 13, fontWeight: "900" },
  suitCenter: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 28, fontWeight: "900" },
  royalPortrait: { position: "absolute", top: "24%", left: "13%", width: "74%", height: "61%", overflow: "hidden", borderRadius: 12, transform: [{ scale: 0.9 }] },
  royalSprite: { position: "absolute", width: "400%", height: "300%" },
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
  bottomControls: { position: "absolute", left: 0, right: 0, bottom: 58, zIndex: 40, elevation: 20, flexDirection: "row", alignSelf: "center", justifyContent: "center", gap: 8 },
  bottomControlsLandscape: { bottom: 4 },
  bottomControlsLandscapeCompact: { gap: 8 },
  bottomControlsPhoneLandscape: { left: 0, flexDirection: "row", alignItems: "stretch", justifyContent: "flex-start", gap: 6 },
  bottomButton: { minWidth: 126, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 15, borderWidth: 1 },
  cartoonActionButton: { width: 94, height: 52, justifyContent: "center", alignItems: "center", borderRadius: 0, overflow: "visible", zIndex: 41, elevation: 0, borderWidth: 0, backgroundColor: "transparent", shadowOpacity: 0 },
  hintAttentionWrap: { width: 94, height: 52, justifyContent: "center", alignItems: "center", zIndex: 42 },
  cartoonHammerButton: { backgroundColor: "transparent", borderColor: "transparent" },
  cartoonHintButton: { backgroundColor: "transparent", borderColor: "transparent" },
  cartoonUndoButton: { backgroundColor: "transparent", borderColor: "transparent" },
  cartoonActionImage: { position: "absolute", left: 0, top: 0, width: 94, height: 52 },
    cartoonActionButtonDisabled: { opacity: 0.45 },
  bottomButtonPhoneLandscape: { flex: 1, minWidth: 0, minHeight: 44 },
  hammerPilesAnimated: { alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
  hammerPilesButton: { alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 0, borderColor: "transparent", backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  hammerPilesButtonReady: { borderWidth: 0, borderColor: "transparent", backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  hammerPilesIcon: { marginTop: -2 },
  hammerStrike: { position: "absolute", zIndex: 80, alignItems: "center", justifyContent: "center" },
  hammerStrikeImage: { width: "100%", height: "100%" },
  hammerImpactBurst: { position: "absolute", zIndex: 82, alignItems: "center", justifyContent: "center" },
  hammerImpactBurstImage: { width: "100%", height: "100%" },
  hammerPilesCount: { color: "#F3C969", lineHeight: 18, fontWeight: "900", marginTop: -1, textShadowColor: "#17233C", textShadowRadius: 2 },
  hammerPilesCountEmpty: { color: "#F3C969", textShadowColor: "#17233C", textShadowRadius: 2 },
  hintButton: { backgroundColor: "#233958", borderColor: "#3D5A85" },
  undoButton: { backgroundColor: "#2A4268", borderColor: "#5B78A5" },
  undoButtonDisabled: { opacity: 0.38 },
  bottomButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  bottomButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hintToast: { position: "absolute", left: 16, right: 16, bottom: 56, zIndex: 20, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  hintToastLandscape: { bottom: 60 },
  hintToastText: { color: "#BCEAE2", fontSize: 12, fontWeight: "700", textAlign: "center" },
  hammerModeHint: { position: "absolute", left: 18, right: 18, top: "44%", zIndex: 62, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: "rgba(90, 41, 26, 0.96)", borderWidth: 2, borderColor: "#F3A85D", shadowColor: "#FFB86B", shadowOpacity: 0.75, shadowRadius: 11, elevation: 16 },
  hammerModeHintText: { color: "#FFF3D1", fontSize: 12, fontWeight: "900", textAlign: "center" },
  flyingCard: { position: "absolute", left: 16, bottom: 44, zIndex: 30, overflow: "hidden", borderRadius: 8, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF7A66", shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 9, elevation: 12 },
  flamingFlyingCard: { position: "absolute", zIndex: 31, overflow: "visible", backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 0, alignItems: "center", justifyContent: "center" },
  flamingCardArt: { position: "absolute", top: "-8%", left: "-8%", width: "116%", height: "116%", zIndex: 2 },
  flamingTailLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1, overflow: "visible" },
  flamingTailParticle: { position: "absolute", fontWeight: "900", textShadowColor: "#FF4B12", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
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
  modalBackdropCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(3, 7, 18, 0.76)" },
  rewardedErrorCard: { width: "100%", maxWidth: 360, padding: 20, borderRadius: 22, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 18, elevation: 16 },
  rewardedErrorTitle: { color: "#F3C969", fontSize: 18, fontWeight: "900", textAlign: "center" },
  rewardedErrorCopy: { color: "#E5ECF8", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  rewardedErrorActions: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 18 },
  rewardedRetryButton: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: "#F3C969", alignItems: "center" },
  rewardedRetryText: { color: "#17233C", fontSize: 13, fontWeight: "900" },
  rewardedCloseButton: { minWidth: 82, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, borderWidth: 1, borderColor: "#64799D", alignItems: "center" },
  rewardedCloseText: { color: "#E5ECF8", fontSize: 13, fontWeight: "800" },
  shuffleHelpCard: { width: "100%", maxWidth: 370, padding: 22, borderRadius: 24, borderWidth: 2, borderColor: "#77D6C3", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18 },
  rewardedShuffleCard: { width: "100%", maxWidth: 370, padding: 22, borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18 },
  noMovesPopupCard: { width: "92%", maxWidth: 320, padding: 18, paddingTop: 24, borderRadius: 20, borderWidth: 2, borderColor: "#77D6C3", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18 },
  noMovesPopupClose: { position: "absolute", top: 5, right: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", zIndex: 2 },
  noMovesPopupCloseText: { color: "#FFF3D1", fontSize: 24, lineHeight: 27, fontWeight: "800" },
  noMovesPopupTitle: { color: "#FFF3D1", fontSize: 17, lineHeight: 23, fontWeight: "900", textAlign: "center" },
  noMovesPopupCopy: { color: "#D4E2F7", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  noMovesPopupActions: { flexDirection: "row", gap: 8, marginTop: 18, justifyContent: "center" },
  noMovesPopupPrimary: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: "#77D6C3", alignItems: "center" },
  noMovesPopupAd: { backgroundColor: "#F3C969" },
  noMovesPopupPrimaryText: { color: "#17233C", fontSize: 13, fontWeight: "900" },
  noMovesPopupSecondary: { minWidth: 94, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, borderWidth: 1, borderColor: "#64799D", alignItems: "center" },
  noMovesPopupSecondaryText: { color: "#E5ECF8", fontSize: 13, fontWeight: "800" },
  hammerOfferCard: { width: "92%", maxWidth: 330, padding: 20, paddingTop: 27, borderRadius: 22, borderWidth: 2, borderColor: "#F3A85D", backgroundColor: "#36211F", shadowColor: "#000000", shadowOpacity: 0.48, shadowRadius: 20, elevation: 20 },
  hammerOfferTitle: { color: "#FFF3D1", fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center" },
  hammerOfferCopy: { color: "#FFD6A4", fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "center", marginTop: 10 },
  hammerOfferPrimary: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: "#F3A85D", alignItems: "center" },
  rewardedTooltip: { alignSelf: "center", marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#FFF3D1", borderWidth: 1, borderColor: "#F3C969" },
  rewardedTooltipText: { color: "#17233C", fontSize: 12, fontWeight: "900", textAlign: "center" },
  shuffleHelpEyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
  shuffleHelpTitle: { color: "#FFF3D1", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 7 },
  shuffleHelpCopy: { color: "#D4E2F7", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 9 },
  shuffleHelpAction: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 16, backgroundColor: "#77D6C3" },
  shuffleHelpRewardAction: { backgroundColor: "#F3C969" },
  shuffleHelpActionIcon: { color: "#17233C", fontSize: 23, fontWeight: "900" },
  shuffleHelpActionTitle: { color: "#17233C", fontSize: 14, fontWeight: "900" },
  shuffleHelpActionSub: { color: "#31415D", fontSize: 10, fontWeight: "800", marginTop: 2 },
  shuffleHelpClose: { alignSelf: "center", paddingHorizontal: 18, paddingVertical: 11, marginTop: 7 },
  shuffleHelpCloseText: { color: "#A6B4CE", fontSize: 13, fontWeight: "800" },
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
  resetButton: { backgroundColor: "#3A355C", borderColor: "#8D7CC2" },
  sheetSecondaryText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
  sheetLinkButton: { alignSelf: "center", paddingVertical: 14, marginTop: 7 },
  sheetLinkText: { color: "#FF9E91", fontSize: 13, fontWeight: "800" },
  companionPickerCopy: { color: "#A6B4CE", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 16 },
  petGridScroll: { maxHeight: 430, marginHorizontal: -4 },
  companionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingBottom: 12 },
  companionChoice: { width: "23.5%", minHeight: 96, alignItems: "center", justifyContent: "center", paddingVertical: 7, paddingHorizontal: 2, borderRadius: 12, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  companionChoiceSelected: { backgroundColor: "#2B6B72", borderColor: "#77D6C3", borderWidth: 2 },
  companionChoiceLocked: { backgroundColor: "#101A30", borderColor: "#263753" },
  companionChoiceImage: { width: 48, height: 52 },
  companionChoiceSilhouette: { opacity: 0.92, tintColor: "#020611" },
  companionChoiceName: { color: "#FFFDF8", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 6 },
  companionChoiceCheck: { position: "absolute", top: 6, right: 7, color: "#FFFDF8", fontSize: 16, fontWeight: "900" },
  recordGrid: { flexDirection: "row", gap: 8, marginTop: 20 },
  recordCard: { flex: 1, minHeight: 83, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A", paddingHorizontal: 4 },
  recordValue: { color: "#FFFDF8", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  recordLabel: { color: "#A6B4CE", fontSize: 10, fontWeight: "700", marginTop: 5 },
  rulesClose: { position: "absolute", top: 14, right: 16, width: 34, height: 34, alignItems: "center", justifyContent: "center", zIndex: 3, borderRadius: 17, backgroundColor: "#152542" },
  rulesCloseText: { color: "#FFF3D1", fontSize: 24, lineHeight: 27, fontWeight: "900" },
  rulesTabs: { flexDirection: "row", gap: 7, marginTop: 18, marginBottom: 4 },
  rulesTab: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  rulesTabActive: { backgroundColor: "#2B6B72", borderColor: "#77D6C3" },
  rulesTabText: { color: "#A6B4CE", fontSize: 11, fontWeight: "800" },
  rulesTabTextActive: { color: "#FFFDF8" },
  attendanceHeaderButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, overflow: "hidden" },
  attendanceHeaderAnimated: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  attendanceHeaderButtonDone: { backgroundColor: "#465A7F", opacity: 0.72 },
  attendanceHeaderImage: { width: 40, height: 40 },
  attendanceHeaderImageDone: { opacity: 0.48 },
  attendanceDoneBadge: { position: "absolute", right: 1, bottom: 1, width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#77D6C3", borderWidth: 2, borderColor: "#152542" },
  attendanceDoneBadgeText: { color: "#152542", fontSize: 13, lineHeight: 15, fontWeight: "900" },
  attendanceRewardFlight: { position: "absolute", zIndex: 80, width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  attendanceRewardFlightImage: { width: 54, height: 54 },
  attendanceCard: { position: "relative", width: "88%", maxWidth: 330, alignItems: "center", padding: 22, paddingTop: 26, borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#1E3153", shadowColor: "#000000", shadowOpacity: 0.46, shadowRadius: 20, elevation: 20 },
  attendanceModalImage: { width: 96, height: 54, marginBottom: 5 },
  attendanceTitle: { color: "#FFF3D1", fontSize: 22, fontWeight: "900", textAlign: "center" },
  attendanceCopy: { color: "#D4E2F7", fontSize: 14, fontWeight: "800", textAlign: "center", marginTop: 9 },
  attendanceReward: { color: "#77D6C3", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 7 },
  attendanceClaimButton: { minWidth: 170, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#F3C969", marginTop: 18, paddingHorizontal: 18 },
  attendanceClaimButtonDisabled: { backgroundColor: "#465A7F", opacity: 0.75 },
  attendanceClaimText: { color: "#17233C", fontSize: 14, fontWeight: "900" },
  rulesText: { color: "#FFFDF8", fontSize: 15, lineHeight: 23, marginTop: 17 },
  rulesHint: { color: "#77D6C3", fontSize: 13, lineHeight: 20, marginTop: 13 },
  confirmBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(3, 7, 18, 0.76)" },
  confirmCard: { position: "relative", overflow: "hidden", borderRadius: 24, borderWidth: 0, backgroundColor: "transparent", padding: 24 },
  resetModalPanelArt: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  confirmButtonArtClip: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden", borderRadius: 15 },
  confirmButtonArt: { position: "absolute", left: 0, width: "100%", height: "200%" },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  confirmCancel: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#2A4268", borderWidth: 1, borderColor: "#45628E", overflow: "hidden" },
  confirmCancelText: { color: "#FFFDF8", fontSize: 15, fontWeight: "900" },
  confirmStart: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#FF7A66", overflow: "hidden" },
  confirmStartText: { color: "#11182C", fontSize: 15, fontWeight: "900" },
});
