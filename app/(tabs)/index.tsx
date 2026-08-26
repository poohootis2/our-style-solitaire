import { useEffect, useRef, useState } from "react";
import { Alert, Animated, AppState, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as ScreenOrientation from "expo-screen-orientation";

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
      <Text style={[styles.suitCenter, { color, fontSize: centerSize }]}>{suitSymbols[card.suit]}</Text>
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
      <View style={[styles.root, { paddingTop: physicalEdgeInset, paddingBottom: physicalEdgeInset }, isLandscape && styles.rootLandscape]}>
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
              <Text style={styles.autoButtonText}>AUTO</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="새 게임" onPress={requestNewGame} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
              <Text style={styles.newButtonText}>＋</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={isLandscape ? "세로 모드로 전환" : "가로 모드로 전환"} onPress={toggleOrientation} style={({ pressed }) => [styles.orientationButton, pressed && styles.pressed]}>
              <Text style={styles.orientationButtonText}>{isLandscape ? "▯" : "▭"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={soundEnabled ? "사운드 끄기" : "사운드 켜기"} onPress={() => setSoundEnabled((value) => !value)} style={({ pressed }) => [styles.soundButton, !soundEnabled && styles.soundButtonOff, pressed && styles.pressed]}>
              <Text style={styles.soundButtonText}>{soundEnabled ? "♪" : "×"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
              <Text style={styles.menuButtonText}>···</Text>
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
            <Text style={styles.bottomButtonText}>HINT</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="실행 취소" disabled={undoStack.length === 0} onPress={undoLastMove} style={({ pressed }) => [styles.bottomButton, styles.undoButton, undoStack.length === 0 && styles.undoButtonDisabled, pressed && styles.pressed]}>
            <Text style={styles.bottomButtonText}>↶  UNDO</Text>
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
  bottomMark: { position: "absolute", right: 5, bottom: 3, transform: [{ rotate: "180deg" }], alignItems: "center" },
  rankBottom: { fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitBottom: { fontSize: 12, lineHeight: 12, fontWeight: "900" },
  cardBack: { borderColor: "#0C1222", backgroundColor: "#77D6C3", padding: 4 },
  backInner: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 4, backgroundColor: "#1E3153", borderWidth: 1, borderColor: "#9BE4D5" },
  backMark: { color: "#77D6C3", fontSize: 26, fontWeight: "900" },
  tableau: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tableauLandscape: { flexGrow: 0 },
  tableauColumn: { position: "relative" },
  bottomControls: { flexDirection: "row", alignSelf: "center", gap: 10, marginTop: 8 },
  bottomControlsLandscape: { marginTop: 4 },
  bottomButton: { minWidth: 126, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 15, borderWidth: 1 },
  hintButton: { backgroundColor: "#233958", borderColor: "#3D5A85" },
  undoButton: { backgroundColor: "#2A4268", borderColor: "#5B78A5" },
  undoButtonDisabled: { opacity: 0.38 },
  bottomButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  hintToast: { alignSelf: "center", maxWidth: "92%", marginTop: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  hintToastLandscape: { position: "absolute", bottom: 52, zIndex: 25 },
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
