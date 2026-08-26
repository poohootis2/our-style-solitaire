import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { getGameLayout } from "@/lib/game-layout";
import { haptic } from "@/lib/haptics";
import {
  autoComplete,
  createNewGame,
  drawFromStock,
  flipTableauCard,
  isWon,
  moveFoundationToTableau,
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

function CardFace({ card, width, selected, onPress }: { card: Card; width: number; selected?: boolean; onPress?: () => void }) {
  const height = width * CARD_RATIO;
  const color = playingCardColor(card);
  const rankSize = Math.max(10, Math.round(width * 0.26));
  const suitSize = Math.max(9, Math.round(width * 0.22));
  const centerSize = Math.max(21, Math.round(width * 0.52));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cardLabel(card)} 카드`}
      onPress={onPress}
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

function CardBack({ width, onPress }: { width: number; onPress: () => void }) {
  const height = width * CARD_RATIO;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="카드 뒷면, 탭하여 공개"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardBack, { width, height }, pressed && styles.pressed]}
    >
      <View style={styles.backInner}>
        <Text style={styles.backMark}>✦</Text>
      </View>
    </Pressable>
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
  const { boardWidth, cardWidth, compact, stackOffset, tableauGap, uiScale } = getGameLayout(screenWidth, screenHeight);
  const [game, setGame] = useState(createNewGame);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [hydrated, setHydrated] = useState(false);
  const newGameStarted = useRef(false);

  useEffect(() => {
    let mounted = true;
    const loadLocalGame = async () => {
      try {
        const [activeGameValue, recordsValue] = await AsyncStorage.multiGet([ACTIVE_GAME_KEY, RECORDS_KEY]);
        if (!mounted) return;
        if (activeGameValue[1] && !newGameStarted.current) {
          const saved = JSON.parse(activeGameValue[1]) as { game?: typeof game; elapsedSeconds?: number };
          if (saved.game?.tableau?.length === 7) setGame(saved.game);
          if (typeof saved.elapsedSeconds === "number") setElapsedSeconds(saved.elapsedSeconds);
        }
        if (recordsValue[1]) setRecords({ ...emptyRecords, ...(JSON.parse(recordsValue[1]) as Records) });
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
  }, [elapsedSeconds, game, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records)).catch(() => undefined);
  }, [hydrated, records]);

  useEffect(() => {
    if (paused || !hydrated || isWon(game)) return;
    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [game, hydrated, paused]);

  const startNewGame = () => {
    newGameStarted.current = true;
    haptic.light();
    setGame(() => createNewGame());
    setSelection(null);
    setElapsedSeconds(0);
    setPaused(false);
    setSheet(null);
    AsyncStorage.removeItem(ACTIVE_GAME_KEY).catch(() => undefined);
  };

  const saveWin = (finishedGame: typeof game) => {
    setRecords((current) => ({
      wins: current.wins + 1,
      bestScore: Math.max(current.bestScore, finishedGame.score),
      bestTimeSeconds: current.bestTimeSeconds === null ? elapsedSeconds : Math.min(current.bestTimeSeconds, elapsedSeconds),
    }));
  };

  const applyGame = (nextGame: typeof game | null, success = false) => {
    if (!nextGame || nextGame === game) {
      haptic.error();
      return;
    }
    setGame(nextGame);
    setSelection(null);
    if (success) {
      haptic.success();
    } else {
      haptic.light();
    }
    if (isWon(nextGame)) {
      saveWin(nextGame);
      setTimeout(() => Alert.alert("축하합니다", `솔리테어를 ${nextGame.moves}번의 이동으로 완성했어요.`, [{ text: "새 게임", onPress: startNewGame }]), 180);
    }
  };

  const selectCard = (nextSelection: Selection) => {
    haptic.light();
    setSelection((current) => (current?.cardId === nextSelection.cardId ? null : nextSelection));
  };

  const moveSelectionToTableau = (toColumn: number) => {
    if (!selection) return;
    if (selection.kind === "tableau") {
      applyGame(moveTableauToTableau(game, selection.column, selection.index, toColumn));
    } else if (selection.kind === "waste") {
      applyGame(moveWasteToTableau(game, toColumn));
    } else {
      applyGame(moveFoundationToTableau(game, selection.suit, toColumn));
    }
  };

  const onTableauPress = (column: number, index: number, card: Card) => {
    const pile = game.tableau[column];
    if (!card.faceUp) {
      applyGame(index === pile.length - 1 ? flipTableauCard(game, column) : null);
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

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>OUR STYLE</Text>
            <Text style={[styles.title, { fontSize: Math.round(27 * uiScale), lineHeight: Math.round(31 * uiScale) }]}>Solitaire</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="자동 완성" onPress={runAutoComplete} style={({ pressed }) => [styles.autoButton, pressed && styles.pressed]}>
              <Text style={styles.autoButtonText}>AUTO</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="새 게임" onPress={startNewGame} style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}>
              <Text style={styles.newButtonText}>＋</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
              <Text style={styles.menuButtonText}>···</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stats}>
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.score}</Text><Text style={styles.statLabel}>점수</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{game.moves}</Text><Text style={styles.statLabel}>이동</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale) }]}>{formatDuration(elapsedSeconds)}</Text><Text style={styles.statLabel}>시간</Text></View>
          {!compact ? <View style={styles.statusWrap}>
              <View style={[styles.statusDot, selection ? styles.statusDotSelected : styles.statusDotReady]} />
              <Text style={styles.statusText}>{hydrated ? (selection ? "이동할 곳을 탭하세요" : "카드를 선택하세요") : "게임 준비 중"}</Text>
            </View> : null}
        </View>

        <View style={[styles.board, { width: boardWidth }]}>
        <View style={styles.topPiles}>
          <View style={styles.stockWasteGroup}>
            {game.stock.length ? (
              <CardBack width={cardWidth} onPress={() => applyGame(drawFromStock(game))} />
            ) : (
              <EmptySlot width={cardWidth} label={game.waste.length ? "↻" : ""} onPress={() => applyGame(drawFromStock(game))} />
            )}
            {game.waste.at(-1) ? (
              <CardFace card={game.waste.at(-1)!} width={cardWidth} selected={selection?.kind === "waste"} onPress={onWastePress} />
            ) : (
              <EmptySlot width={cardWidth} label="" />
            )}
          </View>
          <View style={[styles.foundationGroup, { gap: Math.max(3, Math.round(cardWidth * 0.08)) }]}>
            {SUITS.map((suit) => {
              const card = game.foundations[suit].at(-1);
              return card ? (
                <CardFace key={suit} card={card} width={cardWidth} selected={selection?.kind === "foundation" && selection.suit === suit} onPress={() => onFoundationPress(suit)} />
              ) : (
                <EmptySlot key={suit} width={cardWidth} label={suitSymbols[suit]} onPress={() => onFoundationPress(suit)} />
              );
            })}
          </View>
        </View>

        <View style={[styles.tableau, { gap: tableauGap }]}>
          {game.tableau.map((pile, column) => (
            <View key={`column-${column}`} style={[styles.tableauColumn, { width: cardWidth, minHeight: cardWidth * CARD_RATIO }]}>
              {pile.length === 0 ? <EmptySlot width={cardWidth} label="K" onPress={() => moveSelectionToTableau(column)} /> : null}
              {pile.map((card, index) => (
                <View key={card.id} style={{ position: "absolute", top: index * stackOffset, left: 0, zIndex: index }}>
                  {card.faceUp ? (
                    <CardFace card={card} width={cardWidth} selected={selection?.cardId === card.id} onPress={() => onTableauPress(column, index, card)} />
                  ) : (
                    <CardBack width={cardWidth} onPress={() => onTableauPress(column, index, card)} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
        </View>

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
                  <Pressable onPress={() => Alert.alert("새 게임을 시작할까요?", "진행 중인 게임은 자동 저장되지만 새 게임으로 전환됩니다.", [{ text: "취소", style: "cancel" }, { text: "새 게임", style: "destructive", onPress: startNewGame }])} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>새 게임 시작</Text></Pressable>
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
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11182C", paddingHorizontal: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 12 },
  eyebrow: { color: "#77D6C3", fontSize: 10, fontWeight: "800", letterSpacing: 2.2 },
  title: { color: "#FFFDF8", fontSize: 27, lineHeight: 31, fontWeight: "800", letterSpacing: -0.7 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  autoButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 17, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  autoButtonText: { color: "#77D6C3", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  newButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#FF7A66" },
  newButtonText: { color: "#11182C", fontSize: 22, lineHeight: 24, fontWeight: "600" },
  menuButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958" },
  menuButtonText: { color: "#FFFDF8", fontSize: 19, lineHeight: 16, fontWeight: "900", marginTop: -8 },
  stats: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#2E4163", paddingVertical: 8, marginBottom: 14 },
  statValue: { color: "#FFFDF8", fontSize: 15, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  statLabel: { color: "#A6B4CE", fontSize: 9, fontWeight: "700", marginTop: 1, textAlign: "center" },
  statDivider: { width: 1, height: 22, marginHorizontal: 10, backgroundColor: "#2E4163" },
  statusWrap: { flex: 1, marginLeft: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotReady: { backgroundColor: "#77D6C3" },
  statusDotSelected: { backgroundColor: "#FF7A66" },
  statusText: { color: "#A6B4CE", fontSize: 10, fontWeight: "600" },
  board: { alignSelf: "center" },
  topPiles: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
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
  tableauColumn: { position: "relative" },
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
});
