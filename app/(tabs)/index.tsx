import { useEffect, useRef, useState } from "react";
import { Alert, Animated, AppState, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as ScreenOrientation from "expo-screen-orientation";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
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
  isWon,
  moveFoundationToTableau,
  moveAceToFoundation,
  moveAvailableAcesToFoundation,
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

type Selection = CardSource & { cardId: string };
type Sheet = "menu" | "rules" | "records" | null;
type Records = { wins: number; bestScore: number; bestTimeSeconds: number | null };

const CARD_RATIO = 1.42;
const ACTIVE_GAME_KEY = "our-style-solitaire:active-game";
const RECORDS_KEY = "our-style-solitaire:records";
const SOUND_ENABLED_KEY = "our-style-solitaire:sound-enabled";
const PHYSICAL_EDGE_INSET = 52;

const emptyRecords: Records = { wins: 0, bestScore: 0, bestTimeSeconds: null };

function cardLabel(card: Card): string {
  return `${rankLabels[card.rank]} ${suitNames[card.suit]}`;
}

function playingCardColor(card: Card): string {
  return card.suit === "diamonds" || card.suit === "hearts" ? "#E94B5F" : "#1A2030";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RoyalPortrait({ rank }: { rank: 11 | 12 | 13 }) {
  const isJack = rank === 11;
  const isQueen = rank === 12;
  const outfit = isJack ? "#314A76" : isQueen ? "#7A416B" : "#295D66";
  const trim = isJack ? "#FF8A76" : isQueen ? "#E785B5" : "#D6A956";
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
        {isQueen ? <Path d="M27 29 L34 10 L43 23 L50 7 L57 23 L66 10 L73 29 Z" fill="#F3C969" /> : null}
        {rank === 13 ? <Path d="M23 31 L30 8 L41 23 L50 5 L59 23 L70 8 L77 31 Z" fill="#F3C969" /> : null}
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

type MedievalIconName = "auto" | "new" | "orientation" | "sound" | "menu" | "hint" | "undo";

function MedievalBackdrop() {
  return (
    <View pointerEvents="none" style={styles.medievalBackdrop}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Rect width="390" height="844" fill="#101B31" />
        <Path d="M0 0 H74 V102 H55 V78 H39 V102 H0 Z" fill="#263A5A" opacity="0.82" />
        <Path d="M390 0 H316 V102 H335 V78 H351 V102 H390 Z" fill="#263A5A" opacity="0.82" />
        <Path d="M0 844 V726 H18 V748 H35 V726 H56 V844 Z" fill="#263A5A" opacity="0.78" />
        <Path d="M390 844 V726 H372 V748 H355 V726 H334 V844 Z" fill="#263A5A" opacity="0.78" />
        <Path d="M0 128 C45 104 71 112 96 138" stroke="#3E567F" strokeWidth="4" fill="none" opacity="0.52" />
        <Path d="M390 128 C345 104 319 112 294 138" stroke="#3E567F" strokeWidth="4" fill="none" opacity="0.52" />
        <Circle cx="29" cy="182" r="13" fill="#F3C969" opacity="0.9" />
        <Circle cx="361" cy="182" r="13" fill="#F3C969" opacity="0.9" />
        <Circle cx="29" cy="182" r="6" fill="#FFF3C9" />
        <Circle cx="361" cy="182" r="6" fill="#FFF3C9" />
        <Path d="M21 201 H37 L33 219 H25 Z" fill="#C2794A" />
        <Path d="M353 201 H369 L365 219 H357 Z" fill="#C2794A" />
        <Circle cx="98" cy="30" r="2.5" fill="#77D6C3" opacity="0.6" />
        <Circle cx="292" cy="30" r="2.5" fill="#77D6C3" opacity="0.6" />
        <Path d="M7 567 Q44 549 75 574" stroke="#314A76" strokeWidth="3" fill="none" opacity="0.7" />
        <Path d="M383 567 Q346 549 315 574" stroke="#314A76" strokeWidth="3" fill="none" opacity="0.7" />
      </Svg>
    </View>
  );
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
      {name === "menu" ? <><Path d="M16 4 L27 9 V17 Q25 25 16 29 Q7 25 5 17 V9 Z" fill="#314A76" {...common} /><Circle cx="16" cy="11" r="2" fill={gold} /><Circle cx="16" cy="17" r="2" fill={gold} /><Circle cx="16" cy="23" r="2" fill={gold} /></> : null}
      {name === "hint" ? <><Path d="M10 13 Q10 5 16 5 Q22 5 22 13 V19 H10 Z" fill={gold} {...common} /><Path d="M13 22 H19 M14 26 H18" stroke={teal} strokeWidth="3" strokeLinecap="round" /><Circle cx="16" cy="13" r="3" fill="#FFF3D1" /></> : null}
      {name === "undo" ? <><Path d="M25 10 H12 Q7 10 7 16 Q7 22 13 22 H23" stroke={gold} strokeWidth="4" fill="none" {...common} /><Path d="M12 5 L6 10 L12 15" stroke={coral} strokeWidth="4" fill="none" {...common} /><Path d="M16 13 V19" stroke={teal} strokeWidth="2" strokeLinecap="round" /></> : null}
    </Svg>
  );
}

function CardFace({
  card,
  width,
  selected,
  onPress,
  onDoublePress,
  onDragEnd,
}: {
  card: Card;
  width: number;
  selected?: boolean;
  onPress?: () => void;
  onDoublePress?: () => void;
  onDragEnd?: (dx: number, dy: number) => void;
}) {
  const height = width * CARD_RATIO;
  const color = playingCardColor(card);
  const rankSize = Math.max(10, Math.round(width * 0.26));
  const suitSize = Math.max(9, Math.round(width * 0.22));
  const centerSize = Math.max(21, Math.round(width * 0.52));
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
      <Text style={[styles.rankTop, { color, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
      <Text style={[styles.suitTop, { color, fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      {isRoyal ? <RoyalPortrait rank={card.rank as 11 | 12 | 13} /> : <Text style={[styles.suitCenter, { color, fontSize: centerSize }]}>{suitSymbols[card.suit]}</Text>}
      <View style={styles.bottomMark}>
        <Text style={[styles.rankBottom, { color, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
        <Text style={[styles.suitBottom, { color, fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      </View>
    </Pressable>
  );
}

function CardBack({ width, theme, onPress }: { width: number; theme: CardBackTheme; onPress: () => void }) {
  const height = width * CARD_RATIO;
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

function FlyingCard({ card, width, progress }: { card: Card; width: number; progress: Animated.Value }) {
  const color = playingCardColor(card);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width * 2.7] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 1.8] });
  const scale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1.1, 0.6] });
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View pointerEvents="none" style={[styles.flyingCard, { width, height: width * CARD_RATIO, opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: "7deg" }] }]}>
      <Text style={[styles.flyingRank, { color }]}>{rankLabels[card.rank]}</Text>
      <Text style={[styles.flyingSuit, { color }]}>{suitSymbols[card.suit]}</Text>
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

function EmptySlot({ width, label, onPress }: { width: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label || "빈 카드 슬롯"}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, { width, height: width * CARD_RATIO }, pressed && styles.pressed]}
    >
      <Text style={styles.slotLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [deviceOrientation, setDeviceOrientation] = useState<ScreenOrientation.Orientation | null>(null);
  const nativeLandscape = deviceOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || deviceOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT || screenWidth > screenHeight;
  const isLandscape = nativeLandscape;
  const physicalEdgeInset = isLandscape ? 10 : PHYSICAL_EDGE_INSET;
  const { boardWidth, cardWidth, compact, stackOffset, tableauGap, uiScale } = getGameLayout(
    screenWidth,
    screenHeight,
    physicalEdgeInset * 2,
    false,
  );
  const [game, setGame] = useState(createPlayableGame);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [hydrated, setHydrated] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<typeof game[]>([]);
  const newGameStarted = useRef(false);
  const gameRef = useRef(game);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const flightProgress = useRef(new Animated.Value(0)).current;
  const selectPlayer = useAudioPlayer(require("../../assets/sounds/card-select.wav"));
  const movePlayer = useAudioPlayer(require("../../assets/sounds/card-move.wav"));

  useEffect(() => {
    let mounted = true;
    const loadLocalGame = async () => {
      try {
        const [activeGameValue, recordsValue, soundEnabledValue] = await AsyncStorage.multiGet([ACTIVE_GAME_KEY, RECORDS_KEY, SOUND_ENABLED_KEY]);
        if (!mounted) return;
        if (activeGameValue[1] && !newGameStarted.current) {
          const saved = JSON.parse(activeGameValue[1]) as { game?: typeof game; elapsedSeconds?: number };
          if (saved.game?.tableau?.length === 7) setGame({ ...saved.game, level: saved.game.level ?? 1, recycles: saved.game.recycles ?? 0 });
          if (typeof saved.elapsedSeconds === "number") setElapsedSeconds(saved.elapsedSeconds);
        }
        if (recordsValue[1]) setRecords({ ...emptyRecords, ...(JSON.parse(recordsValue[1]) as Records) });
        if (soundEnabledValue[1]) setSoundEnabled(soundEnabledValue[1] === "true");
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
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ game, elapsedSeconds })).catch(() => undefined);
    gameRef.current = game;
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds, game, hydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") return;
      AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ game: gameRef.current, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records)).catch(() => undefined);
  }, [hydrated, records]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled)).catch(() => undefined);
  }, [hydrated, soundEnabled]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

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
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ game: freshGame, elapsedSeconds: 0 })).catch(() => undefined);
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

  const playEffect = (effect: "select" | "move") => {
    if (!soundEnabled) return;
    const player = effect === "select" ? selectPlayer : movePlayer;
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
    Animated.timing(flightProgress, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setFlyingCard(null));
  };

  const cardFromSource = (source: CardSource): Card | undefined => {
    if (source.kind === "waste") return game.waste.at(-1);
    if (source.kind === "foundation") return game.foundations[source.suit].at(-1);
    return game.tableau[source.column]?.[source.index];
  };

  const showHint = () => {
    const hint = findHint(game);
    if (!hint) {
      setHintMessage("지금은 새로운 이동을 찾기 어렵습니다. 실행 취소를 사용해 보세요.");
      haptic.error();
      return;
    }
    setHintMessage(hint.message);
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
    setHintMessage("이전 이동을 되돌렸습니다.");
    gameRef.current = previousGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ game: previousGame, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
    haptic.light();
  };

  const applyGame = (nextGame: typeof game | null, success = false, movedCard?: Card) => {
    if (!nextGame || nextGame === game) {
      haptic.error();
      return;
    }
    setUndoStack((history) => [...history.slice(-19), cloneGameState(game)]);
    gameRef.current = nextGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ game: nextGame, elapsedSeconds: elapsedSecondsRef.current })).catch(() => undefined);
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
      const nextLevel = Math.min(nextGame.level + 1, 6);
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 1550);
      setTimeout(() => Alert.alert("축하합니다", `레벨 ${nextGame.level}을 ${nextGame.moves}번의 이동으로 완성했어요. 다음 게임은 레벨 ${nextLevel}입니다.`, [{ text: "다음 레벨", onPress: () => startNewGame(nextLevel) }]), 1620);
    }
  };

  const selectCard = (nextSelection: Selection) => {
    haptic.light();
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
      applyGame(moveAvailableAcesToFoundation(drawnGame));
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
      haptic.error();
      return;
    }
    applyGame(completed, isWon(completed));
  };

  const difficulty = getDifficulty(game.level);
  const cardBackTheme = getCardBackTheme(game.level);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <View style={[styles.root, { paddingTop: physicalEdgeInset, paddingBottom: physicalEdgeInset + 62 }, isLandscape && styles.rootLandscape]}>
        <MedievalBackdrop />
        {flyingCard ? <FlyingCard card={flyingCard} width={cardWidth} progress={flightProgress} /> : null}
        <VictoryFireworks visible={showFireworks} />
        <View style={[styles.header, isLandscape && styles.headerLandscape]}>
          <View>
            <Text style={styles.eyebrow}>OUR STYLE</Text>
            <View style={styles.titleLine}>
              <Text style={[styles.title, { fontSize: Math.round(27 * uiScale), lineHeight: Math.round(31 * uiScale) }]}>Solitaire</Text>
              <View style={styles.levelBadge}><Text style={styles.levelText}>LV {game.level} · {difficulty.label}</Text></View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="자동 완성" onPress={runAutoComplete} style={({ pressed }) => [styles.autoButton, pressed && styles.pressed]}>
              <MedievalIcon name="auto" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="새 게임" onPress={requestNewGame} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
              <MedievalIcon name="new" size={23} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={isLandscape ? "세로 모드로 전환" : "가로 모드로 전환"} onPress={toggleOrientation} style={({ pressed }) => [styles.orientationButton, pressed && styles.pressed]}>
              <MedievalIcon name="orientation" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={soundEnabled ? "사운드 끄기" : "사운드 켜기"} onPress={() => setSoundEnabled((value) => !value)} style={({ pressed }) => [styles.soundButton, !soundEnabled && styles.soundButtonOff, pressed && styles.pressed]}>
              <MedievalIcon name="sound" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
              <MedievalIcon name="menu" size={19} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.stats, isLandscape && styles.statsLandscape]}>
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.score}</Text><Text style={styles.statLabel}>점수</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.moves}</Text><Text style={styles.statLabel}>이동</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{formatDuration(elapsedSeconds)}</Text><Text style={styles.statLabel}>시간</Text></View>
          {!compact && !isLandscape ? <View style={styles.statusWrap}>
              <View style={[styles.statusDot, selection ? styles.statusDotSelected : styles.statusDotReady]} />
              <Text style={styles.statusText}>{hydrated ? (selection ? "이동할 곳을 탭하세요" : "카드를 선택하세요") : "게임 준비 중"}</Text>
            </View> : null}
        </View>

        <View style={[styles.board, { width: boardWidth }, isLandscape && styles.boardLandscape]}>
        <View style={[styles.topPiles, isLandscape && styles.topPilesLandscape]}>
          <View style={styles.stockWasteGroup}>
            {game.stock.length ? (
              <CardBack width={cardWidth} theme={cardBackTheme} onPress={drawStockCard} />
            ) : (
              <EmptySlot width={cardWidth} label={game.waste.length ? "↻" : ""} onPress={() => applyGame(drawFromStock(game))} />
            )}
            {game.waste.at(-1) ? (
              <CardFace card={game.waste.at(-1)!} width={cardWidth} selected={selection?.kind === "waste"} onPress={onWastePress} onDoublePress={() => autoMoveToFoundation({ kind: "waste" })} />
            ) : (
              <EmptySlot width={cardWidth} label="" />
            )}
          </View>
          <View style={[styles.foundationGroup, { gap: Math.max(3, Math.round(cardWidth * 0.08)) }]}>
            {SUITS.map((suit) => {
              const card = game.foundations[suit].at(-1);
              return card ? (
                <CardFace key={suit} card={card} width={cardWidth} selected={selection?.kind === "foundation" && selection.suit === suit} onPress={() => onFoundationPress(suit)} onDragEnd={(dx, dy) => dragMoveCard({ kind: "foundation", suit }, dx, dy)} />
              ) : (
                <EmptySlot key={suit} width={cardWidth} label={suitSymbols[suit]} onPress={() => onFoundationPress(suit)} />
              );
            })}
          </View>
        </View>

        <View style={[styles.tableau, { gap: tableauGap }, isLandscape && styles.tableauLandscape]}>
          {game.tableau.map((pile, column) => (
            <View key={`column-${column}`} style={[styles.tableauColumn, { width: cardWidth, minHeight: cardWidth * CARD_RATIO }]}>
              {pile.length === 0 ? <EmptySlot width={cardWidth} label="K" onPress={() => moveSelectionToTableau(column)} /> : null}
              {pile.map((card, index) => (
                <View key={card.id} style={{ position: "absolute", top: index * stackOffset, left: 0, zIndex: index }}>
                  {card.faceUp ? (
                    <CardFace card={card} width={cardWidth} selected={selection?.cardId === card.id} onPress={() => onTableauPress(column, index, card)} onDoublePress={() => autoMoveToFoundation({ kind: "tableau", column, index })} onDragEnd={(dx, dy) => dragMoveCard({ kind: "tableau", column, index }, dx, dy)} />
                  ) : (
                    <CardBack width={cardWidth} theme={cardBackTheme} onPress={() => onTableauPress(column, index, card)} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
        </View>

        <View style={[styles.bottomControls, isLandscape && styles.bottomControlsLandscape]}>
          <Pressable accessibilityRole="button" accessibilityLabel="힌트 보기" onPress={showHint} style={({ pressed }) => [styles.bottomButton, styles.hintButton, pressed && styles.pressed]}>
            <View style={styles.bottomButtonContent}><MedievalIcon name="hint" size={20} /><Text style={styles.bottomButtonText}>힌트</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="실행 취소" disabled={undoStack.length === 0} onPress={undoLastMove} style={({ pressed }) => [styles.bottomButton, styles.undoButton, undoStack.length === 0 && styles.undoButtonDisabled, pressed && styles.pressed]}>
            <View style={styles.bottomButtonContent}><MedievalIcon name="undo" size={20} /><Text style={styles.bottomButtonText}>실행 취소</Text></View>
          </Pressable>
        </View>
        {hintMessage ? <View style={[styles.hintToast, isLandscape && styles.hintToastLandscape]}><Text style={styles.hintToastText}>{hintMessage}</Text></View> : null}

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
                  <Pressable onPress={requestNewGame} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>새 게임 시작</Text></Pressable>
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
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11182C", paddingHorizontal: 12 },
  medievalBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.72 },
  rootLandscape: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 12 },
  headerLandscape: { paddingTop: 0, paddingBottom: 3 },
  eyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "800", letterSpacing: 2.2 },
  title: { color: "#FFFDF8", fontSize: 27, lineHeight: 31, fontWeight: "800", letterSpacing: -0.7 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  levelText: { color: "#77D6C3", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  autoButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 17, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  autoButtonText: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  newButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#FF7A66" },
  newButtonText: { color: "#11182C", fontSize: 22, lineHeight: 24, fontWeight: "600" },
  orientationButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  orientationButtonText: { color: "#77D6C3", fontSize: 17, lineHeight: 20, fontWeight: "900" },
  soundButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  soundButtonOff: { backgroundColor: "#1A2944", borderColor: "#294264" },
  soundButtonText: { color: "#77D6C3", fontSize: 18, lineHeight: 20, fontWeight: "900" },
  menuButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958" },
  menuButtonText: { color: "#FFFDF8", fontSize: 19, lineHeight: 16, fontWeight: "900", marginTop: -8 },
  stats: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#2E4163", paddingVertical: 8, marginBottom: 14 },
  statsLandscape: { paddingVertical: 3, marginBottom: 6 },
  statValue: { color: "#FFFDF8", fontSize: 15, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  statLabel: { color: "#A6B4CE", fontSize: 9, fontWeight: "700", marginTop: 1, textAlign: "center" },
  statDivider: { width: 1, height: 22, marginHorizontal: 10, backgroundColor: "#2E4163" },
  statusWrap: { flex: 1, marginLeft: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotReady: { backgroundColor: "#77D6C3" },
  statusDotSelected: { backgroundColor: "#FF7A66" },
  statusText: { color: "#A6B4CE", fontSize: 10, fontWeight: "600" },
  board: { alignSelf: "center" },
  boardLandscape: { flex: 1, justifyContent: "flex-start" },
  topPiles: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  topPilesLandscape: { marginBottom: 6 },
  stockWasteGroup: { flexDirection: "row", gap: 6 },
  foundationGroup: { flexDirection: "row", gap: 4 },
  slot: { borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3C557D", alignItems: "center", justifyContent: "center", backgroundColor: "#182744" },
  slotLabel: { color: "#58739D", fontSize: 15, fontWeight: "900" },
  card: { position: "relative", overflow: "hidden", borderRadius: 7, borderWidth: 1, backgroundColor: "#FFFDF8", shadowColor: "#050912", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardSelected: { transform: [{ translateY: -7 }], borderWidth: 2.5, shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  rankTop: { position: "absolute", top: 4, left: 5, fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitTop: { position: "absolute", top: 18, left: 6, fontSize: 12, lineHeight: 13, fontWeight: "900" },
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
  bottomControls: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, flexDirection: "row", alignSelf: "center", justifyContent: "center", gap: 10 },
  bottomControlsLandscape: { bottom: 4 },
  bottomButton: { minWidth: 126, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 15, borderWidth: 1 },
  hintButton: { backgroundColor: "#233958", borderColor: "#3D5A85" },
  undoButton: { backgroundColor: "#2A4268", borderColor: "#5B78A5" },
  undoButtonDisabled: { opacity: 0.38 },
  bottomButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  bottomButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hintToast: { position: "absolute", left: 16, right: 16, bottom: 56, zIndex: 20, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  hintToastLandscape: { bottom: 60 },
  hintToastText: { color: "#BCEAE2", fontSize: 12, fontWeight: "700", textAlign: "center" },
  flyingCard: { position: "absolute", left: 16, bottom: 44, zIndex: 30, overflow: "hidden", borderRadius: 8, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF7A66", shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 9, elevation: 12 },
  flyingRank: { position: "absolute", top: 6, left: 7, fontSize: 16, fontWeight: "900" },
  flyingSuit: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 30, fontWeight: "900" },
  fireworkLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: "center", justifyContent: "center" },
  fireworkParticle: { position: "absolute", width: 10, height: 10, borderRadius: 5, shadowColor: "#FFFFFF", shadowOpacity: 0.8, shadowRadius: 5, elevation: 10 },
  victoryText: { position: "absolute", top: "43%", color: "#FFFDF8", fontSize: 28, fontWeight: "900", letterSpacing: 1.8, textShadowColor: "#FF7A66", textShadowRadius: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3, 7, 18, 0.76)" },
  sheet: { backgroundColor: "#1E3153", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: "#45628E", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 34 },
  sheetEyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 1.7, marginBottom: 7 },
  sheetTitle: { color: "#FFFDF8", fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.6 },
  sheetCopy: { color: "#A6B4CE", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 21 },
  sheetPrimaryButton: { minHeight: 50, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#FF7A66", marginTop: 21 },
  sheetPrimaryText: { color: "#11182C", fontSize: 15, fontWeight: "900" },
  sheetRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  sheetSecondaryButton: { flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center", borderRadius: 14, backgroundColor: "#2A4268", borderWidth: 1, borderColor: "#45628E" },
  sheetSecondaryText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
  sheetLinkButton: { alignSelf: "center", paddingVertical: 14, marginTop: 7 },
  sheetLinkText: { color: "#FF9E91", fontSize: 13, fontWeight: "800" },
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
