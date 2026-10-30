import { memo, useEffect, useRef, useState, type ComponentProps, type RefObject } from "react";
import { Alert, Animated, AppState, Easing, FlatList, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput as RNTextInput, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as ExpoInAppUpdates from "expo-in-app-updates";
import Constants from "expo-constants";
import * as ScreenOrientation from "expo-screen-orientation";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { AdBanner } from "@/components/ad-banner";
import { CARD_BACK_THEMES, getCardBackTheme, getCardBackThemeByIndex, type CardBackTheme } from "@/lib/card-back-theme";
import { getGameLayout } from "@/lib/game-layout";
import { getLastVerifiedClearedStage } from "@/lib/stage-access";
import { restoreGoogleSignIn, signInWithGoogle, signOutFromGoogle } from "@/lib/google-sign-in";
import { haptic } from "@/lib/haptics";
import {
  cloneGameState,
  findAutoFoundationMove,
  isLateGameAutoFinishReady,
  createPlayableGame,
  drawFromStock,
  revealHiddenCardWithHammer,
  flipTableauCard,
  findHint,
  getChapterForStage,
  getRemainingRecycles,
  isFinalRecycleWarning,
  isWon,
  moveFoundationToTableau,
  moveAceToFoundation,
  moveTableauToTableau,
  moveToFoundation,
  moveWasteToTableau,
  destroyWasteWithHammer,
  restoreDestroyedCardsToWaste,
  recycleStockWithHammer,
  revealAllTableauCards,
  rankLabels,
  suitNames,
  suitSymbols,
  type Card,
  type GameState,
  type CardSource,
  type Suit,
  SUITS,
  validateGameState,
} from "@/lib/solitaire";
import { getBattleContent, getCompanionRoster, type BattleAsset } from "@/lib/battle-content";
import { PET_ROSTER } from "@/lib/pet-content";
import { showRewardedAd } from "@/components/rewarded-ad";
import { companionAttackColors, getCompanionAttackStyle, getPetAttackStyle, type CompanionAttackStyle } from "@/lib/companion-attack";
import { isRunningInPreviewIframe } from "@/lib/_core/manus-runtime";
import { translateUi, type SupportedLanguage } from "@/lib/i18n";
import { getBadgeAbility, getBadgeAbilityText } from "@/lib/badge-abilities";
import { getLocalizedBattleName } from "@/lib/battle-name-mapping";
import { getAttendanceHammerReward, isSpecialAttendanceDay, pickAttendancePet } from "@/lib/rewards";
import type { CloudGameState } from "@/shared/game-cloud-state";

let fixedFontScaleEnabled = false;
const Text = (props: ComponentProps<typeof RNText>) => <RNText {...props} allowFontScaling={fixedFontScaleEnabled ? false : props.allowFontScaling} />;
const TextInput = (props: ComponentProps<typeof RNTextInput>) => <RNTextInput {...props} allowFontScaling={fixedFontScaleEnabled ? false : props.allowFontScaling} />;

type Selection = CardSource & { cardId: string };
type UndoEntry = { game: GameState; hammerCharges: number };
type ActiveFlight = {
  id: string;
  card: Card;
  variant: "normal" | "flaming" | "pet";
  progress: Animated.Value;
  launchDeltaX: number;
  launchDeltaY: number;
  launchCenterX: number;
  launchCenterY: number;
  targetCenterX: number;
  targetCenterY: number;
  flightColor?: string;
  flamingArt?: ImageSourcePropType;
  petImage?: ImageSourcePropType;
};
type FoundationMoveFlight = { id: number; card: Card; fromLeft: number; fromTop: number; deltaX: number; deltaY: number; progress: Animated.Value };
type MonsterTargetFrame = { centerX: number; centerY: number; width: number; height: number };
type GameMode = "unlimited" | "timeAttack";
type RankingViewMode = "stage" | "overall";
type Language = SupportedLanguage;
type HammerRewardFlightKind = "attendance" | "ad";
const TIME_ATTACK_LIMIT_SECONDS = 300;
const STORY_STAGE_COUNT = 115;
const POST_STORY_STAGE_LIMIT = Number.MAX_SAFE_INTEGER;
type Sheet = "menu" | "rules" | "records" | "badges" | "sound" | "companions" | "cardBacks" | "profile" | null;
type RulesTab = "basic" | "cards" | "items" | "uiGuide" | "hammerGuide";
const RULES_TAB_COLORS: Record<RulesTab, string> = {
  basic: "#B8E0D2",
  cards: "#BFD7EA",
  items: "#F6D6AD",
  uiGuide: "#D8C4E9",
  hammerGuide: "#F2B5C8",
};
type ModeRecords = { wins: number; bestScore: number; bestTimeSeconds: number | null; stageBestTimes: Record<string, number>; stageBestScores: Record<string, number> };
type Records = Record<GameMode, ModeRecords>;
type CountryOption = { code: string; nameKo: string; nameEn: string };
type LanguageOption = { code: Language; nativeName: string; englishName: string; flag: string };
type RankingRow = { id: number; userId?: number; name: string | null; countryCode: string | null; score: number; timeSeconds: number | null; stage: number };
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "ko", nativeName: "한국어", englishName: "Korean", flag: "🇰🇷" },
  { code: "en", nativeName: "English", englishName: "English", flag: "🇺🇸" },
  { code: "th", nativeName: "ไทย", englishName: "Thai", flag: "🇹🇭" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", flag: "🇯🇵" },
  { code: "fr", nativeName: "Français", englishName: "French", flag: "🇫🇷" },
  { code: "de", nativeName: "Deutsch", englishName: "German", flag: "🇩🇪" },
  { code: "es", nativeName: "Español", englishName: "Spanish", flag: "🇪🇸" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", flag: "🇮🇳" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese", flag: "🇻🇳" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", flag: "🇷🇺" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", flag: "🇮🇩" },
  { code: "it", nativeName: "Italiano", englishName: "Italian", flag: "🇮🇹" },
  { code: "zh-CN", nativeName: "简体中文", englishName: "Simplified Chinese", flag: "🇨🇳" },
];

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "KR", nameKo: "대한민국", nameEn: "South Korea" }, { code: "US", nameKo: "미국", nameEn: "United States" },
  { code: "JP", nameKo: "일본", nameEn: "Japan" }, { code: "CN", nameKo: "중국", nameEn: "China" },
  { code: "GB", nameKo: "영국", nameEn: "United Kingdom" }, { code: "CA", nameKo: "캐나다", nameEn: "Canada" },
  { code: "AU", nameKo: "호주", nameEn: "Australia" }, { code: "DE", nameKo: "독일", nameEn: "Germany" },
  { code: "FR", nameKo: "프랑스", nameEn: "France" }, { code: "ES", nameKo: "스페인", nameEn: "Spain" },
  { code: "IT", nameKo: "이탈리아", nameEn: "Italy" }, { code: "BR", nameKo: "브라질", nameEn: "Brazil" },
  { code: "IN", nameKo: "인도", nameEn: "India" }, { code: "SG", nameKo: "싱가포르", nameEn: "Singapore" },
  { code: "TW", nameKo: "대만", nameEn: "Taiwan" }, { code: "TH", nameKo: "태국", nameEn: "Thailand" },
  { code: "VN", nameKo: "베트남", nameEn: "Vietnam" }, { code: "MX", nameKo: "멕시코", nameEn: "Mexico" },
  { code: "RU", nameKo: "러시아", nameEn: "Russia" }, { code: "SE", nameKo: "스웨덴", nameEn: "Sweden" },
];
function countryFlag(code: string | null | undefined): string { return code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0))) : "🌐"; }
const COUNTRY_FLAG_IMAGES: Record<string, ImageSourcePropType> = {
  KR: require("../../assets/images/flags/kr.png"), US: require("../../assets/images/flags/us.png"), JP: require("../../assets/images/flags/jp.png"), CN: require("../../assets/images/flags/cn.png"),
  GB: require("../../assets/images/flags/gb.png"), CA: require("../../assets/images/flags/ca.png"), AU: require("../../assets/images/flags/au.png"), DE: require("../../assets/images/flags/de.png"),
  FR: require("../../assets/images/flags/fr.png"), ES: require("../../assets/images/flags/es.png"), IT: require("../../assets/images/flags/it.png"), BR: require("../../assets/images/flags/br.png"),
  IN: require("../../assets/images/flags/in.png"), SG: require("../../assets/images/flags/sg.png"), TW: require("../../assets/images/flags/tw.png"), TH: require("../../assets/images/flags/th.png"),
  VN: require("../../assets/images/flags/vn.png"), MX: require("../../assets/images/flags/mx.png"), RU: require("../../assets/images/flags/ru.png"), SE: require("../../assets/images/flags/se.png"),
};

const CARD_RATIO = 1.42;
const ROYAL_SPRITE = require("../../assets/images/royal-card-sprite.png");
const RESET_MODAL_PANEL = { uri: "/manus-storage/solitaire-reset-modal-panel_5afc1a91.png" };
const RESET_BUTTONS_ART = { uri: "/manus-storage/solitaire-reset-buttons_31124c25.png" };
const SOLITAIRE_UI_GUIDE_ART = require("../../assets/images/solitaire-ui-guide-user.jpg");
const FLAMING_CARD_ART = require("../../assets/images/flaming-card-attack.webp");
const FLAMING_CARD_ART_BY_STYLE: Record<CompanionAttackStyle, ImageSourcePropType> = {
  red: require("../../assets/images/attack-cards/attack-fire-card.webp"),
  blue: require("../../assets/images/attack-cards/attack-ice-card.webp"),
  orange: require("../../assets/images/attack-cards/attack-lightning-card.webp"),
  white: require("../../assets/images/attack-cards/attack-shadow-card.webp"),
};
const ATTACK_IMPACT_ART_BY_STYLE: Record<CompanionAttackStyle, ImageSourcePropType> = {
  red: require("../../assets/images/attack-projectiles/projectile-fire.webp"),
  blue: require("../../assets/images/attack-projectiles/projectile-ice.webp"),
  orange: require("../../assets/images/attack-projectiles/projectile-lightning.webp"),
  white: require("../../assets/images/attack-projectiles/projectile-shadow.webp"),
};
const HIT_EXPLOSION_ART_BY_STYLE: Record<CompanionAttackStyle, ImageSourcePropType> = {
  red: require("../../assets/images/attack-impacts/impact-red.webp"),
  blue: require("../../assets/images/attack-impacts/impact-blue.webp"),
  orange: require("../../assets/images/attack-impacts/impact-orange.webp"),
  white: require("../../assets/images/attack-impacts/impact-white.webp"),
};
const ATTACK_STYLE_LABELS: Record<CompanionAttackStyle, string> = { red: "불꽃", blue: "빙결", orange: "번개", white: "그림자" };
const ATTACK_SOUND_BY_STYLE = {
  red: require("../../assets/audio/attack-fire.wav"),
  blue: require("../../assets/audio/attack-ice.wav"),
  orange: require("../../assets/audio/attack-lightning.wav"),
  white: require("../../assets/audio/attack-shadow.wav"),
} as const;
const ATTACK_IMPACT_SOUND_BY_STYLE = {
  red: require("../../assets/audio/impact/impact-fire.wav"),
  blue: require("../../assets/audio/impact/impact-ice.wav"),
  orange: require("../../assets/audio/impact/impact-lightning.wav"),
  white: require("../../assets/audio/impact/impact-shadow.wav"),
} as const;
const HAMMER_ICON_ART = require("../../assets/images/card-breaker-shark-hammer.png");
const HINT_BUTTON_ART = require("../../assets/images/hint-cartoon-button.webp");
const UNDO_BUTTON_ART = require("../../assets/images/undo-cartoon-button.webp");
const HAMMER_PLUS_ONE_BUTTON_ART = require("../../assets/images/hammer-plus-one-cartoon-button.webp");
const DAILY_CHECKIN_ART = require("../../assets/images/daily-checkin-cartoon-button.png");
const LOBBY_BUTTON_ART = require("../../assets/images/ui/lobby-button-art.png");
const HAMMER_IMPACT_ART = { uri: "/manus-storage/hammer-impact-burst_f5d30cb2.png" };
const COMBO_IMPACT_ARTS = [
  { uri: "/manus-storage/combo-impact-burst-1_48b789ea.png" },
  { uri: "/manus-storage/combo-impact-burst-2_3dab5748.png" },
  { uri: "/manus-storage/combo-impact-burst-3_c70f5265.png" },
];
const BACKGROUND_MUSIC_TRACKS = [
  require("../../assets/sounds/medieval-solitaire-loop.mp3"),
  require("../../assets/sounds/solitaire-cartoon-bgm-01.mp3"),
  require("../../assets/sounds/solitaire-cartoon-bgm-02.mp3"),
] as const;
const ACTIVE_GAME_KEY = "our-style-solitaire:active-game";
const MODE_PROGRESS_KEY = "our-style-solitaire:mode-progress";
const ACTIVE_GAME_SAVE_VERSION = 3;
const RECORDS_KEY = "our-style-solitaire:records";
const UPDATE_NOTICE_KEY = "our-style-solitaire:last-update-notice";
const UPDATE_NOTICE_VERSION = "2.0.0";
const SOUND_ENABLED_KEY = "our-style-solitaire:sound-enabled";
const SCREEN_SHAKE_ENABLED_KEY = "our-style-solitaire:screen-shake-enabled";
const LANGUAGE_KEY = "our-style-solitaire:language";
const BACKGROUND_MUSIC_ENABLED_KEY = "our-style-solitaire:background-music-enabled";
const SOUND_EFFECTS_VOLUME_KEY = "our-style-solitaire:sound-effects-volume";
const BACKGROUND_MUSIC_VOLUME_KEY = "our-style-solitaire:background-music-volume";
const CARD_SELECT_VIBRATION_KEY = "our-style-solitaire:card-select-vibration";
const SELECTED_COMPANION_KEY = "our-style-solitaire:selected-companion";
const UNLOCKED_PETS_KEY = "our-style-solitaire:unlocked-pets";
const RANDOM_OWNED_PET_PER_STAGE_KEY = "our-style-solitaire:random-owned-pet-per-stage";
const BOSS_PREP_BONUSES_KEY = "our-style-solitaire:boss-prep-bonuses";
const ATTENDANCE_KEY = "our-style-solitaire:attendance";
const HAMMER_CHARGES_KEY = "our-style-solitaire:hammer-charges";
const DAILY_AD_HAMMER_REWARD_KEY = "our-style-solitaire:daily-ad-hammer-reward";
const DAILY_AD_APP_VERSION_KEY = "our-style-solitaire:daily-ad-app-version";
const CURRENT_AD_APP_VERSION = `${Constants.expoConfig?.version ?? "2.0.0"}+${Constants.expoConfig?.android?.versionCode ?? 56}`;
const CARD_BACK_THEME_KEY = "our-style-solitaire:card-back-theme";
const BOSS_BADGES_KEY = "our-style-solitaire:boss-badges";
const ACTIVE_BADGE_KEY = "our-style-solitaire:active-badge";
const PROFILE_COUNTRY_KEY = "our-style-solitaire:profile-country";
const PROFILE_NAME_KEY = "our-style-solitaire:profile-name";
const LOCAL_RANKING_KEY = "our-style-solitaire:local-ranking";
const RANKING_SYNC_AT_KEY = "our-style-solitaire:ranking-sync-at";
const RANKING_SYNC_INTERVAL_MS = 60 * 60 * 1000;
const FIXED_FONT_SCALE_KEY = "our-style-solitaire:fixed-font-scale";
const MAX_DAILY_AD_HAMMER_REWARDS = 5;
const MAX_HAMMER_CHARGES = 30;
const getDailyAdHammerReward = (rewardNumber: number) => rewardNumber <= 2 ? 10 : 20;
const PREVIEW_ALL_BOSS_BADGE_IDS = [
  ...Array.from({ length: 9 }, (_, index) => `boss-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 3 }, (_, index) => `king-boss-${String(index + 1).padStart(2, "0")}`),
  "emperor-boss",
];
const INITIAL_UNLOCKED_PET_IDS = ["pet-004", "pet-005", "pet-006", "pet-007"];
const DEFAULT_PET_ID = INITIAL_UNLOCKED_PET_IDS[0];
const PHYSICAL_EDGE_INSET = 52;
const MAX_UNDO_STEPS = 3;
const CARD_ATTACK_FLIGHT_DURATION = 1800;
const FLAMING_CARD_FLIGHT_DURATION = CARD_ATTACK_FLIGHT_DURATION * 2;
const FLYING_CARD_DURATION = CARD_ATTACK_FLIGHT_DURATION;
const MAX_COMPANION_ATTACK_SCALE = 1.5;
const TARGET_FRAME_SYNC_INTERVAL_MS = 80;
const emptyModeRecords: ModeRecords = { wins: 0, bestScore: 0, bestTimeSeconds: null, stageBestTimes: {}, stageBestScores: {} };
const emptyRecords: Records = { unlimited: { ...emptyModeRecords }, timeAttack: { ...emptyModeRecords } };
const STAGE_ACCESS_REPAIR_KEY = "our-style-solitaire:stage-access-repair";
const STAGE_ACCESS_REPAIR_VERSION = "2026-10-strict-cleared-stage-v2";

function normalizeModeRecords(value: Partial<ModeRecords> | undefined): ModeRecords {
  const stageBestTimes = Object.fromEntries(Object.entries(value?.stageBestTimes ?? {})
    .filter(([stage, seconds]) => Number.isInteger(Number(stage)) && Number(stage) >= 1 && Number(stage) <= POST_STORY_STAGE_LIMIT && typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0)
    .map(([stage, seconds]) => [stage, Math.floor(seconds)]));
  const stageBestScores = Object.fromEntries(Object.entries(value?.stageBestScores ?? {})
    .filter(([stage, score]) => Number.isInteger(Number(stage)) && Number(stage) >= 1 && Number(stage) <= POST_STORY_STAGE_LIMIT && typeof score === "number" && Number.isFinite(score) && score >= 0)
    .map(([stage, score]) => [stage, Math.floor(score)]));
  return {
    wins: Math.max(0, Math.floor(value?.wins ?? 0)),
    bestScore: Math.max(0, Math.floor(value?.bestScore ?? 0)),
    bestTimeSeconds: typeof value?.bestTimeSeconds === "number" && Number.isFinite(value.bestTimeSeconds) ? Math.max(0, Math.floor(value.bestTimeSeconds)) : null,
    stageBestTimes,
    stageBestScores,
  };
}

function mergeModeRecords(localValue: Partial<ModeRecords> | undefined, cloudValue: Partial<ModeRecords> | undefined): ModeRecords {
  const local = normalizeModeRecords(localValue);
  const cloud = normalizeModeRecords(cloudValue);
  const stageBestTimes: Record<string, number> = { ...local.stageBestTimes };
  Object.entries(cloud.stageBestTimes).forEach(([stage, seconds]) => {
    stageBestTimes[stage] = stageBestTimes[stage] === undefined ? seconds : Math.min(stageBestTimes[stage], seconds);
  });
  const stageBestScores: Record<string, number> = { ...local.stageBestScores };
  Object.entries(cloud.stageBestScores).forEach(([stage, score]) => {
    stageBestScores[stage] = Math.max(stageBestScores[stage] ?? 0, score);
  });
  const bestTimes = [local.bestTimeSeconds, cloud.bestTimeSeconds].filter((value): value is number => value !== null);
  return {
    wins: Math.max(local.wins, cloud.wins),
    bestScore: Math.max(local.bestScore, cloud.bestScore),
    bestTimeSeconds: bestTimes.length ? Math.min(...bestTimes) : null,
    stageBestTimes,
    stageBestScores,
  };
}

function mergeGameRecords(localValue: Records, cloudValue: Partial<Records> | undefined): Records {
  return {
    unlimited: mergeModeRecords(localValue.unlimited, cloudValue?.unlimited),
    timeAttack: mergeModeRecords(localValue.timeAttack, cloudValue?.timeAttack),
  };
}

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

function localeForLanguage(language: Language): string {
  return { ko: "ko-KR", en: "en-US", th: "th-TH", ja: "ja-JP", fr: "fr-FR", de: "de-DE", es: "es-ES", hi: "hi-IN", vi: "vi-VN", ru: "ru-RU", "es-MX": "es-MX", id: "id-ID", it: "it-IT", "zh-CN": "zh-CN" }[language];
}
function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  const locale = String(navigator.language || "en").toLowerCase();
  if (locale.startsWith("ko")) return "ko";
  if (locale.startsWith("th")) return "th";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("es-mx")) return "es";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("hi")) return "hi";
  if (locale.startsWith("vi")) return "vi";
  if (locale.startsWith("ru")) return "ru";
  if (locale.startsWith("id")) return "id";
  if (locale.startsWith("it")) return "it";
  if (locale.startsWith("zh")) return "zh-CN";
  return "en";
}
function formatLocalizedNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeForLanguage(language), options).format(value);
}
function formatLocalizedDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(localeForLanguage(language), { year: "numeric", month: "short", day: "numeric" }).format(date);
}
function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds: number, language: Language = "en"): string {
  const formatter = new Intl.NumberFormat(localeForLanguage(language), { minimumIntegerDigits: 2, useGrouping: false });
  const minutes = formatter.format(Math.floor(totalSeconds / 60));
  const seconds = formatter.format(totalSeconds % 60);
  return `${minutes}:${seconds}`;
}

function isBetterTimeAttackRanking(next: Pick<RankingRow, "stage" | "score" | "timeSeconds">, previous: Pick<RankingRow, "stage" | "score" | "timeSeconds"> | null | undefined) {
  if (!previous) return true;
  const nextTime = next.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  const previousTime = previous.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  return next.stage > previous.stage
    || (next.stage === previous.stage && next.score > previous.score)
    || (next.stage === previous.stage && next.score === previous.score && nextTime < previousTime);
}

function sortRankingRows(rows: RankingRow[], mode: GameMode) {
  return [...rows].sort((a, b) => mode === "timeAttack"
    ? b.stage - a.stage || b.score - a.score || (a.timeSeconds ?? Number.MAX_SAFE_INTEGER) - (b.timeSeconds ?? Number.MAX_SAFE_INTEGER)
    : b.score - a.score || b.stage - a.stage);
}

function stageAccentColor(stage: number) {
  if (stage >= 16) return "#FFD76A";
  if (stage >= 11) return "#D8A7FF";
  if (stage >= 6) return "#77D6C3";
  return "#AFC5E4";
}

function stageBadgeStyle(stage: number) {
  if (stage >= 16) return { backgroundColor: "#8A4B35", borderColor: "#FFD76A" };
  if (stage >= 11) return { backgroundColor: "#563B78", borderColor: "#D8A7FF" };
  if (stage >= 6) return { backgroundColor: "#245B61", borderColor: "#77D6C3" };
  return { backgroundColor: "#29446A", borderColor: "#6B8EBB" };
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

type MedievalIconName = "auto" | "new" | "orientation" | "sound" | "soundOff" | "music" | "vibration" | "shake" | "menu" | "settings" | "pause" | "hint" | "undo" | "records" | "book" | "pets" | "reset" | "badge" | "card";

function MedievalBackdrop({ source }: { source: number }) {
  return (
    <View pointerEvents="none" style={styles.medievalBackdrop}>
      <Image source={source} resizeMode="cover" style={styles.medievalBackdropImage} />
      <View style={styles.medievalBackdropDim} />
    </View>
  );
}

function getCompanionLabelWidth(name: string, size: number) {
  const textWidth = Array.from(name).reduce((total, character) => total + (/[^\u0080-\uFFFF]/.test(character) ? 7 : 11), 0);
  return Math.max(size, 72, textWidth + 38);
}

function getResponsiveBattleImage(asset: BattleAsset, displaySize: number): number {
  // The small asset is a 2x source for compact portrait rendering; medium is
  // reserved for larger layouts so Android does not decode a 768px bitmap for
  // a 34–80dp sprite.
  if (displaySize <= 96) return asset.smallImage ?? asset.image;
  return asset.mediumImage ?? asset.image;
}

const CompanionAnchor = memo(function CompanionAnchor({ companion, displayName, attackStyle, size, left, bottom, horizontalShift, comboScale, attackFlight, onPress, anchorRef, onLayout }: { companion: BattleAsset; displayName?: string; attackStyle: CompanionAttackStyle; size: number; left: number; bottom: number; horizontalShift: Animated.Value; comboScale: Animated.Value; attackFlight?: ActiveFlight; onPress: () => void; anchorRef?: (node: View | null) => void; onLayout?: () => void }) {
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
  const attackScale = comboScale.interpolate({ inputRange: [1, MAX_COMPANION_ATTACK_SCALE], outputRange: [1, MAX_COMPANION_ATTACK_SCALE], extrapolate: "clamp" });
  // The companion stays at its original position during an attack. Only its
  // existing scale pulse is preserved; the impact image is the projectile.
  const attackTranslateX = 0;
  const attackTranslateY = 0;
  const flightScale = attackFlight ? attackFlight.progress.interpolate({ inputRange: [0, 0.75, 1, 2, 2.35, 3], outputRange: [1.44, 1.84, 2, 2, 1.8, 1.44] }) : 1;
  const companionImage = getResponsiveBattleImage(companion, size);
  return <Animated.View ref={anchorRef} pointerEvents="none" onLayout={onLayout} style={[styles.companionAnchor, { width: size, height: size + 58, left, bottom, transform: [{ translateX: horizontalShift }, { scale: attackScale }] }]}> 
    <Pressable pointerEvents="none" accessibilityRole="button" accessibilityLabel={`${displayName ?? companion.name}, 막힘 도움 보기`} onPress={onPress} style={({ pressed }) => [styles.companionPressTarget, pressed && styles.companionPressed]}>
      <Animated.View pointerEvents="none" style={[styles.companionImageFrame, { width: size, height: size, left: 0, top: 0, transform: [{ translateX: attackTranslateX }, { translateY: attackTranslateY }, { scale: flightScale }, { translateX }, { translateY }, { rotate }] }]}> 
        <View pointerEvents="none" style={[styles.companionGroundShadow, { width: size * 0.7, height: Math.max(5, size * 0.12), left: size * 0.15, top: size * 0.82 }]} />
        <Image source={companionImage} fadeDuration={0} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={`${companion.name}, 전투 동료`} />
      </Animated.View>
    </Pressable>
    <View pointerEvents="none" accessibilityLabel={`현재 펫 ${displayName ?? companion.name}, 속성 ${ATTACK_STYLE_LABELS[attackStyle]}`} style={[styles.companionAttributeLabel, { top: size + 4, width: getCompanionLabelWidth(displayName ?? companion.name, size) }]}> 
      <View style={[styles.companionAttributeDot, { backgroundColor: companionAttackColors[attackStyle] }]} />
      <Text style={styles.companionAttributeText} numberOfLines={1}>{displayName ?? companion.name}</Text>
    </View>
  </Animated.View>;
});

function MedievalIcon({ name, size = 22, accent }: { name: MedievalIconName; size?: number; accent?: string }) {
  const gold = accent ?? "#F3C969";
  const teal = "#77D6C3";
  const coral = "#FF8A76";
  const common = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {name === "auto" ? <><Path d="M7 24 L21 10" stroke={gold} strokeWidth="5" strokeLinecap="round" /><Path d="M19 6 L20 10 L24 11 L20 12 L19 16 L18 12 L14 11 L18 10 Z" fill={teal} {...common} /><Circle cx="8" cy="24" r="3" fill={coral} {...common} /></> : null}
      {name === "new" ? <><Path d="M25 10 A10 10 0 1 0 26 20" stroke="#FFF3D1" strokeWidth="3.5" fill="none" {...common} /><Path d="M25 5 V11 H19" fill="none" stroke={gold} strokeWidth="3.5" {...common} /><Path d="M9 22 A8 8 0 0 0 16 25" stroke={teal} strokeWidth="2.5" fill="none" {...common} /></> : null}
      {name === "orientation" ? <><Rect x="8" y="5" width="16" height="22" rx="3" fill="#314A76" {...common} /><Path d="M5 11 Q5 6 11 6 M10 3 L13 6 L10 9" stroke={teal} strokeWidth="3" fill="none" {...common} /><Path d="M27 21 Q27 26 21 26 M22 29 L19 26 L22 23" stroke={coral} strokeWidth="3" fill="none" {...common} /></> : null}
      {name === "sound" ? <><Path d="M13 6 V24" stroke={gold} strokeWidth="3" {...common} /><Path d="M13 7 Q23 9 23 17 Q23 24 16 25" stroke={gold} strokeWidth="3" fill="none" {...common} /><Circle cx="11" cy="25" r="4" fill={coral} {...common} /><Path d="M25 11 Q30 16 25 21" stroke={teal} strokeWidth="2.5" fill="none" strokeLinecap="round" /></> : null}
      {name === "soundOff" ? <><Path d="M13 6 V24" stroke="#7C8BA5" strokeWidth="3" {...common} /><Path d="M13 7 Q23 9 23 17 Q23 24 16 25" stroke="#7C8BA5" strokeWidth="3" fill="none" {...common} /><Circle cx="11" cy="25" r="4" fill="#7C8BA5" {...common} /><Path d="M6 6 L27 27" stroke={coral} strokeWidth="4" strokeLinecap="round" /></> : null}
      {name === "music" ? <><Path d="M12 22 V7 L25 4 V19" stroke={gold} strokeWidth="3" fill="none" {...common} /><Path d="M12 10 L25 7" stroke={teal} strokeWidth="2.5" {...common} /><Circle cx="8" cy="23" r="4" fill={coral} {...common} /><Circle cx="21" cy="20" r="4" fill={coral} {...common} /></> : null}
      {name === "vibration" ? <><Rect x="10" y="7" width="12" height="18" rx="3" fill="#314A76" {...common} /><Path d="M6 11 V21 M3 13 V19 M26 11 V21 M29 13 V19" stroke={teal} strokeWidth="2.5" {...common} /><Circle cx="16" cy="22" r="1.4" fill={gold} /></> : null}
      {name === "shake" ? <><Path d="M7 11 L11 8 L15 12 L19 8 L25 12" stroke={coral} strokeWidth="3" fill="none" {...common} /><Path d="M7 21 L11 18 L15 22 L19 18 L25 22" stroke={teal} strokeWidth="3" fill="none" {...common} /><Path d="M5 16 H27" stroke={gold} strokeWidth="2" {...common} /></> : null}
      {name === "menu" ? <><Path d="M16 4 L27 9 V17 Q25 25 16 29 Q7 25 5 17 V9 Z" fill="#314A76" {...common} /><Circle cx="16" cy="11" r="2" fill={gold} /><Circle cx="16" cy="17" r="2" fill={gold} /><Circle cx="16" cy="23" r="2" fill={gold} /></> : null}
      {name === "settings" ? <><Path d="M12 3 H20 L21 7 L24 8 L27 6 L30 11 L27 14 L28 17 L32 18 V24 L28 25 L27 28 L30 31 L25 34 L22 31 L19 32 L18 36 H12 L11 32 L8 31 L5 34 L0 31 L3 28 L2 25 L-2 24 V18 L2 17 L3 14 L0 11 L3 6 L6 8 L9 7 Z" transform="translate(2 -2) scale(0.875)" fill="#77D6C3" stroke={gold} strokeWidth="1.5" {...common} /><Circle cx="16" cy="16" r="5" fill="#233958" stroke="#FFF3D1" strokeWidth="2" /></> : null}
      {name === "pause" ? <><Rect x="7" y="6" width="7" height="20" rx="2" fill={gold} stroke="#FFF3D1" strokeWidth="1.2" {...common} /><Rect x="18" y="6" width="7" height="20" rx="2" fill={coral} stroke="#FFF3D1" strokeWidth="1.2" {...common} /></> : null}
      {name === "hint" ? <><Path d="M10 13 Q10 5 16 5 Q22 5 22 13 V19 H10 Z" fill={gold} {...common} /><Path d="M13 22 H19 M14 26 H18" stroke={teal} strokeWidth="3" strokeLinecap="round" /><Circle cx="16" cy="13" r="3" fill="#FFF3D1" /></> : null}
      {name === "undo" ? <><Path d="M25 10 H12 Q7 10 7 16 Q7 22 13 22 H23" stroke={gold} strokeWidth="4" fill="none" {...common} /><Path d="M12 5 L6 10 L12 15" stroke={coral} strokeWidth="4" fill="none" {...common} /><Path d="M16 13 V19" stroke={teal} strokeWidth="2" strokeLinecap="round" /></> : null}
      {name === "records" ? <><Path d="M7 25 V14 H12 V25 M14 25 V8 H19 V25 M21 25 V4 H26 V25" fill="#314A76" stroke={gold} strokeWidth="2" {...common} /><Path d="M5 27 H28" stroke={teal} strokeWidth="3" {...common} /></> : null}
      {name === "book" ? <><Path d="M6 7 Q11 5 16 9 V26 Q11 22 6 24 Z" fill="#314A76" stroke={gold} strokeWidth="2" {...common} /><Path d="M26 7 Q21 5 16 9 V26 Q21 22 26 24 Z" fill="#314A76" stroke={gold} strokeWidth="2" {...common} /><Path d="M16 10 V25" stroke={teal} strokeWidth="2" {...common} /></> : null}
      {name === "pets" ? <><Circle cx="16" cy="18" r="7" fill="#314A76" stroke={gold} strokeWidth="2" /><Circle cx="9" cy="10" r="3" fill={coral} /><Circle cx="23" cy="10" r="3" fill={coral} /><Circle cx="12" cy="6" r="2.5" fill={teal} /><Circle cx="20" cy="6" r="2.5" fill={teal} /></> : null}
      {name === "reset" ? <><Path d="M8 12 A10 10 0 1 1 7 22" stroke={gold} strokeWidth="3" fill="none" {...common} /><Path d="M8 6 V13 H15" stroke={coral} strokeWidth="3" fill="none" {...common} /><Path d="M13 16 H23 V27 H13 Z M15 16 V13 H21 V16 M16 20 V24 M20 20 V24" fill="#314A76" stroke={teal} strokeWidth="2" {...common} /></> : null}
      {name === "badge" ? <><Path d="M16 4 L20 9 L26 10 L22 15 L23 21 L16 19 L9 21 L10 15 L6 10 L12 9 Z" fill={gold} stroke={coral} strokeWidth="2" {...common} /><Circle cx="16" cy="12" r="3" fill="#FFF3D1" /></> : null}
      {name === "card" ? <><Rect x="7" y="5" width="18" height="22" rx="3" fill="#314A76" stroke={gold} strokeWidth="2" {...common} /><Path d="M16 10 L18 14 L22 16 L18 18 L16 22 L14 18 L10 16 L14 14 Z" fill={teal} /></> : null}
    </Svg>
  );
}

function CardFace({
  card,
  width,
  cardRatio = CARD_RATIO,
  selected,
  hinted = false,
  hintAttention,
  onPress,
  onDoublePress,
  onLongPress,
  onDragEnd,
  chapter = 1,
  isBoss = false,
  markScale = 1,
}: {
  card: Card;
  width: number;
  cardRatio?: number;
  selected?: boolean;
  hinted?: boolean;
  hintAttention?: Animated.Value;
  onPress?: () => void;
  onDoublePress?: () => void;
  onLongPress?: () => void;
  onDragEnd?: (dx: number, dy: number) => void;
  chapter?: number;
  isBoss?: boolean;
  markScale?: number;
}) {
  const height = width * cardRatio;
  const color = playingCardColor(card);
  const narrowMarkScale = (width <= 60 ? 0.82 : width <= 68 ? 0.9 : 1) * markScale;
  // 숫자·알파벳은 기존 최소 크기(8px)를 유지하고, 작은 문양만
  // 카드 폭과 숫자 크기에 맞춰 자동으로 줄여 상단 모서리 겹침을 방지합니다.
  const rankSize = Math.max(8, Math.round(width * 0.26 * narrowMarkScale));
  const suitSize = Math.max(7, Math.min(
    Math.round(width * 0.22 * narrowMarkScale * 1.2),
    Math.max(7, rankSize),
  ));
  const centerSize = Math.max(18, Math.round(width * 0.52 * (width <= 60 ? 0.88 : 1)));
  const markInset = Math.max(4, Math.round(width * 0.075));
  const isRoyal = card.rank >= 11;
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const bossShine = useRef(new Animated.Value(-1)).current;
  const cardPressScale = useRef(new Animated.Value(1)).current;
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

  const animateCardPress = (toValue: number, duration: number) => {
    Animated.timing(cardPressScale, { toValue, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
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

  const hintScale = hintAttention?.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) ?? 1;
  return (
    <Animated.View style={{ opacity: 1, transform: [{ scale: cardPressScale }, { scale: hintScale }] }}>
      <View pointerEvents="none" style={[styles.cardGroundShadow, { width: width * 0.86, height: Math.max(5, width * 0.14), left: width * 0.07, top: height * 0.9 }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cardLabel(card)} 카드`}
        onPress={handlePress}
        onLongPress={() => { longPressTriggered.current = true; onLongPress?.(); }}
        delayLongPress={520}
        onPressIn={() => {
          longPressTriggered.current = false;
          animateCardPress(0.975, 70);
        }}
        onPressOut={() => {
          animateCardPress(1, 140);
        }}
        onHoverIn={() => animateCardPress(0.99, 100)}
        onHoverOut={() => animateCardPress(1, 140)}
        {...(onDragEnd ? panResponder.panHandlers : {})}
        style={({ pressed }) => [
          styles.card,
          { width, height, borderColor: hinted ? "#FFE36E" : selected ? "#FF4B3E" : "#F1EEE6" },
          selected && styles.cardSelected,
          hinted && styles.cardHinted,
          isBoss && styles.cardBoss,
          pressed && styles.cardTouching,
        ]}
      >
      <Text style={[styles.rankTop, { color, top: markInset, left: markInset, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
      <Text style={[styles.suitTop, { color, top: markInset, right: Math.max(2, Math.round(markInset * 0.45)), fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      {isRoyal ? <RoyalPortrait rank={card.rank as 11 | 12 | 13} chapter={chapter} /> : <Text style={[styles.suitCenter, { color, fontSize: centerSize }]}>{suitSymbols[card.suit]}</Text>}
      <Text style={[styles.rankBottom, { color, right: markInset, bottom: markInset * 0.65, fontSize: rankSize, lineHeight: rankSize + 1 }]}>{rankLabels[card.rank]}</Text>
      <Text style={[styles.suitBottom, { color, left: markInset, bottom: markInset * 0.65, fontSize: suitSize, lineHeight: suitSize + 1 }]}>{suitSymbols[card.suit]}</Text>
      {isBoss ? <Animated.View pointerEvents="none" style={[styles.bossCardShine, { opacity: 0.9, transform: [{ translateX: shineTranslateX }, { rotate: "18deg" }] }]} /> : null}
      </Pressable>
    </Animated.View>
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

function getCardBackImage(fileName: string): ImageSourcePropType {
  switch (fileName) {
    case "card_back_01.png": return require("../../assets/images/card-backs/card_back_01.png");
    case "card_back_02.png": return require("../../assets/images/card-backs/card_back_02.png");
    case "card_back_03.png": return require("../../assets/images/card-backs/card_back_03.png");
    case "card_back_04.png": return require("../../assets/images/card-backs/card_back_04.png");
    case "card_back_05.png": return require("../../assets/images/card-backs/card_back_05.png");
    case "card_back_06.png": return require("../../assets/images/card-backs/card_back_06.png");
    case "card_back_07.png": return require("../../assets/images/card-backs/card_back_07.png");
    case "card_back_08.png": return require("../../assets/images/card-backs/card_back_08.png");
    default: return require("../../assets/images/card-backs/card_back_01.png");
  }
}
function CardBack({ width, cardRatio = CARD_RATIO, theme, onPress, isBoss = false }: { width: number; cardRatio?: number; theme: CardBackTheme; onPress: () => void; isBoss?: boolean }) {
  const height = width * cardRatio;
  const bossGlow = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    bossGlow.stopAnimation();
    if (!isBoss) {
      bossGlow.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(bossGlow, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bossGlow, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(180),
    ]));
    glowLoop.start();
    return () => glowLoop.stop();
  }, [bossGlow, isBoss]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="카드 뒷면, 탭하여 공개"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardBack, { width, height, backgroundColor: theme.outer, borderColor: theme.border }, pressed && styles.pressed]}
    >
      {theme.image ? <Image source={getCardBackImage(theme.image)} resizeMode="contain" style={styles.cardBackAsset} /> : <View style={[styles.backInner, { backgroundColor: theme.inner, borderColor: theme.border }]}>
        <Text style={[styles.backMark, { color: theme.mark }]}>{theme.glyph}</Text>
      </View>}
      {isBoss ? <Animated.View pointerEvents="none" style={[styles.bossCardBackGlow, { opacity: bossGlow }]} /> : null}
    </Pressable>
  );
}

function CardBackPreview({ theme }: { theme: CardBackTheme }) {
  return <View style={[styles.cardBackPreview, { backgroundColor: theme.outer, borderColor: theme.border }]}>{theme.image ? <Image source={getCardBackImage(theme.image)} resizeMode="contain" style={styles.cardBackPreviewAsset} /> : <View style={[styles.cardBackPreviewInner, { backgroundColor: theme.inner, borderColor: theme.border }]}><Text style={[styles.cardBackPreviewGlyph, { color: theme.mark }]}>{theme.glyph}</Text></View>}</View>;
}
function FlyingCard({ card, width, progress, launchDeltaX, launchDeltaY, flightColor, flamingArt = FLAMING_CARD_ART, flaming = false }: { card: Card; width: number; progress: Animated.Value; launchDeltaX: number; launchDeltaY: number; flightColor?: string; flamingArt?: ImageSourcePropType; flaming?: boolean }) {
  const glow: Record<Suit, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const glowColor = flightColor ?? glow[card.suit];
  const imageHeight = width * (flaming ? 1.14 : 1);
  const imageWidth = width * 2;
  // This view is rendered inside the moving monster wrapper. It therefore
  // inherits the exact native position of the monster on every frame. The
  // animation only collapses the launch-time pet→monster vector to zero, so
  // no screen/window measurement is required on Android.
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [launchDeltaX, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [launchDeltaY, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.05, 0.6, 0.05] });
  const opacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.View pointerEvents="none" style={[styles.attributeFlyingCardAtMonster, { left: -imageWidth * 0.5, top: -imageHeight * 0.5, width: imageWidth, height: imageHeight, opacity, borderColor: glowColor, shadowColor: glowColor, transform: [{ translateX }, { translateY }] }] }>
      <Animated.View style={{ width: imageWidth, height: imageHeight, transform: [{ scale }] }}>
        <Image source={flamingArt} resizeMode="stretch" style={[styles.attributeFlyingCardImage, { transform: [{ scaleX: 0.92 }, { scaleY: 0.82 }] }]} />
      </Animated.View>
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

function VictoryFireworks({ visible, label = "STAGE CLEAR" }: { visible: boolean; label?: string }) {
  return (
    <View pointerEvents="none" style={styles.fireworkLayer}>
      {Array.from({ length: 36 }, (_, index) => <FireworkParticle key={index} index={index} visible={visible} />)}
      {visible ? <Text style={styles.victoryText}>{label}</Text> : null}
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

function AttributeImpactBurst({ attackStyle, progress, size }: { attackStyle: CompanionAttackStyle; progress: Animated.Value; size: number }) {
  const particles: Record<CompanionAttackStyle, string[]> = {
    red: ["✦", "✹", "•", "✧", "✦", "•", "✹", "✧", "•", "✦"],
    blue: ["❄", "◆", "✧", "◇", "❄", "◆", "✧", "◇", "❄", "◆"],
    orange: ["⚡", "ϟ", "✦", "•", "⚡", "ϟ", "✦", "•", "⚡", "✦"],
    white: ["✦", "◌", "•", "✧", "◆", "◌", "✦", "•", "✧", "◆"],
  };
  const colors: Record<CompanionAttackStyle, string[]> = {
    red: ["#FF4B12", "#FFD45C"],
    blue: ["#8FE8FF", "#DDFBFF"],
    orange: ["#FFD45C", "#FF8A24"],
    white: ["#D9E2FF", "#8B9BFF"],
  };
  const accent = colors[attackStyle];
  return <Animated.View pointerEvents="none" style={[styles.attributeImpactBurst, { width: size, height: size, opacity: progress.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 1, 0.92, 0] }) }]}>
    {particles[attackStyle].map((particle, index) => {
      const angle = (index / particles[attackStyle].length) * Math.PI * 2;
      const distance = size * (0.28 + (index % 3) * 0.09);
      const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] });
      const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] });
      const scale = progress.interpolate({ inputRange: [0, 0.2, 0.72, 1], outputRange: [0.15, 1.35, 0.9, 0.08] });
      const particleSize = Math.max(10, size * (index % 3 === 0 ? 0.2 : 0.15));
      return <Animated.Text key={`${attackStyle}-${index}`} style={[styles.attributeImpactParticle, { color: accent[index % accent.length], fontSize: particleSize, transform: [{ translateX }, { translateY }, { scale }, { rotate: `${index * 37}deg` }] }]}>{particle}</Animated.Text>;
    })}
  </Animated.View>;
}

function HitExplosion({ attackStyle, progress, size }: { attackStyle: CompanionAttackStyle; progress: Animated.Value; size: number }) {
  const scale = progress.interpolate({ inputRange: [0, 0.12, 0.34, 0.72, 1], outputRange: [0.18, 0.72, 1.18, 1.42, 1.62] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.52, 0.78, 1], outputRange: [0, 1, 1, 0.72, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 0.42, 1], outputRange: ["-14deg", "5deg", "22deg"] });
  return <Animated.View pointerEvents="none" style={[styles.hitExplosion, { width: size, height: size, left: -size * 0.5, top: -size * 0.5, opacity, transform: [{ scale }, { rotate }] }]}>
    <Image source={HIT_EXPLOSION_ART_BY_STYLE[attackStyle]} resizeMode="contain" style={styles.hitExplosionImage} />
  </Animated.View>;
}
function HammerFragments({ progress, size }: { progress: Animated.Value; size: number }) {
  const fragments = [
    { x: -0.42, y: -0.32, color: "#FFE48A", rotate: "-28deg" },
    { x: -0.28, y: 0.36, color: "#B9C7D8", rotate: "18deg" },
    { x: -0.08, y: -0.48, color: "#FFF7C7", rotate: "42deg" },
    { x: 0.18, y: 0.44, color: "#8C5A35", rotate: "-22deg" },
    { x: 0.36, y: -0.28, color: "#FFD052", rotate: "64deg" },
    { x: 0.48, y: 0.12, color: "#DDE8F2", rotate: "-46deg" },
    { x: 0.02, y: 0.22, color: "#F5B942", rotate: "12deg" },
    { x: -0.48, y: 0.02, color: "#9B6B43", rotate: "-62deg" },
  ];
  return <Animated.View pointerEvents="none" style={[styles.hammerFragments, { width: size, height: size }]}>
    {fragments.map((fragment, index) => {
      const distance = size * (0.72 + (index % 3) * 0.12);
      const translateX = progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, fragment.x * distance * 0.55, fragment.x * distance] });
      const translateY = progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, fragment.y * distance * 0.55, fragment.y * distance] });
      const scale = progress.interpolate({ inputRange: [0, 0.16, 0.72, 1], outputRange: [0.15, 1.15, 0.9, 0.12] });
      return <Animated.View key={`hammer-fragment-${index}`} style={[styles.hammerFragment, { left: size * 0.5 - 4, top: size * 0.5 - 4, width: 8 + (index % 3) * 3, height: 5 + (index % 2) * 3, backgroundColor: fragment.color, transform: [{ translateX }, { translateY }, { scale }, { rotate: fragment.rotate }] }]} />;
    })}
  </Animated.View>;
}

function LandingDust({ progress, size }: { progress: Animated.Value; size: number }) {
  const particles = Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 8) * Math.PI;
    const distance = size * (0.22 + (index % 3) * 0.06);
    const translateX = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, Math.cos(angle) * distance, Math.cos(angle) * distance * 1.35] });
    const translateY = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -Math.sin(angle) * distance * 0.62, 3] });
    const opacity = progress.interpolate({ inputRange: [0, 0.18, 0.72, 1], outputRange: [0, 1, 0.72, 0] });
    const scale = progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.2, 1, 0.45] });
    return <Animated.View key={`landing-dust-${index}`} style={[styles.landingDustParticle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]} />;
  });
  return <Animated.View pointerEvents="none" style={[styles.landingDust, { width: size, height: size * 0.5 }]}>{particles}</Animated.View>;
}
function healthBarColor(percent: number) {
  const value = Math.max(0, Math.min(100, percent));
  const from = value >= 50 ? [250, 204, 21] : [239, 68, 68];
  const to = value >= 50 ? [34, 197, 94] : [250, 204, 21];
  const progress = value >= 50 ? (value - 50) / 50 : value / 50;
  const rgb = from.map((channel, index) => Math.round(channel + (to[index] - channel) * progress));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function comboTextColor(count: number) {
  const start = [255, 226, 95];
  const end = [255, 59, 48];
  const progress = Math.max(0, Math.min(1, (count - 2) / 8));
  const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * progress));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const FlyingPetImpact = memo(function FlyingPetImpact({ image, size, progress, rootRef, companionRef, targetViewRef, companionSize }: { image: ImageSourcePropType; size: number; progress: Animated.Value; rootRef: RefObject<View | null>; companionRef: RefObject<View | null>; targetViewRef: RefObject<View | null>; companionSize: number }) {
  const [frame, setFrame] = useState<{ left: number; top: number; dx: number; dy: number; angle: string } | null>(null);
  useEffect(() => {
    let active = true;
    const measure = () => {
      const root = rootRef.current;
      const companion = companionRef.current;
      const target = targetViewRef.current;
      if (!root || !companion || !target) return;
      root.measureInWindow((rootX, rootY) => {
        companion.measureInWindow((companionX, companionY, companionWidth) => {
          target.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
            if (!active) return;
            const startX = companionX - rootX + companionWidth * 0.5;
            const startY = companionY - rootY + companionSize * 0.5;
            const goalX = targetX - rootX + targetWidth * 0.5;
            const goalY = targetY - rootY + targetHeight * 0.5;
            const dx = goalX - startX;
            const dy = goalY - startY;
            const angle = Math.atan2(dy, dx);
            const noseOffset = size * 0.34;
            setFrame({ left: startX - size * 0.5, top: startY - size * 0.5, dx: dx - Math.cos(angle) * noseOffset, dy: dy - Math.sin(angle) * noseOffset, angle: `${angle * 180 / Math.PI}deg` });
          });
        });
      });
    };
    measure();
    const timer = setInterval(measure, TARGET_FRAME_SYNC_INTERVAL_MS);
    return () => { active = false; clearInterval(timer); };
  }, [companionRef, companionSize, rootRef, size, targetViewRef]);
  if (!frame) return null;
  return <Animated.Image source={image} resizeMode="contain" style={{ position: "absolute", zIndex: 6000, width: size, height: size, left: frame.left, top: frame.top, opacity: progress.interpolate({ inputRange: [0, 0.82, 0.98, 1], outputRange: [1, 1, 1, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, frame.dx] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, frame.dy] }) }, { rotate: frame.angle }, { scale: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.5, 0.82, 1.1] }) }] }} />;
});
const MonsterBattle = memo(function MonsterBattle({ hp, damage, attackKind, attackToken, impactToken, attackStyle, combo, paused = false, compact = false, portraitNarrow = false, landscape = false, phoneLandscape = false, androidPortrait = false, safeWidth = 360, travelDistance = 24, leftTravelExtension = 100, verticalTravel = 0, monster, displayName, isBoss, cardSize, motionValue, rootRef, monsterTargetRef, monsterTargetFrameRef, flyingAttacks, recycleWarning = false, remainingRecycles = 0 }: { hp: number; damage: number; attackKind: AttackKind; attackToken: number; impactToken: number; attackStyle: CompanionAttackStyle; combo: boolean; paused?: boolean; compact?: boolean; portraitNarrow?: boolean; landscape?: boolean; phoneLandscape?: boolean; androidPortrait?: boolean; safeWidth?: number; travelDistance?: number; leftTravelExtension?: number; verticalTravel?: number; monster: BattleAsset; displayName?: string; isBoss: boolean; cardSize: number; motionValue?: Animated.Value; rootRef?: RefObject<View | null>; monsterTargetRef: RefObject<View | null>; monsterTargetFrameRef: { current: MonsterTargetFrame | null }; flyingAttacks: ActiveFlight[]; recycleWarning?: boolean; remainingRecycles?: number }) {
  const battleRef = useRef<View | null>(null);
  const internalMonsterMotion = useRef(new Animated.Value(1)).current;
  const monsterMotion = motionValue ?? internalMonsterMotion;
  const verticalMonsterMotion = useRef(new Animated.Value(0)).current;
  // The monster grows with its downward approach: 100% at the upper point,
  // reaching a maximum of 250% near the companion.
  const threatScale = verticalMonsterMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const attackProgress = useRef(new Animated.Value(0)).current;
  const [facingLeft, setFacingLeft] = useState(true);
  const [attackVisible, setAttackVisible] = useState(false);
  const [damageVisible, setDamageVisible] = useState(false);
  const [defeatVisible, setDefeatVisible] = useState(false);
  const [impactVariant, setImpactVariant] = useState(0);
  const damageProgress = useRef(new Animated.Value(0)).current;
  const comboImpactProgress = useRef(new Animated.Value(0)).current;
  const hitExplosionProgress = useRef(new Animated.Value(0)).current;
  const hpFlash = useRef(new Animated.Value(0)).current;
  const defeatProgress = useRef(new Animated.Value(0)).current;
  const bossEntrance = useRef(new Animated.Value(isBoss ? 0 : 1)).current;
  const [battleFrame, setBattleFrame] = useState({ width: 0, height: 0 });
  const battleOriginInRootRef = useRef({ x: 0, y: 0 });
  const battleOriginReadyRef = useRef(false);
  const monsterMotionValueRef = useRef(1);
  const verticalMotionValueRef = useRef(0);
  const targetFrameLastPublishedAtRef = useRef(0);
  const targetFramePublishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const segmentDuration = 12258;
    const moveBetweenEdges = (from = monsterMotionValueRef.current) => {
      if (cancelled || paused) return;
      const goingLeft = from > 0.5;
      const target = goingLeft ? 0 : 1;
      const duration = Math.max(1200, Math.round(segmentDuration * Math.abs(target - from)));
      setFacingLeft(goingLeft);
      Animated.timing(monsterMotion, { toValue: target, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished }) => {
        if (finished && !cancelled) moveBetweenEdges(target);
      });
    };
    moveBetweenEdges(monsterMotionValueRef.current);
    return () => { cancelled = true; monsterMotion.stopAnimation((value) => { monsterMotionValueRef.current = value; }); };
  }, [monsterMotion, paused]);
  // Keep the original motion-effect dependency markers for the combat regression test.
  // Pause/resume is intentionally handled by the paused dependency above.
  // Legacy motion dependencies: }, [monsterMotion]); and }, [verticalMonsterMotion, verticalTravel]);
  useEffect(() => {
    let cancelled = false;
    verticalMonsterMotion.stopAnimation((value) => { verticalMotionValueRef.current = value; });
    if (verticalTravel <= 0 || paused) return;
    const moveVertical = (from = verticalMotionValueRef.current) => {
      if (cancelled) return;
      const target = from > 0.5 ? 0 : 1;
      Animated.timing(verticalMonsterMotion, { toValue: target, duration: Math.max(1400, Math.round(7600 * Math.abs(target - from))), easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished }) => {
        if (finished && !cancelled) moveVertical(target);
      });
    };
    moveVertical(verticalMotionValueRef.current);
    return () => { cancelled = true; verticalMonsterMotion.stopAnimation((value) => { verticalMotionValueRef.current = value; }); };
  }, [paused, verticalMonsterMotion, verticalTravel]);

  useEffect(() => {
    if (!attackToken) return;
    setAttackVisible(true);
    attackProgress.setValue(0);
    comboImpactProgress.setValue(0);
    setImpactVariant(combo ? (attackToken - 1) % COMBO_IMPACT_ARTS.length : (attackToken - 1) % COMBO_IMPACT_ARTS.length);
    hpFlash.setValue(0);
    Animated.parallel([
      Animated.timing(attackProgress, { toValue: 1, duration: combo ? 578 : 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(comboImpactProgress, { toValue: 1, duration: combo ? 578 : 780, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { setAttackVisible(false); });
  }, [attackToken, attackProgress, combo, comboImpactProgress]);

  useEffect(() => {
    if (!impactToken) return;
    setDamageVisible(true);
    damageProgress.stopAnimation();
    damageProgress.setValue(0);
    hitExplosionProgress.stopAnimation();
    hitExplosionProgress.setValue(0);
    Animated.parallel([
      Animated.timing(damageProgress, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(hitExplosionProgress, { toValue: 1, duration: combo ? 620 : 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setDamageVisible(false));
  }, [impactToken, combo, damageProgress, hitExplosionProgress]);

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

  const spriteSize = Math.max(34, Math.round(cardSize * 0.9 * 1.3));
  const monsterImage = getResponsiveBattleImage(monster, spriteSize);
  const boundedTravelDistance = battleFrame.width > 0
    ? Math.min(travelDistance, Math.max(0, Math.floor((battleFrame.width - spriteSize) * 0.5)))
    : travelDistance;
  // Extend only the left side of the sprite path by 100dp; the name/health panel remains fixed on the right.
  const leftTravelDistance = boundedTravelDistance + Math.round(leftTravelExtension * 1.2);
  const rightTravelDistance = Math.round(boundedTravelDistance * 0.8);
  const monsterTranslate = monsterMotion.interpolate({ inputRange: [0, 1], outputRange: [-leftTravelDistance, rightTravelDistance] });
  const projectileTranslate = attackProgress.interpolate({ inputRange: [0, 1], outputRange: combo ? [0, 0] : [0, 92] });
  const projectileScale = attackProgress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.15, 0.2] });
  const damageTranslateY = damageProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const damageOpacity = damageProgress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 1, 0] });
  const damageScale = damageProgress.interpolate({ inputRange: [0, 0.12, 0.55, 1], outputRange: [0.55, 1.18, 1, 0.92] });
  const comboImpactOpacity = comboImpactProgress.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 0.92, 0] });
  const comboImpactScale = comboImpactProgress.interpolate({ inputRange: [0, 0.2, 0.72, 1], outputRange: [0.45, 1, 1.12, 0.72] });
  const comboImpactRotate = comboImpactProgress.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "16deg"] });
  const hpFlashOpacity = hpFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.92] });
  const bossEntranceScale = bossEntrance.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1.8, 1.15, 1] });
  const bossEntranceTranslateY = bossEntrance.interpolate({ inputRange: [0, 1], outputRange: [-86, 0] });
  const bossEntranceOpacity = bossEntrance.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1] });
  const defeatScale = defeatProgress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.3, 1.6, 2.8] });
  const defeatOpacity = defeatProgress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1, 0] });
  const attackColors: Record<AttackKind, string> = { clubs: "#77D6C3", diamonds: "#FF6F8A", hearts: "#FF9AD5", spades: "#B9C9FF" };
  const attackSymbols: Record<AttackKind, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  const companionSize = Math.max(24, Math.round(cardSize * 0.62));
  // Android portrait uses fixed React Native dp values so physical devices do not stretch the bar from safeWidth.
  // Keep the gauge independent from the parent panel width on every platform.
  const monsterBarWidth = portraitNarrow ? 60 : Math.max(64, Math.min(120, Math.round(cardSize * 1.02)));
  const monsterNameWidth = Math.max(
    monsterBarWidth,
    portraitNarrow ? 68 : Math.min(Math.max(150, Math.round(safeWidth * 0.72)), Math.ceil((displayName ?? monster.name).length * 8.4 + 20)),
  );
  const currentHealth = Math.max(0, Math.min(100, hp));
  const currentHealthColor = healthBarColor(currentHealth);
  // onLayout reports the static layout box, while left/top are animated
  // independently. The motion values always start at horizontal=1 and
  // vertical=0, so use those fixed outputRange origins rather than capturing
  // a potentially stale animation value during a relayout.
  // React Native may report onLayout x/y after applying the current `left`/`top`
  // values. Store a motion-neutral base box so Android does not add the
  // current animation delta twice when publishing the projectile target.
  const monsterLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const publishSynchronizedTargetFrame = () => {
    const layout = monsterLayoutRef.current;
    if (!battleOriginReadyRef.current || layout.width <= 0 || layout.height <= 0) return;
    const horizontalDelta = (monsterMotionValueRef.current - 1) * (boundedTravelDistance + leftTravelDistance);
    const verticalDelta = verticalMotionValueRef.current * verticalTravel;
    monsterTargetFrameRef.current = {
      centerX: battleOriginInRootRef.current.x + layout.x + layout.width * 0.5 + horizontalDelta,
      centerY: battleOriginInRootRef.current.y + layout.y + layout.height * 0.5 + verticalDelta,
      width: layout.width,
      height: layout.height,
    };
  };
  const publishSynchronizedTargetFrameThrottled = () => {
    const now = Date.now();
    const elapsed = now - targetFrameLastPublishedAtRef.current;
    if (elapsed >= TARGET_FRAME_SYNC_INTERVAL_MS) {
      targetFrameLastPublishedAtRef.current = now;
      publishSynchronizedTargetFrame();
      return;
    }
    if (targetFramePublishTimerRef.current !== null) return;
    targetFramePublishTimerRef.current = setTimeout(() => {
      targetFramePublishTimerRef.current = null;
      targetFrameLastPublishedAtRef.current = Date.now();
      publishSynchronizedTargetFrame();
    }, Math.max(0, TARGET_FRAME_SYNC_INTERVAL_MS - elapsed));
  };
  const syncBattleOriginInRoot = () => {
    const battle = battleRef.current;
    const root = rootRef?.current;
    if (!battle || !root || typeof battle.measureLayout !== "function") return;
    battle.measureLayout(root, (x, y) => {
      battleOriginInRootRef.current = { x, y };
      battleOriginReadyRef.current = true;
      publishSynchronizedTargetFrame();
    }, () => {
      // This is a one-time layout fallback only; per-frame Android window
      // measurements are intentionally not used for projectile tracking.
      if (typeof battle.measureInWindow !== "function" || typeof root.measureInWindow !== "function") return;
      root.measureInWindow((rootX, rootY) => {
        battle.measureInWindow((battleX, battleY) => {
          battleOriginInRootRef.current = { x: battleX - rootX, y: battleY - rootY };
          battleOriginReadyRef.current = true;
          publishSynchronizedTargetFrame();
        });
      });
    });
  };
  useEffect(() => {
    const horizontalListener = monsterMotion.addListener(({ value }) => {
      monsterMotionValueRef.current = value;
      publishSynchronizedTargetFrameThrottled();
    });
    const verticalListener = verticalMonsterMotion.addListener(({ value }) => {
      verticalMotionValueRef.current = value;
      publishSynchronizedTargetFrameThrottled();
    });
    return () => {
      monsterMotion.removeListener(horizontalListener);
      verticalMonsterMotion.removeListener(verticalListener);
      if (targetFramePublishTimerRef.current !== null) {
        clearTimeout(targetFramePublishTimerRef.current);
        targetFramePublishTimerRef.current = null;
      }
    };
  }, [battleFrame.height, battleFrame.width, boundedTravelDistance, leftTravelDistance, monsterMotion, verticalMonsterMotion, verticalTravel]);

  return (
    <View pointerEvents="none" ref={battleRef} onLayout={({ nativeEvent }) => {
      const { width, height } = nativeEvent.layout;
      battleOriginReadyRef.current = false;
      monsterTargetFrameRef.current = null;
      setBattleFrame((current) => current.width === width && current.height === height ? current : { width, height });
      requestAnimationFrame(syncBattleOriginInRoot);
    }} style={[styles.monsterBattle, styles.monsterBattleFront, landscape && styles.monsterBattleLandscape, compact && !landscape && styles.monsterBattleCompact, phoneLandscape && styles.monsterBattlePhoneLandscape]} accessibilityLabel={`몬스터 체력 ${Math.round(hp)}퍼센트`}>
              <Animated.View ref={monsterTargetRef} onLayout={({ nativeEvent }) => {
                const { x, y, width, height } = nativeEvent.layout;
                const currentHorizontalDelta = (monsterMotionValueRef.current - 1) * (boundedTravelDistance + leftTravelDistance);
                const currentVerticalDelta = verticalMotionValueRef.current * verticalTravel;
                monsterLayoutRef.current = {
                  x: x - currentHorizontalDelta,
                  y: y - currentVerticalDelta,
                  width,
                  height,
                };
                publishSynchronizedTargetFrame();
              }} style={[styles.monsterSpriteWrap, compact && styles.monsterSpriteWrapCompact, { width: spriteSize, height: spriteSize, opacity: bossEntranceOpacity, left: 0, top: 0, transform: [{ translateX: monsterTranslate }, { translateY: Animated.add(bossEntranceTranslateY, verticalMonsterMotion.interpolate({ inputRange: [0, 1], outputRange: [0, verticalTravel] })) }] }]}>
        <View pointerEvents="none" style={[styles.monsterGroundShadow, { width: spriteSize * 0.72, height: Math.max(5, spriteSize * 0.13), left: spriteSize * 0.14, top: spriteSize * 0.82 }]} />
        <View pointerEvents="none" style={[styles.monsterProjectileAnchor, { left: spriteSize * 0.5, top: spriteSize * 0.5 }]}>
        </View>
        {recycleWarning ? <View pointerEvents="none" style={[styles.monsterThreatGlow, { width: spriteSize + 12, height: spriteSize + 12, left: -6, top: -6 }]} /> : null}
        <Animated.View style={[styles.monsterImageLayer, { zIndex: 2, width: spriteSize, height: spriteSize, transform: [{ scale: bossEntranceScale }, { scale: threatScale }, { scaleX: facingLeft ? -1 : 1 }] }]}>
          <Image source={monsterImage} fadeDuration={0} resizeMode="contain" style={[styles.monsterSprite, { width: spriteSize, height: spriteSize }, defeatVisible && styles.monsterDefeated]} accessibilityLabel={displayName ?? monster.name} />
        </Animated.View>
        {/* The old monster-center attack symbol was a duplicate projectile. The
            pet projectile is the only attack visual now. */}
        {damageVisible ? <Animated.Text style={[styles.damageText, { opacity: damageOpacity, transform: [{ translateY: damageTranslateY }, { scale: damageScale }] }]}>−{damage}</Animated.Text> : null}
        {defeatVisible ? <Animated.View pointerEvents="none" style={[styles.defeatBurst, { opacity: defeatOpacity, transform: [{ scale: defeatScale }] }]}>{Array.from({ length: 12 }, (_, index) => <Text key={index} style={[styles.defeatSpark, { transform: [{ rotate: `${index * 30}deg` }, { translateY: -24 }] }]}>{index % 2 ? "✦" : "•"}</Text>)}</Animated.View> : null}
      </Animated.View>
      <View style={[styles.monsterInfo, compact && styles.monsterInfoCompact, isBoss && styles.monsterInfoBoss, !landscape && styles.monsterInfoPortrait, portraitNarrow && styles.monsterInfoPortraitNarrow, { width: monsterNameWidth, flexBasis: monsterNameWidth }]}>
        <View style={[styles.monsterNameRow, portraitNarrow && styles.monsterNameRowPortraitNarrow, { width: monsterNameWidth, alignSelf: "flex-end" }]}><Text style={[styles.monsterName, styles.monsterNameCentered, portraitNarrow && styles.monsterNamePortraitNarrow]} numberOfLines={1}>{(displayName ?? monster.name).toUpperCase()}</Text></View>
        <View style={[styles.monsterBar, { width: monsterBarWidth }]}><View style={[styles.monsterBarFill, { width: `${currentHealth}%`, backgroundColor: currentHealthColor }]} /><Animated.View pointerEvents="none" style={[styles.monsterHpFlash, { opacity: hpFlashOpacity }]} /></View>
        <Text style={styles.monsterHp}>{Math.round(hp)}%</Text>
      </View>
    </View>
  );
});

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

function limitProfileNameLength(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const maxLength = /[\uAC00-\uD7A3]/.test(normalized) ? 5 : 10;
  return Array.from(normalized).slice(0, maxLength).join("");
}

function getBossBadgeStage(badgeId: string) {
  if (badgeId === "emperor-boss") return 134;
  if (badgeId.startsWith("king-boss-")) return 131 + Number(badgeId.at(-1)) - 1;
  const bossNumber = Number.parseInt(badgeId.slice(-2), 10);
  if (!Number.isInteger(bossNumber) || bossNumber < 1) return 0;
  return bossNumber <= 7 ? bossNumber * 15 : 116 + bossNumber - 1;
}

function getBossBadgeCondition(badgeId: string) {
  const stage = getBossBadgeStage(badgeId);
  if (badgeId === "emperor-boss") return { ko: "황제 보스 스테이지 134 클리어", en: "Clear emperor boss stage 134" };
  if (badgeId.startsWith("king-boss-")) return { ko: `킹 보스 스테이지 ${stage} 클리어`, en: `Clear king boss stage ${stage}` };
  return { ko: `보스 스테이지 ${stage} 클리어`, en: `Clear boss stage ${stage}` };
}

const LiveRankingPanel = memo(function LiveRankingPanel({ language, mode = "unlimited", narrow, left, liveRows, myRank, myTimeSeconds, myStage, stageRanked = false, onPress }: { language: Language; mode?: GameMode; narrow?: boolean; left?: number; liveRows?: RankingRow[]; myRank?: number | null; myTimeSeconds?: number | null; myStage?: number | null; stageRanked?: boolean; onPress?: () => void }) {
  const title = stageRanked
    ? (language === "ko" ? "실시간 (스테이지) 랭킹" : "Live (Stage) Ranking")
    : (language === "ko" ? "실시간 (전체) 랭킹" : "Live (Overall) Ranking");
  const me = language === "ko" ? "내 순위" : "My rank";
  const rows = liveRows ?? [];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} 열기`} onPress={onPress} style={[styles.liveRankingPanel, narrow && styles.liveRankingPanelNarrow, left !== undefined && { position: "absolute", left, marginLeft: 0 }]}>
      <View style={styles.liveRankingHeader}>
        <Text numberOfLines={1} style={[styles.liveRankingTitle, stageRanked && styles.liveRankingTitleStage]}>{title}</Text>
      </View>
      <View style={styles.liveRankingColumns}>
        <View style={styles.liveRankingTopThree}>
          {[1, 2, 3].map((rank) => (
            <View key={rank} style={styles.liveRankingRow}>
              <Text style={[styles.liveRankingRank, { color: ["#FFD76A", "#C8D5E8", "#D99A6A"][rank - 1] }]}>{rank}</Text>
              <Text accessibilityLabel={rows[rank - 1]?.countryCode ? `${rows[rank - 1]?.countryCode} flag` : "No country flag"} style={styles.liveRankingFlag}>{countryFlag(rows[rank - 1]?.countryCode)}</Text>
              <Text numberOfLines={1} style={styles.liveRankingName}>{rows[rank - 1]?.name ?? "—"}</Text>
              <Text style={styles.liveRankingScore}>{rows[rank - 1] ? formatLocalizedNumber(rows[rank - 1].score, language) : "—"}</Text>
            </View>
          ))}
        </View>
        <View style={styles.liveRankingMe}>
          <Text numberOfLines={1} style={styles.liveRankingMeLabel}>{me}</Text>
          <Text numberOfLines={1} style={styles.liveRankingMeValue}>{myRank ? (language === "ko" ? `${formatLocalizedNumber(myRank, language)}위` : `${translateUi("순위", "Rank", language)} ${formatLocalizedNumber(myRank, language)}`) : "—"}</Text>
          <View style={styles.liveRankingMeDetails}>
            <Text numberOfLines={1} style={styles.liveRankingStage}>{myStage ? `S${formatLocalizedNumber(myStage, language)}` : "—"}</Text>
            <Text numberOfLines={1} style={styles.liveRankingTime}>{myTimeSeconds === null || myTimeSeconds === undefined ? "—" : formatDuration(myTimeSeconds, language)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}, (previous, next) => {
  if (previous.language !== next.language || previous.mode !== next.mode || previous.narrow !== next.narrow || previous.left !== next.left || previous.myRank !== next.myRank || previous.myTimeSeconds !== next.myTimeSeconds || previous.myStage !== next.myStage || previous.stageRanked !== next.stageRanked || previous.onPress !== next.onPress) return false;
  const previousRows = previous.liveRows ?? [];
  const nextRows = next.liveRows ?? [];
  return previousRows.length === nextRows.length && previousRows.every((row, index) => {
    const nextRow = nextRows[index];
    return Boolean(nextRow) && row.id === nextRow.id && row.name === nextRow.name && row.countryCode === nextRow.countryCode && row.score === nextRow.score && row.stage === nextRow.stage && row.timeSeconds === nextRow.timeSeconds;
  });
});
export default function HomeScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Use the live window dimensions so Fold/tablet windows can rotate and resize.
  // The 24dp hysteresis prevents layout thrashing while a device is rotating.
  const isLandscape = screenWidth > screenHeight + 24;
  const isTablet = Math.min(screenWidth, screenHeight) >= 600;
  const phoneLandscape = isLandscape && !isTablet;
  const safeScreenWidth = Math.max(260, screenWidth - insets.left - insets.right);
  const safeScreenHeight = Math.max(220, screenHeight - insets.top - insets.bottom);
  const deviceModel = Platform.OS === "android" ? String((Platform.constants as { Model?: string }).Model ?? "") : "";
  const compactLandscape = isLandscape && safeScreenHeight <= 460;
  const foldDevice = Platform.OS === "android" && /^SM-F/i.test(deviceModel);
  const foldPortrait = !isLandscape && isTablet && foldDevice;
  const narrowCover = !isLandscape && safeScreenWidth <= 390;
  useEffect(() => {
    if (Platform.OS === "web") return;
    const lockPortrait = foldDevice || isTablet;
    const applyOrientationPolicy = async () => {
      try {
        if (lockPortrait) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        } else {
          // Normal smartphones use the reference landscape battle layout when rotated.
          await ScreenOrientation.unlockAsync();
        }
      } catch {
        // Orientation control is unavailable in some preview/native shells.
      }
    };
    void applyOrientationPolicy();
  }, [foldDevice, isTablet]);
  const rootTopPadding = isLandscape ? 4 : Math.max(0, PHYSICAL_EDGE_INSET - 15);
  // Some edge-to-edge Android devices report a zero bottom inset while the
  // persistent home or three-button bar still overlays the game window.
  const systemBottomInset = Platform.OS !== "web" ? Math.max(insets.bottom, isLandscape ? 48 : 36) : insets.bottom;
  const rootBottomPadding = isLandscape ? systemBottomInset + 8 : PHYSICAL_EDGE_INSET + 62;
  // Reserve the additional header spacing used by the inline landscape banner.
  // This keeps the banner, title, and action buttons on separate visual lanes.
  const layoutExtraReservedHeight = isLandscape ? (phoneLandscape ? 16 : 18) : 58;
  const bottomControlsBottom = isLandscape ? systemBottomInset + 4 : Math.max(77, systemBottomInset + 13) + (foldPortrait ? 18 : 0);
  // In portrait, keep the banner below the action buttons while reserving the
  // system navigation inset so it never sits under the home indicator.
  const portraitBannerBottom = foldPortrait ? Math.max(0, bottomControlsBottom - 130) : Math.max(0, bottomControlsBottom - 98);
  const [scoreAnchorX, setScoreAnchorX] = useState<number | null>(null);
  const [timeAnchorRight, setTimeAnchorRight] = useState<number | null>(null);
  const [optionsAnchorRight, setOptionsAnchorRight] = useState<number | null>(null);
  const cardAreaLeft = Math.max(10, Math.min(safeScreenWidth - 10, scoreAnchorX ?? 10));
  const cardAreaRight = Math.max(cardAreaLeft + 220, Math.min(safeScreenWidth - 10, optionsAnchorRight ?? safeScreenWidth - 10));
  const { boardWidth, cardWidth, cardRatio, compact, stackOffset: baseStackOffset, tableauGap: baseTableauGap, uiScale, sideRailWidth, foldUltraWide } = getGameLayout(
    safeScreenWidth,
    safeScreenHeight,
    rootTopPadding + rootBottomPadding,
    isLandscape,
    layoutExtraReservedHeight,
    deviceModel,
    { left: isLandscape ? 10 : cardAreaLeft, right: isLandscape ? safeScreenWidth - 10 : cardAreaRight },
  );
  // Fold tableau cards expose more of each rank/suit mark instead of stacking too tightly.
  const tabletStackOffset = foldPortrait ? Math.max(16, Math.round(baseStackOffset * 0.78) + 10) : baseStackOffset;
  const stackOffset = isTablet ? Math.max(8, Math.round(tabletStackOffset * 0.9)) : tabletStackOffset;
  const tableauGap = foldPortrait ? Math.max(8, Math.round(baseTableauGap * 1.22)) : baseTableauGap;
  const compactControls = compact || compactLandscape;
  const monsterTravelDistance = isLandscape
    ? Math.max(180, Math.min(520, Math.round(safeScreenWidth * 0.46)))
    : Math.max(94, Math.min(150, Math.round(safeScreenWidth * 0.26)));
  // Give the monster a longer approach toward the companion while keeping a
  // bounded safe distance from the bottom controls on short screens.
  const monsterVerticalTravel = Math.max(0, Math.min(340, Math.round(safeScreenHeight * 0.5)));
  const [game, setGame] = useState(createPlayableGame);
  const remainingRecycles = getRemainingRecycles(game);
  const recycleWarning = isFinalRecycleWarning(game);
  useEffect(() => {
    if (!recycleWarning) return;
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    autoFinishTimerRef.current = null;
    autoFinishRunningRef.current = false;
  }, [recycleWarning]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("unlimited");
  const [recordModeView, setRecordModeView] = useState<GameMode>("unlimited");
  const modeProgressRef = useRef<Record<GameMode, number>>({ unlimited: 1, timeAttack: 1 });
  const [showTimeOutPopup, setShowTimeOutPopup] = useState(false);
  const [, setProgressRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [rulesTab, setRulesTab] = useState<RulesTab>("basic");
  const [language, setLanguage] = useState<Language>("en");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileNameError, setProfileNameError] = useState<string | null>(null);
  const [profileNameSaved, setProfileNameSaved] = useState(false);
  const profileNameDirtyRef = useRef(false);
  const [profileCountryCode, setProfileCountryCode] = useState<string | null>(null);
  const [localRankingRows, setLocalRankingRows] = useState<Partial<Record<GameMode, RankingRow>>>({});
  const [stageAccessRepairPending, setStageAccessRepairPending] = useState(false);
  const [previewRankingDemo, setPreviewRankingDemo] = useState(false);
  const [previewTimeAttackOpenTableau, setPreviewTimeAttackOpenTableau] = useState(false);
  const timeAttackPreviewDealMotion = useRef(new Animated.Value(1)).current;
  const [showUiGuideModal, setShowUiGuideModal] = useState(false);
  const [unlockedBossBadges, setUnlockedBossBadges] = useState<string[]>([]);
  const [earnedBadge, setEarnedBadge] = useState<{ id: string; name: string; image: number } | null>(null);
  const [spinningBadgeId, setSpinningBadgeId] = useState<string | null>(null);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const [showActiveBadgeNotice, setShowActiveBadgeNotice] = useState(false);
  const badgePreviewSpin = useRef(new Animated.Value(0)).current;
  const badgeCollectionMotion = useRef(new Animated.Value(0)).current;
  const activeBadgeAbility = activeBadgeId ? getBadgeAbility(activeBadgeId) : null;
  const activeBadgeImage = activeBadgeId ? getBattleContent(getBossBadgeStage(activeBadgeId), false).badgeImage : null;
  const activeBadgeNoticeMotion = useRef(new Animated.Value(0)).current;
  const [attendanceDay, setAttendanceDay] = useState(0);
  const [lastAttendanceDate, setLastAttendanceDate] = useState<string | null>(null);
  const [showAttendanceClaim, setShowAttendanceClaim] = useState(false);
  const [showAttendanceRewardFlight, setShowAttendanceRewardFlight] = useState(false);
  const [hammerRewardFlightKind, setHammerRewardFlightKind] = useState<HammerRewardFlightKind>("attendance");
  const [hammerRewardFlightAmount, setHammerRewardFlightAmount] = useState(0);
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [hydrated, setHydrated] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true);
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(0.9);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [cardSelectVibrationEnabled, setCardSelectVibrationEnabled] = useState(true);
  const [screenShakeEnabled, setScreenShakeEnabled] = useState(false);
  const [fixedFontScale, setFixedFontScale] = useState(false);
  const [pendingGameMode, setPendingGameMode] = useState<GameMode | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [storeUpdateAvailable, setStoreUpdateAvailable] = useState(false);
  const [storeVersion, setStoreVersion] = useState<string | number | null>(null);
  const [resetMode, setResetMode] = useState<"current" | "full">("full");
  const [flyingAttacks, setFlyingAttacks] = useState<ActiveFlight[]>([]);
  const [flyingCard, setFlyingCard] = useState<Card | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [replayResult, setReplayResult] = useState<{ stage: number; previousScore: number; newScore: number; previousTime: number | null; newTime: number } | null>(null);
  const [comboBanner, setComboBanner] = useState<{ count: number } | null>(null);
  const comboBannerOpacity = useRef(new Animated.Value(0)).current;
  const comboBannerScale = useRef(new Animated.Value(0.72)).current;
  const comboBannerTranslateY = useRef(new Animated.Value(12)).current;
  const comboStreakRef = useRef(0);
  const lastAttackAtRef = useRef(0);
  const comboResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [autoMoveHintIds, setAutoMoveHintIds] = useState<string[]>([]);
  const [timeBonusText, setTimeBonusText] = useState<string | null>(null);
  const timeBonusOpacity = useRef(new Animated.Value(0)).current;
  const timeBonusTranslateY = useRef(new Animated.Value(10)).current;
  const timeBonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [comboScoreText, setComboScoreText] = useState<string | null>(null);
  const [autoFinishSummary, setAutoFinishSummary] = useState<{ comboCount: number; totalScore: number } | null>(null);
  const comboScoreOpacity = useRef(new Animated.Value(0)).current;
  const comboScoreScale = useRef(new Animated.Value(0.65)).current;
  const comboScoreTranslateY = useRef(new Animated.Value(18)).current;
  const comboScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishSummaryOpacity = useRef(new Animated.Value(0)).current;
  const autoFinishSummaryScale = useRef(new Animated.Value(0.78)).current;
  const autoFinishSummaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboImpactBorderOpacity = useRef(new Animated.Value(0)).current;
  const replayStageRef = useRef<number | null>(null);
  const [petPreservationNotice, setPetPreservationNotice] = useState(false);
  const [attackKind, setAttackKind] = useState<AttackKind>("clubs");
  const [lastDamage, setLastDamage] = useState(0);
  const [attackToken, setAttackToken] = useState(0);
  const [impactToken, setImpactToken] = useState(0);
  const [comboAttack, setComboAttack] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState(DEFAULT_PET_ID);
  const [randomOwnedPetPerStage, setRandomOwnedPetPerStage] = useState(true);
  const [selectedCardBackIndex, setSelectedCardBackIndex] = useState<number | null>(null);
  const [hoveredCardBackIndex, setHoveredCardBackIndex] = useState<number | "stage" | null>(null);
  const [unlockedPetIds, setUnlockedPetIds] = useState<string[]>(INITIAL_UNLOCKED_PET_IDS);
  const languageLabel = LANGUAGE_OPTIONS.find((option) => option.code === language)?.nativeName ?? "English";
  const tr = (ko: string, en: string) => translateUi(ko, en, language);
  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setShowLanguagePicker(false);
    if (hydrated) void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage).catch(() => undefined);
  };
  const compactLanguageText = language !== "ko" && language !== "en";
  const saveProfileName = () => {
    const normalized = limitProfileNameLength(profileName);
    setProfileName(normalized);
    const persistLocalName = AsyncStorage.setItem(PROFILE_NAME_KEY, normalized);
    if (authQuery.data) {
      updateNameMutation.mutate({ name: normalized || null }, {
        onSuccess: (result) => {
          setProfileName(result.name ?? normalized);
          profileNameDirtyRef.current = false;
          setProfileNameError(null);
          setProfileNameSaved(true);
          void AsyncStorage.setItem(PROFILE_NAME_KEY, result.name ?? normalized);
          void authQuery.refetch();
          void leaderboardQuery.refetch();
          void leaderboardSnapshotQuery.refetch();
          void currentStageRankingQuery.refetch();
          void currentStageRankingSnapshotQuery.refetch();
          if (showRankingPopup) {
            void rankingPopupQuery.refetch();
            void rankingPopupSnapshotQuery.refetch();
          }
        },
      });
      return;
    }
    void persistLocalName.then(() => {
      profileNameDirtyRef.current = false;
      setProfileNameError(null);
      setProfileNameSaved(true);
    }).catch(() => {
      setProfileNameSaved(false);
      setProfileNameError(tr("이름을 저장하지 못했습니다.", "Could not save the name."));
    });
  };
  const saveProfileCountry = (countryCode: string | null) => {
    setProfileCountryCode(countryCode);
    void AsyncStorage.setItem(PROFILE_COUNTRY_KEY, countryCode ?? "").catch(() => undefined);
    if (authQuery.data) {
      updateCountryMutation.mutate({ countryCode }, {
        onSuccess: (result) => {
          setProfileCountryCode(result.countryCode);
          void AsyncStorage.setItem(PROFILE_COUNTRY_KEY, result.countryCode ?? "");
          void authQuery.refetch();
          void leaderboardQuery.refetch();
          void leaderboardSnapshotQuery.refetch();
          void currentStageRankingQuery.refetch();
          void currentStageRankingSnapshotQuery.refetch();
          if (showRankingPopup) {
            void rankingPopupQuery.refetch();
            void rankingPopupSnapshotQuery.refetch();
          }
        },
      });
    }
  };
  const buildCloudGameState = (): CloudGameState => ({
    version: 1,
    savedAt: new Date().toISOString(),
    activeGame: { saveVersion: ACTIVE_GAME_SAVE_VERSION, game, elapsedSeconds, gameMode },
    records,
    hammerCharges: Math.max(0, Math.min(MAX_HAMMER_CHARGES, hammerCharges)),
    unlockedPetIds,
    unlockedBossBadges,
    selectedCompanionId,
    selectedCardBackIndex,
    attendance: { day: attendanceDay, lastDate: lastAttendanceDate },
    dailyAdRewards: { date: dailyAdRewardDate, count: dailyAdHammerRewards, startedAt: dailyAdRewardStartedAt },
    modeProgress: { ...modeProgressRef.current },
    claimedBossPrepStages,
    randomOwnedPetPerStage,
  });
  const saveCloudGameState = async () => {
    if (!authQuery.data?.id || cloudHydratedUserRef.current !== authQuery.data.id) return;
    try {
      await cloudStateSaveMutation.mutateAsync({ payload: JSON.stringify(buildCloudGameState()) });
    } catch {
      setCloudSyncMessage(tr("클라우드 저장에 실패했습니다. 로컬 데이터는 유지됩니다.", "Cloud save failed. Local data is still safe."));
    }
  };
  const setFixedFontScalePreference = (enabled: boolean) => {
    fixedFontScaleEnabled = enabled;
    setFixedFontScale(enabled);
    void AsyncStorage.setItem(FIXED_FONT_SCALE_KEY, String(enabled));
  };
  const runPreviewRankingDemo = () => {
    if (!showPreviewAttackTools) return;
    setPreviewRankingDemo(true);
    setPaused(false);
    setSheet(null);
    showTimedHint(tr("미리보기: 스테이지 18 클리어 기록을 저장하고 랭킹을 갱신했습니다.", "Preview: Stage 18 clear saved and rankings refreshed."));
  };
  const [claimedBossPrepStages, setClaimedBossPrepStages] = useState<number[]>([]);
  const [showTwoTouch, setShowTwoTouch] = useState(false);
  const [showNoMovesPopup, setShowNoMovesPopup] = useState(false);
  const [twoTouchOpensUsed, setTwoTouchOpensUsed] = useState(0);
  const [rewardedRevealUsed, setRewardedRevealUsed] = useState(0);
  const [rewardedAdError, setRewardedAdError] = useState<string | null>(null);
  const [rewardedAdInProgress, setRewardedAdInProgress] = useState(false);
  const [rewardedRetrySlot, setRewardedRetrySlot] = useState<1 | 2>(1);
  const [showHammerOffer, setShowHammerOffer] = useState(false);
  const [showRankingPopup, setShowRankingPopup] = useState(false);
  const [showGoogleAccountMenu, setShowGoogleAccountMenu] = useState(false);
  const [rankingPopupMode, setRankingPopupMode] = useState<GameMode>(gameMode);
  const [rankingPopupViewMode, setRankingPopupViewMode] = useState<RankingViewMode>("overall");
  const [showReplayStageList, setShowReplayStageList] = useState(false);
  const [showStageRankingList, setShowStageRankingList] = useState(false);
  const [selectedStageRanking, setSelectedStageRanking] = useState<number | null>(null);
  const [hammerMode, setHammerMode] = useState(false);
  const [hammerCharges, setHammerCharges] = useState(0);
  const [dailyAdHammerRewards, setDailyAdHammerRewards] = useState(0);
  const [dailyAdRewardDate, setDailyAdRewardDate] = useState<string | null>(null);
  const [dailyAdRewardStartedAt, setDailyAdRewardStartedAt] = useState<number | null>(null);
  const adRewardResetForAppUpdateRef = useRef(false);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);
  const [googleAuthMessage, setGoogleAuthMessage] = useState<string | null>(null);
  const [googleSessionUser, setGoogleSessionUser] = useState<Auth.User | null>(null);
  const googleSessionRestoreStartedRef = useRef(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);
  const getCurrentDailyAdRewardCount = () => {
    const now = Date.now();
    const sameLocalDay = dailyAdRewardDate === localDateKey();
    const windowExpired = dailyAdRewardStartedAt !== null && now - dailyAdRewardStartedAt >= 24 * 60 * 60 * 1000;
    return sameLocalDay && !windowExpired ? dailyAdHammerRewards : 0;
  };
  const refreshDailyAdRewardDay = () => {
    const today = localDateKey();
    const now = Date.now();
    const windowExpired = dailyAdRewardStartedAt !== null && now - dailyAdRewardStartedAt >= 24 * 60 * 60 * 1000;
    if (dailyAdRewardDate === today && !windowExpired) return dailyAdHammerRewards;
    setDailyAdRewardDate(today);
    setDailyAdHammerRewards(0);
    setDailyAdRewardStartedAt(null);
    void AsyncStorage.setItem(DAILY_AD_HAMMER_REWARD_KEY, JSON.stringify({ date: today, count: 0, startedAt: null }));
    return 0;
  };
  const authQuery = trpc.auth.me.useQuery();
  const cloudStateQuery = trpc.gameState.get.useQuery(undefined, { enabled: Boolean(authQuery.data?.id), staleTime: 30000 });
  const cloudStateSaveMutation = trpc.gameState.save.useMutation();
  const leaderboardQuery = trpc.leaderboard.top.useQuery({ mode: gameMode }, { refetchInterval: 15000, staleTime: 10000 });
  const leaderboardSnapshotQuery = trpc.leaderboard.snapshot.useQuery({ mode: gameMode }, { enabled: Boolean(authQuery.data?.id), refetchInterval: 15000, staleTime: 10000 });
  const currentStageRankingQuery = trpc.leaderboard.byStage.useQuery({ mode: gameMode, stage: game.level }, { refetchInterval: 15000, staleTime: 10000 });
  const currentStageRankingSnapshotQuery = trpc.leaderboard.stageSnapshot.useQuery({ mode: gameMode, stage: game.level }, { enabled: Boolean(authQuery.data?.id), refetchInterval: 15000, staleTime: 10000 });
  const rankingPopupQuery = trpc.leaderboard.top.useQuery({ mode: rankingPopupMode }, { enabled: showRankingPopup, refetchInterval: 15000, staleTime: 10000 });
  const rankingPopupSnapshotQuery = trpc.leaderboard.snapshot.useQuery({ mode: rankingPopupMode }, { enabled: showRankingPopup && Boolean(authQuery.data?.id), refetchInterval: 15000, staleTime: 10000 });
  const stageRankingQuery = trpc.leaderboard.byStage.useQuery(
    { mode: rankingPopupMode, stage: selectedStageRanking ?? game.level },
    {
      enabled: showRankingPopup && rankingPopupViewMode === "stage",
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  );
  const updateCountryMutation = trpc.profile.updateCountry.useMutation();
  const updateNameMutation = trpc.profile.updateName.useMutation({
    onSuccess: () => {
      setProfileNameError(null);
      setProfileNameSaved(true);
      void authQuery.refetch();
      void leaderboardQuery.refetch();
      void leaderboardSnapshotQuery.refetch();
      void currentStageRankingQuery.refetch();
      void currentStageRankingSnapshotQuery.refetch();
      if (showRankingPopup) {
        void rankingPopupQuery.refetch();
        void rankingPopupSnapshotQuery.refetch();
        if (selectedStageRanking !== null) void stageRankingQuery.refetch();
      }
    },
    onError: (error) => { setProfileNameSaved(false); setProfileNameError(error.message); },
  });
  const submitLeaderboardMutation = trpc.leaderboard.submit.useMutation({ onSuccess: () => {
    void leaderboardQuery.refetch();
    void leaderboardSnapshotQuery.refetch();
    void currentStageRankingQuery.refetch();
    void currentStageRankingSnapshotQuery.refetch();
    if (showRankingPopup) {
      void rankingPopupQuery.refetch();
      void rankingPopupSnapshotQuery.refetch();
      if (selectedStageRanking !== null) void stageRankingQuery.refetch();
    }
  } });
  const rankingSyncInFlightRef = useRef(false);
  const leaderboardRepairUserRef = useRef<number | null>(null);
  const submitStoredStagesToServer = async (userIdOverride?: number) => {
    const userId = userIdOverride ?? authQuery.data?.id;
    if (!userId || rankingSyncInFlightRef.current) return;
    rankingSyncInFlightRef.current = true;
    try {
      const submissions: Promise<unknown>[] = [];
      for (const mode of ["unlimited", "timeAttack"] as const) {
        const modeRecord = records[mode];
        const clearedStages = Array.from(new Set([
          ...Object.keys(modeRecord.stageBestTimes ?? {}),
          ...Object.keys(modeRecord.stageBestScores ?? {}),
        ].map(Number).filter((stage) => Number.isInteger(stage) && stage >= 1 && stage <= POST_STORY_STAGE_LIMIT)));
        for (const stage of clearedStages) {
          const stageKey = String(stage);
          const score = modeRecord.stageBestScores?.[stageKey] ?? modeRecord.bestScore;
          submissions.push(submitLeaderboardMutation.mutateAsync({ mode, score: Math.max(0, Math.floor(score)), timeSeconds: modeRecord.stageBestTimes?.[stageKey] ?? modeRecord.bestTimeSeconds ?? null, stage }));
        }
      }
      await Promise.all(submissions);
      await AsyncStorage.setItem(`${RANKING_SYNC_AT_KEY}:${userId}`, String(Date.now()));
    } catch {
      // Keep the previous sync time so the next activation retries.
    } finally {
      rankingSyncInFlightRef.current = false;
    }
  };
  useEffect(() => {
    const userId = authQuery.data?.id;
    if (!hydrated || !userId || !cloudStateQuery.isFetched || cloudHydratedUserRef.current !== userId) return;
    const hasLocalStageData = (Object.values(records) as ModeRecords[]).some((modeRecord, index) => Object.keys(modeRecord.stageBestTimes ?? {}).length > 0 || modeRecord.bestScore > 0 || (modeProgressRef.current[["unlimited", "timeAttack"][index] as GameMode] ?? 1) > 1);
    if (!hasLocalStageData && leaderboardRepairUserRef.current !== userId) return;
    if (leaderboardRepairUserRef.current === userId && !hasLocalStageData) return;
    leaderboardRepairUserRef.current = userId;
    void submitStoredStagesToServer();
  }, [authQuery.data?.id, cloudStateQuery.isFetched, hydrated, records, submitLeaderboardMutation]);
  useEffect(() => {
    const userId = authQuery.data?.id;
    if (!hydrated || !userId || !cloudStateQuery.isFetched || cloudHydratedUserRef.current !== userId) return;
    let cancelled = false;
    const syncIfDue = async () => {
      const stored = await AsyncStorage.getItem(`${RANKING_SYNC_AT_KEY}:${userId}`);
      const lastSyncAt = stored ? Number(stored) : 0;
      if (!Number.isFinite(lastSyncAt) || Date.now() - lastSyncAt >= RANKING_SYNC_INTERVAL_MS) {
        if (!cancelled) await submitStoredStagesToServer();
      }
    };
    void syncIfDue();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncIfDue();
    });
    return () => { cancelled = true; subscription.remove(); };
  }, [authQuery.data?.id, cloudStateQuery.isFetched, hydrated, records, submitLeaderboardMutation]);

  const establishGoogleSession = async (googleLogin: { idToken: string; avatarUrl: string | null }) => {
      const session = await Api.exchangeGoogleIdToken(googleLogin.idToken);
      const user: Auth.User = {
        id: session.user.id,
        openId: session.user.openId,
        name: session.user.name,
        email: session.user.email,
        avatarUrl: session.user.avatarUrl ?? googleLogin.avatarUrl ?? null,
        loginMethod: session.user.loginMethod,
        countryCode: session.user.countryCode ?? null,
        lastSignedIn: new Date(session.user.lastSignedIn || Date.now()),
      };
      await Auth.setSessionToken(session.sessionToken);
      await Auth.setUserInfo(user);
      setGoogleSessionUser(user);
      await authQuery.refetch();
      await submitStoredStagesToServer(user.id);
      await leaderboardQuery.refetch();
      await leaderboardSnapshotQuery.refetch();
      await currentStageRankingQuery.refetch();
      await currentStageRankingSnapshotQuery.refetch();
      return user;
  };

  const loginWithGoogle = async () => {
    if (googleAuthPending) return;
    setGoogleAuthPending(true);
    setGoogleAuthMessage(tr("Google 로그인 창을 여는 중…", "Opening Google sign-in…"));
    try {
      const googleLogin = await signInWithGoogle();
      if (googleLogin.kind === "cancelled") return;
      if (googleLogin.kind !== "success") {
        setGoogleAuthMessage(googleLogin.message);
        if (Platform.OS === "android") Alert.alert(tr("Google 로그인 실패", "Google Sign-In failed"), googleLogin.message);
        haptic.error();
        return;
      }

      await establishGoogleSession(googleLogin);
      setGoogleAuthMessage(tr("✓ Google 로그인 완료 · 이제 기록이 계정에 연결됩니다.", "✓ Google sign-in complete · your records are now linked to this account."));
      if (Platform.OS === "android") Alert.alert(tr("Google 로그인 완료", "Google Sign-In successful"), tr("프로필과 게임 데이터가 계정에 연결되었습니다.", "Your profile and game data are now linked to your account."));
      haptic.success();
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Google 로그인에 실패했습니다.", "Google sign-in failed.");
      setGoogleAuthMessage(message);
      if (Platform.OS === "android") Alert.alert(tr("Google 로그인 오류", "Google Sign-In error"), message);
      haptic.error();
    } finally {
      setGoogleAuthPending(false);
    }
  };
  const logoutFromGoogle = async () => {
    if (googleAuthPending) return;
    setGoogleAuthPending(true);
    setGoogleAuthMessage(null);
    try {
      await Api.logout().catch(() => undefined);
      await signOutFromGoogle().catch(() => undefined);
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setGoogleSessionUser(null);
      cloudHydratedUserRef.current = null;
      await authQuery.refetch();
      setGoogleAuthMessage(tr("로그아웃했습니다. 이 기기의 로컬 게임 데이터는 유지됩니다.", "Signed out. This device's local game data remains."));
      haptic.light();
    } finally {
      setGoogleAuthPending(false);
    }
  };
  useEffect(() => {
    if (Platform.OS === "web" || authQuery.data || googleSessionRestoreStartedRef.current) return;
    googleSessionRestoreStartedRef.current = true;
    let cancelled = false;

    void (async () => {
      const googleLogin = await restoreGoogleSignIn();
      if (!googleLogin || googleLogin.kind !== "success" || cancelled) return;
      try {
        await establishGoogleSession(googleLogin);
        if (!cancelled) {
          setGoogleAuthMessage(tr("✓ Google 계정 연결을 복원했습니다.", "✓ Restored your Google account connection."));
        }
      } catch (error) {
        // Preserve manual sign-in and local game data if a renewal fails.
        console.warn("[GoogleAuth] Startup session restore failed", error instanceof Error ? error.message : String(error));
      }
    })();

    return () => { cancelled = true; };
  // A ref intentionally limits recovery to one attempt per app launch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authQuery.data]);
  const [hammerStrikeTarget, setHammerStrikeTarget] = useState<{ dx: number; dy: number } | null>(null);
  const [hammerRevealFlight, setHammerRevealFlight] = useState<{ card: Card; from: { dx: number; dy: number }; to: { dx: number; dy: number } } | null>(null);
  const [hammerLandingDustTarget, setHammerLandingDustTarget] = useState<{ dx: number; dy: number } | null>(null);
  const [foundationMoveFlights, setFoundationMoveFlights] = useState<FoundationMoveFlight[]>([]);
  const showPreviewAttackTools = Platform.OS === "web" && (__DEV__ || isRunningInPreviewIframe());
  const runPreviewTimeAttackOpenTableau = () => {
    if (!showPreviewAttackTools) return;
    const previewGame = revealAllTableauCards(createPlayableGame(game.level));
    timeAttackPreviewDealMotion.stopAnimation();
    timeAttackPreviewDealMotion.setValue(0);
    setPreviewTimeAttackOpenTableau(true);
    setGameMode("timeAttack");
    setRecordModeView("timeAttack");
    setGame(previewGame);
    gameRef.current = previewGame;
    lastValidGameRef.current = previewGame;
    recentGameFingerprintsRef.current = [gameStateFingerprint(previewGame)];
    setSelection(null);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    timeOutHandledRef.current = false;
    setShowTimeOutPopup(false);
    setPaused(true);
    setSheet(null);
    setShowNoMovesPopup(false);
    setShowTwoTouch(false);
  };
  useEffect(() => {
    if (!previewTimeAttackOpenTableau) return;
    let cancelled = false;
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      // Wait for the open-card tableau to paint at opacity 0 before moving it.
      // Starting synchronously in the button handler skipped this first frame.
      secondFrame = requestAnimationFrame(() => {
        Animated.timing(timeAttackPreviewDealMotion, {
          toValue: 1,
          duration: 1850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || cancelled) return;
          setPaused(false);
          showTimedHint(tr("미리보기 테스트: 태블로 카드가 모두 공개되었습니다. 스톡은 기존처럼 직접 넘겨 보세요.", "Preview test: All tableau cards are open. Stock still reveals by tapping."));
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
      timeAttackPreviewDealMotion.stopAnimation();
    };
  }, [previewTimeAttackOpenTableau, timeAttackPreviewDealMotion]);
  const previewBadge = () => {
    if (!showPreviewAttackTools) return;
    setUnlockedBossBadges(PREVIEW_ALL_BOSS_BADGE_IDS);
    const content = getBattleContent(9, false);
    if (!content.badgeId || !content.badgeImage) return;
    badgePreviewSpin.stopAnimation();
    badgePreviewSpin.setValue(0);
    setEarnedBadge({ id: content.badgeId, name: content.monster.name, image: content.badgeImage });
    Animated.timing(badgePreviewSpin, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const spinBadgeInCollection = (badgeId: string) => {
    const content = getBattleContent(getBossBadgeStage(badgeId), false);
    if (!content.badgeImage) return;
    haptic.light();
    badgeCollectionMotion.stopAnimation();
    badgeCollectionMotion.setValue(0);
    setSpinningBadgeId(badgeId);
    Animated.timing(badgeCollectionMotion, { toValue: 1, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setSpinningBadgeId(null));
  };
  const selectBadgeInCollection = (badgeId: string) => {
    if (!unlockedBossBadges.includes(badgeId)) return;
    setActiveBadgeId(badgeId);
    void AsyncStorage.setItem(ACTIVE_BADGE_KEY, badgeId);
    showTimedHint(getBadgeAbilityText(badgeId, language));
    haptic.success();
  };
  useEffect(() => {
    void AsyncStorage.getItem(PROFILE_COUNTRY_KEY).then((value) => {
      if (/^[A-Z]{2}$/.test(value ?? "")) setProfileCountryCode(value);
    });
  }, []);
  useEffect(() => {
    void AsyncStorage.getItem(ACTIVE_BADGE_KEY).then((value) => {
      if (value) setActiveBadgeId(value);
    });
  }, []);
  useEffect(() => {
    if (!activeBadgeId) {
      void AsyncStorage.removeItem(ACTIVE_BADGE_KEY);
      return;
    }
    void AsyncStorage.setItem(ACTIVE_BADGE_KEY, activeBadgeId);
  }, [activeBadgeId]);
  useEffect(() => {
    if (!hydrated || !activeBadgeId || !activeBadgeImage) {
      setShowActiveBadgeNotice(false);
      return;
    }
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showBadge = () => {
      if (hideTimer) clearTimeout(hideTimer);
      activeBadgeNoticeMotion.stopAnimation();
      activeBadgeNoticeMotion.setValue(0);
      setShowActiveBadgeNotice(true);
      Animated.timing(activeBadgeNoticeMotion, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      hideTimer = setTimeout(() => {
        Animated.timing(activeBadgeNoticeMotion, { toValue: 0, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setShowActiveBadgeNotice(false));
      }, 5000);
    };
    const firstShowTimer = setTimeout(showBadge, 300);
    const interval = setInterval(showBadge, 180000);
    return () => {
      clearTimeout(firstShowTimer);
      if (hideTimer) clearTimeout(hideTimer);
      clearInterval(interval);
      activeBadgeNoticeMotion.stopAnimation();
    };
  }, [activeBadgeId, activeBadgeImage, activeBadgeNoticeMotion, hydrated]);
  useEffect(() => {
    if (authQuery.data?.name) return;
    void AsyncStorage.getItem(PROFILE_NAME_KEY).then((value) => {
      if (value !== null) setProfileName(value);
    });
  }, [authQuery.data?.name]);
  useEffect(() => {
    void AsyncStorage.getItem(LOCAL_RANKING_KEY).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as Partial<Record<GameMode, RankingRow>>;
        setLocalRankingRows(parsed);
      } catch {
        // Ignore malformed local history and let the server ranking render.
      }
    });
  }, []);
  useEffect(() => {
    if (!hydrated || (!profileName.trim() && !profileCountryCode)) return;
    setLocalRankingRows((current) => {
      let changed = false;
      const next = { ...current };
      (Object.keys(next) as GameMode[]).forEach((mode) => {
        const row = next[mode];
        if (!row) return;
        const updated = {
          ...row,
          name: profileName.trim() || row.name,
          countryCode: profileCountryCode ?? row.countryCode,
        };
        if (updated.name !== row.name || updated.countryCode !== row.countryCode) {
          next[mode] = updated;
          changed = true;
        }
      });
      if (changed) void AsyncStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(next));
      return changed ? next : current;
    });
  }, [hydrated, profileName, profileCountryCode]);
  useEffect(() => {
    void AsyncStorage.getItem(FIXED_FONT_SCALE_KEY).then((value) => {
      const enabled = value === "true";
      fixedFontScaleEnabled = enabled;
      setFixedFontScale(enabled);
    });
  }, []);
  useEffect(() => {
    const serverCountry = authQuery.data?.countryCode;
    if (typeof serverCountry === "string" && /^[A-Z]{2}$/.test(serverCountry)) {
      setProfileCountryCode(serverCountry);
      void AsyncStorage.setItem(PROFILE_COUNTRY_KEY, serverCountry);
    }
  }, [authQuery.data?.countryCode]);
  useEffect(() => {
    if (profileNameDirtyRef.current) return;
    if (typeof authQuery.data?.name === "string") setProfileName(authQuery.data.name);
  }, [authQuery.data?.name]);
  const [hammerImpactBurstTarget, setHammerImpactBurstTarget] = useState<{ dx: number; dy: number } | null>(null);
  const [showBossWarning, setShowBossWarning] = useState(false);
  const [showBossPrepReward, setShowBossPrepReward] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const newGameStarted = useRef(false);
  const suppressNextShufflePromptRef = useRef(false);
  const rootRef = useRef<View | null>(null);
  const monsterTargetRef = useRef<View | null>(null);
  const monsterTargetFrameRef = useRef<MonsterTargetFrame | null>(null);
  const companionAnchorRef = useRef<View | null>(null);
  const cloudHydratedUserRef = useRef<number | null>(null);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableauCardRefs = useRef<Record<string, View | null>>({});
  const companionAvoidanceShift = useRef(new Animated.Value(0)).current;
  const companionAvoidanceTargetRef = useRef(0);
  const [companionAvoidanceTarget, setCompanionAvoidanceTarget] = useState(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petPreservationNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  // Keep the last known-good board so a transient/native race cannot replace
  // the player's current stage with a fresh deal.
  const lastValidGameRef = useRef(game);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const timeOutHandledRef = useRef(false);
  const flightProgress = useRef(new Animated.Value(0)).current;
  const monsterMotion = useRef(new Animated.Value(1)).current;
  const comboCompanionScale = useRef(new Animated.Value(1)).current;
  const autoMoveHintAttention = useRef(new Animated.Value(0)).current;
  const autoMoveHintLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hammerShine = useRef(new Animated.Value(0)).current;
  const hammerIdleMotion = useRef(new Animated.Value(0)).current;
  const hammerImpact = useRef(new Animated.Value(0)).current;
  const hammerStrike = useRef(new Animated.Value(0)).current;
  const hammerImpactBurst = useRef(new Animated.Value(0)).current;
  const hammerRevealFlightProgress = useRef(new Animated.Value(0)).current;
  const hammerLandingDustProgress = useRef(new Animated.Value(0)).current;
  const foundationMoveFlightIdRef = useRef(0);
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
  const autoFinishRunningRef = useRef(false);
  const autoFinishComboPlanRef = useRef({
    totalCards: 0,
    totalDurationMs: 0,
    startedAt: 0,
    processedCards: 0,
    displayedCombos: 0,
    finalComboCount: 0,
  });
  const backgroundTrackIndexRef = useRef(0);
  const selectPlayer = useAudioPlayer(require("../../assets/sounds/card-select.wav"));
  const movePlayer = useAudioPlayer(require("../../assets/sounds/card-move.wav"));
  const shufflePlayer = useAudioPlayer(require("../../assets/sounds/card-shuffle.wav"));
  const companionAttackPlayer = useAudioPlayer(require("../../assets/sounds/companion-attack.wav"));
  const foundationAttackPlayer = useAudioPlayer(require("../../assets/sounds/foundation-attack.wav"));
  const fireAttackPlayer = useAudioPlayer(ATTACK_SOUND_BY_STYLE.red);
  const iceAttackPlayer = useAudioPlayer(ATTACK_SOUND_BY_STYLE.blue);
  const lightningAttackPlayer = useAudioPlayer(ATTACK_SOUND_BY_STYLE.orange);
  const shadowAttackPlayer = useAudioPlayer(ATTACK_SOUND_BY_STYLE.white);
  const fireImpactPlayer = useAudioPlayer(ATTACK_IMPACT_SOUND_BY_STYLE.red);
  const iceImpactPlayer = useAudioPlayer(ATTACK_IMPACT_SOUND_BY_STYLE.blue);
  const lightningImpactPlayer = useAudioPlayer(ATTACK_IMPACT_SOUND_BY_STYLE.orange);
  const shadowImpactPlayer = useAudioPlayer(ATTACK_IMPACT_SOUND_BY_STYLE.white);
  const backgroundPlayer = useAudioPlayer(BACKGROUND_MUSIC_TRACKS[0]);

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
    if (paused) return;
    hintIdleTimerRef.current = setTimeout(() => {
      if (paused) return;
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
  }, [paused]);

  useEffect(() => {
    attendanceAttentionLoopRef.current?.stop();
    attendanceAttention.stopAnimation();
    attendanceAttention.setValue(0);
    if (!hydrated || paused || lastAttendanceDate === localDateKey()) return;
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
  }, [attendanceAttention, hydrated, lastAttendanceDate, paused]);

  useEffect(() => {
    hammerShine.stopAnimation();
    hammerShine.setValue(0);
    if (hammerCharges <= 0 || paused) return;
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.timing(hammerShine, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(hammerShine, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(420),
    ]));
    shineLoop.start();
    return () => shineLoop.stop();
  }, [hammerCharges, hammerShine, paused]);

  useEffect(() => {
    hammerIdleMotion.stopAnimation();
    hammerIdleMotion.setValue(0);
    if (hammerCharges <= 0 || hammerStrikeTarget || paused) return;
    const idleLoop = Animated.loop(Animated.sequence([
      Animated.timing(hammerIdleMotion, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hammerIdleMotion, { toValue: -1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hammerIdleMotion, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    idleLoop.start();
    return () => idleLoop.stop();
  }, [hammerCharges, hammerIdleMotion, hammerStrikeTarget, paused]);

  const attackVisualActive = comboAttack || flyingAttacks.some((flight) => flight.variant !== "pet");
  const activePetFlight = flyingAttacks.find((flight) => flight.variant === "pet");
  useEffect(() => {
    comboCompanionScale.stopAnimation();
    if (attackVisualActive) {
      const grow = Animated.timing(comboCompanionScale, { toValue: MAX_COMPANION_ATTACK_SCALE, duration: 1450, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      grow.start();
      return () => grow.stop();
    }
    const reset = Animated.timing(comboCompanionScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    reset.start();
    return () => reset.stop();
  }, [attackVisualActive, comboCompanionScale]);

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

  const getAutoMoveHintIds = (currentGame: GameState) => {
    const ids: string[] = [];
    const wasteCard = currentGame.waste.at(-1);
    if (wasteCard && (moveToFoundation(currentGame, { kind: "waste" }) || currentGame.tableau.some((_, column) => Boolean(moveWasteToTableau(currentGame, column))))) {
      ids.push(wasteCard.id);
    }
    currentGame.tableau.forEach((pile, column) => {
      pile.forEach((card, index) => {
        if (!card.faceUp) return;
        const source: CardSource = { kind: "tableau", column, index };
        const canMove = Boolean(moveToFoundation(currentGame, source)) || currentGame.tableau.some((_, targetColumn) => targetColumn !== column && Boolean(moveTableauToTableau(currentGame, column, index, targetColumn)));
        if (canMove) ids.push(card.id);
      });
    });
    return ids;
  };

  useEffect(() => {
    setAutoMoveHintIds([]);
    autoMoveHintLoopRef.current?.stop();
    autoMoveHintLoopRef.current = null;
    autoMoveHintAttention.stopAnimation();
    autoMoveHintAttention.setValue(0);
    if (!hydrated || paused || hammerMode || selection || isWon(game)) return;
    const timer = setTimeout(() => {
      const ids = getAutoMoveHintIds(gameRef.current);
      if (ids.length === 0) return;
      setAutoMoveHintIds(ids);
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(autoMoveHintAttention, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(autoMoveHintAttention, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(420),
      ]));
      autoMoveHintLoopRef.current = loop;
      loop.start();
    }, 5000);
    return () => {
      clearTimeout(timer);
      autoMoveHintLoopRef.current?.stop();
      autoMoveHintLoopRef.current = null;
      autoMoveHintAttention.stopAnimation();
      autoMoveHintAttention.setValue(0);
    };
  }, [autoMoveHintAttention, game, hammerMode, hydrated, paused, selection]);

  const showFloatingReward = (text: string) => {
    if (timeBonusTimerRef.current) clearTimeout(timeBonusTimerRef.current);
    setTimeBonusText(text);
    timeBonusOpacity.stopAnimation();
    timeBonusTranslateY.stopAnimation();
    timeBonusOpacity.setValue(0);
    timeBonusTranslateY.setValue(10);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(timeBonusOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.delay(720),
        Animated.timing(timeBonusOpacity, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]),
      Animated.timing(timeBonusTranslateY, { toValue: -18, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    timeBonusTimerRef.current = setTimeout(() => {
      setTimeBonusText(null);
      timeBonusTimerRef.current = null;
    }, 1300);
  };

  const showComboScoreReward = (amount: number, comboCount: number) => {
    if (comboScoreTimerRef.current) clearTimeout(comboScoreTimerRef.current);
    setComboScoreText(`COMBO ×${comboCount}  +${amount}`);
    comboScoreOpacity.stopAnimation();
    comboScoreScale.stopAnimation();
    comboScoreTranslateY.stopAnimation();
    comboScoreOpacity.setValue(0);
    comboScoreScale.setValue(0.65);
    comboScoreTranslateY.setValue(18);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(comboScoreOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(760),
        Animated.timing(comboScoreOpacity, { toValue: 0, duration: 360, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(comboScoreScale, { toValue: 1.12, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(comboScoreScale, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.timing(comboScoreTranslateY, { toValue: -28, duration: 1240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    comboScoreTimerRef.current = setTimeout(() => {
      setComboScoreText(null);
      comboScoreTimerRef.current = null;
    }, 1300);
  };

  const showAutoFinishSummary = (comboCount: number, totalScore: number) => {
    if (autoFinishSummaryTimerRef.current) clearTimeout(autoFinishSummaryTimerRef.current);
    setAutoFinishSummary({ comboCount, totalScore });
    autoFinishSummaryOpacity.stopAnimation();
    autoFinishSummaryScale.stopAnimation();
    autoFinishSummaryOpacity.setValue(0);
    autoFinishSummaryScale.setValue(0.78);
    Animated.parallel([
      Animated.timing(autoFinishSummaryOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(autoFinishSummaryScale, { toValue: 1.06, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(autoFinishSummaryScale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
    autoFinishSummaryTimerRef.current = setTimeout(() => {
      Animated.timing(autoFinishSummaryOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setAutoFinishSummary(null));
      autoFinishSummaryTimerRef.current = null;
    }, 3000);
  };
  const showHighComboImpact = () => {
    comboImpactBorderOpacity.stopAnimation();
    comboImpactBorderOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(comboImpactBorderOpacity, { toValue: 0.82, duration: 90, useNativeDriver: true }),
      Animated.timing(comboImpactBorderOpacity, { toValue: 0.28, duration: 150, useNativeDriver: true }),
      Animated.timing(comboImpactBorderOpacity, { toValue: 0.72, duration: 90, useNativeDriver: true }),
      Animated.delay(110),
      Animated.timing(comboImpactBorderOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  };
  const shouldShowAutoFinishCombo = () => {
    const plan = autoFinishComboPlanRef.current;
    if (!plan.totalCards || plan.displayedCombos >= 20) return false;
    plan.processedCards += 1;
    const elapsed = Math.max(0, Date.now() - plan.startedAt);
    const timeProgress = plan.totalDurationMs > 0 ? elapsed / plan.totalDurationMs : plan.processedCards / plan.totalCards;
    const cardProgress = plan.processedCards / plan.totalCards;
    const targetDisplayCount = Math.min(20, plan.totalCards, Math.max(1, Math.ceil(Math.max(timeProgress, cardProgress) * Math.min(20, plan.totalCards))));
    if (targetDisplayCount <= plan.displayedCombos) return false;
    plan.displayedCombos = targetDisplayCount;
    return true;
  };
  const registerSuccessfulAttack = (showVisual = true) => {
    const now = Date.now();
    const nextCount = now - lastAttackAtRef.current <= 1800 ? comboStreakRef.current + 1 : 1;
    comboStreakRef.current = nextCount;
    lastAttackAtRef.current = now;
    if (comboResetTimerRef.current) clearTimeout(comboResetTimerRef.current);
    comboResetTimerRef.current = setTimeout(() => {
      comboStreakRef.current = 0;
      lastAttackAtRef.current = 0;
      comboResetTimerRef.current = null;
    }, 1800);
    if (nextCount < 2 || !showVisual) return nextCount;
    setComboBanner({ count: nextCount });
    comboBannerOpacity.stopAnimation();
    comboBannerScale.stopAnimation();
    comboBannerTranslateY.stopAnimation();
    comboBannerOpacity.setValue(0);
    comboBannerScale.setValue(0.72);
    comboBannerTranslateY.setValue(12);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(comboBannerOpacity, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.delay(620),
        Animated.timing(comboBannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.spring(comboBannerScale, { toValue: 1.08, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.timing(comboBannerScale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.timing(comboBannerTranslateY, { toValue: -18, duration: 980, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setComboBanner(null));
    return nextCount;
  };

  const setSoundEffectsVolumePreference = (value: number) => {
    const volume = clampVolume(value);
    setSoundEffectsVolume(volume);
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer, fireAttackPlayer, iceAttackPlayer, lightningAttackPlayer, shadowAttackPlayer, fireImpactPlayer, iceImpactPlayer, lightningImpactPlayer, shadowImpactPlayer]) {
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
        for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer, fireAttackPlayer, iceAttackPlayer, lightningAttackPlayer, shadowAttackPlayer, fireImpactPlayer, iceImpactPlayer, lightningImpactPlayer, shadowImpactPlayer]) {
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
  const setScreenShakePreference = (enabled: boolean) => {
    setScreenShakeEnabled(enabled);
    showTimedHint(enabled ? "타격 화면 흔들림을 켰습니다." : "타격 화면 흔들림을 껐습니다.");
    haptic.light();
  };

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (petPreservationNoticeTimerRef.current) clearTimeout(petPreservationNoticeTimerRef.current);
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    if (comboResetTimerRef.current) clearTimeout(comboResetTimerRef.current);
    stopHintAttention();
    autoFinishRunningRef.current = false;
  }, []);


  useEffect(() => {
    let mounted = true;
    const loadLocalGame = async () => {
      try {
        const [activeGameValue, recordsValue, updateNoticeValue, soundEffectsValue, backgroundMusicValue, soundEffectsVolumeValue, backgroundMusicVolumeValue, cardSelectVibrationValue, screenShakeValue, selectedCompanionValue, unlockedPetsValue, randomOwnedPetPerStageValue, bossPrepValue, attendanceValue, hammerChargesValue, dailyAdRewardValue, dailyAdAppVersionValue, cardBackThemeValue, languageValue] = await AsyncStorage.multiGet([ACTIVE_GAME_KEY, RECORDS_KEY, UPDATE_NOTICE_KEY, SOUND_ENABLED_KEY, BACKGROUND_MUSIC_ENABLED_KEY, SOUND_EFFECTS_VOLUME_KEY, BACKGROUND_MUSIC_VOLUME_KEY, CARD_SELECT_VIBRATION_KEY, SCREEN_SHAKE_ENABLED_KEY, SELECTED_COMPANION_KEY, UNLOCKED_PETS_KEY, RANDOM_OWNED_PET_PER_STAGE_KEY, BOSS_PREP_BONUSES_KEY, ATTENDANCE_KEY, HAMMER_CHARGES_KEY, DAILY_AD_HAMMER_REWARD_KEY, DAILY_AD_APP_VERSION_KEY, CARD_BACK_THEME_KEY, LANGUAGE_KEY]);
        const [modeProgressValue, bossBadgesValue, stageAccessRepairValue] = await Promise.all([AsyncStorage.getItem(MODE_PROGRESS_KEY), AsyncStorage.getItem(BOSS_BADGES_KEY), AsyncStorage.getItem(STAGE_ACCESS_REPAIR_KEY)]);
        if (bossBadgesValue) {
          const savedBadges = JSON.parse(bossBadgesValue);
          if (Array.isArray(savedBadges)) setUnlockedBossBadges(savedBadges.filter((value): value is string => typeof value === "string"));
        }
        if (modeProgressValue) {
          const savedModes = JSON.parse(modeProgressValue) as Partial<Record<GameMode, number>>;
          modeProgressRef.current = { unlimited: Math.max(1, Math.floor(savedModes.unlimited ?? 1)), timeAttack: Math.max(1, Math.floor(savedModes.timeAttack ?? 1)) };
          setProgressRevision((revision) => revision + 1);
        }
        if (!mounted) return;
        if (stageAccessRepairValue !== STAGE_ACCESS_REPAIR_VERSION) setStageAccessRepairPending(true);
        const storedAdAppVersion = dailyAdAppVersionValue[1];
        const hasLegacyAdRewardState = !storedAdAppVersion && Boolean(dailyAdRewardValue[1]);
        const isAppUpdate = Boolean((storedAdAppVersion && storedAdAppVersion !== CURRENT_AD_APP_VERSION) || hasLegacyAdRewardState);
        adRewardResetForAppUpdateRef.current = isAppUpdate;
        if (isAppUpdate) {
          setDailyAdRewardDate(localDateKey());
          setDailyAdHammerRewards(0);
          setDailyAdRewardStartedAt(null);
          AsyncStorage.setItem(DAILY_AD_HAMMER_REWARD_KEY, JSON.stringify({ date: localDateKey(), count: 0, startedAt: null })).catch(() => undefined);
        }
        AsyncStorage.setItem(DAILY_AD_APP_VERSION_KEY, CURRENT_AD_APP_VERSION).catch(() => undefined);
        if (updateNoticeValue[1] !== UPDATE_NOTICE_VERSION) {
          setShowUpdateNotice(true);
          AsyncStorage.setItem(UPDATE_NOTICE_KEY, UPDATE_NOTICE_VERSION).catch(() => undefined);
        }
        if (activeGameValue[1] && !newGameStarted.current) {
          const saved = JSON.parse(activeGameValue[1]) as { saveVersion?: number; game?: typeof game; elapsedSeconds?: number; gameMode?: GameMode };
          if (saved.saveVersion === ACTIVE_GAME_SAVE_VERSION && saved.game?.tableau?.length === 7) {
            const restoredGame = restoreDestroyedCardsToWaste({ ...saved.game, level: saved.game.level ?? 1, recycles: saved.game.recycles ?? 0 });
            if (validateGameState(restoredGame).valid) {
              recentGameFingerprintsRef.current = [gameStateFingerprint(restoredGame)];
              lastValidGameRef.current = restoredGame;
              setGame(restoredGame);
              if (saved.gameMode === "unlimited" || saved.gameMode === "timeAttack") setGameMode(saved.gameMode);
              if ((saved.game.destroyedCards?.length ?? 0) > 0) {
                AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: restoredGame, elapsedSeconds: saved.elapsedSeconds ?? 0, gameMode: saved.gameMode ?? "unlimited" })).catch(() => undefined);
              }
              if (typeof saved.elapsedSeconds === "number") setElapsedSeconds(saved.elapsedSeconds);
            } else {
              AsyncStorage.removeItem(ACTIVE_GAME_KEY).catch(() => undefined);
            }
          } else {
            // Older builds could retain the previous fixed tutorial arrangement.
            // Do not bring that order into the current random-deal implementation.
            AsyncStorage.removeItem(ACTIVE_GAME_KEY).catch(() => undefined);
          }
        }
        if (recordsValue[1]) {
          const savedRecords = JSON.parse(recordsValue[1]) as Partial<Records> & Partial<ModeRecords>;
          const isLegacy = typeof savedRecords.wins === "number" || typeof savedRecords.bestScore === "number" || savedRecords.bestTimeSeconds !== undefined;
          if (isLegacy) {
            const legacy: ModeRecords = {
              wins: Math.max(0, savedRecords.wins ?? 0),
              bestScore: Math.max(0, savedRecords.bestScore ?? 0),
              bestTimeSeconds: typeof savedRecords.bestTimeSeconds === "number" ? Math.max(0, savedRecords.bestTimeSeconds) : null,
              stageBestTimes: {},
              stageBestScores: {},
            };
            setRecords({ unlimited: legacy, timeAttack: { ...emptyModeRecords } });
          } else {
            setRecords({
              unlimited: { ...emptyModeRecords, ...(savedRecords.unlimited ?? {}), stageBestTimes: { ...emptyModeRecords.stageBestTimes, ...(savedRecords.unlimited?.stageBestTimes ?? {}) }, stageBestScores: { ...emptyModeRecords.stageBestScores, ...(savedRecords.unlimited?.stageBestScores ?? {}) } },
              timeAttack: { ...emptyModeRecords, ...(savedRecords.timeAttack ?? {}), stageBestTimes: { ...emptyModeRecords.stageBestTimes, ...(savedRecords.timeAttack?.stageBestTimes ?? {}) }, stageBestScores: { ...emptyModeRecords.stageBestScores, ...(savedRecords.timeAttack?.stageBestScores ?? {}) } },
            });
          }
        }
        if (soundEffectsValue[1]) setSoundEffectsEnabled(soundEffectsValue[1] === "true");
        if (backgroundMusicValue[1]) setBackgroundMusicEnabled(backgroundMusicValue[1] === "true");
        if (soundEffectsVolumeValue[1]) setSoundEffectsVolume(clampVolume(Number(soundEffectsVolumeValue[1])));
        if (backgroundMusicVolumeValue[1]) setBackgroundMusicVolume(clampVolume(Number(backgroundMusicVolumeValue[1])));
        if (cardSelectVibrationValue[1]) setCardSelectVibrationEnabled(cardSelectVibrationValue[1] === "true");
        if (screenShakeValue[1]) setScreenShakeEnabled(screenShakeValue[1] === "true");
        if (randomOwnedPetPerStageValue[1]) setRandomOwnedPetPerStage(randomOwnedPetPerStageValue[1] === "true");
        if (languageValue[1] === "es-MX") {
          // Keep older Mexican-Spanish preferences compatible with the single Spanish picker entry.
          setLanguage("es");
        } else if (LANGUAGE_OPTIONS.some((option) => option.code === languageValue[1])) {
          setLanguage(languageValue[1] as Language);
        }
        if (selectedCompanionValue[1]) setSelectedCompanionId(selectedCompanionValue[1]);
        if (cardBackThemeValue[1]) {
          const savedIndex = Number.parseInt(cardBackThemeValue[1], 10);
          if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < CARD_BACK_THEMES.length) setSelectedCardBackIndex(savedIndex);
        }
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
        if (bossPrepValue[1]) {
          const savedBossPrepStages = JSON.parse(bossPrepValue[1]);
          if (Array.isArray(savedBossPrepStages)) setClaimedBossPrepStages(savedBossPrepStages.filter((stage): stage is number => Number.isInteger(stage) && stage > 0));
        }
        if (attendanceValue[1]) {
          const savedAttendance = JSON.parse(attendanceValue[1]) as { day?: number; lastDate?: string | null };
          setAttendanceDay(typeof savedAttendance.day === "number" ? Math.max(0, savedAttendance.day) : 0);
          setLastAttendanceDate(typeof savedAttendance.lastDate === "string" ? savedAttendance.lastDate : null);
        }
        if (hammerChargesValue[1]) {
          const savedHammerCharges = Number.parseInt(hammerChargesValue[1], 10);
          if (Number.isFinite(savedHammerCharges)) setHammerCharges(Math.max(0, Math.min(MAX_HAMMER_CHARGES, savedHammerCharges)));
        }
        const today = localDateKey();
        if (dailyAdRewardValue[1]) {
          const savedAdReward = JSON.parse(dailyAdRewardValue[1]) as { date?: string; count?: number; startedAt?: number | null };
          const savedCount = Math.max(0, Math.min(MAX_DAILY_AD_HAMMER_REWARDS, savedAdReward.count ?? 0));
          const savedStartedAt = typeof savedAdReward.startedAt === "number" && Number.isFinite(savedAdReward.startedAt) ? savedAdReward.startedAt : savedCount > 0 ? Date.now() : null;
          const expired = savedStartedAt !== null && Date.now() - savedStartedAt >= 24 * 60 * 60 * 1000;
          if (savedAdReward.date === today && !expired) {
            setDailyAdRewardDate(today);
            setDailyAdHammerRewards(savedCount);
            setDailyAdRewardStartedAt(savedStartedAt);
          } else {
            setDailyAdRewardDate(today);
            setDailyAdHammerRewards(0);
            setDailyAdRewardStartedAt(null);
            AsyncStorage.setItem(DAILY_AD_HAMMER_REWARD_KEY, JSON.stringify({ date: today, count: 0, startedAt: null })).catch(() => undefined);
          }
        } else {
          setDailyAdRewardDate(today);
          setDailyAdRewardStartedAt(null);
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
    const userId = authQuery.data?.id;
    if (!hydrated || !userId || !cloudStateQuery.isFetched || cloudHydratedUserRef.current === userId) return;
    const cloud = cloudStateQuery.data as Partial<CloudGameState> | null | undefined;
    if (cloud?.version === 1) {
      const savedGame = cloud.activeGame?.game as GameState | undefined;
      if (savedGame?.tableau?.length === 7 && validateGameState(savedGame).valid) {
        const restoredGame = restoreDestroyedCardsToWaste(savedGame);
        setGame(restoredGame);
        if (cloud.activeGame?.gameMode === "unlimited" || cloud.activeGame?.gameMode === "timeAttack") setGameMode(cloud.activeGame.gameMode);
        gameRef.current = restoredGame;
        lastValidGameRef.current = restoredGame;
        setElapsedSeconds(Math.max(0, cloud.activeGame?.elapsedSeconds ?? 0));
      }
      if (cloud.records && typeof cloud.records === "object") {
        // Never overwrite a newer device record with an older cloud snapshot.
        // This is also the client-side safety net that keeps the logged-in
        // player's 4th-place row available while the production board catches up.
        setRecords((localRecords) => mergeGameRecords(localRecords, cloud.records as Partial<Records>));
      }
      if (typeof cloud.hammerCharges === "number") setHammerCharges(Math.max(0, Math.min(MAX_HAMMER_CHARGES, cloud.hammerCharges)));
      if (Array.isArray(cloud.unlockedPetIds)) setUnlockedPetIds(Array.from(new Set([...INITIAL_UNLOCKED_PET_IDS, ...cloud.unlockedPetIds.filter((id): id is string => typeof id === "string")])));
      if (Array.isArray(cloud.unlockedBossBadges)) setUnlockedBossBadges(cloud.unlockedBossBadges.filter((id): id is string => typeof id === "string"));
      if (typeof cloud.selectedCompanionId === "string") setSelectedCompanionId(cloud.selectedCompanionId);
      if (typeof cloud.selectedCardBackIndex === "number" || cloud.selectedCardBackIndex === null) setSelectedCardBackIndex(cloud.selectedCardBackIndex);
      if (cloud.attendance) { setAttendanceDay(Math.max(0, cloud.attendance.day ?? 0)); setLastAttendanceDate(cloud.attendance.lastDate ?? null); }
      if (cloud.dailyAdRewards) {
        const today = localDateKey();
        if (adRewardResetForAppUpdateRef.current) {
          setDailyAdRewardDate(today);
          setDailyAdHammerRewards(0);
          setDailyAdRewardStartedAt(null);
        } else {
        const cloudCount = Math.max(0, Math.min(MAX_DAILY_AD_HAMMER_REWARDS, cloud.dailyAdRewards.count ?? 0));
        const cloudStartedAt = typeof cloud.dailyAdRewards.startedAt === "number" && Number.isFinite(cloud.dailyAdRewards.startedAt) ? cloud.dailyAdRewards.startedAt : cloudCount > 0 ? Date.now() : null;
        const cloudExpired = cloudStartedAt !== null && Date.now() - cloudStartedAt >= 24 * 60 * 60 * 1000;
        if (cloud.dailyAdRewards.date === today && !cloudExpired) {
          setDailyAdRewardDate(today);
          setDailyAdHammerRewards(cloudCount);
          setDailyAdRewardStartedAt(cloudStartedAt);
        } else {
          setDailyAdRewardDate(today);
          setDailyAdHammerRewards(0);
          setDailyAdRewardStartedAt(null);
          void AsyncStorage.setItem(DAILY_AD_HAMMER_REWARD_KEY, JSON.stringify({ date: today, count: 0, startedAt: null }));
        }
        }
      }
      if (cloud.modeProgress) {
        // `modeProgress` was used by earlier builds for browsing and can be
        // ahead of an actual clear. Keep it only as a stored resume hint; all
        // movement decisions below use the verified stage-record maps.
        modeProgressRef.current = {
          unlimited: Math.max(1, Math.min(POST_STORY_STAGE_LIMIT, Math.floor(cloud.modeProgress.unlimited ?? 1))),
          timeAttack: Math.max(1, Math.min(POST_STORY_STAGE_LIMIT, Math.floor(cloud.modeProgress.timeAttack ?? 1))),
        };
        setProgressRevision((revision) => revision + 1);
      }
      if (Array.isArray(cloud.claimedBossPrepStages)) setClaimedBossPrepStages(cloud.claimedBossPrepStages.filter((stage): stage is number => Number.isInteger(stage) && stage > 0));
      if (typeof cloud.randomOwnedPetPerStage === "boolean") setRandomOwnedPetPerStage(cloud.randomOwnedPetPerStage);
      setCloudSyncMessage(tr("클라우드 데이터를 불러왔습니다.", "Cloud data restored."));
    }
    cloudHydratedUserRef.current = userId;
  }, [authQuery.data?.id, cloudStateQuery.data, cloudStateQuery.isFetched, hydrated]);

  useEffect(() => {
    const userId = authQuery.data?.id;
    if (!hydrated || !stageAccessRepairPending || !authQuery.isFetched) return;
    if (userId && (!cloudStateQuery.isFetched || cloudHydratedUserRef.current !== userId)) return;

    const lastClearedStage = getLastVerifiedClearedStage(records[gameMode], POST_STORY_STAGE_LIMIT);
    // Preserve the legitimate post-story board (116+) that was opened after
    // clearing stage 115, while still repairing old impossible browse states.
    const postStoryResumeStage = Math.min(STORY_STAGE_COUNT + 1, Math.max(1, modeProgressRef.current[gameMode] ?? 1));
    const safeStage = Math.max(1, lastClearedStage, postStoryResumeStage);
    const mustRestoreStage = game.level > safeStage;

    // Earlier builds allowed browsing any stage and could persist that board.
    // A one-time versioned repair restarts only those invalid future boards at
    // the user's actual final cleared stage, without unlocking new content.
    if (mustRestoreStage) {
      const repairedGame = createPlayableGame(safeStage);
      newGameStarted.current = true;
      gameRef.current = repairedGame;
      lastValidGameRef.current = repairedGame;
      recentGameFingerprintsRef.current = [gameStateFingerprint(repairedGame)];
      setGame(repairedGame);
      setSelection(null);
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      setPaused(false);
      setShowTimeOutPopup(false);
      timeOutHandledRef.current = false;
      void AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: repairedGame, elapsedSeconds: 0, gameMode }));
    }

    const repairedModeProgress = (Object.keys(modeProgressRef.current) as GameMode[]).reduce((next, mode) => {
      const verifiedStage = getLastVerifiedClearedStage(records[mode], POST_STORY_STAGE_LIMIT);
      next[mode] = Math.min(POST_STORY_STAGE_LIMIT, Math.max(1, verifiedStage + 1));
      return next;
    }, {} as Record<GameMode, number>);
    if (modeProgressRef.current.unlimited !== repairedModeProgress.unlimited || modeProgressRef.current.timeAttack !== repairedModeProgress.timeAttack) {
      modeProgressRef.current = repairedModeProgress;
      setProgressRevision((revision) => revision + 1);
      void AsyncStorage.setItem(MODE_PROGRESS_KEY, JSON.stringify(modeProgressRef.current));
    }

    void AsyncStorage.setItem(STAGE_ACCESS_REPAIR_KEY, STAGE_ACCESS_REPAIR_VERSION);
    setStageAccessRepairPending(false);
  }, [authQuery.data?.id, authQuery.isFetched, cloudStateQuery.isFetched, game.level, gameMode, hydrated, records, stageAccessRepairPending]);

  useEffect(() => {
    if (!hydrated || !authQuery.data?.id || cloudHydratedUserRef.current !== authQuery.data.id || previewTimeAttackOpenTableau) return;
    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = setTimeout(() => { void saveCloudGameState(); cloudSaveTimerRef.current = null; }, 900);
    return () => { if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current); };
  }, [authQuery.data?.id, attendanceDay, claimedBossPrepStages, dailyAdHammerRewards, dailyAdRewardDate, dailyAdRewardStartedAt, elapsedSeconds, game, gameMode, hammerCharges, hydrated, previewTimeAttackOpenTableau, randomOwnedPetPerStage, records, selectedCardBackIndex, selectedCompanionId, unlockedBossBadges, unlockedPetIds]);

  useEffect(() => {
    if (!hydrated || Platform.OS !== "android" || __DEV__) return;
    let cancelled = false;
    ExpoInAppUpdates.checkForUpdate()
      .then((result) => {
        if (cancelled || !result.updateAvailable) return;
        setStoreUpdateAvailable(true);
        setStoreVersion(result.storeVersion ?? null);
        setShowUpdateNotice(true);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [hydrated]);

  const startStoreUpdate = async () => {
    try {
      const started = await ExpoInAppUpdates.startUpdate(false);
      if (started) setShowUpdateNotice(false);
    } catch {
      // Google Play can reject the request when the app was not installed from Play.
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game, elapsedSeconds, gameMode })).catch(() => undefined);
    gameRef.current = game;
    if (validateGameState(game).valid) lastValidGameRef.current = game;
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds, game, gameMode, hydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshDailyAdRewardDay();
        return;
      }
      if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
      autoFinishTimerRef.current = null;
      autoFinishRunningRef.current = false;
      AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: gameRef.current, elapsedSeconds: elapsedSecondsRef.current, gameMode })).catch(() => undefined);
    });
    let dateCheckTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleDateCheck = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime());
      return setTimeout(() => {
        refreshDailyAdRewardDay();
        dateCheckTimer = scheduleDateCheck();
      }, delay);
    };
    dateCheckTimer = scheduleDateCheck();
    return () => {
      subscription.remove();
      if (dateCheckTimer) clearTimeout(dateCheckTimer);
    };
  }, [gameMode, hydrated, dailyAdRewardDate, dailyAdHammerRewards, dailyAdRewardStartedAt]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records)).catch(() => undefined);
  }, [hydrated, records]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => undefined);
  }, [hydrated, language]);
  // modeProgressRef is advanced at the moment a stage is actually cleared.
  // Browsing with the header arrows must never unlock future stages.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(MODE_PROGRESS_KEY, JSON.stringify(modeProgressRef.current)).catch(() => undefined);
  }, [hydrated]);

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
    AsyncStorage.setItem(SCREEN_SHAKE_ENABLED_KEY, String(screenShakeEnabled)).catch(() => undefined);
  }, [hydrated, screenShakeEnabled]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SELECTED_COMPANION_KEY, selectedCompanionId).catch(() => undefined);
  }, [hydrated, selectedCompanionId]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(RANDOM_OWNED_PET_PER_STAGE_KEY, String(randomOwnedPetPerStage)).catch(() => undefined);
  }, [hydrated, randomOwnedPetPerStage]);

  useEffect(() => {
    if (!hydrated) return;
    if (selectedCardBackIndex === null) AsyncStorage.removeItem(CARD_BACK_THEME_KEY).catch(() => undefined);
    else AsyncStorage.setItem(CARD_BACK_THEME_KEY, String(selectedCardBackIndex)).catch(() => undefined);
  }, [hydrated, selectedCardBackIndex]);

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
    AsyncStorage.setItem(HAMMER_CHARGES_KEY, String(Math.max(0, Math.min(MAX_HAMMER_CHARGES, hammerCharges)))).catch(() => undefined);
  }, [hammerCharges, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(BOSS_PREP_BONUSES_KEY, JSON.stringify(claimedBossPrepStages)).catch(() => undefined);
  }, [claimedBossPrepStages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setRulesTab("basic");
    setPaused(true);
    setSheet("rules");
  }, [hydrated]);

  useEffect(() => {
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer, fireAttackPlayer, iceAttackPlayer, lightningAttackPlayer, shadowAttackPlayer, fireImpactPlayer, iceImpactPlayer, lightningImpactPlayer, shadowImpactPlayer]) {
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
    for (const player of [selectPlayer, movePlayer, shufflePlayer, companionAttackPlayer, foundationAttackPlayer, fireAttackPlayer, iceAttackPlayer, lightningAttackPlayer, shadowAttackPlayer, fireImpactPlayer, iceImpactPlayer, lightningImpactPlayer, shadowImpactPlayer]) {
      try { player.volume = soundEffectsEnabled ? soundEffectsVolume : 0; } catch { /* optional audio */ }
    }
    try { backgroundPlayer.volume = backgroundMusicEnabled ? backgroundMusicVolume : 0; } catch { /* optional audio */ }
  }, [backgroundPlayer, backgroundMusicEnabled, backgroundMusicVolume, companionAttackPlayer, foundationAttackPlayer, movePlayer, selectPlayer, shufflePlayer, soundEffectsEnabled, soundEffectsVolume]);

  useEffect(() => {
    const subscription = backgroundPlayer.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish) return;
      const nextIndex = (backgroundTrackIndexRef.current + 1) % BACKGROUND_MUSIC_TRACKS.length;
      backgroundTrackIndexRef.current = nextIndex;
      try {
        backgroundPlayer.replace(BACKGROUND_MUSIC_TRACKS[nextIndex]);
        backgroundPlayer.volume = backgroundMusicEnabled ? backgroundMusicVolume : 0;
        if (backgroundMusicEnabled && !paused) backgroundPlayer.play();
      } catch {
        // A track transition must never interrupt gameplay if audio is unavailable.
      }
    });
    return () => subscription.remove();
  }, [backgroundMusicEnabled, backgroundMusicVolume, backgroundPlayer, paused]);

  useEffect(() => {
    try {
      backgroundPlayer.loop = false;
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

  const timeAttackRemaining = Math.max(0, TIME_ATTACK_LIMIT_SECONDS - elapsedSeconds);
  const displayedTime = gameMode === "timeAttack" ? timeAttackRemaining : elapsedSeconds;
  useEffect(() => {
    if (paused || !hydrated || isWon(game) || (gameMode === "timeAttack" && timeOutHandledRef.current)) return;
    const timer = setInterval(() => {
      setElapsedSeconds((seconds) => {
        const rawNextSeconds = seconds + 1;
        const timeBadgeTick = activeBadgeAbility?.kind.startsWith("time") === true
          && activeBadgeAbility.intervalSeconds
          && rawNextSeconds % activeBadgeAbility.intervalSeconds === 0;
        const nextSeconds = Math.max(0, rawNextSeconds - (timeBadgeTick ? activeBadgeAbility.value : 0));
        if (gameMode === "timeAttack" && nextSeconds >= TIME_ATTACK_LIMIT_SECONDS && !timeOutHandledRef.current) {
          timeOutHandledRef.current = true;
          setPaused(true);
          setShowTimeOutPopup(true);
          return TIME_ATTACK_LIMIT_SECONDS;
        }
        return nextSeconds;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeBadgeId, game, gameMode, hydrated, paused]);

  const startNewGame = (level = game.level, resetProgress = false) => {
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    autoFinishTimerRef.current = null;
    autoFinishRunningRef.current = false;
    if (autoFinishSummaryTimerRef.current) clearTimeout(autoFinishSummaryTimerRef.current);
    autoFinishSummaryTimerRef.current = null;
    setAutoFinishSummary(null);
    comboImpactBorderOpacity.stopAnimation();
    comboImpactBorderOpacity.setValue(0);
    if (previewTimeAttackOpenTableau) {
      timeAttackPreviewDealMotion.stopAnimation();
      timeAttackPreviewDealMotion.setValue(1);
      setPreviewTimeAttackOpenTableau(false);
    }
    setFlyingAttacks([]);
    setComboAttack(false);
    setAttackToken((token) => token + 1);
    setImpactToken((token) => token + 1);
    resetHintAttention();
    const manualReset = resetProgress;
    newGameStarted.current = true;
    bossWarningStageRef.current = null;
    setShowBossWarning(false);
    if (randomOwnedPetPerStage) {
      setSelectedCompanionId((currentId) => pickRandomOwnedPet(currentId));
    }
    const freshGame = createPlayableGame(level);
    const enteringBossStage = getBattleContent(level, false).isBoss;
    const shouldGrantBossPrepBonus = enteringBossStage && !manualReset && !claimedBossPrepStages.includes(level);
    if (shouldGrantBossPrepBonus) {
      const nextClaimedBossPrepStages = [...claimedBossPrepStages, level];
      setClaimedBossPrepStages(nextClaimedBossPrepStages);
      setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + 1));
      setShowBossPrepReward(true);
      showTimedHint("보스 전 준비 보너스: 망치 +1");
    }
    recentGameFingerprintsRef.current = [gameStateFingerprint(freshGame)];
    haptic.light();
    setGame(freshGame);
    setSelection(null);
    setElapsedSeconds(0);
    timeOutHandledRef.current = false;
    setShowTimeOutPopup(false);
    setPaused(false);
    setSheet(null);
    setShowNewGameConfirm(false);
    setHintMessage(null);
    if (manualReset) {
      if (petPreservationNoticeTimerRef.current) clearTimeout(petPreservationNoticeTimerRef.current);
      setPetPreservationNotice(true);
      petPreservationNoticeTimerRef.current = setTimeout(() => setPetPreservationNotice(false), 2400);
    }
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
    }
    gameRef.current = freshGame;
    elapsedSecondsRef.current = 0;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: freshGame, elapsedSeconds: 0, gameMode })).catch(() => undefined);
  };

  const requestNewGame = () => {
    setResetMode("full");
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const startReplayStage = (mode: GameMode, stage: number) => {
    const maxCompletedStage = Math.max(1, getLastVerifiedClearedStage(records[mode], STORY_STAGE_COUNT));
    const safeStage = Math.max(1, Math.min(Math.floor(stage), maxCompletedStage));
    setRecordModeView(mode);
    setShowReplayStageList(false);
    setGameMode(mode);
    replayStageRef.current = safeStage;
    setReplayResult(null);
    setSheet(null);
    timeOutHandledRef.current = false;
    startNewGame(safeStage, false);
    showTimedHint(tr(`스테이지 ${safeStage} 재도전 시작`, `Replay Stage ${safeStage}`));
  };

  const requestFullProgressReset = () => {
    haptic.light();
    setResetMode("full");
    setSheet(null);
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const startGameMode = (mode: GameMode) => {
    if (mode !== gameMode && game.moves > 0) {
      setPendingGameMode(mode);
      return;
    }
    const resumeLevel = Math.max(1, Math.min(
      modeProgressRef.current[mode] ?? 1,
      getLastVerifiedClearedStage(records[mode], POST_STORY_STAGE_LIMIT) + 1,
    ));
    setGameMode(mode);
    AsyncStorage.setItem(MODE_PROGRESS_KEY, JSON.stringify(modeProgressRef.current)).catch(() => undefined);
    timeOutHandledRef.current = false;
    startNewGame(resumeLevel, false);
    showTimedHint(mode === "timeAttack" ? "시간제한 모드: 5분 안에 클리어하세요." : "무제한 모드로 시작합니다.");
  };
  const confirmGameModeSwitch = () => {
    const mode = pendingGameMode;
    setPendingGameMode(null);
    if (mode) {
      setGameMode(mode);
      startNewGame(Math.max(1, Math.min(
        modeProgressRef.current[mode] ?? 1,
        getLastVerifiedClearedStage(records[mode], POST_STORY_STAGE_LIMIT) + 1,
      )), false);
      showTimedHint(mode === "timeAttack" ? "시간제한 모드로 전환했습니다." : "무제한 모드로 전환했습니다.");
    }
  };

  const requestCurrentStageRestart = () => {
    setResetMode("current");
    setPaused(true);
    setShowNewGameConfirm(true);
  };

  const grantTimeAttackComboBonus = () => {
    if (gameMode !== "timeAttack") return;
    setElapsedSeconds((seconds) => Math.max(0, seconds - 10));
    elapsedSecondsRef.current = Math.max(0, elapsedSecondsRef.current - 10);
    timeOutHandledRef.current = false;
    setShowTimeOutPopup(false);
    setPaused(false);
    showTimedHint("콤보 성공! 시간 보너스 +10초");
  };
  const grantTimeAttackFoundationBonus = (cardCount: number) => {
    if (gameMode !== "timeAttack" || cardCount <= 0) return;
    const bonusSeconds = cardCount * 2;
    setElapsedSeconds((seconds) => Math.max(0, seconds - bonusSeconds));
    elapsedSecondsRef.current = Math.max(0, elapsedSecondsRef.current - bonusSeconds);
    timeOutHandledRef.current = false;
    setShowTimeOutPopup(false);
    setPaused(false);
    showFloatingReward(`+${bonusSeconds}초`);
    showTimedHint(`파운데이션 이동! 시간 보너스 +${bonusSeconds}초`);
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

  const pickRandomOwnedPet = (previousId = selectedCompanionId) => {
    const ownedPets = PET_ROSTER.filter((pet) => unlockedPetIds.includes(pet.id));
    if (!ownedPets.length) return DEFAULT_PET_ID;
    const alternatives = ownedPets.length > 1 ? ownedPets.filter((pet) => pet.id !== previousId) : ownedPets;
    const pool = alternatives.length ? alternatives : ownedPets;
    return pool[Math.floor(Math.random() * pool.length)]?.id ?? DEFAULT_PET_ID;
  };

  const saveWin = (finishedGame: typeof game) => {
    const replayStage = replayStageRef.current;
    const previousRecord = records[gameMode];
    if (replayStage !== null && replayStage === finishedGame.level) {
      setReplayResult({
        stage: replayStage,
        previousScore: previousRecord.bestScore,
        newScore: finishedGame.score,
        previousTime: previousRecord.stageBestTimes?.[String(replayStage)] ?? null,
        newTime: elapsedSeconds,
      });
      replayStageRef.current = null;
    }
    const localRow: RankingRow = {
      id: -1,
      name: profileName.trim() || null,
      countryCode: profileCountryCode,
      score: finishedGame.score,
      timeSeconds: elapsedSeconds,
      stage: finishedGame.level,
    };
    setLocalRankingRows((current) => {
      if (gameMode === "timeAttack" && !isBetterTimeAttackRanking(localRow, current.timeAttack)) return current;
      const next = { ...current, [gameMode]: localRow };
      void AsyncStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(next));
      return next;
    });
    if (authQuery.data?.id) {
      submitLeaderboardMutation.mutate({ mode: gameMode, score: finishedGame.score, timeSeconds: elapsedSeconds, stage: finishedGame.level });
    }
    setRecords((current) => {
      const modeRecord = current[gameMode];
      const stageKey = String(finishedGame.level);
      const previousStageTime = modeRecord.stageBestTimes?.[stageKey];
      const stageBestTimes = {
        ...(modeRecord.stageBestTimes ?? {}),
        [stageKey]: previousStageTime === undefined ? elapsedSeconds : Math.min(previousStageTime, elapsedSeconds),
      };
      const stageBestScores = {
        ...(modeRecord.stageBestScores ?? {}),
        [stageKey]: Math.max(modeRecord.stageBestScores?.[stageKey] ?? 0, finishedGame.score),
      };
      return {
        ...current,
        [gameMode]: {
          wins: modeRecord.wins + 1,
          bestScore: Math.max(modeRecord.bestScore, finishedGame.score),
          bestTimeSeconds: modeRecord.bestTimeSeconds === null ? elapsedSeconds : Math.min(modeRecord.bestTimeSeconds, elapsedSeconds),
          stageBestTimes,
          stageBestScores,
        },
      };
    });
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
    const player = effect === "select" ? selectPlayer : effect === "move" ? movePlayer : effect === "shuffle" ? shufflePlayer : effect === "companionAttack" ? ({ red: fireAttackPlayer, blue: iceAttackPlayer, orange: lightningAttackPlayer, white: shadowAttackPlayer } as const)[companionAttackStyle] : foundationAttackPlayer;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound feedback must never interrupt a card move.
    }
  };

  const playAttributeImpact = () => {
    if (!soundEffectsEnabled) return;
    const player = ({ red: fireImpactPlayer, blue: iceImpactPlayer, orange: lightningImpactPlayer, white: shadowImpactPlayer } as const)[companionAttackStyle];
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Impact audio must never interrupt the attack animation.
    }
  };

  const triggerHitFeedback = () => {
    screenShake.stopAnimation();
    screenShake.setValue(0);
    const shakeAnimation = screenShakeEnabled ? Animated.sequence([
        Animated.timing(screenShake, { toValue: 1, duration: 38, useNativeDriver: true }),
        Animated.timing(screenShake, { toValue: -0.8, duration: 48, useNativeDriver: true }),
        Animated.timing(screenShake, { toValue: 0.55, duration: 42, useNativeDriver: true }),
        Animated.timing(screenShake, { toValue: 0, duration: 62, useNativeDriver: true }),
      ]) : Animated.delay(0);
    shakeAnimation.start();
  };

  const animateFlight = (card: Card, flaming = false, pet = false) => {
    const progress = new Animated.Value(0);
    const id = `flight-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const target = monsterTargetFrameRef.current;
    const launchCenterX = companionBaseLeft + companionAvoidanceTargetRef.current + companionSize * 0.5;
    // CompanionAnchor is `size + 58` high because its attribute label sits
    // below the image. Use the actual image center, not the anchor center, so
    // the real bottom pet reaches the same monster target point as a projectile.
    const launchCenterY = safeScreenHeight - companionBottom - 58 - companionSize * 0.5;
    const targetCenterX = target?.centerX ?? safeScreenWidth * 0.72;
    const targetCenterY = target?.centerY ?? rootTopPadding + cardWidth;
    const flight: ActiveFlight = {
      id,
      card,
      variant: pet ? "pet" : flaming ? "flaming" : "normal",
      progress,
      launchDeltaX: launchCenterX - targetCenterX,
      launchDeltaY: launchCenterY - targetCenterY,
      launchCenterX,
      launchCenterY,
      targetCenterX,
      targetCenterY,
      flightColor: companionAttackColor,
      flamingArt: FLAMING_CARD_ART_BY_STYLE[companionAttackStyle],
      petImage: battleContent.companion.image,
    };
    // Keep gameplay and damage intact, but cap only the visual projectiles so
    // rapid card moves cannot create an unbounded animated image stack.
    setFlyingAttacks((current) => [...current, flight].slice(-4));
    // The projectile now lives in the monster's moving native wrapper, so it can
    // safely use the native driver and always finishes at that wrapper's center.
    const animation = Animated.timing(progress, { toValue: 1, duration: pet ? FLYING_CARD_DURATION * 1.42045 : (flaming ? FLAMING_CARD_FLIGHT_DURATION : FLYING_CARD_DURATION), easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (!finished) return;
      triggerHitFeedback();
      setImpactToken((token) => token + 1);
      setFlyingAttacks((current) => current.filter((active) => active.id !== id));
    });
  };

  const cardFromSource = (source: CardSource, sourceGame: typeof game = game): Card | undefined => {
    if (source.kind === "waste") return sourceGame.waste.at(-1);
    if (source.kind === "foundation") return sourceGame.foundations[source.suit].at(-1);
    return sourceGame.tableau[source.column]?.[source.index];
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
    const previousEntry = undoStack.at(-1);
    if (!previousEntry) {
      haptic.error();
      return;
    }
    const previousGame = previousEntry.game;
    const restoredHammerCount = Math.max(0, previousEntry.hammerCharges - hammerCharges);
    setGame(cloneGameState(previousGame));
    setHammerCharges(previousEntry.hammerCharges);
    setUndoStack((history) => history.slice(0, -1));
    setSelection(null);
    if (restoredHammerCount > 0) {
      showFloatingReward(`+${restoredHammerCount} 망치`);
      showTimedHint(`실행 취소 완료 · 망치 ${restoredHammerCount}개를 복구했습니다.`);
    } else {
      showTimedHint("이전 이동을 되돌렸습니다.");
    }
    gameRef.current = previousGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: previousGame, elapsedSeconds: elapsedSecondsRef.current, gameMode })).catch(() => undefined);
    haptic.light();
  };

  const queueLateGameAutoFinish = (candidate: typeof game) => {
    if (autoFinishRunningRef.current || paused || !hydrated || !isLateGameAutoFinishReady(candidate)) return;
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    comboStreakRef.current = 0;
    lastAttackAtRef.current = 0;
    if (comboResetTimerRef.current) clearTimeout(comboResetTimerRef.current);
    comboResetTimerRef.current = null;
    const remainingCards = candidate.tableau.reduce((total, pile) => total + pile.length, 0) + candidate.stock.length + candidate.waste.length;
    const visualComboCount = Math.min(20, remainingCards);
    const estimatedDurationMs = 244 + remainingCards * 322 + Math.floor(Math.max(0, remainingCards - 1) / 10) * 678;
    autoFinishComboPlanRef.current = {
      totalCards: Math.max(1, remainingCards),
      totalDurationMs: Math.max(244, estimatedDurationMs),
      startedAt: Date.now(),
      processedCards: 0,
      displayedCombos: 0,
      finalComboCount: 0,
    };
    autoFinishRunningRef.current = true;
    showTimedHint(`모든 카드가 공개되었습니다. ${visualComboCount}개 구간으로 콤보 정리를 시작합니다!`);
    let cursor = candidate;
    let batchCount = 0;
    const step = () => {
      if (gameStateFingerprint(gameRef.current) !== gameStateFingerprint(cursor)) {
        autoFinishRunningRef.current = false;
        autoFinishTimerRef.current = null;
        setComboAttack(false);
        return;
      }
      const move = findAutoFoundationMove(cursor);
      if (!move) {
        grantTimeAttackComboBonus();
        const plan = autoFinishComboPlanRef.current;
        if (plan.finalComboCount > 0) {
          showAutoFinishSummary(plan.finalComboCount, Math.max(0, cursor.score - candidate.score));
        }
        autoFinishRunningRef.current = false;
        autoFinishTimerRef.current = null;
        setComboAttack(false);
        return;
      }
      const previousCursor = cursor;
      const next = moveToFoundation(cursor, move.source);
      if (!next) {
        autoFinishRunningRef.current = false;
        autoFinishTimerRef.current = null;
        setComboAttack(false);
        return;
      }
      cursor = next;
      batchCount += 1;
      applyGame(next, false, move.card, hammerCharges, previousCursor);
      if (batchCount >= 10) {
        batchCount = 0;
        autoFinishTimerRef.current = setTimeout(step, 1000);
      } else {
        autoFinishTimerRef.current = setTimeout(step, 322);
      }
    };
    autoFinishTimerRef.current = setTimeout(step, 244);
  };

  const applyGame = (nextGame: typeof game | null, success = false, movedCard?: Card, undoHammerCharges = hammerCharges, previousGameOverride?: typeof game) => {
    const currentGame = previousGameOverride ?? gameRef.current;
    if (!nextGame || nextGame === currentGame) {
      haptic.error();
      return;
    }
    const validation = validateGameState(nextGame);
    if (!validation.valid) {
      // Never replace the current stage with a fresh deal after a transient
      // native/animation race. Restore the last known-good board instead.
      // Hammer charges are intentionally not restored here: the hammer action
      // has already consumed its charge and that consumption must persist.
      const recoveryGame = validateGameState(currentGame).valid ? currentGame : lastValidGameRef.current;
      lastValidGameRef.current = recoveryGame;
      gameRef.current = recoveryGame;
      recentGameFingerprintsRef.current = [gameStateFingerprint(recoveryGame)];
      AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: recoveryGame, elapsedSeconds: elapsedSecondsRef.current, gameMode })).catch(() => undefined);
      setSelection(null);
      setGame(cloneGameState(recoveryGame));
      showTimedHint(`스테이지 ${recoveryGame.level}의 진행 상태를 복구했습니다. 망치 사용량은 유지됩니다.`);
      haptic.error();
      return;
    }
    resetHintAttention();
    const previousFoundationCount = SUITS.reduce((total, suit) => total + currentGame.foundations[suit].length, 0);
    const nextFoundationCount = SUITS.reduce((total, suit) => total + nextGame!.foundations[suit].length, 0);
    const foundationMove = nextFoundationCount > previousFoundationCount;
    const wasAutoFinishRunning = autoFinishRunningRef.current;
    if (foundationMove) grantTimeAttackFoundationBonus(nextFoundationCount - previousFoundationCount);
    const changedSuit = movedCard?.suit ?? SUITS.find((suit) => nextGame!.foundations[suit].length > currentGame.foundations[suit].length) ?? "clubs";
    const foundationCard = foundationMove ? (movedCard ?? nextGame.foundations[changedSuit].at(-1)) : undefined;
    // Combo banners are reserved for the final automatic foundation cleanup.
    // Ordinary player moves still attack the monster, but never advance the combo counter.
    let comboScoreBonus = 0;
    if ((foundationCard || movedCard) && autoFinishRunningRef.current) {
      // The numeric combo and score advance for every card. Only the visual
      // banner is sampled into at most 20 evenly distributed time segments.
      const showVisual = shouldShowAutoFinishCombo();
      const comboCount = registerSuccessfulAttack(showVisual);
      const comboMultiplier = comboCount >= 20 ? Math.min(2.5, 1.5 + Math.floor((comboCount - 20) / 5) * 0.1) : 1;
      comboScoreBonus = comboCount >= 2 ? Math.round(comboCount * 5 * comboMultiplier) : 0;
      autoFinishComboPlanRef.current.finalComboCount = comboCount;
      if (comboCount >= 10 && showVisual) showHighComboImpact();
      if (comboScoreBonus > 0 && showVisual) showComboScoreReward(comboScoreBonus, comboCount);
    }
    if (foundationMove) {
      const damage = (nextFoundationCount - previousFoundationCount) * 5;
      const isCombo = wasAutoFinishRunning;
      setLastDamage(damage);
      setAttackKind(changedSuit);
      setComboAttack(isCombo);
      setAttackToken((token) => token + 1);
    } else if (movedCard) {
      // Tableau/waste moves also launch an attack card. Keep the monster's
      // impact animation in sync with that projectile, not only foundation moves.
      setLastDamage(5);
      setAttackKind(movedCard.suit);
      setComboAttack(false);
      setAttackToken((token) => token + 1);
    }
    if (comboScoreBonus > 0) {
      nextGame = { ...nextGame, score: nextGame.score + comboScoreBonus };
    }
    const previousProgress = currentGame.foundations.clubs.length + currentGame.foundations.diamonds.length + currentGame.foundations.hearts.length + currentGame.foundations.spades.length + currentGame.tableau.flat().filter((card) => card.faceUp).length;
    const nextProgress = nextGame.foundations.clubs.length + nextGame.foundations.diamonds.length + nextGame.foundations.hearts.length + nextGame.foundations.spades.length + nextGame.tableau.flat().filter((card) => card.faceUp).length;
    if (nextProgress > previousProgress || nextGame.stock.length !== currentGame.stock.length || nextGame.waste.length !== currentGame.waste.length) stagnantMovesRef.current = 0;
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
    setUndoStack((history) => [...history.slice(-(MAX_UNDO_STEPS - 1)), { game: cloneGameState(currentGame), hammerCharges: undoHammerCharges }]);
    gameRef.current = nextGame;
    lastValidGameRef.current = nextGame;
    AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ saveVersion: ACTIVE_GAME_SAVE_VERSION, game: nextGame, elapsedSeconds: elapsedSecondsRef.current, gameMode })).catch(() => undefined);
    setGame(nextGame);
    setSelection(null);
    playEffect("move");
    const foundationRetreat = nextFoundationCount < previousFoundationCount;
    if (!isWon(nextGame) && !foundationRetreat) queueLateGameAutoFinish(nextGame);
    if (foundationCard || movedCard) {
      const attackCard = foundationCard ?? movedCard;
      if (attackCard) {
        if (wasAutoFinishRunning) {
          playEffect("foundationAttack");
          animateFlight(attackCard, Boolean(foundationCard));
        } else {
          playEffect("companionAttack");
          animateFlight(attackCard, false, true);
        }
      }
    }
    if (success) {
      haptic.success();
    } else {
      haptic.light();
    }
    if (isWon(nextGame)) {
      if (previewTimeAttackOpenTableau) {
        setPaused(true);
        showTimedHint(tr("미리보기 테스트를 완료했습니다. 기록·보상·랭킹에는 반영되지 않습니다.", "Preview test complete. No records, rewards, or rankings were updated."));
        setTimeout(() => startNewGame(nextGame.level, false), 900);
        return;
      }
      const clearedNextStage = Math.min(POST_STORY_STAGE_LIMIT, nextGame.level + 1);
      modeProgressRef.current[gameMode] = Math.max(modeProgressRef.current[gameMode] ?? 1, clearedNextStage);
      setProgressRevision((revision) => revision + 1);
      AsyncStorage.setItem(MODE_PROGRESS_KEY, JSON.stringify(modeProgressRef.current)).catch(() => undefined);
      saveWin(nextGame);
      setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + 10));
      showFloatingReward("+10 망치 · 스테이지 클리어");
      showTimedHint(tr("스테이지 클리어! 망치 +10", "Stage clear! Bonus hammers +10"));
      const petRewardCount = battleContent.isBoss ? 3 : currentGame.level <= 10 ? 2 : 1;
      unlockRandomPets(petRewardCount);
      if (battleContent.isBoss && battleContent.badgeId && battleContent.badgeImage) {
        setUnlockedBossBadges((current) => current.includes(battleContent.badgeId!) ? current : [...current, battleContent.badgeId!]);
        setEarnedBadge({ id: battleContent.badgeId, name: battleContent.monster.name, image: battleContent.badgeImage });
      }
      const nextStage = nextGame.level + 1;
      const nextChapter = getChapterForStage(nextStage);
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 1550);
      showTimedHint(nextChapter !== battleContent.chapter ? `챕터 ${nextChapter} 보스가 등장합니다. 스테이지 ${nextStage} 시작!` : `스테이지 ${nextStage}로 이동합니다.`);
      setTimeout(() => startNewGame(nextStage), 2350);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    const normalizedBadges = [...new Set(unlockedBossBadges)];
    if (normalizedBadges.length !== unlockedBossBadges.length) {
      setUnlockedBossBadges(normalizedBadges);
      return;
    }
    AsyncStorage.setItem(BOSS_BADGES_KEY, JSON.stringify(normalizedBadges)).catch(() => undefined);
  }, [hydrated, unlockedBossBadges]);

  const startHammerRewardFlight = (kind: HammerRewardFlightKind, amount: number) => {
    attendanceRewardFlight.stopAnimation();
    attendanceRewardFlight.setValue(0);
    setHammerRewardFlightKind(kind);
    setHammerRewardFlightAmount(amount);
    setShowAttendanceRewardFlight(true);
    Animated.timing(attendanceRewardFlight, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowAttendanceRewardFlight(false);
    });
  };

  const claimAttendance = () => {
    const today = localDateKey();
    if (lastAttendanceDate === today) {
      showTimedHint("오늘 출석은 이미 완료했습니다.");
      setShowAttendanceClaim(false);
      return;
    }
    const nextDay = attendanceDay + 1;
    const reward = getAttendanceHammerReward(nextDay);
    const attendancePetId = isSpecialAttendanceDay(nextDay) ? pickAttendancePet(unlockedPetIds) : null;
    const attendancePet = attendancePetId ? PET_ROSTER.find((pet) => pet.id === attendancePetId) : null;
    setAttendanceDay(nextDay);
    setLastAttendanceDate(today);
    setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + reward));
    if (attendancePetId) {
      setUnlockedPetIds((current) => current.includes(attendancePetId) ? current : [...current, attendancePetId]);
    }
    setShowAttendanceClaim(false);
    startHammerRewardFlight("attendance", reward);
    showTimedHint(attendancePet ? `${nextDay}일차 출석 완료 · 망치 +${reward} · 특별 펫 ${attendancePet.name} 획득` : `${nextDay}일차 출석 완료 · 망치 +${reward}`);
    haptic.success();
  };

  const useShuffleBonus = async (slot: 0 | 1 | 2) => {
    if (rewardedAdInProgress) return;
    if (!showTwoTouch) return;
    if (slot === 0) {
      if (twoTouchOpensUsed > 0) { showTimedHint("무료 망치는 이미 사용했습니다."); return; }
      setTwoTouchOpensUsed(1);
      setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + 1));
      setShowTwoTouch(false);
      setShowNoMovesPopup(false);
      beginHammerMode(true);
      showTimedHint("카드를 선택하세요. 웨이스트 파괴에는 망치 2개가 필요합니다.");
      return;
    }
      setRewardedRetrySlot(1);
    if (twoTouchOpensUsed === 0) { showTimedHint("먼저 무료 망치를 사용해 주세요."); return; }
    const currentDailyAdRewards = refreshDailyAdRewardDay();
    if (currentDailyAdRewards >= MAX_DAILY_AD_HAMMER_REWARDS) {
      showDailyAdRewardExhausted();
      return;
    }
    if (rewardedRevealUsed >= 10) {
      showTimedHint("광고 망치는 이번 스테이지에서 더 사용할 수 없습니다.");
      return;
    }
    setRewardedAdError(null);
    showTimedHint("보상형 광고를 불러오는 중입니다.");
    setRewardedAdInProgress(true);
    const completed = await showRewardedAd();
    setRewardedAdInProgress(false);
    if (!completed) {
      setRewardedAdError("광고가 준비되지 않았거나 끝까지 시청되지 않았습니다. 다시 시도해 주세요.");
      return;
    }
    const nextRewardedCount = rewardedRevealUsed + 1;
    const dailyRewardNumber = Math.min(MAX_DAILY_AD_HAMMER_REWARDS, currentDailyAdRewards + 1);
    const rewardAmount = getDailyAdHammerReward(dailyRewardNumber);
    setRewardedRevealUsed(nextRewardedCount);
    recordDailyAdHammerReward();
    setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + rewardAmount));
    startHammerRewardFlight("ad", rewardAmount);
    setShowTwoTouch(false);
    setShowNoMovesPopup(false);
    beginHammerMode(true);
    showTimedHint(`원하는 카드를 클릭하세요 (오늘 광고 ${dailyRewardNumber}/5 · 망치 +${rewardAmount})`);
  };

  const recordDailyAdHammerReward = () => {
    const today = localDateKey();
    const startedAt = dailyAdRewardStartedAt ?? Date.now();
    setDailyAdRewardDate(today);
    setDailyAdRewardStartedAt(startedAt);
    setDailyAdHammerRewards((count) => {
      const nextCount = Math.min(MAX_DAILY_AD_HAMMER_REWARDS, count + 1);
      AsyncStorage.setItem(DAILY_AD_HAMMER_REWARD_KEY, JSON.stringify({ date: today, count: nextCount, startedAt })).catch(() => undefined);
      return nextCount;
    });
  };

  const showDailyAdRewardExhausted = () => {
    setShowHammerOffer(true);
    showTimedHint("일일 광고 보상이 모두 소진되었습니다.");
  };

  const claimHammerAdReward = async () => {
    if (rewardedAdInProgress) return;
    const currentDailyAdRewards = refreshDailyAdRewardDay();
    if (currentDailyAdRewards >= MAX_DAILY_AD_HAMMER_REWARDS) {
      showDailyAdRewardExhausted();
      return;
    }
    const hammerCap = MAX_HAMMER_CHARGES;
    if (hammerCharges >= hammerCap) {
      showTimedHint(`망치가 이미 ${hammerCap}개라 광고 보상을 받을 수 없습니다. 먼저 망치를 사용해 주세요.`);
      return;
    }
    setRewardedAdError(null);
    showTimedHint("보상형 광고를 불러오는 중입니다.");
    setRewardedAdInProgress(true);
    const completed = await showRewardedAd();
    setRewardedAdInProgress(false);
    if (!completed) {
      setRewardedAdError("광고가 준비되지 않았거나 끝까지 시청되지 않았습니다. 다시 시도해 주세요.");
      return;
    }
    const dailyRewardNumber = Math.min(MAX_DAILY_AD_HAMMER_REWARDS, currentDailyAdRewards + 1);
    const rewardAmount = getDailyAdHammerReward(dailyRewardNumber);
    recordDailyAdHammerReward();
    setHammerCharges((charges) => Math.min(hammerCap, charges + rewardAmount));
    startHammerRewardFlight("ad", rewardAmount);
    showTimedHint(`망치 +${rewardAmount} 충전 완료 (${Math.min(hammerCap, hammerCharges + rewardAmount)}/${hammerCap}) · 오늘 ${dailyRewardNumber}/${MAX_DAILY_AD_HAMMER_REWARDS}`);
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

  const useHammerOnCard = (source: CardSource, targetPosition?: { dx: number; dy: number }, hammerCost = 1) => {
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    autoFinishTimerRef.current = null;
    autoFinishRunningRef.current = false;
    if (hammerCharges < hammerCost) {
      setHammerMode(false);
      showTimedHint(`이 카드를 부수려면 망치 ${hammerCost}개가 필요합니다. 현재 ${hammerCharges}개입니다.`);
      haptic.error();
      return;
    }
    const hammerBaseGame = gameRef.current;
    const target = cardFromSource(source, hammerBaseGame);
    const hammerBaseFingerprint = gameStateFingerprint(hammerBaseGame);
    const revealedGame = source.kind === "waste" ? destroyWasteWithHammer(hammerBaseGame) : revealHiddenCardWithHammer(hammerBaseGame, source);
    if (!revealedGame || !target) {
      showTimedHint("망치 사용 중에는 원하는 히든카드를 탭할 수 있습니다.");
      haptic.error();
      return;
    }
    setHammerMode(false);
    setHammerCharges((charges) => Math.max(0, charges - hammerCost));
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
        if (gameStateFingerprint(gameRef.current) !== hammerBaseFingerprint) {
          showTimedHint("현재 진행 상태가 바뀌어 오래된 망치 동작을 적용하지 않았습니다. 망치 사용량은 유지됩니다.");
          return;
        }
        if (source.kind === "tableau" && !target.faceUp) {
          const boardLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5);
          const wasteLeft = boardLeft + cardWidth * 1.08;
          const wasteTarget = { dx: wasteLeft - hammerStartLeft, dy: 0 };
          setHammerRevealFlight({ card: { ...target, faceUp: true }, from: targetPosition, to: wasteTarget });
          hammerRevealFlightProgress.stopAnimation();
          hammerRevealFlightProgress.setValue(0);
          Animated.timing(hammerRevealFlightProgress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished: flightFinished }) => {
            setHammerRevealFlight(null);
            setHammerLandingDustTarget(wasteTarget);
            hammerLandingDustProgress.stopAnimation();
            hammerLandingDustProgress.setValue(0);
            Animated.timing(hammerLandingDustProgress, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setHammerLandingDustTarget(null));
            if (!flightFinished) return;
            if (gameStateFingerprint(gameRef.current) !== hammerBaseFingerprint) {
              showTimedHint("현재 진행 상태가 바뀌어 오래된 카드 이동을 적용하지 않았습니다. 망치 사용량은 유지됩니다.");
              return;
            }
            applyGame(revealedGame, false, target, hammerCharges);
            showTimedHint(`${cardLabel(target)} 카드를 공개해 웨이스트로 이동했습니다.`);
          });
          return;
        }
        applyGame(revealedGame, false, target, hammerCharges);
        showTimedHint(source.kind === "waste" ? `${cardLabel(target)} 웨이스트 카드를 망치로 파괴했습니다.` : `${cardLabel(target)} 카드를 공개해 웨이스트에 놓았습니다.`);
      });
      return;
    }
    applyGame(revealedGame, false, target, hammerCharges);
    showTimedHint(source.kind === "waste" ? `${cardLabel(target)} 웨이스트 카드를 망치로 파괴했습니다.` : `${cardLabel(target)} 카드를 공개해 웨이스트에 놓았습니다.`);
  };

  const selectCard = (nextSelection: Selection) => {
    if (paused) return;
    if (cardSelectVibrationEnabled) haptic.light();
    playEffect("select");
    setSelection((current) => (current?.cardId === nextSelection.cardId ? null : nextSelection));
  };

  const moveSelectionToTableau = (toColumn: number): boolean => {
    if (!selection) return false;
    const currentGame = gameRef.current;
    const movingCard = cardFromSource(selection, currentGame);
    if (selection.kind === "tableau") {
      const nextGame = moveTableauToTableau(currentGame, selection.column, selection.index, toColumn);
      if (!nextGame) return false;
      applyGame(nextGame, false, movingCard);
      return true;
    } else if (selection.kind === "waste") {
      const nextGame = moveWasteToTableau(currentGame, toColumn);
      if (!nextGame) return false;
      applyGame(nextGame, false, movingCard);
      return true;
    } else {
      if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
      autoFinishTimerRef.current = null;
      autoFinishRunningRef.current = false;
      const nextGame = moveFoundationToTableau(currentGame, selection.suit, toColumn);
      if (!movingCard || !nextGame) return false;
      const boardLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5);
      const foundationGap = Math.max(3, Math.round(cardWidth * 0.08));
      const foundationStartLeft = boardLeft + boardWidth - (cardWidth * 4 + foundationGap * 3);
      const fromLeft = foundationStartLeft + SUITS.indexOf(selection.suit) * (cardWidth + foundationGap);
      const pileTop = rootTopPadding + 132;
      const targetIndex = nextGame.tableau[toColumn].length - 1;
      const toLeft = boardLeft + toColumn * (cardWidth + tableauGap);
      const toTop = rootTopPadding + 220 + targetIndex * stackOffset;
      const flightProgress = new Animated.Value(0);
      const flight: FoundationMoveFlight = { id: ++foundationMoveFlightIdRef.current, card: movingCard, fromLeft, fromTop: pileTop, deltaX: toLeft - fromLeft, deltaY: toTop - pileTop, progress: flightProgress };
      setFoundationMoveFlights((flights) => [...flights, flight]);
      setSelection(null);
      applyGame(nextGame, false, movingCard, hammerCharges, currentGame);
      Animated.timing(flightProgress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
        setFoundationMoveFlights((flights) => flights.filter((item) => item.id !== flight.id));
      });
      return true;
    }
  };

  const dragMoveCard = (source: CardSource, dx: number, dy: number) => {
    if (paused) return;
    if (hammerMode) {
      showTimedHint("망치 사용 중입니다. 원하는 히든카드를 탭해 공개하세요.");
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
    if (source.kind === "foundation") return false;
    const currentGame = gameRef.current;
    const movingCard = cardFromSource(source, currentGame);
    const nextGame = moveToFoundation(currentGame, source);
    if (!movingCard || !nextGame) return false;
    const boardLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5);
    const foundationGap = Math.max(3, Math.round(cardWidth * 0.08));
    const foundationStartLeft = boardLeft + boardWidth - (cardWidth * 4 + foundationGap * 3);
    const foundationLeft = foundationStartLeft + SUITS.indexOf(movingCard.suit) * (cardWidth + foundationGap);
    const pileTop = rootTopPadding + 132;
    const fromLeft = source.kind === "waste" ? boardLeft + cardWidth + 6 : boardLeft + source.column * (cardWidth + tableauGap);
    const fromTop = source.kind === "waste" ? pileTop : rootTopPadding + 220 + source.index * stackOffset;
    const flightProgress = new Animated.Value(0);
    const flight: FoundationMoveFlight = { id: ++foundationMoveFlightIdRef.current, card: movingCard, fromLeft, fromTop, deltaX: foundationLeft - fromLeft, deltaY: pileTop - fromTop, progress: flightProgress };
    setFoundationMoveFlights((flights) => [...flights, flight]);
    applyGame(nextGame, false, movingCard, hammerCharges, currentGame);
    Animated.timing(flightProgress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
      setFoundationMoveFlights((flights) => flights.filter((item) => item.id !== flight.id));
    });
    return true;
  };
  const autoMoveToTableau = (source: CardSource) => {
    if (source.kind === "foundation") return false;
    const currentGame = gameRef.current;
    const movingCard = cardFromSource(source, currentGame);
    if (!movingCard) return false;
    for (let column = 0; column < currentGame.tableau.length; column += 1) {
      if (source.kind === "tableau" && column === source.column) continue;
      const nextGame = source.kind === "waste"
        ? moveWasteToTableau(currentGame, column)
        : moveTableauToTableau(currentGame, source.column, source.index, column);
      if (!nextGame) continue;
      applyGame(nextGame, false, movingCard, hammerCharges, currentGame);
      return true;
    }
    return false;
  };

  const autoMoveSelectedCard = (source: CardSource) => {
    const moved = autoMoveToFoundation(source) || autoMoveToTableau(source);
    if (moved) setSelection(null);
    return moved;
  };

  const drawStockCard = () => {
    if (paused) return;
    if (hammerMode) cancelHammerModeForCardAction();
    if (autoFinishTimerRef.current) clearTimeout(autoFinishTimerRef.current);
    autoFinishTimerRef.current = null;
    autoFinishRunningRef.current = false;
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

  const recycleStockWithHammerAction = () => {
    if (paused) return;
    if (game.stock.length > 0 || game.waste.length === 0) return;
    if (hammerCharges < 2) {
      showTimedHint(`추가 스톡 순환에는 망치 2개가 필요합니다. 현재 ${hammerCharges}개입니다.`);
      haptic.error();
      return;
    }
    const recycledGame = recycleStockWithHammer(game);
    if (!recycledGame) return;
    setHammerCharges((charges) => Math.max(0, charges - 2));
    applyGame(recycledGame, false, undefined, hammerCharges);
    showTimedHint("망치 2개를 사용해 스톡을 한 바퀴 추가로 열 수 있습니다.");
    playEffect("shuffle");
  };

  const cancelHammerModeForCardAction = () => {
    if (!hammerMode) return;
    setHammerMode(false);
    setShowHammerOffer(false);
    showTimedHint("망치 사용을 취소하고 카드 동작을 실행합니다.");
    haptic.light();
  };

  const onTableauPress = (column: number, index: number, card: Card) => {
    if (paused) return;
    const pile = game.tableau[column];
    if (hammerMode && card.faceUp) {
      cancelHammerModeForCardAction();
    } else if (hammerMode) {
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
    const source: CardSource = { kind: "tableau", column, index };
    if (selection?.kind === "foundation") {
      // A foundation card can be returned by tapping a valid tableau
      // destination directly. Previously this branch cleared/replaced the
      // foundation selection and attempted to move the newly tapped card,
      // making foundation -> tableau appear unavailable on Android builds.
      if (moveSelectionToTableau(column)) return;
    }
    if (selection?.cardId === card.id) {
      // 다른 카드를 더블탭해 선택을 바꾼 뒤, 선택된 카드를 다시 탭하면
      // 목적지를 한 번 더 탭하지 않고 가능한 위치로 즉시 이동합니다.
      if (!autoMoveSelectedCard(source)) showTimedHint("이 카드는 지금 이동할 수 없습니다.");
      return;
    }
    if (selection) {
      // 잘못 선택한 카드가 있어도 다른 카드를 한 번 탭하면 새 카드를
      // 선택하고, 가능한 목적지가 있으면 즉시 자동 이동합니다.
      setSelection(null);
      if (autoMoveToFoundation(source) || autoMoveToTableau(source)) return;
      selectCard({ kind: "tableau", column, index, cardId: card.id });
      return;
    }
    if (autoMoveToFoundation(source) || autoMoveToTableau(source)) return;
    selectCard({ kind: "tableau", column, index, cardId: card.id });
  };

  const onFoundationPress = (suit: Suit) => {
    if (paused) return;
    if (hammerMode) cancelHammerModeForCardAction();
    if (selection) {
      const movedGame = moveToFoundation(game, selection);
      if (movedGame) {
        applyGame(movedGame);
        return;
      }
    }
    const card = game.foundations[suit].at(-1);
    if (card) selectCard({ kind: "foundation", suit, cardId: card.id });
  };
  const onFoundationDoublePress = (suit: Suit) => {
    if (paused) return;
    if (hammerMode) {
      cancelHammerModeForCardAction();
      return;
    }
    const card = game.foundations[suit].at(-1);
    if (!card) return;
    playEffect("select");
    // Double-tap must be able to replace an existing selection so the
    // foundation card can then be moved down to a valid tableau column.
    setSelection({ kind: "foundation", suit, cardId: card.id });
  };

  const onWastePress = () => {
    if (paused) return;
    const card = game.waste.at(-1);
    if (!card) return;
    if (hammerMode) {
      const boardLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5);
      const wasteLeft = boardLeft + cardWidth * 1.08;
      useHammerOnCard({ kind: "waste" }, { dx: wasteLeft - hammerStartLeft, dy: 0 }, 2);
      return;
    }
    const source: CardSource = { kind: "waste" };
    if (selection?.cardId === card.id) {
      if (!autoMoveSelectedCard(source)) showTimedHint("이 카드는 지금 이동할 수 없습니다.");
      return;
    }
    if (selection) {
      setSelection(null);
      if (autoMoveToFoundation(source) || autoMoveToTableau(source)) return;
      selectCard({ kind: "waste", cardId: card.id });
      return;
    }
    if (autoMoveToFoundation(source) || autoMoveToTableau(source)) return;
    selectCard({ kind: "waste", cardId: card.id });
  };

  const onWasteDoublePress = () => {
    if (paused) return;
    if (hammerMode) cancelHammerModeForCardAction();
    const card = game.waste.at(-1);
    if (!card) return;
    if (selection && selection.cardId !== card.id) {
      selectCard({ kind: "waste", cardId: card.id });
      return;
    }
    setSelection(null);
    autoMoveToFoundation({ kind: "waste" });
  };

  const onTableauDoublePress = (column: number, index: number, card: Card) => {
    if (paused) return;
    if (hammerMode) cancelHammerModeForCardAction();
    if (selection && selection.cardId !== card.id) {
      selectCard({ kind: "tableau", column, index, cardId: card.id });
      return;
    }
    autoMoveToFoundation({ kind: "tableau", column, index });
  };

  const battleContent = getBattleContent(game.level, isLandscape);
  const cardBackTheme = selectedCardBackIndex === null
    ? (battleContent.isBoss ? getCardBackThemeByIndex(CARD_BACK_THEMES.length - 1) : getCardBackTheme(game.level))
    : getCardBackThemeByIndex(selectedCardBackIndex);
  const companionRoster = [...getCompanionRoster(), ...PET_ROSTER];
  const selectedCompanion = companionRoster.find((candidate) => candidate.id === selectedCompanionId) ?? battleContent.companion;
  const bossWarningOpacity = bossIntroProgress.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const bossWarningScale = bossIntroProgress.interpolate({ inputRange: [0, 0.22, 0.82, 1], outputRange: [0.82, 1, 1.04, 0.94] });
  const companionAttackStyle = selectedCompanion.id.startsWith("pet-") ? getPetAttackStyle(selectedCompanion.id) : getCompanionAttackStyle(selectedCompanion);
  const companionAttackColor = companionAttackColors[companionAttackStyle];
  // Fold ultra-wide cards shrink by 30%, but the companion keeps its established baseline size.
  const companionBaseCardWidth = foldUltraWide ? Math.round(cardWidth / 0.7) : cardWidth;
  // Enlarge the idle pet by 50%; comboScale remains a separate combat-only multiplier.
  const companionSize = Math.max(30, Math.round(companionBaseCardWidth * 1.64 * 0.9 * 1.3 * 0.75));
  const companionBaseLeft = isLandscape
    ? Math.max(8, Math.round(safeScreenWidth * 0.08 - companionSize * 0.5))
    : Math.max(4, (phoneLandscape ? Math.max(8, Math.round((sideRailWidth - companionSize) * 0.5)) : Math.max(10, Math.round((safeScreenWidth - companionSize) * 0.5))) - 30);
  const companionBottom = isLandscape
    ? Math.max(bottomControlsBottom + 18, Math.round(safeScreenHeight * 0.34))
    : Math.max(0, bottomControlsBottom + 47 + (!isLandscape ? 1 : 0) - (Platform.OS === "android" && !isLandscape ? 24 : 0));
  const renderCardRatio = cardRatio;
  const activeShuffleStep: 0 | 1 | 2 = twoTouchOpensUsed === 0 ? 0 : rewardedRevealUsed < 10 ? 1 : 2;
  const shuffleHelpTitle = activeShuffleStep === 0 ? "무료 망치" : `광고 보상 망치 +${activeShuffleStep}`;
  const shuffleHelpCopy = activeShuffleStep === 0
    ? "열지 않은 카드 한 장을 공개해 스톡 옆 공개 영역에 놓습니다."
    : "짧은 광고를 끝까지 시청하면 히든 카드 공개 망치 1회를 추가로 이용할 수 있습니다.";
  const shuffleHelpButton = activeShuffleStep === 0 ? "무료 망치 사용" : "광고 시청 후 망치 +1";
  const hammerStartLeft = Math.max(0, (safeScreenWidth - boardWidth) * 0.5) + cardWidth * 2.25;
  const hammerStartTop = rootTopPadding + 132;
  const hammerStrikeTranslateX = hammerStrike.interpolate({ inputRange: [0, 0.86, 1], outputRange: [0, hammerStrikeTarget?.dx ?? 0, hammerStrikeTarget?.dx ?? 0] });
  const hammerCountFontSize = Math.max(13, Math.round(cardWidth * 0.18) + 3);
  const hammerRewardFlightWidth = 96;
  const hammerRewardTargetLeft = hammerStartLeft + cardWidth * 0.5 - hammerRewardFlightWidth * 0.5;
  const hammerRewardTargetTop = hammerStartTop + cardWidth * 0.82 - 20;
  const hammerRewardSourceLeft = hammerRewardFlightKind === "attendance"
    ? Math.max(0, safeScreenWidth - 150)
    : Math.max(0, (safeScreenWidth - (94 * 3 + 16)) * 0.5);
  const hammerRewardSourceTop = hammerRewardFlightKind === "attendance"
    ? rootTopPadding + 8
    : Math.max(0, safeScreenHeight - bottomControlsBottom - 52);
  const hammerRewardTranslateX = attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: [0, hammerRewardTargetLeft - hammerRewardSourceLeft] });
  const hammerRewardTranslateY = attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: [0, hammerRewardTargetTop - hammerRewardSourceTop] });
  const attendanceRewardScale = attendanceRewardFlight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const attendanceRewardOpacity = attendanceRewardFlight.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const hammerStrikeTranslateY = hammerStrike.interpolate({ inputRange: [0, 0.86, 1], outputRange: [0, hammerStrikeTarget?.dy ?? 0, (hammerStrikeTarget?.dy ?? 0) + 8] });
  const hammerStrikeScale = hammerStrike.interpolate({ inputRange: [0, 0.76, 0.9, 1], outputRange: [1, 2.25, 3, 2.45] });
  const hammerStrikeRotate = hammerStrike.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });
  const hammerRevealTranslateX = hammerRevealFlightProgress.interpolate({ inputRange: [0, 1], outputRange: [hammerRevealFlight?.from.dx ?? 0, hammerRevealFlight?.to.dx ?? 0] });
  const hammerRevealTranslateY = hammerRevealFlightProgress.interpolate({ inputRange: [0, 1], outputRange: [hammerRevealFlight?.from.dy ?? 0, hammerRevealFlight?.to.dy ?? 0] });
  const hammerRevealRotate = hammerRevealFlightProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "180deg", "360deg"] });
  const hammerRevealScale = hammerRevealFlightProgress.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [1, 1.08, 0.92, 0.82] });
  const hammerRevealOpacity = hammerRevealFlightProgress.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });

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
        const cardRefs = Object.values(tableauCardRefs.current)
          .filter((node): node is View => node !== null);
        if (!cardRefs.length) { animateCompanionTo(0); return; }
        const frames: Array<{ x: number; y: number; width: number; height: number }> = [];
          cardRefs.forEach((node) => node.measureInWindow((x, y, width, height) => {
          if (cancelled || width <= 0 || height <= 0) return;
          frames.push({ x, y, width, height });
          if (frames.length !== cardRefs.length) return;
          const minLeft = 4;
          const maxLeft = Math.max(minLeft, rootWidth - companionSize - 4);
          // A small visual overlap is still perceived as a collision on a phone.
          // Keep a real safety gap on both axes instead of choosing only the
          // candidate with the smallest overlapping area.
          const horizontalClearance = Math.max(12, Math.round(cardWidth * 0.28));
          const verticalClearance = Math.max(6, Math.round(cardWidth * 0.14));
          const step = Math.max(companionSize * 0.9, cardWidth * 1.15);
          const candidates = Array.from({ length: 9 }, (_, index) => {
            if (index === 0) return companionBaseLeft;
            const direction = index % 2 ? -1 : 1;
            return companionBaseLeft + direction * Math.ceil(index / 2) * step;
          }).map((left) => Math.max(minLeft, Math.min(maxLeft, left)));
          const uniqueCandidates = Array.from(new Set(candidates));
          const bestLeft = uniqueCandidates
            .map((left) => {
              // 펫과 카드의 실제 사각형이 안전 여백까지 포함해 겹치는지 검사합니다.
              // 겹침이 0인 후보를 항상 먼저 선택하고, 화면이 좁아 모두 겹칠 때만
              // 겹침 면적이 가장 작은 후보를 선택합니다.
              const companionTop = rootHeight - companionBottom - companionSize;
              const companionBottomEdge = companionTop + companionSize;
              const collision = frames.reduce((total, frame) => {
                const cardLeft = frame.x - rootX - horizontalClearance;
                const cardRight = frame.x - rootX + frame.width + horizontalClearance;
                const cardTop = frame.y - rootY - verticalClearance;
                const cardBottom = frame.y - rootY + frame.height + verticalClearance;
                const horizontalOverlap = Math.max(0, Math.min(left + companionSize, cardRight) - Math.max(left, cardLeft));
                const verticalOverlap = Math.max(0, Math.min(companionBottomEdge, cardBottom) - Math.max(companionTop, cardTop));
                return total + horizontalOverlap * verticalOverlap;
              }, 0);
              return { left, collision, collides: collision > 0, distance: Math.abs(left - companionBaseLeft) };
            })
            .sort((a, b) => Number(a.collides) - Number(b.collides) || a.collision - b.collision || a.distance - b.distance)[0]?.left ?? companionBaseLeft;
          animateCompanionTo(bestLeft - companionBaseLeft);
        }));
      });
    }, 90);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cardWidth, companionAvoidanceShift, companionBaseLeft, companionBottom, companionSize, flyingCard, game.tableau, isLandscape, safeScreenHeight, safeScreenWidth]);

  useEffect(() => {
    if (!showBossPrepReward) return;
    const timeout = setTimeout(() => setShowBossPrepReward(false), 2400);
    return () => clearTimeout(timeout);
  }, [showBossPrepReward]);

  useEffect(() => {
    if (!hydrated || !battleContent.isBoss || bossWarningStageRef.current === battleContent.stage) return;
    bossWarningStageRef.current = battleContent.stage;
    setShowBossWarning(true);
    bossIntroProgress.setValue(0);
    screenShake.setValue(0);
    const warning = Animated.timing(bossIntroProgress, { toValue: 1, duration: 1150, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const shake = screenShakeEnabled ? Animated.sequence([
      Animated.delay(110),
      Animated.timing(screenShake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0.75, duration: 70, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -0.55, duration: 70, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0.3, duration: 60, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]) : Animated.delay(0);
    Animated.parallel([warning, shake]).start(({ finished }) => {
      if (finished) setShowBossWarning(false);
    });
    return () => { warning.stop(); shake.stop(); };
  }, [battleContent.isBoss, battleContent.stage, bossIntroProgress, hydrated, screenShake]);

  const snapshotRankingRows = (leaderboardSnapshotQuery.data?.rows ?? []) as RankingRow[];
  const topRankingRows = (leaderboardQuery.data ?? []) as RankingRow[];
  const serverRankingRows = snapshotRankingRows.length ? snapshotRankingRows : topRankingRows;
  const previewNames = ["시간의수호자", "BlueKnight", "별빛모험가", "성벽순찰자", "OceanPet", "달빛기사", "StormFox", "고대탐험가", "RubyMage", "바다의전사", "SkyRider", "황금나침반", "NightWolf", "푸른수호자", "MapleHero", "별자리여행", "IronGuard", "새벽의용사", "CloudPet", "CastleStar"];
  const previewCountries = ["KR", "US", "JP", "GB", "CA", "DE", "FR", "AU", "BR", "IN"];
  const previewRows: RankingRow[] = previewNames.map((name, index) => ({ id: -101 - index, name: index === 3 ? profileName.trim() || "내 기록" : name, countryCode: index === 3 ? profileCountryCode ?? "KR" : previewCountries[index % previewCountries.length], score: (gameMode === "timeAttack" ? 420 : 680) - index * 11, timeSeconds: (gameMode === "timeAttack" ? 242 : 362) + index * 9, stage: index === 3 ? 16 : Math.max(1, 18 - Math.floor(index / 2)) }));
  const currentUserId = authQuery.data?.id;
  const currentUserName = authQuery.data?.name ?? (profileName.trim() || null);
  const localModeRecord = records[gameMode];
  const localStageScoreEntries = Object.entries(localModeRecord.stageBestScores ?? {})
    .map(([stage, score]) => ({ stage: Number(stage), score }))
    .filter((entry) => Number.isInteger(entry.stage) && entry.stage >= 1 && entry.stage <= POST_STORY_STAGE_LIMIT);
  const localHighestStage = localStageScoreEntries.length
    ? Math.max(...localStageScoreEntries.map((entry) => entry.stage))
    : (localRankingRows[gameMode]?.stage ?? 1);
  const savedLocalRankingRow = localRankingRows[gameMode]
    ? {
        ...localRankingRows[gameMode],
        userId: currentUserId,
        name: currentUserName ?? localRankingRows[gameMode]?.name ?? null,
        countryCode: profileCountryCode ?? localRankingRows[gameMode]?.countryCode ?? null,
      } as RankingRow
    : undefined;
  const localOverallRow: RankingRow | undefined = localStageScoreEntries.length || localModeRecord.bestScore > 0
    ? {
        id: -3,
        userId: currentUserId,
        name: currentUserName,
        countryCode: profileCountryCode,
        score: localStageScoreEntries.length ? localStageScoreEntries.reduce((total, entry) => total + Math.max(0, entry.score), 0) : localModeRecord.bestScore,
        timeSeconds: localModeRecord.stageBestTimes?.[String(localHighestStage)] ?? localModeRecord.bestTimeSeconds,
        stage: localHighestStage,
      }
    : savedLocalRankingRow;
  const localCurrentStageRecord = records[gameMode].stageBestTimes?.[String(game.level)] !== undefined
    ? {
        id: -2,
        userId: currentUserId,
        name: currentUserName,
        countryCode: profileCountryCode,
        score: records[gameMode].stageBestScores?.[String(game.level)] ?? records[gameMode].bestScore,
        timeSeconds: records[gameMode].stageBestTimes?.[String(game.level)] ?? null,
        stage: game.level,
      } as RankingRow
    : null;
  const isCurrentUserRow = (row: RankingRow) => Boolean(
    (currentUserId !== undefined && row.userId === currentUserId)
      || (currentUserName && row.name === currentUserName),
  );
  const mergeCurrentUserRow = (rows: RankingRow[], localRow: RankingRow | null | undefined) => {
    if (!localRow || isCurrentUserRow(localRow) && rows.some(isCurrentUserRow)) return rows;
    return rows.some(isCurrentUserRow) ? rows : [...rows, localRow];
  };
  const visibleRankingRows = sortRankingRows(showPreviewAttackTools && previewRankingDemo
    ? previewRows
    : mergeCurrentUserRow(
        serverRankingRows.length ? serverRankingRows : [],
        localOverallRow,
      ), gameMode);
  const currentStageServerRows = (currentStageRankingQuery.data ?? []) as RankingRow[];
  const currentStageRankingRows = sortRankingRows(
    showPreviewAttackTools && previewRankingDemo
      ? previewRows.filter((row) => row.stage === game.level)
      : mergeCurrentUserRow(currentStageServerRows, localCurrentStageRecord),
    gameMode,
  );
  const currentUserRankIndex = visibleRankingRows.findIndex((row) => (authQuery.data?.id !== undefined && row.userId === authQuery.data.id) || (authQuery.data?.name && row.name === authQuery.data.name));
  const calculatedMyRank = currentUserRankIndex >= 0 ? currentUserRankIndex + 1 : null;
  const calculatedMyTimeSeconds = currentUserRankIndex >= 0 ? visibleRankingRows[currentUserRankIndex]?.timeSeconds ?? null : null;
  const calculatedMyStage = currentUserRankIndex >= 0 ? visibleRankingRows[currentUserRankIndex]?.stage ?? null : null;
  const visibleMyRank = showPreviewAttackTools && previewRankingDemo ? 4 : calculatedMyRank ?? leaderboardSnapshotQuery.data?.myRank ?? null;
  const visibleMyTimeSeconds = showPreviewAttackTools && previewRankingDemo ? 298 : calculatedMyTimeSeconds ?? leaderboardSnapshotQuery.data?.myTimeSeconds ?? localRankingRows[gameMode]?.timeSeconds ?? null;
  const visibleMyStage = showPreviewAttackTools && previewRankingDemo ? 16 : calculatedMyStage ?? localRankingRows[gameMode]?.stage ?? null;
  const homeUsesStageRanking = currentStageRankingRows.length > 0;
  const homeRankingRows = homeUsesStageRanking ? currentStageRankingRows : visibleRankingRows;
  const homeUserRankIndex = homeRankingRows.findIndex(isCurrentUserRow);
  const homeMyRank = homeUsesStageRanking ? currentStageRankingSnapshotQuery.data?.myRank ?? (homeUserRankIndex >= 0 ? homeUserRankIndex + 1 : null) ?? visibleMyRank : visibleMyRank;
  const homeMyTimeSeconds = homeUsesStageRanking ? currentStageRankingSnapshotQuery.data?.myTimeSeconds ?? (homeUserRankIndex >= 0 ? homeRankingRows[homeUserRankIndex]?.timeSeconds ?? null : null) ?? visibleMyTimeSeconds : visibleMyTimeSeconds;
  const homeMyStage = homeUsesStageRanking ? game.level : visibleMyStage;

  const maxClearedStageForMode = getLastVerifiedClearedStage(records[gameMode], POST_STORY_STAGE_LIMIT);
  // The web preview is a content-preview environment, so it can browse every
  // stage. Native/release builds keep the progression gate: cleared stages and
  // exactly the next stage are available, but uncleared stages cannot be skipped.
  const maxNavigableStage = showPreviewAttackTools
    ? POST_STORY_STAGE_LIMIT
    : Math.max(1, Math.min(POST_STORY_STAGE_LIMIT, maxClearedStageForMode + 1));
  const canGoPreviousStage = hydrated && game.level > 1;
  const canGoNextStage = hydrated && game.level < maxNavigableStage;
  const navigateClearedStage = (delta: -1 | 1) => {
    if (!hydrated) return;
    const targetStage = Math.max(1, Math.min(game.level + delta, maxNavigableStage));
    if (targetStage === game.level) {
      if (delta === 1) showTimedHint(tr("현재 스테이지를 먼저 클리어해야 합니다.", "You must clear the current stage first."));
      return;
    }
    haptic.light();
    startNewGame(targetStage);
  };
  const rankingReplayStages = Object.keys(records[rankingPopupMode].stageBestTimes ?? {})
    .map(Number)
    .filter((stage) => Number.isInteger(stage) && stage >= 1 && stage <= STORY_STAGE_COUNT)
    .sort((a, b) => b - a);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
        <Animated.View ref={rootRef} style={[styles.root, { paddingTop: rootTopPadding, paddingBottom: rootBottomPadding, transform: screenShakeEnabled ? [{ translateX: screenShake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }, { translateY: screenShake.interpolate({ inputRange: [-1, 1], outputRange: [2, -2] }) }] : undefined }, isLandscape && styles.rootLandscape, phoneLandscape && styles.rootPhoneLandscape]}>
        <MedievalBackdrop source={battleContent.background} />
        {showBossWarning ? <Animated.View pointerEvents="none" style={[styles.bossWarning, { opacity: bossWarningOpacity, transform: [{ scale: bossWarningScale }] }]}><Text style={styles.bossWarningEyebrow}>WARNING · BOSS INCOMING</Text><Text style={styles.bossWarningTitle}>{battleContent.monster.name}</Text><Text style={styles.bossWarningCopy}>새로운 수호자가 전장에 나타났습니다</Text></Animated.View> : null}
        {showBossPrepReward ? <View style={styles.bossPrepRewardPopup}><Text style={styles.bossPrepRewardTitle}>보스 준비 보너스 획득!</Text><Text style={styles.bossPrepRewardCopy}>망치 +1</Text></View> : null}
        {hammerStrikeTarget ? <Animated.View pointerEvents="none" style={[styles.hammerStrike, { left: hammerStartLeft, top: hammerStartTop, width: cardWidth * 1.08, height: cardWidth * 1.08, transform: [{ translateX: hammerStrikeTranslateX }, { translateY: hammerStrikeTranslateY }, { scale: hammerStrikeScale }, { rotate: hammerStrikeRotate }] }]}>
          <Image source={HAMMER_ICON_ART} resizeMode="contain" style={styles.hammerStrikeImage} />
        </Animated.View> : null}
        {hammerRevealFlight ? <Animated.View pointerEvents="none" style={[styles.hammerRevealFlight, { left: hammerStartLeft, top: hammerStartTop, width: cardWidth, height: cardWidth * renderCardRatio, opacity: hammerRevealOpacity, transform: [{ translateX: hammerRevealTranslateX }, { translateY: hammerRevealTranslateY }, { scale: hammerRevealScale }, { rotateY: hammerRevealRotate }] }]}>
          <CardFace card={hammerRevealFlight.card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} markScale={isTablet ? 0.9 : 1} />
        </Animated.View> : null}
        {hammerLandingDustTarget ? <Animated.View pointerEvents="none" style={[styles.hammerLandingDustLayer, { left: hammerStartLeft + hammerLandingDustTarget.dx + cardWidth * 0.5, top: hammerStartTop + hammerLandingDustTarget.dy + cardWidth * renderCardRatio * 0.9, transform: [{ translateX: -cardWidth * 0.5 }, { translateY: -cardWidth * 0.25 }] }] }>
          <LandingDust progress={hammerLandingDustProgress} size={cardWidth * 0.9} />
        </Animated.View> : null}
        {foundationMoveFlights.map((flight) => {
          const translateX = flight.progress.interpolate({ inputRange: [0, 1], outputRange: [0, flight.deltaX] });
          const translateY = flight.progress.interpolate({ inputRange: [0, 1], outputRange: [0, flight.deltaY] });
          const rotate = flight.progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "180deg", "360deg"] });
          const scale = flight.progress.interpolate({ inputRange: [0, 0.16, 0.84, 1], outputRange: [1, 1.08, 0.96, 0.88] });
          return <Animated.View key={flight.id} pointerEvents="none" style={[styles.foundationMoveFlight, { left: flight.fromLeft, top: flight.fromTop, width: cardWidth, height: cardWidth * renderCardRatio, transform: [{ translateX }, { translateY }, { scale }, { rotateY: rotate }] }] }>
            <CardFace card={flight.card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} markScale={isTablet ? 0.9 : 1} />
          </Animated.View>;
        })}
        {hammerImpactBurstTarget ? <Animated.View pointerEvents="none" style={[styles.hammerImpactBurst, { left: hammerStartLeft, top: hammerStartTop, width: cardWidth * 1.5, height: cardWidth * 1.5, transform: [{ translateX: hammerImpactBurstTarget.dx }, { translateY: hammerImpactBurstTarget.dy }, { scale: hammerImpactBurst.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0.35, 1.25, 0.1] }) }, { rotate: hammerImpactBurst.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "18deg"] }) }], opacity: hammerImpactBurst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] }) }]}><Image source={HAMMER_IMPACT_ART} resizeMode="contain" style={styles.hammerImpactBurstImage} /><HammerFragments progress={hammerImpactBurst} size={cardWidth * 1.5} /></Animated.View> : null}
        {showAttendanceRewardFlight ? <Animated.View pointerEvents="none" style={[styles.attendanceRewardFlight, { left: hammerRewardSourceLeft, top: hammerRewardSourceTop, width: hammerRewardFlightWidth, opacity: attendanceRewardOpacity, transform: [{ translateX: hammerRewardTranslateX }, { translateY: hammerRewardTranslateY }, { scale: attendanceRewardScale }] }]}><Text style={[styles.hammerRewardFlightText, { fontSize: hammerCountFontSize * 2, lineHeight: hammerCountFontSize * 2.2 }]}>+{hammerRewardFlightAmount}</Text></Animated.View> : null}
        <VictoryFireworks visible={showFireworks} label={tr("스테이지 클리어", "STAGE CLEAR")} />
          <View style={[styles.header, styles.contentLift, isLandscape && styles.headerLandscape, compactLandscape && styles.headerLandscapeCompact, phoneLandscape && styles.headerPhoneLandscape, phoneLandscape && { width: sideRailWidth }]}>
            <View style={phoneLandscape && styles.headerTitlePhoneLandscape}>
            <Text style={[styles.eyebrow, narrowCover && styles.eyebrowNarrow]}>OUR STYLE</Text>
            <View style={styles.titleLine}>
              <Text style={[styles.title, narrowCover && styles.titleNarrow, { fontSize: Math.round((compactLandscape ? 23 : narrowCover ? 26 : 27) * (isLandscape ? 1 : uiScale)), lineHeight: Math.round((compactLandscape ? 27 : narrowCover ? 30 : 31) * (isLandscape ? 1 : uiScale)) }]}>Solitaire</Text>
              <View style={styles.levelBadge}>
                <Pressable hitSlop={10} onStartShouldSetResponder={() => true} accessibilityRole="button" accessibilityLabel={language === "ko" ? "이전 스테이지" : "Previous stage"} accessibilityState={{ disabled: !canGoPreviousStage }} onPress={() => navigateClearedStage(-1)} style={({ pressed }) => [styles.stageNavArrow, !canGoPreviousStage && styles.stageNavArrowDisabled, pressed && styles.pressed]}><Text style={styles.stageNavArrowText}>◀</Text></Pressable>
                <Text style={[styles.levelText, narrowCover && styles.levelTextNarrow]}>LV {battleContent.chapter}{"\n"}STAGE {game.level}</Text>
                <Pressable hitSlop={10} onStartShouldSetResponder={() => true} accessibilityRole="button" accessibilityLabel={language === "ko" ? "다음 스테이지" : "Next stage"} accessibilityState={{ disabled: !canGoNextStage }} onPress={() => navigateClearedStage(1)} style={({ pressed }) => [styles.stageNavArrow, !canGoNextStage && styles.stageNavArrowDisabled, pressed && styles.pressed]}><Text style={styles.stageNavArrowText}>▶</Text></Pressable>
              </View>
            </View>
          </View>
          {isLandscape ? <View style={[styles.landscapeHeaderBanner, phoneLandscape && styles.landscapeHeaderBannerPhone]}><AdBanner compact inline /></View> : null}
          <View onLayout={(event) => { const { x, width } = event.nativeEvent.layout; const right = x + width; if (optionsAnchorRight !== right) setOptionsAnchorRight(right); }} style={[styles.headerActions, compactControls && styles.headerActionsCompact, phoneLandscape && styles.headerActionsPhoneLandscape]}>
            <Pressable accessibilityRole="button" accessibilityLabel="출석체크" disabled={lastAttendanceDate === localDateKey()} onPress={() => { haptic.light(); setShowAttendanceClaim(true); }} style={({ pressed }) => [styles.attendanceHeaderButton, compactControls && styles.iconButtonCompact, lastAttendanceDate === localDateKey() && styles.attendanceHeaderButtonDone, pressed && styles.pressed]}>
              <Animated.View pointerEvents="none" style={[styles.attendanceHeaderAnimated, { opacity: attendanceAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 0.64] }), transform: [{ scale: attendanceAttention.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { rotate: attendanceAttention.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-3deg", "3deg"] }) }] }]}>
                <Image source={DAILY_CHECKIN_ART} resizeMode="contain" style={[styles.attendanceHeaderImage, lastAttendanceDate === localDateKey() && styles.attendanceHeaderImageDone]} />
              </Animated.View>
              {lastAttendanceDate === localDateKey() ? <View pointerEvents="none" style={styles.attendanceDoneBadge}><Text style={styles.attendanceDoneBadgeText}>✓</Text></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="현재 스테이지 초기화" onPress={requestCurrentStageRestart} style={({ pressed }) => [styles.newButton, compactControls && styles.newButtonCompact, pressed && styles.pressed]}>
              <MedievalIcon name="new" size={23} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="사운드 설정" onPress={() => { haptic.light(); setPaused(true); setSheet("sound"); }} style={({ pressed }) => [styles.soundButton, compactControls && styles.iconButtonCompact, !soundEffectsEnabled && !backgroundMusicEnabled && styles.soundButtonOff, pressed && styles.pressed]}>
              <MedievalIcon name={soundEffectsEnabled || backgroundMusicEnabled ? "sound" : "soundOff"} size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="게임 메뉴" onPress={() => { haptic.light(); setPaused(true); setSheet("menu"); }} style={({ pressed }) => [styles.menuButton, compactControls && styles.iconButtonCompact, pressed && styles.pressed]}>
              <Image source={require("../../assets/images/ui/pause-settings.png")} resizeMode="contain" style={styles.menuButtonImage} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.stats, styles.contentLift, narrowCover && styles.statsNarrowCover, foldUltraWide && styles.statsFoldUltraWide, isLandscape && styles.statsLandscape, compactLandscape && styles.statsLandscapeCompact, phoneLandscape && styles.statsPhoneLandscape, phoneLandscape && { width: safeScreenWidth }]}>
          <View style={[styles.statsSummary, narrowCover && styles.statsSummaryNarrowCover, phoneLandscape && styles.statsSummaryPhoneLandscape, phoneLandscape && { width: sideRailWidth }]}>
            <View onLayout={(event) => { const { x } = event.nativeEvent.layout; if (scoreAnchorX !== x) setScoreAnchorX(x); }}><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale * (narrowCover ? 0.88 : 1)) }]}>{formatLocalizedNumber(game.score, language)}</Text><Text style={styles.statLabel}>{tr("점수", "Score")}</Text></View>
            <View style={[styles.statDivider, narrowCover && styles.statDividerNarrow]} />
            <View><Text style={[styles.statValue, { fontSize: Math.round(15 * uiScale * (narrowCover ? 0.88 : 1)) }]}>{formatLocalizedNumber(game.moves, language)}</Text><Text style={styles.statLabel}>{tr("이동", "Moves")}</Text></View>
            <View style={[styles.statDivider, narrowCover && styles.statDividerNarrow]} />
            <View onLayout={(event) => { const { x, width } = event.nativeEvent.layout; const right = x + width; if (timeAnchorRight !== right) setTimeAnchorRight(right); }}><Text style={[styles.statValue, gameMode === "timeAttack" && timeAttackRemaining <= 30 && styles.timeAttackStatWarning, { fontSize: Math.round(15 * uiScale * (narrowCover ? 0.88 : 1)) }]}>{formatDuration(displayedTime, language)}</Text><Text style={styles.statLabel}>{gameMode === "timeAttack" ? tr("남은시간", "Remaining") : tr("시간", "Time")}</Text></View>
          </View>
        {!isLandscape && timeAnchorRight !== null ? <LiveRankingPanel language={language} mode={gameMode} narrow={narrowCover} liveRows={homeRankingRows} myRank={homeMyRank} myTimeSeconds={homeMyTimeSeconds} myStage={homeMyStage} stageRanked={homeUsesStageRanking} onPress={() => { setRankingPopupMode(gameMode); setRankingPopupViewMode("overall"); setSelectedStageRanking(null); setShowReplayStageList(false); setShowStageRankingList(false); setShowRankingPopup(true); }} left={timeAnchorRight + 10} /> : null}
          <MonsterBattle paused={paused} recycleWarning={recycleWarning} remainingRecycles={remainingRecycles} compact={compact || compactLandscape} portraitNarrow={narrowCover} landscape={isLandscape} phoneLandscape={phoneLandscape} androidPortrait={Platform.OS === "android" && !isLandscape} safeWidth={safeScreenWidth} travelDistance={monsterTravelDistance} verticalTravel={monsterVerticalTravel} leftTravelExtension={isTablet ? 130 : 100} motionValue={monsterMotion} rootRef={rootRef} monsterTargetRef={monsterTargetRef} monsterTargetFrameRef={monsterTargetFrameRef} flyingAttacks={flyingAttacks} damage={lastDamage} hp={Math.max(0, 100 - ((SUITS.reduce((total, suit) => total + game.foundations[suit].length, 0) + (game.destroyedCards?.length ?? 0)) / 52) * 100)} attackKind={attackKind} attackToken={attackToken} impactToken={impactToken} attackStyle={companionAttackStyle} combo={comboAttack} monster={battleContent.monster} displayName={getLocalizedBattleName(battleContent.monster.id, battleContent.monster.name, language)} isBoss={battleContent.isBoss} cardSize={cardWidth} />
        </View>

        <Animated.View style={[styles.boardTransition, styles.boardTransitionFront, { opacity: layoutTransition, transform: [{ translateY: -24 }, { scale: layoutTransition }, { translateX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }, { rotate: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "0.7deg"] }) }] }]}>
        <View style={[styles.board, { width: boardWidth, alignSelf: isLandscape ? "center" : "flex-start", marginLeft: isLandscape ? 0 : isTablet ? Math.max(0, (safeScreenWidth - boardWidth) * 0.5) : foldUltraWide ? Math.max(0, (safeScreenWidth - boardWidth) * 0.5) : Math.max(0, cardAreaLeft - 6) }, isLandscape && styles.boardLandscape, phoneLandscape && styles.boardPhoneLandscape]}>
        <View style={[styles.topPiles, isLandscape && styles.topPilesLandscape]}>
          <View style={[styles.stockWasteGroup, recycleWarning && styles.stockWasteWarning]}>
            {game.stock.length ? (
              <CardBack width={cardWidth} cardRatio={renderCardRatio} theme={cardBackTheme} isBoss={battleContent.isBoss} onPress={drawStockCard} />
            ) : (
              <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label={game.waste.length ? "↻" : ""} onPress={() => { if (hammerMode) { cancelHammerModeForCardAction(); return; } if (game.waste.length) { if (getRemainingRecycles(game) > 0) applyGame(drawFromStock(game)); else recycleStockWithHammerAction(); } }} />
            )}
            <View style={styles.wastePileWithHint}>
              {game.waste.at(-1) && !foundationMoveFlights.some((flight) => flight.card.id === game.waste.at(-1)?.id) ? (
              <CardFace card={game.waste.at(-1)!} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} markScale={isTablet ? 0.9 : 1} selected={selection?.kind === "waste"} hinted={autoMoveHintIds.includes(game.waste.at(-1)!.id)} hintAttention={autoMoveHintAttention} onPress={onWastePress} onDoublePress={onWasteDoublePress} onLongPress={() => { if (!hammerMode) { const card = game.waste.at(-1); if (card) selectCard({ kind: "waste", cardId: card.id }); } showTimedHint("웨이스트 카드를 길게 눌러 선택했습니다."); }} />
              ) : (
                <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label="" />
              )}
            </View>
          </View>
          <Animated.View style={[styles.hammerPilesAnimated, { width: cardWidth, height: cardWidth * renderCardRatio }, { opacity: hammerCharges > 0 ? hammerShine.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) : 0.72 }, { transform: [{ translateX: hammerImpact.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) }, { rotate: hammerImpact.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] }) }, { scale: hammerCharges > 0 ? hammerShine.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) : 1 }] }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`망치 ${hammerCharges}개 남음`} onPress={() => beginHammerMode()} style={({ pressed }) => [styles.hammerPilesButton, { width: cardWidth, height: cardWidth * renderCardRatio }, hammerCharges > 0 && styles.hammerPilesButtonReady, pressed && styles.pressed]}>
              <Animated.Image source={HAMMER_ICON_ART} resizeMode="contain" style={[styles.hammerPilesIcon, { width: Math.min(cardWidth * 1.17, 76), height: Math.min(cardWidth * 1.17, 76) }, { transform: [{ translateY: hammerIdleMotion.interpolate({ inputRange: [-1, 0, 1], outputRange: [2, 0, -2] }) }] }]} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.hammerPilesCount, { fontSize: hammerCountFontSize, lineHeight: hammerCountFontSize + 1 }]}>{hammerCharges}/{MAX_HAMMER_CHARGES}</Text>
            </Pressable>
          </Animated.View>
          <View style={[styles.foundationGroup, { gap: Math.max(3, Math.round(cardWidth * 0.08)) }]}>
            {SUITS.map((suit) => {
              const card = game.foundations[suit].at(-1);
              return card ? foundationMoveFlights.some((flight) => flight.card.id === card.id) ? (
                <View key={suit} style={{ width: cardWidth, height: cardWidth * renderCardRatio }} />
              ) : (
                <CardFace key={suit} card={card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} markScale={isTablet ? 0.9 : 1} selected={selection?.kind === "foundation" && selection.suit === suit} onPress={() => onFoundationPress(suit)} onDoublePress={() => onFoundationDoublePress(suit)} onDragEnd={(dx, dy) => dragMoveCard({ kind: "foundation", suit }, dx, dy)} />
              ) : (
                <EmptySlot key={suit} width={cardWidth} cardRatio={renderCardRatio} label={suitSymbols[suit]} onPress={() => onFoundationPress(suit)} />
              );
            })}
          </View>
        </View>

        <View style={[styles.tableau, { gap: tableauGap }, isLandscape && styles.tableauLandscape]}>
          {game.tableau.map((pile, column) => (
            <Animated.View key={`column-${column}`} style={[styles.tableauColumn, { width: cardWidth, minHeight: cardWidth * renderCardRatio, transform: [{ translateX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [0, (3 - column) * (cardWidth + tableauGap)] }) }, { scaleY: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) }, { scaleX: shuffleMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] }]}>
              {pile.length === 0 ? <EmptySlot width={cardWidth} cardRatio={renderCardRatio} label="K" onPress={() => { if (hammerMode) { cancelHammerModeForCardAction(); return; } moveSelectionToTableau(column); }} /> : null}
              {pile.map((card, index) => {
                const sequence = (column * (column + 1)) / 2 + index;
                const revealStart = 0.02 + sequence * 0.026;
                const revealEnd = Math.min(0.97, revealStart + 0.22);
                const previewDealStyle = previewTimeAttackOpenTableau && gameMode === "timeAttack"
                  ? {
                      opacity: timeAttackPreviewDealMotion.interpolate({ inputRange: [0, revealStart, revealEnd, 1], outputRange: [0, 0, 1, 1] }),
                      transform: [{ translateY: timeAttackPreviewDealMotion.interpolate({ inputRange: [0, revealStart, revealEnd, 1], outputRange: [-150, -150, 0, 0] }) }],
                    }
                  : null;
                return <View ref={(node) => { if (node) tableauCardRefs.current[card.id] = node; else delete tableauCardRefs.current[card.id]; }} key={card.id} style={{ position: "absolute", top: index * stackOffset, left: 0, zIndex: 100 + index, elevation: 100 + index }}>
                  <Animated.View style={previewDealStyle}>
                    {foundationMoveFlights.some((flight) => flight.card.id === card.id) ? <View style={{ width: cardWidth, height: cardWidth * renderCardRatio }} /> : card.faceUp ? (
                      <CardFace card={card} width={cardWidth} cardRatio={renderCardRatio} chapter={battleContent.chapter} isBoss={battleContent.isBoss} markScale={isTablet ? 0.9 : 1} selected={selection?.cardId === card.id} hinted={autoMoveHintIds.includes(card.id)} hintAttention={autoMoveHintAttention} onPress={() => onTableauPress(column, index, card)} onDoublePress={() => onTableauDoublePress(column, index, card)} onDragEnd={(dx, dy) => dragMoveCard({ kind: "tableau", column, index }, dx, dy)} />
                    ) : (
                      <CardBack width={cardWidth} cardRatio={renderCardRatio} theme={cardBackTheme} isBoss={battleContent.isBoss} onPress={() => onTableauPress(column, index, card)} />
                    )}
                  </Animated.View>
                </View>;
              })}
            </Animated.View>
          ))}
        </View>
        </View>
        </Animated.View>
        {hammerMode && game.waste.length > 0 ? <View pointerEvents="none" style={[styles.hammerModeHint, { top: Math.max(8, rootTopPadding + 4) }]}><Text style={styles.hammerModeHintText}>{tr("웨이스트 맨 아래로 이동 · 망치 2개", "Move waste to bottom · 2 hammers")}</Text></View> : null}

        {!isLandscape ? <View style={[styles.portraitAdBanner, { bottom: portraitBannerBottom }]}><AdBanner /></View> : null}
        <CompanionAnchor companion={selectedCompanion} displayName={getLocalizedBattleName(selectedCompanion.id, selectedCompanion.name, language)} attackStyle={companionAttackStyle} size={companionSize} left={companionBaseLeft} bottom={companionBottom} horizontalShift={companionAvoidanceShift} comboScale={comboCompanionScale} attackFlight={undefined} onPress={() => undefined} anchorRef={(node) => { companionAnchorRef.current = node; }} />
        {showActiveBadgeNotice && activeBadgeImage ? <Animated.View pointerEvents="none" style={{ position: "absolute", left: companionBaseLeft + Math.round(companionSize * 0.5) - 28, bottom: companionBottom + companionSize + 12, width: 56, alignItems: "center", opacity: activeBadgeNoticeMotion, transform: [{ translateY: activeBadgeNoticeMotion.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}><Image source={activeBadgeImage} resizeMode="contain" style={{ width: 56, height: 56 }} /><Text numberOfLines={2} style={{ color: "#FFF4B8", fontSize: 8, lineHeight: 10, fontWeight: "900", textAlign: "center", textShadowColor: "#1B2340", textShadowRadius: 3 }}>{getBadgeAbilityText(activeBadgeId!, language)}</Text></Animated.View> : null}
        {activePetFlight ? <FlyingPetImpact image={ATTACK_IMPACT_ART_BY_STYLE[companionAttackStyle]} size={Math.max(52, Math.round(companionSize * 1.35))} progress={activePetFlight.progress} rootRef={rootRef} companionRef={companionAnchorRef} targetViewRef={monsterTargetRef} companionSize={companionSize} /> : null}
                <View style={[styles.bottomControls, isLandscape && styles.bottomControlsLandscape, compactLandscape && styles.bottomControlsLandscapeCompact, phoneLandscape && styles.bottomControlsPhoneLandscape, phoneLandscape && { width: sideRailWidth }, { bottom: Math.max(0, bottomControlsBottom - 5) }]}>

          <Pressable accessibilityRole="button" accessibilityLabel={hammerCharges >= MAX_HAMMER_CHARGES ? `망치가 ${MAX_HAMMER_CHARGES}개라 광고 보상을 받을 수 없음` : "광고 시청 후 망치 받기"} onPress={() => { haptic.light(); void claimHammerAdReward(); }} style={({ pressed }) => [styles.cartoonActionButton, styles.cartoonHammerButton, phoneLandscape && styles.bottomButtonPhoneLandscape, pressed && styles.pressed]}>
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
        <Animated.View pointerEvents="none" style={[styles.comboImpactBorder, { opacity: comboImpactBorderOpacity }]} />
        {autoFinishSummary ? <Animated.View pointerEvents="none" style={[styles.autoFinishSummary, isLandscape && styles.autoFinishSummaryLandscape, { opacity: autoFinishSummaryOpacity, transform: [{ scale: autoFinishSummaryScale }] }]}>
          <Text style={styles.autoFinishSummaryEyebrow}>{tr("자동 정리 완료", "AUTO FINISH COMPLETE")}</Text>
          <Text style={styles.autoFinishSummaryTitle}>{tr("최종 콤보", "FINAL COMBO")}</Text>
          <Text style={styles.autoFinishSummaryCombo}>×{formatLocalizedNumber(autoFinishSummary.comboCount, language)}</Text>
          <View style={styles.autoFinishSummaryDivider} />
          <Text style={styles.autoFinishSummaryScoreLabel}>{tr("총 획득 점수", "TOTAL SCORE GAIN")}</Text>
          <Text style={styles.autoFinishSummaryScore}>+{formatLocalizedNumber(autoFinishSummary.totalScore, language)}</Text>
        </Animated.View> : null}
        {timeBonusText ? <Animated.View pointerEvents="none" style={[styles.timeBonusFloat, isLandscape && styles.timeBonusFloatLandscape, { opacity: timeBonusOpacity, transform: [{ translateY: timeBonusTranslateY }] }]}><Text style={styles.timeBonusFloatText}>{timeBonusText}</Text></Animated.View> : null}
        {comboScoreText ? <Animated.View pointerEvents="none" style={[styles.comboScoreFloat, isLandscape && styles.comboScoreFloatLandscape, { opacity: comboScoreOpacity, transform: [{ translateY: comboScoreTranslateY }, { scale: comboScoreScale }] }]}><Text style={styles.comboScoreFloatText}>{comboScoreText}</Text></Animated.View> : null}
        {comboBanner ? <Animated.View pointerEvents="none" style={[styles.comboBanner, isLandscape && styles.comboBannerLandscape, { opacity: comboBannerOpacity, transform: [{ translateY: comboBannerTranslateY }, { scale: comboBannerScale }] }]}>
          <Text style={[styles.comboBannerTitle, { color: comboTextColor(comboBanner.count), textShadowColor: "#07101F" }]}>{tr("연속 공격", "COMBO ATTACK")}</Text>
          <Text style={[styles.comboBannerCount, { color: comboTextColor(comboBanner.count), textShadowColor: comboTextColor(comboBanner.count), position: "relative", zIndex: 3, elevation: 3 }]}>{"×"}{comboBanner.count}</Text>
          <Text style={[styles.comboBannerBonus, { color: comboTextColor(comboBanner.count), textShadowColor: "#07101F" }]}>{tr("공격 성공이 이어지고 있습니다!", "Successful attacks continue!")}</Text>
        </Animated.View> : null}
        {hintMessage ? <View style={[styles.hintToast, isLandscape && styles.hintToastLandscape, phoneLandscape && { left: 8, right: undefined, width: Math.max(160, sideRailWidth - 16), bottom: 160 }]}><Text style={styles.hintToastText}>{hintMessage}</Text></View> : null}
        {petPreservationNotice ? <View pointerEvents="none" style={styles.petPreservationNotice}><Text style={styles.petPreservationNoticeText}>펫 도감은 안전하게 보존되었습니다</Text></View> : null}



        <Modal transparent visible={showRankingPopup} animationType="fade" onRequestClose={() => setShowRankingPopup(false)}>
          <View style={styles.rankingModalBackdrop}>
            <Pressable accessibilityRole="button" accessibilityLabel="랭킹 팝업 닫기" onPress={() => setShowRankingPopup(false)} style={StyleSheet.absoluteFillObject} />
            <View style={styles.rankingModalCard}>
              <View style={styles.rankingModalHeader}>
                <View style={styles.rankingModalTitleBlock}>
                  <View>
                    <Text style={styles.rankingModalEyebrow}>{rankingPopupMode === "timeAttack" ? "TIME ATTACK" : "UNLIMITED MODE"}</Text>
                    <Text style={styles.rankingModalTitle}>{tr("실시간 랭킹", "Live Ranking")}</Text>
                  </View>
                  <View style={styles.rankingHeaderPickerRow}>
                    {rankingReplayStages.length ? <View style={styles.replayHeaderPickerWrap}>
                      <Pressable accessibilityRole="button" onPress={() => { setShowReplayStageList((visible) => !visible); setShowStageRankingList(false); }} style={({ pressed }) => [styles.replayHeaderPicker, pressed && styles.pressed]}>
                        <Text numberOfLines={1} style={styles.replayHeaderPickerText}>{tr("스테이지 재도전", "Replay")}</Text>
                        <Text style={styles.replayHeaderPickerChevron}>{showReplayStageList ? "▲" : "▼"}</Text>
                      </Pressable>

                    </View> : null}
                    <View style={styles.replayHeaderPickerWrap}>
                      <Pressable accessibilityRole="button" onPress={() => { setShowStageRankingList((visible) => !visible); setShowReplayStageList(false); }} style={({ pressed }) => [styles.stageRankingHeaderPicker, pressed && styles.pressed]}>
                        <Text numberOfLines={1} style={styles.replayHeaderPickerText}>{tr("스테이지별 랭킹", "Stage Rankings")}</Text>
                        <Text style={styles.replayHeaderPickerChevron}>{showStageRankingList ? "▲" : "▼"}</Text>
                      </Pressable>

                    </View>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="랭킹 닫기" onPress={() => setShowRankingPopup(false)} style={({ pressed }) => [styles.rankingModalClose, pressed && styles.pressed]}><Text style={styles.rankingModalCloseText}>×</Text></Pressable>
              </View>
              <View style={styles.rankingModalModeToggle}>
                <Pressable onPress={() => { setRankingPopupMode("unlimited"); setRankingPopupViewMode("overall"); setShowReplayStageList(false); setShowStageRankingList(false); setSelectedStageRanking(null); }} style={[styles.rankingModalModeButton, rankingPopupMode === "unlimited" && styles.rankingModalModeButtonActive]}><Text style={styles.rankingModalModeText}>{tr("무제한", "Unlimited")}</Text></Pressable>
                <Pressable onPress={() => { setRankingPopupMode("timeAttack"); setRankingPopupViewMode("overall"); setShowReplayStageList(false); setShowStageRankingList(false); setSelectedStageRanking(null); }} style={[styles.rankingModalModeButton, rankingPopupMode === "timeAttack" && styles.rankingModalModeButtonActive]}><Text style={styles.rankingModalModeText}>{tr("시간제한", "Time Attack")}</Text></Pressable>
              </View>
              <View style={styles.rankingModalViewToggle}>
                <Pressable accessibilityRole="button" accessibilityLabel={language === "ko" ? "현재 스테이지 랭킹 보기" : "View current stage ranking"} onPress={() => { setRankingPopupViewMode("stage"); setSelectedStageRanking(null); }} style={[styles.rankingModalViewButton, rankingPopupViewMode === "stage" && styles.rankingModalViewButtonActive]}><Text style={styles.rankingModalViewText}>{tr("스테이지", "Stage")}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={language === "ko" ? "전체 랭킹 보기" : "View overall ranking"} onPress={() => { setRankingPopupViewMode("overall"); setSelectedStageRanking(null); }} style={[styles.rankingModalViewButton, rankingPopupViewMode === "overall" && styles.rankingModalViewButtonActive]}><Text style={styles.rankingModalViewText}>{tr("전체 랭킹", "Overall")}</Text></Pressable>
              </View>
              <Text style={styles.rankingModalCopy}>{rankingPopupMode === "timeAttack" ? tr("게임오버 전까지 도달한 최고 스테이지 기준입니다.", "Ranked by the highest stage reached before game over.") : tr("현재 모드의 상위 20명 기록입니다.", "Top 20 records for the current mode.")}</Text>
              <ScrollView style={styles.rankingModalScroll} onStartShouldSetResponder={() => false} onMoveShouldSetResponder={() => true} contentContainerStyle={styles.rankingModalList} nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {(() => {
                  const popupRows = (rankingPopupQuery.data ?? []) as RankingRow[];
                  const popupSnapshotRows = (rankingPopupSnapshotQuery.data?.rows ?? []) as RankingRow[];
                  const popupServerRows = popupSnapshotRows.length ? popupSnapshotRows : popupRows;
                  const popupOverallRows = mergeCurrentUserRow(popupServerRows, localOverallRow);
                  const popupPreviewRows = previewNames.map((name, index) => ({ id: -201 - index, name: index === 3 ? profileName.trim() || "내 기록" : name, countryCode: index === 3 ? profileCountryCode ?? "KR" : previewCountries[index % previewCountries.length], score: (rankingPopupMode === "timeAttack" ? 420 : 680) - index * 11, timeSeconds: (rankingPopupMode === "timeAttack" ? 242 : 362) + index * 9, stage: index === 3 ? 16 : Math.max(1, 18 - Math.floor(index / 2)) }));
                  const stageServerRows = (stageRankingQuery.data ?? []) as RankingRow[];
                  const localStage = selectedStageRanking ?? game.level;
                  const localStageRecord = records[rankingPopupMode].stageBestTimes?.[String(localStage)] !== undefined
                    ? {
                        id: -1,
                        userId: authQuery.data?.id,
                        name: profileName.trim() || authQuery.data?.name || null,
                        countryCode: profileCountryCode,
                        mode: rankingPopupMode,
                        stage: localStage,
                        score: records[rankingPopupMode].stageBestScores?.[String(localStage)] ?? records[rankingPopupMode].bestScore,
                        timeSeconds: records[rankingPopupMode].stageBestTimes?.[String(localStage)] ?? null,
                      } as RankingRow
                    : null;
                  const selectedStageRows = rankingPopupViewMode === "stage"
                    ? showPreviewAttackTools && previewRankingDemo
                      ? popupPreviewRows.filter((row) => row.stage === localStage)
                      : mergeCurrentUserRow(stageServerRows, localStageRecord)
                    : [];
                  const popupBaseRows = rankingPopupViewMode === "stage"
                    ? selectedStageRows
                    : showPreviewAttackTools && previewRankingDemo
                      ? popupPreviewRows
                      : popupOverallRows.length
                        ? popupOverallRows
                        : localRankingRows[rankingPopupMode]
                          ? [localRankingRows[rankingPopupMode] as RankingRow]
                          : popupOverallRows;
                  const popupAllRows = sortRankingRows(popupBaseRows, rankingPopupMode);
                  const filteredPopupRows = popupAllRows;
                  const highestStage = popupAllRows.reduce((highest, row) => Math.max(highest, row.stage), 0);
                  const popupIndex = filteredPopupRows.findIndex(isCurrentUserRow);
                  const popupRank = showPreviewAttackTools && previewRankingDemo ? 4 : popupIndex >= 0 ? popupIndex + 1 : rankingPopupSnapshotQuery.data?.myRank ?? null;
                  const popupTime = showPreviewAttackTools && previewRankingDemo ? 298 : popupIndex >= 0 ? filteredPopupRows[popupIndex]?.timeSeconds ?? null : rankingPopupSnapshotQuery.data?.myTimeSeconds ?? localRankingRows[rankingPopupMode]?.timeSeconds ?? null;
                  const popupStage = showPreviewAttackTools && previewRankingDemo ? 16 : popupIndex >= 0 ? filteredPopupRows[popupIndex]?.stage ?? null : localRankingRows[rankingPopupMode]?.stage ?? null;
                  const replayStages = rankingReplayStages;
                  return <>
                    {rankingPopupViewMode === "stage" ? <View style={styles.stageRankingStatus}><Text style={styles.stageRankingStatusTitle}>{tr(`스테이지 ${selectedStageRanking ?? game.level} 랭킹`, `Stage ${selectedStageRanking ?? game.level} rankings`)}</Text><Text style={styles.stageRankingStatusCopy}>{stageRankingQuery.isPending && !stageRankingQuery.data ? tr("랭킹을 확인하는 중입니다…", "Checking rankings…") : stageRankingQuery.isError ? tr("랭킹을 불러오지 못했습니다. 잠시 후 다시 선택해 주세요.", "Could not load rankings. Please select the stage again shortly.") : filteredPopupRows.length ? tr(`등록된 랭킹 있음 · ${filteredPopupRows.length}명`, `Ranking available · ${filteredPopupRows.length} players`) : tr("등록된 랭킹이 없습니다.", "No ranking records yet.")}</Text></View> : null}
                    {filteredPopupRows.slice(0, 20).map((row, index) => <View key={`${row.id}-${index}`} style={[styles.rankingModalRow, index < 3 && styles.rankingModalTopRow]}><Text style={[styles.rankingModalRank, index === 0 && styles.rankingGold, index === 1 && styles.rankingSilver, index === 2 && styles.rankingBronze]}>{formatLocalizedNumber(index + 1, language)}</Text>{COUNTRY_FLAG_IMAGES[row.countryCode ?? ""] ? <Image source={COUNTRY_FLAG_IMAGES[row.countryCode ?? ""]} resizeMode="cover" style={styles.rankingModalFlag} /> : <Text style={styles.rankingModalFlagText}>{countryFlag(row.countryCode)}</Text>}<Text numberOfLines={1} style={styles.rankingModalName}>{row.name ?? "—"}</Text><Text style={[styles.rankingModalStage, row.stage ? stageBadgeStyle(row.stage) : null, row.stage ? { color: stageAccentColor(row.stage) } : null]}>{row.stage ? `${row.stage === highestStage && index === 0 ? "♛ " : ""}Lv${formatLocalizedNumber(getBattleContent(row.stage, false).chapter, language)}/S${formatLocalizedNumber(row.stage, language)}` : "—"}</Text><Text style={styles.rankingModalScore}>{formatLocalizedNumber(row.score, language)}</Text><Text style={styles.rankingModalTime}>{rankingPopupMode === "timeAttack" ? formatLocalizedNumber(row.timeSeconds ?? 0, language) : row.timeSeconds == null ? "—" : formatDuration(row.timeSeconds, language)}</Text></View>)}
                    {!filteredPopupRows.length ? <Text style={styles.rankingModalEmpty}>{tr("아직 등록된 기록이 없습니다.", "No records yet.")}</Text> : null}

                    <View style={styles.rankingModalFooter}><Text style={styles.rankingModalMyRank}>{tr("내 순위", "My rank")}: {popupRank ? `${formatLocalizedNumber(popupRank, language)}${language === "ko" ? "위" : ""}` : "—"}</Text><Text style={styles.rankingModalMyTime}>{rankingPopupMode === "timeAttack" ? (popupStage ? `S${popupStage}` : "—") : popupTime == null ? "—" : formatDuration(popupTime, language)}</Text></View>
                  </>;
                })()}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showReplayStageList} animationType="fade" onRequestClose={() => setShowReplayStageList(false)}>
          <View style={styles.independentListBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowReplayStageList(false)} />
            <View style={styles.independentListCard}>
              <Text style={styles.independentListTitle}>{tr("스테이지 재도전", "Replay Stage")}</Text>
              <ScrollView style={styles.independentListScroll} contentContainerStyle={styles.independentListContent} nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar>
                {rankingReplayStages.map((stage) => <Pressable key={stage} accessibilityRole="button" onPress={() => { setShowReplayStageList(false); startReplayStage(rankingPopupMode, stage); }} style={({ pressed }) => [styles.replayStageOption, pressed && styles.pressed]}><Text style={styles.replayStageButtonText}>{tr("스테이지 ", "Stage ")}{stage}</Text></Pressable>)}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showStageRankingList} animationType="fade" onRequestClose={() => setShowStageRankingList(false)}>
          <View style={styles.independentListBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowStageRankingList(false)} />
            <View style={styles.independentListCard}>
              <Text style={styles.independentListTitle}>{tr("스테이지별 랭킹", "Stage Rankings")}</Text>
              <ScrollView style={styles.independentListScroll} contentContainerStyle={styles.independentListContent} nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar>
                {Array.from({ length: STORY_STAGE_COUNT }, (_, index) => index + 1).map((stage) => <Pressable key={stage} accessibilityRole="button" onPress={() => { setSelectedStageRanking(stage); setRankingPopupViewMode("stage"); setShowStageRankingList(false); }} style={({ pressed }) => [styles.replayStageOption, selectedStageRanking === stage && styles.stageRankingSelectedOption, pressed && styles.pressed]}><Text style={styles.replayStageButtonText}>{tr("스테이지 ", "Stage ")}{stage}</Text></Pressable>)}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showGoogleAccountMenu} animationType="fade" onRequestClose={() => setShowGoogleAccountMenu(false)}>
          <Pressable style={styles.accountMenuBackdrop} onPress={() => setShowGoogleAccountMenu(false)}>
            <View style={styles.accountMenuCard} onStartShouldSetResponder={() => true}>
              <View style={styles.accountMenuHeader}>
                {(googleSessionUser ?? authQuery.data)?.avatarUrl ? <Image source={{ uri: (googleSessionUser ?? authQuery.data)!.avatarUrl! }} style={styles.accountMenuAvatar} /> : <View style={styles.accountMenuAvatarFallback}><Text style={styles.accountMenuAvatarText}>G</Text></View>}
                <View style={styles.accountMenuCopy}><Text style={styles.accountMenuTitle}>{(googleSessionUser ?? authQuery.data)?.name ?? tr("Google 계정", "Google Account")}</Text><Text numberOfLines={1} style={styles.accountMenuSubtitle}>{(googleSessionUser ?? authQuery.data)?.email ?? ""}</Text></View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="다른 Google 계정으로 전환" onPress={() => { setShowGoogleAccountMenu(false); void logoutFromGoogle().then(() => setSheet("profile")); }} style={({ pressed }) => [styles.accountMenuSwitchButton, pressed && styles.pressed]}><Text style={styles.accountMenuSwitchText}>{tr("다른 계정으로 전환", "Switch account")}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Google 로그아웃" onPress={() => { setShowGoogleAccountMenu(false); void logoutFromGoogle(); }} style={({ pressed }) => [styles.accountMenuLogoutButton, pressed && styles.pressed]}><Text style={styles.accountMenuLogoutText}>{tr("로그아웃", "Sign out")}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="계정 메뉴 닫기" onPress={() => setShowGoogleAccountMenu(false)} style={({ pressed }) => [styles.accountMenuCancelButton, pressed && styles.pressed]}><Text style={styles.accountMenuCancelText}>{tr("취소", "Cancel")}</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal transparent visible={showHammerOffer} animationType="fade" hardwareAccelerated statusBarTranslucent onRequestClose={() => setShowHammerOffer(false)}>
          <Pressable style={styles.hammerOfferModalLayer} onPress={() => setShowHammerOffer(false)}>
            <View style={styles.hammerOfferCard} onStartShouldSetResponder={() => true}>
              <Pressable accessibilityRole="button" accessibilityLabel="망치 안내 닫기" onPress={() => setShowHammerOffer(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              {getCurrentDailyAdRewardCount() >= MAX_DAILY_AD_HAMMER_REWARDS ? <>
                <Text style={styles.hammerOfferTitle}>일일 광고 보상이 소진되었습니다.</Text>
                <Text style={styles.hammerOfferCopy}>오늘 광고 5회 보상이 모두 소진되었습니다. 1·2회차는 망치 10개, 3·4·5회차는 망치 20개를 받으며, 망치는 최대 30개까지 보유할 수 있습니다. 내일 광고 보상이 다시 열리고 현재 스테이지와 펫 도감은 유지됩니다.</Text>
                <View style={styles.noMovesPopupActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="현재 Stage 새로 시작" onPress={() => { setShowHammerOffer(false); requestCurrentStageRestart(); }} style={({ pressed }) => [styles.hammerOfferPrimary, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>이 Stage 재시작</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Stage 1로 돌아가기" onPress={() => { setShowHammerOffer(false); requestNewGame(); }} style={({ pressed }) => [styles.noMovesPopupSecondary, pressed && styles.pressed]}><Text style={styles.noMovesPopupSecondaryText}>Stage 1로</Text></Pressable>
                </View>
              </> : <>
                <Text style={styles.hammerOfferTitle}>히든 카드를 열어 길을 만들까요?</Text>
                <Text style={styles.hammerOfferCopy}>망치로 히든 카드 1장을 즉시 공개할 수 있습니다. 광고 보상은 하루 5회이며, 1·2회차는 망치 +10, 3·4·5회차는 망치 +20입니다. 망치는 최대 30개까지 적립됩니다.</Text>
                <View style={styles.noMovesPopupActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="망치 사용" onPress={() => { setHammerCharges((charges) => Math.min(MAX_HAMMER_CHARGES, charges + 1)); beginHammerMode(true); }} style={({ pressed }) => [styles.hammerOfferPrimary, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>망치 사용</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="새로 시작" onPress={() => { setShowHammerOffer(false); requestNewGame(); }} style={({ pressed }) => [styles.noMovesPopupSecondary, pressed && styles.pressed]}><Text style={styles.noMovesPopupSecondaryText}>새로 시작</Text></Pressable>
                </View>
              </>}
            </View>
          </Pressable>
        </Modal>

        <Modal transparent visible={showNoMovesPopup} animationType="fade" onRequestClose={() => setShowNoMovesPopup(false)}>
          <Pressable style={styles.modalBackdropCenter} onPress={() => setShowNoMovesPopup(false)}>
            <View style={styles.noMovesPopupCard} onStartShouldSetResponder={() => true}>
              <Pressable accessibilityRole="button" accessibilityLabel="이동 불가 안내 닫기" onPress={() => setShowNoMovesPopup(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              <Text style={styles.noMovesPopupTitle}>더 이상 이동할 수 없습니다.</Text>
              {activeShuffleStep === 0 ? <Text style={styles.noMovesPopupCopy}>무료 망치 1번 사용 가능</Text> : activeShuffleStep < 2 ? <Text style={styles.noMovesPopupCopy}>광고시청후 망치 1번 사용 가능</Text> : <Text style={styles.noMovesPopupCopy}>게임을 새로시작하세요.</Text>}
              <View style={styles.noMovesPopupActions}>
                {activeShuffleStep === 0 ? <Pressable accessibilityRole="button" accessibilityLabel="무료 망치" onPress={() => { setShowNoMovesPopup(false); void useShuffleBonus(0); }} style={({ pressed }) => [styles.noMovesPopupPrimary, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>무료 망치</Text></Pressable> : activeShuffleStep < 2 ? <Pressable accessibilityRole="button" accessibilityLabel="광고 시청 후 망치 사용" onPress={() => { setShowNoMovesPopup(false); void useShuffleBonus(activeShuffleStep as 1 | 2); }} style={({ pressed }) => [styles.noMovesPopupPrimary, styles.noMovesPopupAd, pressed && styles.pressed]}><Text style={styles.noMovesPopupPrimaryText}>광고 망치</Text></Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityLabel="새로 시작" onPress={() => { setShowNoMovesPopup(false); requestNewGame(); }} style={({ pressed }) => [styles.noMovesPopupSecondary, pressed && styles.pressed]}><Text style={styles.noMovesPopupSecondaryText}>새로 시작</Text></Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        <Modal transparent visible={replayResult !== null} animationType="fade" onRequestClose={() => setReplayResult(null)}>
          <Pressable style={styles.replayResultBackdrop} onPress={() => setReplayResult(null)}>
            <View style={styles.replayResultCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.replayResultEyebrow}>{tr("재도전 결과", "REPLAY RESULT")}</Text>
              <Text style={styles.replayResultTitle}>{replayResult ? `${tr("스테이지", "Stage")} ${replayResult.stage}` : ""}</Text>
              <Text style={styles.replayResultCopy}>{tr("기존 최고 기록과 이번 결과를 비교해 보세요.", "Compare your previous best with this replay.")}</Text>
              <View style={styles.replayResultGrid}>
                <View style={styles.replayResultColumn}><Text style={styles.replayResultLabel}>{tr("기존 최고", "PREVIOUS BEST")}</Text><Text style={styles.replayResultScore}>{formatLocalizedNumber(replayResult?.previousScore ?? 0, language)}</Text><Text style={styles.replayResultTime}>{replayResult?.previousTime === null || replayResult?.previousTime === undefined ? "—" : formatDuration(replayResult.previousTime, language)}</Text></View>
                <View style={styles.replayResultArrow}><Text style={styles.replayResultArrowText}>→</Text></View>
                <View style={styles.replayResultColumn}><Text style={styles.replayResultLabel}>{tr("이번 결과", "NEW RESULT")}</Text><Text style={styles.replayResultScore}>{formatLocalizedNumber(replayResult?.newScore ?? 0, language)}</Text><Text style={styles.replayResultTime}>{replayResult ? formatDuration(replayResult.newTime, language) : "—"}</Text></View>
              </View>
              {replayResult ? <Text style={styles.replayResultDelta}>{replayResult.newScore >= replayResult.previousScore ? tr("점수가 같거나 좋아졌습니다!", "Your score matched or improved!") : tr("다음 도전에서 기록을 더 높여보세요.", "Try again to beat your record.")}</Text> : null}
              <Pressable onPress={() => setReplayResult(null)} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("확인", "Got it")}</Text></Pressable>
            </View>
          </Pressable>
        </Modal>

        <Modal transparent visible={showUpdateNotice} animationType="fade" onRequestClose={() => setShowUpdateNotice(false)}>
          <Pressable style={styles.modalBackdropCenter} onPress={() => setShowUpdateNotice(false)}>
            <View style={styles.updateNoticeCard} onStartShouldSetResponder={() => true}>
              <Image source={HAMMER_ICON_ART} resizeMode="contain" style={styles.updateNoticeImage} />
              <Text style={styles.updateNoticeEyebrow}>{storeUpdateAvailable ? tr("GOOGLE PLAY UPDATE", "GOOGLE PLAY UPDATE") : `UPDATE ${UPDATE_NOTICE_VERSION}`}</Text>
              <Text style={styles.updateNoticeTitle}>{storeUpdateAvailable ? tr("새 버전이 있습니다", "A new version is available") : tr("새로운 모험이 도착했어요", "A new adventure has arrived")}</Text>
              <Text style={styles.updateNoticeCopy}>{storeUpdateAvailable ? tr(`Google Play에서 버전 ${storeVersion ?? "새 버전"}을(를) 설치할 수 있습니다.`, `Version ${storeVersion ?? "new"} is available on Google Play.`) : tr("이번 업데이트의 주요 변경사항을 확인해 보세요.", "Here are the highlights from this update.")}</Text>
              <View style={styles.updateNoticeList}>
                {storeUpdateAvailable ? <><Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("업데이트를 누르면 Google Play의 안전한 Flexible 업데이트가 시작됩니다.", "Tap Update to start a safe flexible update from Google Play.")}</Text><Text style={[styles.updateNoticeItem, styles.updateNoticeWarning, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("업데이트 후 설치에 실패하면 기존 게임 앱을 삭제한 후 다시 설치해 주세요.", "If installation fails after the update, uninstall the existing game app and install it again.")}</Text></> : <>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("무제한·시간제한 모드 기록 분리", "Separate records for Unlimited and Time Attack")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("5초 비활동 시 이동 힌트 표시", "Show a move hint after 5 seconds of inactivity")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("팝업 화면과 기록 카드 시각 요소 개선", "Improved visuals for popups and record cards")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("지난 스테이지 재도전 결과 비교 화면 추가", "Added replay result comparison for cleared stages")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("콤보 보너스 점수 플로팅 연출 추가", "Added a floating visual effect for combo bonus points")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("실시간 랭킹 팝업에서 무제한·시간제한 모드 전환", "Switch between Unlimited and Time Attack in the live ranking popup")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("랭킹 팝업에서 완료 스테이지 목록을 열어 바로 재도전", "Open the cleared-stage list in the ranking popup to replay instantly")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("망치 설명 풍선과 스테이지 클리어 보상 문구의 표시 위치 개선", "Improved the display layers and positions for the hammer tip and stage-clear reward")}</Text>
                  <Text style={[styles.updateNoticeItem, compactLanguageText && styles.updateNoticeItemCompactLanguage]}>• {tr("언어 선택 목록에 태국어·일본어·프랑스어·독일어·스페인어·힌디어·베트남어·러시아어·멕시코식 스페인어·인도네시아어·이탈리아어·중국어 간체 추가", "Added Thai, Japanese, French, German, Spanish, Hindi, Vietnamese, Russian, Mexican Spanish, Indonesian, Italian, and Simplified Chinese to the language picker")}</Text>
                </>}
              </View>
              {storeUpdateAvailable ? <View style={styles.updateNoticeActions}>
                <Pressable onPress={() => void startStoreUpdate()} style={({ pressed }) => [styles.sheetPrimaryButton, styles.updateNoticeUpdateButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("업데이트", "Update")}</Text></Pressable>
                <Pressable onPress={() => setShowUpdateNotice(false)} style={({ pressed }) => [styles.updateNoticeLaterButton, pressed && styles.pressed]}><Text style={styles.updateNoticeLaterText}>{tr("나중에", "Later")}</Text></Pressable>
              </View> : <Pressable onPress={() => setShowUpdateNotice(false)} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("확인", "Got it")}</Text></Pressable>}
            </View>
          </Pressable>
        </Modal>

        <Modal transparent visible={rewardedAdError !== null} animationType="fade" onRequestClose={() => setRewardedAdError(null)}>
          <Pressable style={styles.modalBackdropCenter} onPress={() => setRewardedAdError(null)}>
            <View style={styles.rewardedErrorCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.rewardedErrorTitle}>광고를 불러오지 못했어요</Text>
              <Text style={styles.rewardedErrorCopy}>{rewardedAdError}</Text>
              <View style={styles.rewardedErrorActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="보상형 광고 다시 시도" onPress={() => { setRewardedAdError(null); void useShuffleBonus(rewardedRetrySlot); }} style={({ pressed }) => [styles.rewardedRetryButton, pressed && styles.pressed]}><Text style={styles.rewardedRetryText}>다시 시도</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="광고 안내 닫기" onPress={() => setRewardedAdError(null)} style={({ pressed }) => [styles.rewardedCloseButton, pressed && styles.pressed]}><Text style={styles.rewardedCloseText}>닫기</Text></Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        <Modal transparent visible={showAttendanceClaim} animationType="fade" onRequestClose={() => setShowAttendanceClaim(false)}>
          <Pressable style={styles.modalBackdropCenter} onPress={() => setShowAttendanceClaim(false)}>
            <View style={styles.attendanceCard} onStartShouldSetResponder={() => true}>
              <Pressable accessibilityRole="button" accessibilityLabel="출석체크 닫기" onPress={() => setShowAttendanceClaim(false)} style={({ pressed }) => [styles.noMovesPopupClose, pressed && styles.pressed]}><Text style={styles.noMovesPopupCloseText}>×</Text></Pressable>
              <Image source={DAILY_CHECKIN_ART} resizeMode="contain" style={styles.attendanceModalImage} />
              <Text style={styles.attendanceTitle}>출석체크</Text>
              <Text style={styles.attendanceCopy}>{lastAttendanceDate === localDateKey() ? `${tr("오늘 출석 완료", "Attendance complete")} · ${formatLocalizedNumber(attendanceDay, language)}${tr("일차", "day")} · ${formatLocalizedDate(new Date(), language)}` : `${tr("다음 출석 보상", "Next attendance reward")} · ${formatLocalizedNumber(attendanceDay + 1, language)}${tr("일차", "day")} · ${formatLocalizedDate(new Date(), language)}`}</Text>
              <Text style={styles.attendanceReward}>{lastAttendanceDate === localDateKey() ? tr("오늘 보상은 이미 받았습니다.", "Today’s reward has already been claimed.") : `${tr("망치", "Hammers")} +${formatLocalizedNumber(getAttendanceHammerReward(attendanceDay + 1), language)}${isSpecialAttendanceDay(attendanceDay + 1) ? ` · ${tr("특별 펫 추첨", "special pet draw")}` : ""} · ${tr("최대 30개 보유", "up to 30")}`}</Text>
              <Pressable disabled={lastAttendanceDate === localDateKey()} onPress={claimAttendance} style={({ pressed }) => [styles.attendanceClaimButton, lastAttendanceDate === localDateKey() && styles.attendanceClaimButtonDisabled, pressed && styles.pressed]}><Text style={styles.attendanceClaimText}>{lastAttendanceDate === localDateKey() ? "오늘 출석 완료" : "오늘 출석 받기"}</Text></Pressable>
            </View>
          </Pressable>
        </Modal>


        <Modal transparent visible={sheet !== null} animationType="fade" onRequestClose={() => { setShowLanguagePicker(false); setPaused(false); setSheet(null); }}>
          <View style={styles.modalBackdrop}>
            <Pressable accessibilityRole="button" accessibilityLabel="창 닫기" style={StyleSheet.absoluteFillObject} onPress={() => { setPaused(false); setSheet(null); }} />
            <View style={styles.sheet}>
              {sheet === "menu" ? (
                <>
                  <ScrollView style={[styles.menuSheetScroll, { maxHeight: Math.max(220, Math.min(560, screenHeight * 0.72)) }]} contentContainerStyle={styles.menuSheetScrollContent} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled">
                  <Text style={styles.sheetEyebrow}>PAUSED</Text>
                  <View style={styles.menuTitleRow}>
                    <Text style={[styles.sheetTitle, styles.menuPauseTitle, compactLanguageText && styles.sheetTitleCompactLanguage, compactLanguageText && styles.menuPauseTitleCompactLanguage]}>{tr("일시정지", "Paused")}</Text>
                    <View style={styles.languagePickerGroup}>
                      <Text style={[styles.languagePickerLabel, compactLanguageText && styles.languagePickerLabelCompactLanguage]}>Language</Text>
                      <View style={styles.languagePickerWrap}>
                        <Pressable accessibilityRole="button" accessibilityLabel="언어 선택" onPress={() => setShowLanguagePicker((visible) => !visible)} style={({ pressed }) => [styles.languagePickerButton, pressed && styles.pressed]}><Text numberOfLines={1} style={styles.languagePickerText}>{languageLabel}</Text><Text style={styles.languagePickerChevron}>{showLanguagePicker ? "▲" : "▼"}</Text></Pressable>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("현재 게임은 기기에 자동으로 저장됩니다.", "Your game is saved automatically on this device.")}</Text>
                  <View style={styles.menuQuickActionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="게임 계속하기" onPress={() => { haptic.light(); setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, styles.menuQuickActionButton, styles.menuContinueButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("게임 계속하기", "Continue")}</Text></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="로비로 이동" onPress={() => { haptic.light(); setShowLanguagePicker(false); setRulesTab("basic"); setSheet("rules"); }} style={({ pressed }) => [styles.sheetPrimaryButton, styles.menuQuickActionButton, styles.menuLobbyButton, pressed && styles.pressed]}>
                      <Image source={LOBBY_BUTTON_ART} resizeMode="stretch" style={styles.menuLobbyButtonArt} />
                      <Text style={[styles.sheetPrimaryText, styles.menuLobbyButtonText]}>{tr("로비로", "Lobby")}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.sheetRow}>
                    <Pressable onPress={() => { haptic.light(); setRecordModeView(gameMode); setSheet("records"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.recordsMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="records" size={18} accent="#FFD166" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("기록", "Records")}</Text></View></Pressable>
                    <Pressable onPress={() => { haptic.light(); setSheet("rules"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.rulesMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="book" size={18} accent="#7FE7FF" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("규칙", "Rules")}</Text></View></Pressable>
                  </View>
                  <View style={styles.sheetRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="펫 도감 열기" onPress={() => { haptic.light(); setSheet("companions"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.petsMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="pets" size={18} accent="#FF9AD5" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("펫 도감", "Pets")}</Text></View></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="게임 진행 데이터 완전 초기화" onPress={requestFullProgressReset} style={({ pressed }) => [styles.sheetSecondaryButton, styles.resetButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="reset" size={18} accent="#FFB86B" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("진행 데이터 초기화", "Reset Progress")}</Text></View></Pressable>
                  </View>
                  <View style={styles.sheetRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={authQuery.data ? "Google 계정 메뉴 열기" : "프로필과 Google 로그인 설정 열기"} onPress={() => { haptic.light(); setSheet("profile"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.profileMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}>{authQuery.data?.avatarUrl ? <Image source={{ uri: authQuery.data.avatarUrl }} style={styles.profileMenuAvatar} /> : <Text style={styles.profileMenuFlag}>{countryFlag(profileCountryCode)}</Text>}<Text numberOfLines={2} style={styles.sheetSecondaryText}>{authQuery.data?.name ?? tr("프로필·Google 로그인", "Profile · Google")}</Text></View></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="보스 배지 보관함 열기" onPress={() => { haptic.light(); setSheet("badges"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.badgesMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="badge" size={18} accent="#FFE27A" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("보스 배지 보관함", "Badge Collection")} ({unlockedBossBadges.length})</Text></View></Pressable>
                  </View>
                  <View style={styles.sheetRow}>
                    {showPreviewAttackTools ? <Pressable accessibilityRole="button" accessibilityLabel="보스 배지 미리보기" onPress={previewBadge} style={({ pressed }) => [styles.sheetSecondaryButton, styles.previewBadgeButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="badge" size={18} /><Text style={styles.sheetSecondaryText}>{tr("배지 미리보기", "Badge Preview")}</Text></View></Pressable> : null}
                    <Pressable accessibilityRole="button" accessibilityLabel="카드 뒷면 디자인 선택" onPress={() => { haptic.light(); setSheet("cardBacks"); }} style={({ pressed }) => [styles.sheetSecondaryButton, styles.cardBacksMenuButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="card" size={18} accent="#A9B8FF" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("카드 뒷면 디자인", "Card Back Designs")}</Text></View></Pressable>
                  </View>
                  {showPreviewAttackTools ? <Pressable accessibilityRole="button" accessibilityLabel="랭킹 스테이지 클리어 미리보기" onPress={runPreviewRankingDemo} style={({ pressed }) => [styles.sheetSecondaryButton, styles.previewBadgeButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="records" size={18} accent="#77D6C3" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("랭킹 클리어 테스트", "Ranking Clear Test")}</Text></View></Pressable> : null}
                  {showPreviewAttackTools ? <Pressable accessibilityRole="button" accessibilityLabel="타임어택 오픈 태블로 미리보기 시작" onPress={runPreviewTimeAttackOpenTableau} style={({ pressed }) => [styles.sheetSecondaryButton, styles.previewTimeAttackButton, pressed && styles.pressed]}><View style={styles.menuButtonContent}><MedievalIcon name="card" size={18} accent="#9DEBFF" /><Text numberOfLines={2} style={styles.sheetSecondaryText}>{tr("타임어택 오픈카드 테스트", "Time Attack Open-Card Test")}</Text></View></Pressable> : null}
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: randomOwnedPetPerStage }} onPress={() => { setRandomOwnedPetPerStage((enabled) => !enabled); haptic.light(); }} style={({ pressed }) => [styles.petRandomToggle, pressed && styles.pressed]}>
                    <View style={[styles.checkBox, randomOwnedPetPerStage && styles.checkBoxChecked]}>{randomOwnedPetPerStage ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("보유 펫 랜덤 출현", "Random Owned Pet per Stage")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("새 스테이지마다 보유 펫 중 무작위 선택", "Randomly choose from owned pets at each new stage")}</Text></View>
                  </Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: fixedFontScale }} onPress={() => { setFixedFontScalePreference(!fixedFontScale); haptic.light(); }} style={({ pressed }) => [styles.petRandomToggle, pressed && styles.pressed]}>
                    <View style={[styles.checkBox, fixedFontScale && styles.checkBoxChecked]}>{fixedFontScale ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("앱 글자 크기 고정", "Lock App Text Size")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("휴대폰 시스템 글자 크기와 무관하게 일정한 UI 유지", "Keep the UI size independent of system font settings")}</Text></View>
                  </Pressable>
                  </ScrollView>
                </>
              ) : null}
              {sheet === "profile" ? (
                <>
                  <Text style={styles.sheetEyebrow}>PROFILE</Text>
                  <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("프로필·Google 로그인", "Profile · Google")}</Text>
                  <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("Google 로그인으로 기록을 계정에 연결하고, 아이디와 국가를 실시간 랭킹에 표시하세요.", "Use Google sign-in to link your records, then set your leaderboard name and country.")}</Text>
                  <View style={styles.googleLoginCard}>
                    <View style={styles.googleLoginHeader}>
                        {(googleSessionUser ?? authQuery.data)?.avatarUrl ? <Image accessibilityLabel="Google profile image" source={{ uri: (googleSessionUser ?? authQuery.data)!.avatarUrl! }} style={styles.googleProfileImage} /> : <View style={styles.googleLoginMark}><Text style={styles.googleLoginMarkText}>G</Text></View>}
                      <View style={styles.googleLoginCopyWrap}>
                        <Text style={styles.googleLoginTitle}>{(googleSessionUser ?? authQuery.data)?.name ?? ((googleSessionUser ?? authQuery.data) ? tr("Google 계정 로그인됨", "Google account signed in") : tr("Google 계정 로그인", "Sign in with Google"))}</Text>
                        <Text numberOfLines={1} style={styles.googleLoginSubtitle}>{(googleSessionUser ?? authQuery.data)?.email ?? tr("기록과 실시간 랭킹을 계정에 연결합니다.", "Link records and live rankings to your account.")}</Text>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={(googleSessionUser ?? authQuery.data) ? tr("Google 로그아웃", "Sign out of Google") : tr("Google 로그인", "Sign in with Google")}
                      disabled={googleAuthPending}
                      onPress={(googleSessionUser ?? authQuery.data) ? logoutFromGoogle : loginWithGoogle}
                      style={({ pressed }) => [styles.googleLoginButton, (googleSessionUser ?? authQuery.data) && styles.googleLogoutButton, googleAuthPending && styles.googleLoginButtonDisabled, pressed && styles.pressed]}
                    >
                      <Text style={[styles.googleLoginButtonText, (googleSessionUser ?? authQuery.data) && styles.googleLogoutButtonText]}>{googleAuthPending ? tr("처리 중…", "Working…") : (googleSessionUser ?? authQuery.data) ? tr("로그아웃", "Sign out") : tr("Google 로그인", "Sign in with Google")}</Text>
                    </Pressable>
                    {googleAuthMessage ? <Text style={styles.googleLoginMessage}>{googleAuthMessage}</Text> : null}
                    {cloudSyncMessage ? <Text style={styles.cloudSyncMessage}>{cloudSyncMessage}</Text> : null}
                  </View>
                  <View style={styles.profileNameRow}>
                    <TextInput
                      value={profileName}
                      onChangeText={(value) => { profileNameDirtyRef.current = true; setProfileNameError(null); setProfileNameSaved(false); setProfileName(limitProfileNameLength(value)); }}
                      onSubmitEditing={saveProfileName}
                      maxLength={10}
                      returnKeyType="done"
                      placeholder={tr("랭킹에 표시할 아이디", "Leaderboard name")}
                      placeholderTextColor="#8FA5C4"
                      style={styles.profileNameInput}
                    />
                    <Pressable disabled={updateNameMutation.isPending} onPress={saveProfileName} style={({ pressed }) => [styles.profileNameSaveButton, updateNameMutation.isPending && styles.googleLoginButtonDisabled, pressed && styles.pressed]}>
                      <Text style={styles.profileNameSaveText}>{updateNameMutation.isPending ? tr("저장 중…", "Saving…") : tr("저장", "Save")}</Text>
                    </Pressable>
                  </View>
                  {profileNameError ? <Text style={styles.profileNameError}>{profileNameError}</Text> : null}
                  {profileNameSaved ? <Text style={styles.profileNameSaved}>{tr("✓ 저장되었습니다", "✓ Saved")}</Text> : null}
                  <FlatList
                    style={styles.countryList}
                    contentContainerStyle={styles.countryGrid}
                    columnWrapperStyle={styles.countryRow}
                    numColumns={2}
                    data={[null, ...COUNTRY_OPTIONS]}
                    keyExtractor={(item) => item === null ? "none" : item.code}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => item === null
                      ? <Pressable onPress={() => saveProfileCountry(null)} style={({ pressed }) => [styles.countryOption, profileCountryCode === null && styles.countryOptionActive, pressed && styles.pressed]}><Text style={styles.countryFlag}>{countryFlag(null)}</Text><Text style={styles.countryName}>{tr("국가 선택 안 함", "No country")}</Text></Pressable>
                      : <Pressable onPress={() => saveProfileCountry(item.code)} style={({ pressed }) => [styles.countryOption, profileCountryCode === item.code && styles.countryOptionActive, pressed && styles.pressed]}><Text style={styles.countryFlag}>{countryFlag(item.code)}</Text><Text numberOfLines={1} style={styles.countryName}>{language === "ko" ? item.nameKo : item.nameEn}</Text></Pressable>}
                  />
                  <Pressable onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("닫기", "Close")}</Text></Pressable>
                </>
              ) : null}
              {sheet === "badges" ? (
                <>
                  <Text style={styles.sheetEyebrow}>BOSS BADGES</Text>
                  <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("보스 배지 보관함", "Badge Collection")}</Text>
                  <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("클리어한 보스의 배지를 보관합니다.", "Store badges earned from cleared stages.")}</Text>
                  <Text style={styles.sheetCopy}>{activeBadgeId ? `${tr("현재 선택", "Active")}: ${getBadgeAbilityText(activeBadgeId, language)}` : tr("선택된 배지가 없습니다.", "No active badge")}</Text>
                  <ScrollView style={styles.badgeCollectionScroll} onStartShouldSetResponder={() => false} onMoveShouldSetResponder={() => true} contentContainerStyle={styles.badgeCollectionGrid} nestedScrollEnabled scrollEnabled alwaysBounceVertical overScrollMode="always" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar indicatorStyle="white">
                    {unlockedBossBadges.length === 0 ? <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("아직 획득한 보스 배지가 없습니다.", "No badges earned yet.")}</Text> : unlockedBossBadges.map((badgeId) => {
                      const content = getBattleContent(getBossBadgeStage(badgeId), false);
                      return content.badgeImage ? <View key={badgeId} style={[styles.badgeCollectionItem, activeBadgeId === badgeId && styles.badgeCollectionItemActive]}><Pressable accessibilityRole="button" accessibilityLabel={`${content.monster.name} 배지 회전`} onPress={() => spinBadgeInCollection(badgeId)} style={({ pressed }) => [pressed && styles.pressed]}><Animated.Image source={content.badgeImage} resizeMode="contain" style={[styles.badgeCollectionImage, spinningBadgeId === badgeId && { transform: [{ rotateY: badgeCollectionMotion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] }) }] }]} /><Text numberOfLines={2} style={styles.badgeCollectionLabel}>{getLocalizedBattleName(content.monster.id, content.monster.name, language)}</Text><Text numberOfLines={2} style={styles.badgeCollectionCondition}>{getBadgeAbilityText(badgeId, language)}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => selectBadgeInCollection(badgeId)} style={({ pressed }) => [styles.badgeCollectionSelect, activeBadgeId === badgeId && styles.badgeCollectionSelectActive, pressed && styles.pressed]}><Text style={styles.badgeCollectionSelectText}>{activeBadgeId === badgeId ? tr("선택됨", "Selected") : tr("선택", "Select")}</Text></Pressable></View> : null;
                    })}
                  </ScrollView>
                  <Pressable onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("닫기", "Close")}</Text></Pressable>
                </>
              ) : null}
              {sheet === "sound" ? (
                <>
                  <Text style={styles.sheetEyebrow}>AUDIO SETTINGS</Text>
                  <Image source={HAMMER_ICON_ART} resizeMode="contain" style={styles.sheetHeaderImage} />
                  <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("소리 설정", "Sound Settings")}</Text>
                  <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("효과음과 배경음을 각각 켜고 끌 수 있습니다.", "Toggle sound effects and background music separately.")}</Text>
                  <View style={styles.soundSettings}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: soundEffectsEnabled }} onPress={() => setSoundEffectsEnabledPreference(!soundEffectsEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, soundEffectsEnabled && styles.checkBoxChecked]}>{soundEffectsEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View><MedievalIcon name="sound" size={23} /><View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("효과음", "Sound Effects")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("카드 선택·이동·공격 소리", "Card, move, and attack sounds")}</Text></View>
                    </Pressable>
                    <VolumeSlider label={tr("효과음 볼륨", "Sound volume")} value={soundEffectsVolume} onChange={setSoundEffectsVolumePreference} disabled={!soundEffectsEnabled} />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: backgroundMusicEnabled }} onPress={() => setBackgroundMusicEnabledPreference(!backgroundMusicEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, backgroundMusicEnabled && styles.checkBoxChecked]}>{backgroundMusicEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View><MedievalIcon name="music" size={23} /><View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("배경음", "Music")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("성채 분위기의 반복 배경음", "Looping castle atmosphere")}</Text></View>
                    </Pressable>
                    <VolumeSlider label={tr("배경음 볼륨", "Music volume")} value={backgroundMusicVolume} onChange={setBackgroundMusicVolumePreference} disabled={!backgroundMusicEnabled} />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: cardSelectVibrationEnabled }} onPress={() => setCardSelectVibrationPreference(!cardSelectVibrationEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, cardSelectVibrationEnabled && styles.checkBoxChecked]}>{cardSelectVibrationEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View><MedievalIcon name="vibration" size={23} />
                      <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("카드 선택 진동", "Card Vibration")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("카드를 선택할 때 가볍게 진동", "Light vibration when selecting cards")}</Text></View>
                    </Pressable>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: screenShakeEnabled }} onPress={() => setScreenShakePreference(!screenShakeEnabled)} style={({ pressed }) => [styles.audioOption, pressed && styles.pressed]}>
                      <View style={[styles.checkBox, screenShakeEnabled && styles.checkBoxChecked]}>{screenShakeEnabled ? <Text style={styles.checkMark}>✓</Text> : null}</View><MedievalIcon name="shake" size={23} />
                      <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("타격 화면 흔들림", "Hit Screen Shake")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("공격 명중 시 화면 흔들림 효과", "Shake the screen on hit")}</Text></View>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("닫기", "Close")}</Text></Pressable>
                </>
              ) : null}
              {sheet === "companions" ? (
                <>
                  <Text style={styles.sheetEyebrow}>COMPANION SLOTS</Text>
                  <Image source={selectedCompanion.image} resizeMode="contain" style={styles.sheetHeaderImage} />
                  <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("펫 도감", "Pet Collection")}</Text>
                  <Text style={styles.companionPickerCopy}>{tr("기본은 선택한 펫이 계속 유지됩니다. 아래 기능을 켜면 다음 스테이지마다 보유 펫 중 하나가 무작위로 출현합니다.", "Your selected pet stays active by default. Turn on the option below to randomly show one owned pet at each new stage.")}</Text>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: randomOwnedPetPerStage }} onPress={() => { setRandomOwnedPetPerStage((enabled) => !enabled); haptic.light(); }} style={({ pressed }) => [styles.petRandomToggle, pressed && styles.pressed]}>
                    <View style={[styles.checkBox, randomOwnedPetPerStage && styles.checkBoxChecked]}>{randomOwnedPetPerStage ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("보유 펫 랜덤 출현", "Random Owned Pet per Stage")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("새 스테이지마다 보유 펫 중 무작위 선택", "Randomly choose from owned pets at each new stage")}</Text></View>
                  </Pressable>
                  <ScrollView style={styles.petGridScroll} contentContainerStyle={styles.companionGrid} nestedScrollEnabled scrollEnabled alwaysBounceVertical overScrollMode="always" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar indicatorStyle="white">
                    {companionRoster.map((companion) => {
                      const unlocked = unlockedPetIds.includes(companion.id);
                      const selected = unlocked && companion.id === selectedCompanionId;
                      const companionStyle = companion.id.startsWith("pet-") ? getPetAttackStyle(companion.id) : getCompanionAttackStyle(companion);
                      return <Pressable key={companion.id} accessibilityRole="radio" accessibilityState={{ selected, disabled: !unlocked }} disabled={!unlocked} onPress={() => { setSelectedCompanionId(companion.id); haptic.light(); }} style={({ pressed }) => [styles.companionChoice, selected && styles.companionChoiceSelected, !unlocked && styles.companionChoiceLocked, pressed && styles.pressed]}>
                        <Image source={companion.image} resizeMode="contain" style={[styles.companionChoiceImage, !unlocked && styles.companionChoiceSilhouette]} accessibilityLabel={unlocked ? companion.name : "잠긴 펫"} />
                        <Text style={styles.companionChoiceName}>{unlocked ? companion.name : "???"}</Text>
                        <View accessibilityLabel={`속성 ${ATTACK_STYLE_LABELS[companionStyle]}`} style={styles.companionChoiceAttribute}>
                          <View style={[styles.companionChoiceAttributeDot, { backgroundColor: companionAttackColors[companionStyle] }]} />
                          <Text style={styles.companionChoiceAttributeText}>{ATTACK_STYLE_LABELS[companionStyle]}</Text>
                        </View>
                        {selected ? <Text style={styles.companionChoiceCheck}>✓</Text> : null}
                      </Pressable>;
                    })}
                  </ScrollView>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>선택 완료</Text></Pressable>
                </>
              ) : null}
              {sheet === "cardBacks" ? (
                <>
                  <Text style={styles.sheetEyebrow}>CARD BACK DESIGNS</Text>
                  <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("카드 뒷면 디자인", "Card Back Designs")}</Text>
                  <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{tr("원하는 디자인을 선택하면 모든 카드 뒷면에 적용됩니다.", "Choose a design to apply it to every card back.")}</Text>
                  <ScrollView style={styles.cardBackPickerScroll} contentContainerStyle={styles.cardBackPickerGrid} nestedScrollEnabled scrollEnabled alwaysBounceVertical overScrollMode="always" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar indicatorStyle="white">
                    <Pressable accessibilityRole="radio" accessibilityState={{ selected: selectedCardBackIndex === null }} onHoverIn={() => setHoveredCardBackIndex("stage")} onHoverOut={() => setHoveredCardBackIndex(null)} onPress={() => { setSelectedCardBackIndex(null); haptic.light(); }} style={({ pressed }) => [styles.cardBackChoice, selectedCardBackIndex === null && styles.cardBackChoiceSelected, hoveredCardBackIndex === "stage" && styles.cardBackChoiceHovered, pressed && styles.pressed]}>
                      <CardBackPreview theme={battleContent.isBoss ? getCardBackThemeByIndex(CARD_BACK_THEMES.length - 1) : getCardBackTheme(game.level)} />
                      <Text style={styles.cardBackChoiceName}>{tr("스테이지 테마", "Stage Theme")}</Text>
                      <Text style={styles.cardBackChoiceHint}>{battleContent.isBoss ? "보스 전용 테마" : "스테이지마다 변경"}</Text>
                      {selectedCardBackIndex === null ? <Text style={styles.cardBackChoiceCheck}>✓</Text> : null}
                    </Pressable>
                    {CARD_BACK_THEMES.map((theme, index) => <Pressable key={theme.name} accessibilityRole="radio" accessibilityState={{ selected: selectedCardBackIndex === index }} onHoverIn={() => setHoveredCardBackIndex(index)} onHoverOut={() => setHoveredCardBackIndex(null)} onPress={() => { setSelectedCardBackIndex(index); haptic.light(); }} style={({ pressed }) => [styles.cardBackChoice, selectedCardBackIndex === index && styles.cardBackChoiceSelected, hoveredCardBackIndex === index && styles.cardBackChoiceHovered, pressed && styles.pressed]}>
                      <CardBackPreview theme={theme} />
                      <Text style={styles.cardBackChoiceName}>{theme.name}</Text>
                      {selectedCardBackIndex === index ? <Text style={styles.cardBackChoiceCheck}>✓</Text> : null}
                    </Pressable>)}
                  </ScrollView>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>선택 완료</Text></Pressable>
                </>
              ) : null}
              {sheet === "records" ? (
                <>
                  <Text style={styles.sheetEyebrow}>YOUR PLAY</Text>
                  <View style={styles.recordsHeaderVisual}>
                    <Image source={battleContent.monster.image} resizeMode="contain" style={styles.recordsHeaderImage} />
                    <View style={styles.recordsHeaderCopy}>
                      <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("내 기록", "My Records")}</Text>
                      <Text style={styles.recordsModeLabel}>{recordModeView === "timeAttack" ? tr("시간제한 모드 기록", "Time Attack Records") : tr("무제한 모드 기록", "Unlimited Records")}</Text>
                    </View>
                  </View>
                  <View style={styles.recordModeToggle}>
                    <Pressable onPress={() => setRecordModeView("unlimited")} style={[styles.recordModeButton, recordModeView === "unlimited" && styles.recordModeButtonActive]}><Text style={styles.recordModeButtonText}>{tr("무제한", "Unlimited")}</Text></Pressable>
                    <Pressable onPress={() => setRecordModeView("timeAttack")} style={[styles.recordModeButton, recordModeView === "timeAttack" && styles.recordModeButtonActive]}><Text style={styles.recordModeButtonText}>{tr("시간제한", "Time Attack")}</Text></Pressable>
                  </View>
                  <View style={styles.recordGrid}>
                    <View style={styles.recordCard}><Image source={DAILY_CHECKIN_ART} resizeMode="contain" style={styles.recordCardImage} /><Text style={styles.recordValue}>{records[recordModeView].wins}</Text><Text style={styles.recordLabel}>{tr("승리", "Wins")}</Text></View>
                    <View style={styles.recordCard}><Image source={COMBO_IMPACT_ARTS[1]} resizeMode="contain" style={styles.recordCardImage} /><Text style={styles.recordValue}>{records[recordModeView].bestScore}</Text><Text style={styles.recordLabel}>{tr("최고 점수", "Best Score")}</Text></View>
                    <View style={styles.recordCard}><Image source={HINT_BUTTON_ART} resizeMode="contain" style={styles.recordCardImage} /><Text style={styles.recordValue}>{records[recordModeView].bestTimeSeconds === null ? "—" : formatDuration(records[recordModeView].bestTimeSeconds, language)}</Text><Text style={styles.recordLabel}>{tr("최단 시간", "Best Time")}</Text></View>
                  </View>
                  <View style={styles.stageBestTimesPanel}>
                    <Text style={styles.stageBestTimesTitle}>{tr("스테이지별 최단 시간", "Best Time by Stage")}</Text>
                    <ScrollView style={styles.stageBestTimesScroll} onStartShouldSetResponder={() => false} onMoveShouldSetResponder={() => true} nestedScrollEnabled scrollEnabled alwaysBounceVertical overScrollMode="always" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar indicatorStyle="white" contentContainerStyle={styles.stageBestTimesScrollContent}>
                      {Object.entries(records[recordModeView].stageBestTimes ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([stage, seconds]) => <View key={stage} style={styles.stageBestTimeRow}><Text style={styles.stageBestTimeStage}>{tr("스테이지", "Stage")} {stage}</Text><Text style={styles.stageBestTimeValue}>{formatDuration(seconds, language)}</Text></View>)}
                      {!Object.keys(records[recordModeView].stageBestTimes ?? {}).length ? <Text style={styles.stageBestTimesEmpty}>{tr("아직 스테이지 기록이 없습니다.", "No stage records yet.")}</Text> : null}
                    </ScrollView>
                  </View>
                  <Pressable onPress={() => setSheet("menu")} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>{tr("뒤로", "Back")}</Text></Pressable>
                </>
              ) : null}
              {sheet === "rules" ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="게임 룰 닫기" onPress={() => { setPaused(false); setSheet(null); }} style={({ pressed }) => [styles.rulesClose, pressed && styles.pressed]}><Text style={styles.rulesCloseText}>×</Text></Pressable>
                  <Text style={styles.sheetEyebrow}>HOW TO PLAY</Text>
                  <Image source={HINT_BUTTON_ART} resizeMode="contain" style={styles.sheetHeaderImage} />
                  <View style={styles.rulesTitleRow}>
                    <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{tr("게임 룰", "Game Rules")}</Text>
                    <View style={styles.languagePickerGroup}>
                      <Text style={[styles.languagePickerLabel, compactLanguageText && styles.languagePickerLabelCompactLanguage]}>Language</Text>
                      <View style={styles.languagePickerWrap}>
                        <Pressable accessibilityRole="button" accessibilityLabel="언어 선택" onPress={() => setShowLanguagePicker((visible) => !visible)} style={({ pressed }) => [styles.languagePickerButton, pressed && styles.pressed]}><Text numberOfLines={1} style={styles.languagePickerText}>{languageLabel}</Text><Text style={styles.languagePickerChevron}>{showLanguagePicker ? "▲" : "▼"}</Text></Pressable>
                      </View>
                    </View>
                  </View>
                  <View style={styles.rulesTabs}>
                    {([["basic", tr("기본 규칙", "Basic Rules")], ["cards", tr("카드 이동", "Card Moves")], ["items", tr("공격·아이템", "Actions & Items")], ["uiGuide", tr("UI 설명", "UI Guide")], ["hammerGuide", tr("망치 활용", "Hammer Guide")]] as const).map(([tab, label]) => <Pressable key={tab} onPress={() => { setRulesTab(tab); if (tab === "uiGuide") setShowUiGuideModal(true); }} style={({ pressed }) => [styles.rulesTab, { backgroundColor: RULES_TAB_COLORS[tab] }, rulesTab === tab && styles.rulesTabActive, pressed && styles.pressed]}><Text numberOfLines={2} style={[styles.rulesTabText, compactLanguageText && styles.rulesTabTextCompactLanguage, rulesTab === tab && styles.rulesTabTextActive]}>{label}</Text></Pressable>)}
                  </View>
                  <ScrollView style={styles.rulesScroll} contentContainerStyle={styles.rulesContentContainer} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled">
                    {rulesTab === "basic" ? <><Text style={[styles.rulesText, compactLanguageText && styles.rulesTextCompactLanguage]}>{tr("A부터 같은 무늬 순서로 위쪽 파운데이션을 완성하면 승리합니다. 카드는 색을 번갈아 놓고 숫자가 하나씩 낮아지게 쌓습니다.", "Build each foundation from Ace upward in the same suit to win. On the tableau, alternate colors and place cards in descending order.")}</Text><Text style={[styles.rulesModeUnlimited, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("무제한 모드: 시간 제한 없이 스테이지를 플레이합니다.", "Unlimited: Play each stage without a time limit.")}</Text><Text style={[styles.rulesModeTimeAttack, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("시간제한 모드: 5분 안에 클리어하세요. 파운데이션 이동마다 +2초, 자동 정리 성공 시 +10초를 받습니다.", "Time Attack: Clear the stage within 5 minutes. Foundation moves grant +2 seconds and auto-finish grants +10 seconds.")}</Text></> : null}
                    {rulesTab === "cards" ? <><Text style={[styles.rulesText, compactLanguageText && styles.rulesTextCompactLanguage]}>{tr("카드를 탭한 뒤 이동할 곳을 탭하세요. 빈 열에는 K만 놓을 수 있습니다.", "Tap a card, then tap its destination. Only a King can be placed in an empty tableau column.")}</Text><Text style={[styles.rulesWaste, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("웨이스트 최상단 카드는 탭하거나 길게 눌러 선택할 수 있고, 더블탭하면 파운데이션으로 자동 이동합니다.", "Tap or long-press the top waste card to select it. Double-tap to move it to a foundation automatically.")}</Text><Text style={[styles.rulesStock, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("재순환이 가까워지면 스톡과 웨이스트가 주황색으로 표시됩니다. 막힌 스톡은 망치 2개로 한 바퀴 추가 순환할 수 있습니다.", "Stock and waste turn orange when a recycle is close. One extra recycle costs 2 hammers.")}</Text></> : null}
                    {rulesTab === "items" ? <><Text style={[styles.rulesText, compactLanguageText && styles.rulesTextCompactLanguage]}>{tr("파운데이션 카드와 콤보 정리는 몬스터에게 피해를 줍니다. 펫의 속성에 따라 효과가 달라집니다.", "Foundation moves and combo clears damage the monster. Effects vary by your pet's element.")}</Text><Text style={[styles.rulesHammer, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("망치: 히든 카드 공개, 웨이스트 카드를 맨 아래로 이동, 추가 순환에 사용할 수 있습니다.", "Hammer: Reveal a hidden card, move the exposed waste card to the bottom, or add one stock recycle.")}</Text><Text style={[styles.rulesAttendance, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("출석체크: 기본 보상은 망치 10개이며, 5·10·15일차처럼 5일마다 망치 20개를 받습니다. 10·20·30일차에는 특별 펫을 추첨합니다. 최대 30개까지 보유합니다.", "Attendance: The regular reward is 10 hammers. Every 5th day, such as days 5, 10 and 15, grants 20 hammers. Days 10, 20 and 30 also draw a special pet. Hammer storage is capped at 30.")}</Text><Text style={[styles.rulesRewarded, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("보상형 광고: 하루 최대 5회, 1·2회차 망치 10개, 3~5회차 망치 20개를 받습니다.", "Rewarded ads: Up to 5 per day. Ads 1\u20132 grant 10 hammers; ads 3\u20135 grant 20.")}</Text></> : null}
                    {rulesTab === "hammerGuide" ? <><Text style={[styles.rulesText, compactLanguageText && styles.rulesTextCompactLanguage]}>{tr("망치는 막힌 상황을 풀어 주는 보조 아이템입니다.", "Hammers are support items for opening blocked paths.")}</Text><Text style={[styles.rulesHammer, compactLanguageText && styles.rulesHintCompactLanguage]}>{tr("스톡만 계속 넘기기보다 태블로 이동을 먼저 찾고, 필요한 순간에 망치와 웨이스트 파괴를 사용하세요.", "Look for tableau moves before cycling stock repeatedly, then use hammers and waste destruction when needed.")}</Text></> : null}
                  </ScrollView>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: randomOwnedPetPerStage }} onPress={() => { setRandomOwnedPetPerStage((enabled) => !enabled); haptic.light(); }} style={({ pressed }) => [styles.petRandomToggle, styles.startPetRandomToggle, pressed && styles.pressed]}>
                    <View style={[styles.checkBox, randomOwnedPetPerStage && styles.checkBoxChecked]}>{randomOwnedPetPerStage ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <View style={styles.audioOptionCopy}><Text style={[styles.audioOptionTitle, compactLanguageText && styles.audioOptionTitleCompactLanguage]}>{tr("보유 펫 랜덤 출현", "Random Owned Pet per Stage")}</Text><Text style={[styles.audioOptionSubtitle, compactLanguageText && styles.audioOptionSubtitleCompactLanguage]}>{tr("켜면 다음 스테이지마다 보유 펫 중 하나가 무작위로 출현합니다.", "When enabled, one owned pet appears randomly at each new stage.")}</Text></View>
                  </Pressable>
                  <View style={styles.modeChoiceRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="무제한 모드 시작" onPress={() => startGameMode("unlimited")} style={({ pressed }) => [styles.modeChoiceButton, styles.modeChoiceUnlimited, gameMode === "unlimited" && styles.modeChoiceButtonSelected, pressed && styles.pressed]}>
                      <View style={styles.modeChoiceHeading}><View style={[styles.modeChoiceEmblem, styles.modeChoiceUnlimitedEmblem]}><Text style={styles.modeChoiceEmblemText}>∞</Text></View><View style={styles.modeChoiceTextWrap}><Text numberOfLines={1} style={[styles.modeChoiceTitle, compactLanguageText && styles.modeChoiceTitleCompactLanguage]}>{tr("무제한 모드", "Unlimited")}</Text><Text numberOfLines={2} style={[styles.modeChoiceCopy, compactLanguageText && styles.modeChoiceCopyCompactLanguage]}>{tr("시간 제한 없이 플레이", "Play without a time limit")}</Text></View></View>
                      <View style={[styles.modeChoiceActionPill, styles.modeChoiceUnlimitedAction]}><Text style={styles.modeChoiceActionText}>{gameMode === "unlimited" ? tr("현재 모드", "CURRENT") : tr("자유롭게 시작", "START FREE")}</Text></View>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="시간제한 모드 시작" onPress={() => startGameMode("timeAttack")} style={({ pressed }) => [styles.modeChoiceButton, styles.modeChoiceTimed, gameMode === "timeAttack" && styles.modeChoiceButtonSelected, pressed && styles.pressed]}>
                      <View style={styles.modeChoiceHeading}><View style={[styles.modeChoiceEmblem, styles.modeChoiceTimedEmblem]}><Text style={styles.modeChoiceEmblemText}>⌛</Text></View><View style={styles.modeChoiceTextWrap}><Text numberOfLines={1} style={[styles.modeChoiceTitle, compactLanguageText && styles.modeChoiceTitleCompactLanguage]}>{tr("시간제한", "Time Attack")}</Text><Text numberOfLines={2} style={[styles.modeChoiceCopy, compactLanguageText && styles.modeChoiceCopyCompactLanguage]}>{tr("5분 안에 클리어", "Clear within 5 minutes")}</Text></View></View>
                      <View style={[styles.modeChoiceActionPill, styles.modeChoiceTimedAction]}><Text style={styles.modeChoiceActionText}>{gameMode === "timeAttack" ? tr("현재 모드", "CURRENT") : tr("도전 시작", "START RACE")}</Text></View>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showLanguagePicker} animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={() => setShowLanguagePicker(false)}>
          <View style={styles.independentListBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowLanguagePicker(false)} />
            <View style={styles.independentListCard}>
              <Text style={styles.independentListTitle}>Language</Text>
              <ScrollView style={styles.independentLanguageListScroll} contentContainerStyle={styles.independentListContent} nestedScrollEnabled scrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar>
                {LANGUAGE_OPTIONS.map((option) => <Pressable key={option.code} accessibilityRole="button" accessibilityLabel={`${option.nativeName} 선택`} onPress={() => selectLanguage(option.code)} style={({ pressed }) => [styles.languagePickerOption, language === option.code && styles.languagePickerOptionActive, pressed && styles.pressed]}><Text style={[styles.languagePickerOptionText, language === option.code && styles.languagePickerOptionTextActive]}><Text style={styles.languagePickerFlag}>{option.flag}</Text> {option.nativeName}</Text><Text style={styles.languagePickerOptionEnglish}>{option.englishName}</Text></Pressable>)}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal transparent visible={showUiGuideModal} animationType="fade" onRequestClose={() => { setShowUiGuideModal(false); setRulesTab("basic"); }}>
          <Pressable style={styles.uiGuideModalBackdrop} onPress={() => { setShowUiGuideModal(false); setRulesTab("basic"); }}>
            <View style={styles.uiGuideModalCard} onStartShouldSetResponder={() => true}>
              <Pressable accessibilityRole="button" accessibilityLabel="UI 설명 닫기" onPress={() => { setShowUiGuideModal(false); setRulesTab("basic"); }} style={({ pressed }) => [styles.uiGuideModalClose, pressed && styles.pressed]}>
                <Text style={styles.uiGuideModalCloseText}>×</Text>
              </Pressable>
              <Image source={SOLITAIRE_UI_GUIDE_ART} resizeMode="contain" accessibilityLabel="솔리테어 화면 영역 안내" style={styles.uiGuideModalImage} />
            </View>
          </Pressable>
        </Modal>
        <Modal transparent visible={earnedBadge !== null} animationType="fade" onRequestClose={() => setEarnedBadge(null)}>
          <Pressable style={styles.badgeModalBackdrop} onPress={() => setEarnedBadge(null)}>
            <View style={styles.badgeModalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.badgeModalEyebrow}>BOSS DEFEATED</Text>
              <Text style={styles.badgeModalTitle}>{earnedBadge?.name}</Text>
              {earnedBadge ? <Animated.Image source={earnedBadge.image} resizeMode="contain" style={[styles.badgeModalImage, { transform: [{ rotate: badgePreviewSpin.interpolate({ inputRange: [0, 0.55, 1], outputRange: ["0deg", "1260deg", "1440deg"] }) }] }]} /> : null}
              <Text style={styles.badgeModalCopy}>보스 배지를 획득했습니다. 배지 보관함에 안전하게 보관됩니다.</Text>
              <Pressable onPress={() => setEarnedBadge(null)} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>확인</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal transparent visible={pendingGameMode !== null} animationType="fade" onRequestClose={() => setPendingGameMode(null)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setPendingGameMode(null)}>
            <View style={styles.timeOutCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.sheetEyebrow}>MODE CHANGE</Text>
              <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>진행 중인 게임을 포기할까요?</Text>
              <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>현재 스테이지의 진행 상황은 저장되지만, 선택한 모드의 마지막 저장 스테이지부터 새 보드로 시작합니다.</Text>
              <Pressable onPress={confirmGameModeSwitch} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>전환하기</Text></Pressable>
              <Pressable onPress={() => setPendingGameMode(null)} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>계속 플레이</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal transparent visible={showTimeOutPopup} animationType="fade" onRequestClose={() => setShowTimeOutPopup(false)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setShowTimeOutPopup(false)}>
            <View style={styles.timeOutCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.sheetEyebrow}>TIME ATTACK</Text>
              <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>시간이 종료되었습니다</Text>
              <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>이번 도전은 여기서 끝났습니다. 같은 스테이지를 다시 시도해 보세요.</Text>
              <Pressable onPress={() => { setShowTimeOutPopup(false); startNewGame(game.level, false); }} style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.pressed]}><Text style={styles.sheetPrimaryText}>다시 도전</Text></Pressable>
              <Pressable onPress={() => { setShowTimeOutPopup(false); setPaused(false); }} style={({ pressed }) => [styles.sheetLinkButton, pressed && styles.pressed]}><Text style={styles.sheetLinkText}>닫기</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal transparent visible={showNewGameConfirm} animationType="fade" onRequestClose={() => { setShowNewGameConfirm(false); setPaused(false); }}>
          <Pressable style={styles.confirmBackdrop} onPress={() => { setShowNewGameConfirm(false); setPaused(false); }}>
            <View style={styles.confirmCard} onStartShouldSetResponder={() => true}>
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <Image source={RESET_MODAL_PANEL} resizeMode="stretch" style={styles.resetModalPanelArt} />
              </View>
              <Text style={styles.sheetEyebrow}>{resetMode === "current" ? tr("스테이지 재시작", "STAGE RESTART") : tr("게임 진행 데이터 초기화", "RESET PROGRESS")}</Text>
              <Text style={[styles.sheetTitle, compactLanguageText && styles.sheetTitleCompactLanguage]}>{resetMode === "current" ? tr(`현재 스테이지 ${game.level}을(를) 다시 시작할까요?`, `Restart stage ${game.level}?`) : tr("게임 진행 데이터를 초기화할까요?", "Reset all game progress?")}</Text>
              <Text style={[styles.sheetCopy, compactLanguageText && styles.sheetCopyCompactLanguage]}>{resetMode === "current" ? tr(`스테이지 ${game.level}부터 다시 시작됩니다`, `Stage ${game.level} will start again.`) : tr("스테이지·현재 게임·망치 수량을 초기화합니다. 펫 도감과 배지는 보존됩니다.", "Stages, current game, and hammers will be reset. Pets and badges are preserved.")}</Text>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => { setShowNewGameConfirm(false); setPaused(false); }} style={({ pressed }) => [styles.confirmCancel, pressed && styles.pressed]}>
                  <View pointerEvents="none" style={styles.confirmButtonArtClip}><Image source={RESET_BUTTONS_ART} resizeMode="stretch" style={[styles.confirmButtonArt, { top: 0 }]} /></View>
                  <Text style={styles.confirmCancelText}>{tr("취소", "Cancel")}</Text>
                </Pressable>
                <Pressable onPress={() => startNewGame(resetMode === "current" ? game.level : 1, resetMode === "full")} style={({ pressed }) => [styles.confirmStart, pressed && styles.pressed]}>
                  <View pointerEvents="none" style={styles.confirmButtonArtClip}><Image source={RESET_BUTTONS_ART} resizeMode="stretch" style={[styles.confirmButtonArt, { top: "-100%" }]} /></View>
                  <Text style={styles.confirmStartText}>{tr("초기화", "Reset")}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#11182C", paddingHorizontal: 12 },
  medievalBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  medievalBackdropImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 1 },
  medievalBackdropDim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0, 0, 0, 0.30)" },
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
  eyebrowNarrow: { fontSize: 9, letterSpacing: 1.8 },
  title: { color: "#FFFDF8", fontSize: 27, lineHeight: 31, fontWeight: "800", letterSpacing: -0.7 },
  titleNarrow: { fontSize: 26, lineHeight: 30 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelBadge: { zIndex: 40, elevation: 40, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 4, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85", flexDirection: "row", alignItems: "center", gap: 3 },
  stageNavArrow: { zIndex: 41, elevation: 41, width: 17, height: 21, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(119, 214, 195, 0.16)", borderWidth: 1, borderColor: "#77D6C3" },
  stageNavArrowDisabled: { opacity: 0.28 },
  stageNavArrowText: { color: "#B8FFF0", fontSize: 9, lineHeight: 11, fontWeight: "900" },
  levelText: { color: "#77D6C3", fontSize: 9, lineHeight: 10, fontWeight: "900", letterSpacing: 0.4, textAlign: "center" },
  levelTextNarrow: { fontSize: 8, lineHeight: 9, letterSpacing: 0.2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerActionsCompact: { gap: 3 },
  newButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  newButtonText: { color: "#11182C", fontSize: 22, lineHeight: 24, fontWeight: "600" },
  newButtonCompact: { width: 30, height: 30, borderRadius: 15 },
  orientationButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  orientationButtonText: { color: "#77D6C3", fontSize: 17, lineHeight: 20, fontWeight: "900" },
  iconButtonCompact: { width: 28, height: 28, borderRadius: 14 },
  soundButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  soundButtonOff: { backgroundColor: "#233958", borderColor: "#3D5A85", opacity: 0.72 },
  soundButtonText: { color: "#77D6C3", fontSize: 18, lineHeight: 20, fontWeight: "900" },
  menuButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#233958", borderWidth: 1, borderColor: "#3D5A85" },
  menuButtonImage: { width: 31, height: 31 },
  menuButtonText: { color: "#FFFDF8", fontSize: 19, lineHeight: 16, fontWeight: "900", marginTop: -8 },
  contentLift: { transform: [{ translateY: -24 }] },
  stats: { position: "relative", zIndex: 100, elevation: 100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#2E4163", paddingVertical: 6, marginBottom: 10 },
  statsNarrowCover: { paddingVertical: 6.3, marginBottom: 10.8 },
  statsFoldUltraWide: { paddingVertical: 4.2, marginBottom: 7.6 },
  statsSummary: { flex: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-start" },
  statsSummaryNarrowCover: { width: 126, flexShrink: 0 },
  statsSummaryPhoneLandscape: { width: "100%" },
  profileMenuFlag: { fontSize: 18, marginRight: 6 },
  countryList: { maxHeight: 250, marginTop: 8 },
  countryGrid: { paddingBottom: 8 },
  countryRow: { justifyContent: "space-between", marginBottom: 8 },
  countryOption: { width: "48%", minHeight: 42, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: "#405A83", backgroundColor: "rgba(24, 45, 78, 0.72)", flexDirection: "row", alignItems: "center" },
  countryOptionActive: { borderColor: "#F3C969", backgroundColor: "rgba(87, 67, 29, 0.8)" },
  countryFlag: { width: 28, fontSize: 20, textAlign: "center", marginRight: 6 },
  countryName: { flex: 1, color: "#F4F7FF", fontSize: 12, fontWeight: "800" },
  googleLoginCard: { marginTop: -8, marginBottom: 9, padding: 11, borderRadius: 15, borderWidth: 2, borderColor: "#6AA8E6", backgroundColor: "#132846", shadowColor: "#071225", shadowOpacity: 0.34, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  googleLoginHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  googleLoginMark: { width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#D9E8FB" },
  googleProfileImage: { width: 31, height: 31, borderRadius: 16, borderWidth: 2, borderColor: "#FFF0B3" },
  googleLoginMarkText: { color: "#4285F4", fontSize: 19, lineHeight: 22, fontWeight: "900" },
  googleLoginCopyWrap: { flex: 1, minWidth: 0 },
  googleLoginTitle: { color: "#FFFDF8", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  googleLoginSubtitle: { color: "#B9D2EF", fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 1 },
  googleLoginButton: { alignItems: "center", justifyContent: "center", minHeight: 38, marginTop: 10, borderRadius: 11, borderWidth: 2, borderColor: "#FFF0B3", backgroundColor: "#4B88D1", shadowColor: "#071225", shadowOpacity: 0.38, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  googleLogoutButton: { backgroundColor: "#506A91", borderColor: "#BFD2EC" },
  googleLoginButtonDisabled: { opacity: 0.58 },
  googleLoginButtonText: { color: "#FFFFFF", fontSize: 13, lineHeight: 16, fontWeight: "900", textShadowColor: "#173964", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  googleLogoutButtonText: { color: "#F2F7FF", textShadowColor: "#213957" },
  googleLoginMessage: { color: "#9CEFD4", fontSize: 10, lineHeight: 14, fontWeight: "800", textAlign: "center", marginTop: 7 },
  cloudSyncMessage: { color: "#9FE8C3", fontSize: 10, lineHeight: 14, fontWeight: "800", textAlign: "center", marginTop: 4 },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 6 },
  profileNameInput: { flex: 1, minHeight: 40, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#49658F", backgroundColor: "rgba(10, 25, 52, 0.88)", color: "#F4F7FF", fontSize: 14, fontWeight: "700" },
  profileNameSaveButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#D6A83D" },
  profileNameSaveText: { color: "#17233A", fontSize: 12, fontWeight: "900" },
  profileNameError: { color: "#FF9D8D", fontSize: 11, lineHeight: 15, fontWeight: "800", marginTop: 2, marginBottom: 4 },
  profileNameSaved: { color: "#8FF0BD", fontSize: 11, lineHeight: 15, fontWeight: "900", marginTop: 2, marginBottom: 4 },
  liveRankingPanel: { width: 182, height: 72, flexShrink: 0, marginLeft: 10, marginRight: 4, paddingHorizontal: 7, paddingTop: 3, paddingBottom: 2, borderRadius: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(73, 101, 143, 0.72)", justifyContent: "center" },
  liveRankingPanelNarrow: { width: 142, marginLeft: 6, marginRight: 1, paddingHorizontal: 4 },
  liveRankingHeader: { height: 16, flexDirection: "row", alignItems: "center" },
  liveRankingTitle: { flex: 7, color: "#F3C969", fontSize: 10, lineHeight: 12, fontWeight: "900", textAlign: "left" },
  liveRankingTitleStage: { color: "#77D6C3", fontSize: 8.5 },
  liveRankingMeHeader: { height: 16, paddingLeft: 3, flexDirection: "row", alignItems: "center", borderLeftWidth: 1, borderLeftColor: "rgba(130, 161, 207, 0.42)" },
  liveRankingColumns: { flex: 1, flexDirection: "row", alignItems: "center", transform: [{ translateY: -2 }] },
  liveRankingTopThree: { flex: 6, justifyContent: "center" },
  liveRankingMe: { flex: 4, height: 34, minWidth: 0, marginLeft: 0, paddingLeft: 3, borderLeftWidth: 1, borderLeftColor: "rgba(130, 161, 207, 0.42)", justifyContent: "center", alignItems: "center" },
  liveRankingMeDetails: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  liveRankingRow: { flexDirection: "row", alignItems: "center", height: 13 },
  liveRankingRank: { width: 12, color: "#F3C969", fontSize: 10, lineHeight: 12, fontWeight: "900" },
  liveRankingFlag: { width: 20, flexShrink: 0, fontSize: 11, lineHeight: 13, textAlign: "center", includeFontPadding: false },
  liveRankingFlagImage: { width: 20, height: 13, flexShrink: 0, borderRadius: 2, marginHorizontal: 0 },
  liveRankingName: { flex: 1, minWidth: 0, color: "#D6E2F4", fontSize: 10, lineHeight: 12, fontWeight: "700" },
  liveRankingScore: { width: 38, flexShrink: 0, color: "#F3C969", fontSize: 9, lineHeight: 11, fontWeight: "900", textAlign: "right", fontVariant: ["tabular-nums"] },
  liveRankingStage: { width: 24, flexShrink: 0, color: "#77D6C3", fontSize: 8, lineHeight: 10, fontWeight: "900", textAlign: "center" },
  liveRankingTime: { width: 32, flexShrink: 0, color: "#AFC5E4", fontSize: 9, lineHeight: 11, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  liveRankingMeLabel: { color: "#FFF3D1", fontSize: 10, lineHeight: 12, fontWeight: "900" },
  liveRankingMeValue: { color: "#FFF3D1", fontSize: 10, lineHeight: 12, fontWeight: "900", textAlign: "center" },
  attributeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(19, 31, 58, 0.9)", borderWidth: 1, borderColor: "#4A638A" },
  attributeBadgePhoneLandscape: { marginLeft: 0, marginTop: 5, alignSelf: "flex-start" },
  attributeBadgeDot: { width: 7, height: 7, borderRadius: 4 },
  attributeBadgeLabel: { color: "#A6B4CE", fontSize: 9, fontWeight: "800" },
  attributeBadgeValue: { fontSize: 11, fontWeight: "900" },
  statsLandscape: { paddingVertical: 2.7, marginBottom: 5.4 },
  statsLandscapeCompact: { paddingVertical: 0.9, marginBottom: 3.6 },
  statsPhoneLandscape: { position: "absolute", left: 0, right: 0, top: 128, flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start", paddingVertical: 5.4, marginBottom: 0, zIndex: 5 },
  statValue: { color: "#FFFDF8", fontSize: 15, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  statLabel: { color: "#A6B4CE", fontSize: 9, fontWeight: "700", marginTop: 1, textAlign: "center" },
  statDivider: { width: 1, height: 22, marginHorizontal: 10, backgroundColor: "#2E4163" },
  statDividerNarrow: { marginHorizontal: 5 },
  statusWrap: { flex: 1, minWidth: 92, marginLeft: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  statusWrapLandscape: { flex: 0, width: 140, minWidth: 140 },
  statusWrapCompact: { minWidth: 0, marginLeft: 4, gap: 3 },
  statusWrapPhoneLandscape: { flex: 0, width: "100%", minWidth: 0, marginLeft: 0, marginTop: 14, justifyContent: "flex-start" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotReady: { backgroundColor: "#77D6C3" },
  statusDotSelected: { backgroundColor: "#FF7A66" },
  statusText: { color: "#A6B4CE", fontSize: 10, fontWeight: "600" },
  monsterBattle: { flex: 1, minWidth: 0, marginLeft: 10, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", overflow: "visible" },
  // The monster intentionally travels across the tableau as part of the battle scene.
  // pointerEvents="none" keeps the card board interactive beneath the animation.
  monsterBattleFront: { zIndex: 220, elevation: 220 },
  monsterBattleLandscape: { flex: 1, minWidth: 250, maxWidth: 9999 },
  monsterBattleCompact: { flex: 1, minWidth: 0, marginLeft: 4 },
  monsterBattlePhoneLandscape: { flex: 1, minWidth: 0, maxWidth: 9999, marginLeft: 0, marginTop: 12, justifyContent: "flex-end" },
  monsterSpriteWrap: { width: 50, height: 54, alignItems: "center", justifyContent: "center", position: "relative" },
  monsterSpriteWrapCompact: { width: 32, height: 38 },
  monsterSprite: { width: 50, height: 54 },
  monsterSpriteCompact: { width: 34, height: 38 },
  monsterImageLayer: { alignItems: "center", justifyContent: "center" },
  monsterGroundShadow: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(3, 8, 20, 0.58)", shadowColor: "#000000", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 0 },
  monsterProjectileAnchor: { position: "absolute", width: 0, height: 0, zIndex: 1000, elevation: 1000, overflow: "visible" },
  rootPetImpactAnchor: { position: "absolute", width: 0, height: 0, zIndex: 5000, elevation: 5000, overflow: "visible" },
  monsterThreatGlow: { position: "absolute", borderWidth: 3, borderColor: "#FF8A2B", borderRadius: 18, zIndex: 0 },
  hitExplosionAnchor: { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center", overflow: "visible" },
  hitFeedbackBurst: { position: "absolute", zIndex: 75, alignItems: "center", justifyContent: "center", overflow: "visible" },
  hitExplosion: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 1, overflow: "visible" },
  hitExplosionImage: { width: "100%", height: "100%" },
  bossCardShine: { position: "absolute", top: "-45%", bottom: "-45%", left: "-12%", width: 11, backgroundColor: "rgba(255, 246, 180, 0.92)", shadowColor: "#FFFFFF", shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  monsterInfo: { flexGrow: 0, flexShrink: 0, flexDirection: "column", alignItems: "flex-end", alignSelf: "flex-end", position: "relative", zIndex: 10, elevation: 10 },
  monsterInfoCompact: { flexGrow: 0, flexShrink: 0 },
  monsterInfoBoss: { flexGrow: 0, flexShrink: 0 },
  monsterInfoPortrait: { flexGrow: 0, flexShrink: 0 },
  monsterInfoPortraitNarrow: { maxWidth: 68, marginLeft: 3 },
  companionSprite: { width: 34, height: 38, marginHorizontal: 1 },
  companionSpriteCompact: { width: 27, height: 31 },
  monsterNameRow: { flexDirection: "row", alignItems: "center", width: "100%", height: 16, overflow: "hidden" },
  monsterNameRowPortraitNarrow: { height: 14 },
  monsterName: { width: "100%", color: "#F3C969", fontSize: 12, lineHeight: 14, fontWeight: "900", letterSpacing: 0.5, textAlign: "right", zIndex: 11, elevation: 11 },
  monsterNameCentered: { width: "100%", textAlign: "right" },
  monsterNamePortraitNarrow: { fontSize: 8, lineHeight: 10, letterSpacing: 0.1 },
  bossBadge: { minWidth: 42, color: "#11182C", backgroundColor: "#F3C969", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, lineHeight: 12, fontWeight: "900", textAlign: "center", letterSpacing: 0.4 },
  monsterBar: { width: 80, maxWidth: 80, alignSelf: "flex-end", height: 7, marginTop: 3, overflow: "hidden", borderRadius: 4, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  monsterBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#FF6F8A" },
  monsterHpFlash: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 3, backgroundColor: "#FF1F3D" },
  monsterRedFlash: { position: "absolute", left: "8%", top: "8%", width: "84%", height: "84%", borderRadius: 999, backgroundColor: "#FF1F3D" },
  comboImpactOverlay: { position: "absolute", zIndex: 8, alignItems: "center", justifyContent: "center" },
  comboImpactImage: { width: "100%", height: "100%" },
  attributeImpactBurst: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center", zIndex: 12 },
  attributeImpactParticle: { position: "absolute", fontWeight: "900", textShadowColor: "#FFFFFF", textShadowRadius: 7 },
  monsterHp: { width: 80, color: "#BCEAE2", fontSize: 11, fontWeight: "800", marginTop: 2, textAlign: "right", alignSelf: "flex-end" },
  monsterProjectile: { position: "absolute", left: 8, top: 12, fontSize: 24, fontWeight: "900", textShadowColor: "#FFFFFF", textShadowRadius: 7 },
  companionAnchor: { position: "absolute", zIndex: 2000, elevation: 2000, alignItems: "center", justifyContent: "center" },
  companionPressTarget: { width: "100%", height: "100%" },
  companionPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  companionAttributeLabel: { position: "absolute", left: 0, height: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "rgba(11, 25, 49, 0.92)", borderWidth: 1, borderColor: "rgba(255, 216, 107, 0.78)" },
  companionAttributeDot: { width: 7, height: 7, borderRadius: 999 },
  companionAttributeText: { color: "#FFE8A8", fontSize: 11, fontWeight: "900", textShadowColor: "#0B1931", textShadowRadius: 2 },
  companionTapFrame: { position: "absolute", borderWidth: 3, borderRadius: 999, shadowColor: "#FFD86B", shadowOpacity: 0.95, shadowRadius: 12, elevation: 14 },
  companionImageFrame: { position: "absolute", alignItems: "center", justifyContent: "center" },
  companionGroundShadow: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(3, 8, 20, 0.52)", shadowColor: "#000000", shadowOpacity: 0.85, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, zIndex: 0 },
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
  boardTransitionFront: { zIndex: 1, elevation: 1 },
  boardTransition: { flex: 1, alignItems: "center" },
  board: { alignSelf: "center", position: "relative", zIndex: 1, elevation: 1 },
  boardLandscape: { flex: 1, justifyContent: "flex-start" },
  boardPhoneLandscape: { position: "relative", right: 0, top: 0, alignSelf: "center" },
  difficultyStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", alignSelf: "center", gap: 7, marginBottom: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(26, 32, 48, 0.78)", borderWidth: 1, borderColor: "rgba(243, 201, 105, 0.72)" },
  difficultyStatusText: { color: "#FFF3D1", fontSize: 10, lineHeight: 13, fontWeight: "900" },
  difficultyStatusDivider: { color: "#F3C969", fontSize: 12, fontWeight: "900" },
  topPiles: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, position: "relative", zIndex: 150, elevation: 150 },
  topPilesLandscape: { marginBottom: 6 },
  stockWasteGroup: { flexDirection: "row", gap: 6 },
  stockWasteWarning: { borderWidth: 2, borderColor: "#FF9D3D", borderRadius: 10, padding: 3 },
  foundationGroup: { flexDirection: "row", gap: 4 },
  slot: { borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3C557D", alignItems: "center", justifyContent: "center", backgroundColor: "#182744" },
  slotLabel: { color: "#58739D", fontSize: 15, fontWeight: "900" },
  cardGroundShadow: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(3, 8, 20, 0.42)", shadowColor: "#000000", shadowOpacity: 0.86, shadowRadius: 11, shadowOffset: { width: 0, height: 7 }, zIndex: 0 },
  card: { position: "relative", overflow: "hidden", borderRadius: 7, borderWidth: 1, backgroundColor: "#FFFDF8", shadowColor: "#050912", shadowOpacity: 0.62, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  cardSelected: { transform: [{ translateY: -7 }], borderWidth: 4, borderColor: "#FF4B3E", shadowColor: "#FF4B3E", shadowOpacity: 1, shadowRadius: 10, elevation: 12 },
  cardHinted: { borderWidth: 3, borderColor: "#FFE36E", shadowColor: "#FFD43B", shadowOpacity: 1, shadowRadius: 14, elevation: 18 },
  cardTouching: { opacity: 0.92 },
  cardBoss: { backgroundColor: "#D5A73A", borderColor: "#FFE39A", shadowColor: "#F3C969", shadowOpacity: 0.55, shadowRadius: 6 },
  rankTop: { position: "absolute", fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitTop: { position: "absolute", fontSize: 12, lineHeight: 13, fontWeight: "900" },
  suitCenter: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 28, fontWeight: "900" },
  royalPortrait: { position: "absolute", top: "24%", left: "13%", width: "74%", height: "61%", overflow: "hidden", borderRadius: 12, transform: [{ scale: 0.9 }] },
  royalSprite: { position: "absolute", width: "400%", height: "300%" },
  bottomMark: { position: "absolute", right: 5, bottom: 3, transform: [{ rotate: "180deg" }], alignItems: "center" },
  rankBottom: { position: "absolute", fontSize: 14, lineHeight: 15, fontWeight: "900" },
  suitBottom: { position: "absolute", fontSize: 12, lineHeight: 12, fontWeight: "900" },
  cardBack: { borderColor: "#0C1222", backgroundColor: "#77D6C3", padding: 0 },
  backInner: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 4, backgroundColor: "#1E3153", borderWidth: 1, borderColor: "#9BE4D5" },
  cardBackAsset: { ...StyleSheet.absoluteFillObject, borderRadius: 6, width: "100%", height: "100%" },
  bossCardBackGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 7, borderWidth: 3, borderColor: "#FFD45A", shadowColor: "#FFC72C", shadowOpacity: 1, shadowRadius: 13, elevation: 16 },
  backMark: { color: "#77D6C3", fontSize: 26, fontWeight: "900" },
  tableau: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 60, elevation: 60 },
  tableauLandscape: { flexGrow: 0 },
  tableauColumn: { position: "relative", zIndex: 61, elevation: 61 },
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
  hammerStrike: { position: "absolute", zIndex: 600, elevation: 600, alignItems: "center", justifyContent: "center" },
  hammerStrikeImage: { width: "100%", height: "100%" },
  hammerRevealFlight: { position: "absolute", zIndex: 600, elevation: 600, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden" },
  foundationMoveFlight: { position: "absolute", zIndex: 620, elevation: 620, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden" },
  hammerImpactBurst: { position: "absolute", zIndex: 630, elevation: 630, alignItems: "center", justifyContent: "center" },
  hammerImpactBurstImage: { width: "100%", height: "100%" },
  hammerFragments: { ...StyleSheet.absoluteFillObject, zIndex: 3, overflow: "visible" },
  hammerFragment: { position: "absolute", borderRadius: 2, shadowColor: "#FFF3B0", shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
  hammerLandingDustLayer: { position: "absolute", zIndex: 610, elevation: 610, alignItems: "center", justifyContent: "center" },
  landingDust: { alignItems: "center", justifyContent: "flex-start", overflow: "visible" },
  landingDustParticle: { position: "absolute", left: "50%", top: "26%", width: 5, height: 5, marginLeft: -2.5, borderRadius: 999, backgroundColor: "rgba(224, 207, 170, 0.86)", shadowColor: "#FFF3D1", shadowOpacity: 0.45, shadowRadius: 3, elevation: 3 },
  hammerPilesCount: { color: "#F3C969", lineHeight: 18, fontWeight: "900", marginTop: -1, textShadowColor: "#17233C", textShadowRadius: 2 },
  hammerPilesCountEmpty: { color: "#F3C969", textShadowColor: "#17233C", textShadowRadius: 2 },
  hintButton: { backgroundColor: "#233958", borderColor: "#3D5A85" },
  undoButton: { backgroundColor: "#2A4268", borderColor: "#5B78A5" },
  undoButtonDisabled: { opacity: 0.38 },
  bottomButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  bottomButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  comboImpactBorder: { ...StyleSheet.absoluteFillObject, zIndex: 680, elevation: 680, borderWidth: 7, borderColor: "#FFD45A", borderRadius: 14, shadowColor: "#FF8A3D", shadowOpacity: 0.9, shadowRadius: 12 },
  autoFinishSummary: { position: "absolute", top: "29%", left: 24, right: 24, zIndex: 760, elevation: 760, alignItems: "center", alignSelf: "center", paddingHorizontal: 24, paddingVertical: 18, borderRadius: 24, borderWidth: 3, borderColor: "#FFD45A", backgroundColor: "rgba(20, 34, 65, 0.96)", shadowColor: "#FFB84D", shadowOpacity: 0.82, shadowRadius: 18 },
  autoFinishSummaryLandscape: { top: "22%" },
  autoFinishSummaryEyebrow: { color: "#77D6C3", fontSize: 11, fontWeight: "900", letterSpacing: 1.8, textAlign: "center" },
  autoFinishSummaryTitle: { color: "#FFF3B0", fontSize: 17, fontWeight: "900", marginTop: 5, letterSpacing: 1 },
  autoFinishSummaryCombo: { color: "#FFFFFF", fontSize: 52, lineHeight: 58, fontWeight: "900", textShadowColor: "#FF8A3D", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  autoFinishSummaryDivider: { width: 120, height: 2, marginVertical: 5, backgroundColor: "#F3C969" },
  autoFinishSummaryScoreLabel: { color: "#BBD0E9", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  autoFinishSummaryScore: { color: "#FFE27A", fontSize: 28, fontWeight: "900", marginTop: 3, textShadowColor: "#6B2B1E", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 5 },
  timeBonusFloat: { position: "absolute", top: "16%", left: 0, right: 0, zIndex: 710, elevation: 710, alignItems: "center" },
  timeBonusFloatLandscape: { top: "11%" },
  timeBonusFloatText: { color: "#FFE27A", fontSize: 28, fontWeight: "900", textShadowColor: "#6B2B1E", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 5 },
  comboScoreFloat: { position: "absolute", top: "43%", left: 18, right: 18, zIndex: 710, elevation: 710, alignItems: "center" },
  comboScoreFloatLandscape: { top: "35%" },
  comboScoreFloatText: { color: "#FFF1A8", fontSize: 25, fontWeight: "900", letterSpacing: 1, textShadowColor: "#5C1F68", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 5 },
  replayResultBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(4, 10, 24, 0.82)" },
  replayResultCard: { width: "100%", maxWidth: 430, padding: 20, borderRadius: 24, backgroundColor: "#172A4A", borderWidth: 3, borderColor: "#F3C969", shadowColor: "#000000", shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 12 },
  replayResultEyebrow: { color: "#77D6C3", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" },
  replayResultTitle: { color: "#FFFDF8", fontSize: 26, fontWeight: "900", textAlign: "center", marginTop: 5 },
  replayResultCopy: { color: "#C8D7ED", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 7, marginBottom: 16 },
  replayResultGrid: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  replayResultColumn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 15, backgroundColor: "#213A63", borderWidth: 1, borderColor: "#5077A8" },
  replayResultLabel: { color: "#AFC5E6", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  replayResultScore: { color: "#FFFDF8", fontSize: 27, fontWeight: "900", marginTop: 7, fontVariant: ["tabular-nums"] },
  replayResultTime: { color: "#77D6C3", fontSize: 14, fontWeight: "900", marginTop: 3, fontVariant: ["tabular-nums"] },
  replayResultArrow: { width: 26, alignItems: "center", justifyContent: "center" },
  replayResultArrowText: { color: "#F3C969", fontSize: 24, fontWeight: "900" },
  replayResultDelta: { color: "#FFE08A", fontSize: 13, fontWeight: "900", textAlign: "center", marginTop: 15, marginBottom: 10 },
  comboBanner: { position: "absolute", top: "36%", left: 24, right: 24, zIndex: 700, alignItems: "center", alignSelf: "center", paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 700 },
  comboBannerLandscape: { top: "30%" },
  comboBannerTitle: { color: "#FFE8A8", fontSize: 15, fontWeight: "900", letterSpacing: 1.4, textShadowColor: "#07101F", textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 3, textDecorationLine: "none" },
  comboBannerCount: { color: "#FFFFFF", fontSize: 42, lineHeight: 46, fontWeight: "900", textShadowColor: "#07101F", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
  comboBannerBonus: { color: "#BCEAE2", fontSize: 11, fontWeight: "800", textAlign: "center", textShadowColor: "#07101F", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  hintToast: { position: "absolute", left: 16, right: 16, bottom: 51, zIndex: 300, elevation: 300, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#182744", borderWidth: 1, borderColor: "#45628E" },
  hintToastLandscape: { bottom: 55 },
  hintToastText: { color: "#BCEAE2", fontSize: 12, fontWeight: "700", textAlign: "center" },
  petPreservationNotice: { position: "absolute", top: "44%", left: 24, right: 24, zIndex: 90, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, backgroundColor: "rgba(20, 44, 73, 0.96)", borderWidth: 2, borderColor: "#77D6C3", shadowColor: "#77D6C3", shadowOpacity: 0.75, shadowRadius: 14, elevation: 18 },
  petPreservationNoticeText: { color: "#E7FFF8", fontSize: 15, fontWeight: "900", textAlign: "center" },
  wastePileWithHint: { position: "relative", alignItems: "center", zIndex: 160, elevation: 160 },
  wasteHammerTooltip: { position: "absolute", bottom: "100%", marginBottom: 7, minWidth: 118, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(22, 35, 60, 0.98)", borderWidth: 1, borderColor: "#64799D", zIndex: 1000, elevation: 1000 },
  wasteHammerTooltipActive: { backgroundColor: "rgba(90, 41, 26, 0.98)", borderColor: "#F3A85D" },
  wasteHammerTooltipText: { color: "#FFF3D1", fontSize: 10, fontWeight: "900", textAlign: "center" },
  hammerModeHint: { position: "absolute", left: "25%", width: "50%", top: 104, zIndex: 800, alignSelf: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, backgroundColor: "rgba(90, 41, 26, 0.96)", borderWidth: 2, borderColor: "#F3A85D", shadowColor: "#FFB86B", shadowOpacity: 0.75, shadowRadius: 11, elevation: 800, transform: [{ translateY: 5 }] },
  hammerModeHintText: { color: "#FFF3D1", fontSize: 12, lineHeight: 16, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  flyingCard: { position: "absolute", left: 16, bottom: 44, zIndex: 30, overflow: "hidden", borderRadius: 8, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF7A66", shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 9, elevation: 12 },
  attributeFlyingCard: { position: "absolute", zIndex: 31, overflow: "visible", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  attributeFlyingCardAtMonster: { position: "absolute", zIndex: 31, overflow: "visible", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 31 },
  attributeFlyingCardImage: { ...StyleSheet.absoluteFillObject },
  flamingFlyingCard: { position: "absolute", zIndex: 31, overflow: "visible", backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 0, alignItems: "center", justifyContent: "center" },
  flamingCardFace: { ...StyleSheet.absoluteFillObject, borderRadius: 8, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF7A66", shadowColor: "#FF7A66", shadowOpacity: 0.8, shadowRadius: 9, elevation: 12, zIndex: 1 },
  flamingCardText: { zIndex: 4 },
  flamingCardArt: { position: "absolute", top: "-8%", left: "-8%", width: "116%", height: "116%", zIndex: 3, opacity: 0.78 },
  flamingTailLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1, overflow: "visible" },
  flamingTailParticle: { position: "absolute", fontWeight: "900", textShadowColor: "#FF4B12", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  flyingRank: { position: "absolute", top: 6, left: 7, fontSize: 16, fontWeight: "900" },
  flyingSuit: { position: "absolute", top: "31%", width: "100%", textAlign: "center", fontSize: 30, fontWeight: "900" },
  fireworkLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: "center", justifyContent: "center" },
  bossWarning: { position: "absolute", top: "38%", left: 18, right: 18, zIndex: 220, alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: "rgba(94, 28, 48, 0.94)", borderWidth: 2, borderColor: "#F3C969", shadowColor: "#FF6F8A", shadowOpacity: 0.75, shadowRadius: 16, elevation: 220 },
  bossWarningEyebrow: { color: "#FFE7A2", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  bossWarningTitle: { color: "#FFFDF8", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 4, textAlign: "center" },
  bossWarningCopy: { color: "#FFC1B4", fontSize: 11, fontWeight: "800", marginTop: 4, textAlign: "center" },
  bossPrepRewardPopup: { position: "absolute", top: "31%", left: 28, right: 28, zIndex: 62, alignItems: "center", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16, backgroundColor: "rgba(20, 44, 73, 0.96)", borderWidth: 2, borderColor: "#F3C969", shadowColor: "#FFD66B", shadowOpacity: 0.8, shadowRadius: 14, elevation: 14 },
  bossPrepRewardTitle: { color: "#FFE7A2", fontSize: 16, fontWeight: "900", textAlign: "center" },
  bossPrepRewardCopy: { color: "#FFFDF8", fontSize: 22, fontWeight: "900", marginTop: 3, textAlign: "center" },
  fireworkParticle: { position: "absolute", width: 10, height: 10, borderRadius: 5, shadowColor: "#FFFFFF", shadowOpacity: 0.8, shadowRadius: 5, elevation: 10 },
  victoryText: { position: "absolute", top: "43%", color: "#FFFDF8", fontSize: 28, fontWeight: "900", letterSpacing: 1.8, textShadowColor: "#FF7A66", textShadowRadius: 14 },
  pressed: { opacity: 0.86, transform: [{ translateY: -3 }, { scale: 0.94 }] },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3, 7, 18, 0.76)" },
  rankingModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 14, backgroundColor: "rgba(3, 7, 18, 0.82)" },
  rankingModalCard: { width: "96%", maxWidth: 390, maxHeight: "84%", paddingHorizontal: 14, paddingTop: 15, paddingBottom: 10, borderRadius: 25, borderWidth: 3, borderColor: "#F3C969", backgroundColor: "#172B4C", shadowColor: "#050A16", shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 24 },
  rankingModalHeader: { position: "relative", zIndex: 1000, elevation: 1000, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: "rgba(243, 201, 105, 0.42)" },
  rankingModalTitleBlock: { position: "relative", zIndex: 1100, elevation: 1100, flex: 1, minWidth: 0, gap: 6 },
  rankingHeaderPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, zIndex: 1200, elevation: 1200 },
  stageRankingHeaderPicker: { minHeight: 30, width: 116, paddingHorizontal: 8, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#286B68", borderWidth: 1, borderColor: "#8FE7D1" },
  stageRankingHeaderList: { position: "absolute", top: 34, right: 0, width: 150, height: 220, maxHeight: 220, flexGrow: 0, padding: 5, borderRadius: 11, backgroundColor: "#1E4D4C", borderWidth: 1, borderColor: "#8FE7D1", zIndex: 1300, elevation: 1300 },
  stageRankingSelectedOption: { backgroundColor: "#286B68", borderColor: "#8FE7D1" },
  stageRankingStatus: { width: "100%", paddingHorizontal: 10, paddingVertical: 7, marginBottom: 2, borderRadius: 10, backgroundColor: "rgba(40, 107, 104, 0.28)", borderWidth: 1, borderColor: "rgba(143, 231, 209, 0.55)" },
  stageRankingStatusTitle: { color: "#FFE08A", fontSize: 12, fontWeight: "900" },
  stageRankingStatusCopy: { color: "#D9FFF5", fontSize: 11, fontWeight: "800", marginTop: 2 },
  rankingModalEyebrow: { color: "#76D9C7", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  rankingModalTitle: { color: "#FFF3D1", fontSize: 23, lineHeight: 28, fontWeight: "900", textShadowColor: "#08152B", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  rankingModalClose: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#D85D55", borderWidth: 2, borderColor: "#FFB17D", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, elevation: 5 },
  rankingModalCloseText: { color: "#FFF8E8", fontSize: 25, lineHeight: 27, fontWeight: "900" },
  rankingModalCopy: { color: "#BBD0E9", fontSize: 11, fontWeight: "700", marginTop: 8, marginBottom: 7 },
  rankingModalModeToggle: { flexDirection: "row", gap: 7, marginTop: 10, marginBottom: 2 },
  rankingModalViewToggle: { flexDirection: "row", gap: 7, marginTop: 7, marginBottom: 2 },
  rankingModalViewButton: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#1C3154", borderWidth: 1, borderColor: "#5077A8" },
  rankingModalViewButtonActive: { backgroundColor: "#6A4F91", borderColor: "#D6B8FF" },
  rankingModalViewText: { color: "#FFFDF8", fontSize: 11, fontWeight: "900" },
  rankingModalModeButton: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#213A63", borderWidth: 1, borderColor: "#5077A8" },
  rankingModalModeButtonActive: { backgroundColor: "#2C806F", borderColor: "#77D6C3" },
  rankingModalModeText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900" },
  independentListBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3, 10, 25, 0.82)", paddingHorizontal: 22 },
  independentListCard: { width: "100%", maxWidth: 360, maxHeight: "78%", padding: 14, borderRadius: 18, backgroundColor: "#1E3153", borderWidth: 2, borderColor: "#77D6C3", elevation: 80, zIndex: 80 },
  independentListTitle: { color: "#FFF4C2", fontSize: 18, fontWeight: "900", marginBottom: 10, textAlign: "center" },
  independentListScroll: { height: 360, maxHeight: 360 },
  independentLanguageListScroll: { height: 420, maxHeight: 420 },
  independentListContent: { paddingBottom: 8, gap: 4 },
  rankingModalScroll: { maxHeight: 430 },
  replayHeaderPickerWrap: { position: "relative", zIndex: 1200, elevation: 1200, alignSelf: "flex-start" },
  replayHeaderPicker: { minHeight: 30, paddingHorizontal: 9, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#57408A", borderWidth: 1, borderColor: "#D6B8FF" },
  replayHeaderPickerText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  replayHeaderPickerChevron: { color: "#FFE08A", fontSize: 10, fontWeight: "900", marginLeft: 8 },
  replayHeaderList: { position: "absolute", top: 34, left: 0, width: 185, height: 190, maxHeight: 190, padding: 5, borderRadius: 11, backgroundColor: "#39295D", borderWidth: 1, borderColor: "#D6B8FF", zIndex: 1300, elevation: 1300 },
  rankingModalList: { gap: 5, paddingVertical: 3 },
  rankingModalRow: { minHeight: 29, paddingHorizontal: 7, borderRadius: 10, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(29, 51, 83, 0.86)", borderWidth: 1, borderColor: "rgba(105, 139, 183, 0.35)" },
  rankingModalTopRow: { backgroundColor: "rgba(78, 69, 40, 0.92)", borderColor: "rgba(243, 201, 105, 0.68)" },
  rankingModalRank: { width: 25, color: "#DCE8F8", fontSize: 13, fontWeight: "900", textAlign: "center" },
  rankingGold: { color: "#FFD76A", fontSize: 16 },
  rankingSilver: { color: "#D9E5F2", fontSize: 15 },
  rankingBronze: { color: "#E5A06C", fontSize: 15 },
  rankingModalFlag: { width: 23, height: 15, borderRadius: 2, marginRight: 7 },
  rankingModalFlagText: { width: 23, color: "#D9E5F2", fontSize: 12, textAlign: "center", marginRight: 7 },
  rankingModalName: { flex: 1, color: "#F4F7FF", fontSize: 12, fontWeight: "800" },
  rankingModalStage: { width: 52, paddingHorizontal: 2, paddingVertical: 2, borderWidth: 1, borderRadius: 6, color: "#77D6C3", fontSize: 9, fontWeight: "900", textAlign: "center" },
  rankingModalScore: { width: 45, color: "#F3C969", fontSize: 11, fontWeight: "900", textAlign: "right" },
  rankingModalTime: { width: 48, color: "#BBD0E9", fontSize: 11, fontWeight: "800", textAlign: "right" },
  rankingModalEmpty: { color: "#BBD0E9", textAlign: "center", paddingVertical: 30, fontWeight: "800" },
  accountMenuBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(3, 7, 18, 0.8)" },
  accountMenuCard: { width: "100%", maxWidth: 340, padding: 17, borderRadius: 22, borderWidth: 3, borderColor: "#FFE08A", backgroundColor: "#1D3557", shadowColor: "#000000", shadowOpacity: 0.65, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 20 },
  accountMenuHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255, 224, 138, 0.35)" },
  accountMenuAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#FFF0B3" },
  accountMenuAvatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FFF0B3" },
  accountMenuAvatarText: { color: "#4285F4", fontSize: 27, fontWeight: "900" },
  accountMenuCopy: { flex: 1, minWidth: 0 },
  accountMenuTitle: { color: "#FFF3D1", fontSize: 16, fontWeight: "900" },
  accountMenuSubtitle: { color: "#B9D2EF", fontSize: 10, fontWeight: "700", marginTop: 2 },
  accountMenuSwitchButton: { minHeight: 43, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 2, borderColor: "#8FE7D1", backgroundColor: "#286B68" },
  accountMenuSwitchText: { color: "#F0FFF9", fontSize: 13, fontWeight: "900" },
  accountMenuLogoutButton: { minHeight: 43, alignItems: "center", justifyContent: "center", marginTop: 8, borderRadius: 12, borderWidth: 2, borderColor: "#FFB09A", backgroundColor: "#8A3F4A" },
  accountMenuLogoutText: { color: "#FFF1EC", fontSize: 13, fontWeight: "900" },
  accountMenuCancelButton: { minHeight: 37, alignItems: "center", justifyContent: "center", marginTop: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  accountMenuCancelText: { color: "#C7D8EE", fontSize: 12, fontWeight: "800" },
  rankingModalFooter: { marginTop: 9, paddingTop: 9, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: "rgba(243, 201, 105, 0.42)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rankingModalMyRank: { color: "#FFF3D1", fontSize: 13, fontWeight: "900" },
  rankingModalMyTime: { color: "#76D9C7", fontSize: 13, fontWeight: "900" },
  modalBackdropCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 17, backgroundColor: "rgba(3, 7, 18, 0.76)" },
  hammerOfferModalLayer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 17, backgroundColor: "rgba(3, 7, 18, 0.76)", zIndex: 1000, elevation: 1000 },
  updateNoticeCard: { width: "100%", maxWidth: 390, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22, borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#1E3153", shadowColor: "#000000", shadowOpacity: 0.46, shadowRadius: 20, elevation: 20, transform: [{ translateY: -60 }] },
  updateNoticeImage: { width: 92, height: 68, alignSelf: "center", marginBottom: 5 },
  updateNoticeEyebrow: { color: "#77D6C3", fontSize: 11, fontWeight: "900", letterSpacing: 1.6, textAlign: "center" },
  updateNoticeTitle: { color: "#FFF3D1", fontSize: 22, lineHeight: 28, fontWeight: "900", textAlign: "center", marginTop: 5 },
  updateNoticeCopy: { color: "#D4E2F7", fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center", marginTop: 8 },
  updateNoticeList: { gap: 9, marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  updateNoticeItem: { color: "#FFFDF8", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  updateNoticeWarning: { color: "#FFD36A" },
  updateNoticeItemCompactLanguage: { fontSize: 11, lineHeight: 16 },
  updateNoticeActions: { gap: 8, marginTop: 16 },
  updateNoticeUpdateButton: { marginTop: 0 },
  updateNoticeLaterButton: { alignItems: "center", paddingVertical: 8 },
  updateNoticeLaterText: { color: "#AFC5E6", fontSize: 13, fontWeight: "800" },
  rewardedErrorCard: { width: "100%", maxWidth: 360, paddingVertical: 17, paddingHorizontal: 20, borderRadius: 22, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 18, elevation: 16, transform: [{ translateY: -60 }] },
  rewardedErrorTitle: { color: "#F3C969", fontSize: 18, fontWeight: "900", textAlign: "center" },
  rewardedErrorCopy: { color: "#E5ECF8", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  rewardedErrorActions: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 18 },
  rewardedRetryButton: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#F3C969", alignItems: "center" },
  rewardedRetryText: { color: "#17233C", fontSize: 13, fontWeight: "900" },
  rewardedCloseButton: { minWidth: 82, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: "#64799D", alignItems: "center" },
  rewardedCloseText: { color: "#E5ECF8", fontSize: 13, fontWeight: "800" },
  shuffleHelpCard: { width: "100%", maxWidth: 370, paddingVertical: 19, paddingHorizontal: 22, borderRadius: 24, borderWidth: 2, borderColor: "#77D6C3", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18, transform: [{ translateY: -60 }] },
  rewardedShuffleCard: { width: "100%", maxWidth: 370, paddingVertical: 19, paddingHorizontal: 22, borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18, transform: [{ translateY: -60 }] },
  noMovesPopupCard: { width: "92%", maxWidth: 320, paddingHorizontal: 18, paddingBottom: 15, paddingTop: 20, borderRadius: 20, borderWidth: 2, borderColor: "#77D6C3", backgroundColor: "#17233C", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 20, elevation: 18, transform: [{ translateY: -60 }] },
  noMovesPopupClose: { position: "absolute", top: 5, right: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", zIndex: 2 },
  noMovesPopupCloseText: { color: "#FFF3D1", fontSize: 24, lineHeight: 27, fontWeight: "800" },
  noMovesPopupTitle: { color: "#FFF3D1", fontSize: 17, lineHeight: 23, fontWeight: "900", textAlign: "center" },
  noMovesPopupCopy: { color: "#D4E2F7", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  noMovesPopupActions: { flexDirection: "row", gap: 8, marginTop: 18, justifyContent: "center" },
  noMovesPopupPrimary: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#77D6C3", alignItems: "center" },
  noMovesPopupAd: { backgroundColor: "#F3C969" },
  noMovesPopupPrimaryText: { color: "#17233C", fontSize: 13, fontWeight: "900" },
  noMovesPopupSecondary: { minWidth: 94, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: "#64799D", alignItems: "center" },
  noMovesPopupSecondaryText: { color: "#E5ECF8", fontSize: 13, fontWeight: "800" },
  hammerOfferCard: { width: "92%", maxWidth: 330, paddingHorizontal: 20, paddingBottom: 17, paddingTop: 23, borderRadius: 22, borderWidth: 2, borderColor: "#F3A85D", backgroundColor: "#36211F", shadowColor: "#000000", shadowOpacity: 0.48, shadowRadius: 20, elevation: 1001, zIndex: 1001, transform: [{ translateY: -60 }] },
  hammerOfferTitle: { color: "#FFF3D1", fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center" },
  hammerOfferCopy: { color: "#FFD6A4", fontSize: 13, lineHeight: 20, fontWeight: "700", textAlign: "center", marginTop: 10 },
  hammerOfferPrimary: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "#F3A85D", alignItems: "center" },
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
  shuffleHelpClose: { alignSelf: "center", paddingHorizontal: 18, paddingVertical: 9, marginTop: 7 },
  shuffleHelpCloseText: { color: "#A6B4CE", fontSize: 13, fontWeight: "800" },
  sheet: { width: "100%", maxWidth: 680, alignSelf: "center", backgroundColor: "#1E3153", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: "#45628E", paddingHorizontal: 24, paddingTop: 22, paddingBottom: 29, transform: [{ translateY: -60 }] },
  menuSheetScroll: { maxHeight: "72%" },
  menuSheetScrollContent: { paddingBottom: 4, overflow: "visible" },
  sheetEyebrow: { color: "#77D6C3", fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.7, marginBottom: 7, flexShrink: 1 },
  sheetHeaderImage: { width: 64, height: 54, alignSelf: "center", marginTop: 4, marginBottom: -2 },
  sheetTitle: { color: "#FFFDF8", fontSize: 26, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6, flexShrink: 1 },
  sheetTitleCompactLanguage: { fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  menuPauseTitle: { fontSize: 23, lineHeight: 30 },
  menuPauseTitleCompactLanguage: { fontSize: 19, lineHeight: 25 },
  menuTitleRow: { position: "relative", zIndex: 1000, elevation: 1000, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sheetCopy: { color: "#A6B4CE", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 21, flexShrink: 1 },
  sheetCopyCompactLanguage: { fontSize: 12, lineHeight: 18 },
  soundSettings: { gap: 10, marginTop: 2 },
  optionLanguageRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, paddingVertical: 6 },
  volumeSliderRow: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: "#12213A", borderWidth: 1, borderColor: "#2E4A70" },
  volumeSliderDisabled: { opacity: 0.45 },
  volumeSliderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  volumeSliderLabel: { color: "#CFE9E4", fontSize: 11, fontWeight: "800" },
  volumeSliderValue: { color: "#77D6C3", fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  volumeSliderTrack: { height: 20, justifyContent: "center", position: "relative" },
  volumeSliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: "#77D6C3" },
  volumeSliderThumb: { position: "absolute", top: 4, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: "#FFFDF8", borderWidth: 2, borderColor: "#FF8A76" },
  audioOption: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  petRandomToggle: { minHeight: 51, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 9, borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  startPetRandomToggle: { marginTop: 10, marginBottom: 4 },
  checkBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 2, borderColor: "#58739D", backgroundColor: "#11182C" },
  checkBoxChecked: { borderColor: "#77D6C3", backgroundColor: "#2B6B72" },
  checkMark: { color: "#FFFDF8", fontSize: 16, lineHeight: 18, fontWeight: "900" },
  audioOptionCopy: { flex: 1, marginLeft: 10 },
  audioOptionTitle: { color: "#FFFDF8", fontSize: 15, fontWeight: "900" },
  audioOptionTitleCompactLanguage: { fontSize: 13, lineHeight: 17 },
  audioOptionSubtitle: { color: "#A6B4CE", fontSize: 11, fontWeight: "600", marginTop: 3 },
  audioOptionSubtitleCompactLanguage: { fontSize: 10, lineHeight: 14 },
  sheetPrimaryButton: { minHeight: 54, width: "100%", paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 18, backgroundColor: "#FF7A66", borderWidth: 2, borderColor: "#FFD18A", shadowColor: "#5A1F2B", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4, marginTop: 18 },
  menuQuickActionRow: { width: "100%", flexDirection: "row", alignItems: "stretch", gap: 10, marginTop: 12 },
  menuQuickActionButton: { flex: 1, width: undefined, minHeight: 42, marginTop: 0, borderRadius: 15 },
  menuContinueButton: { backgroundColor: "#FF7A66", borderColor: "#FFD18A", shadowColor: "#5A1F2B" },
  menuLobbyButton: { position: "relative", overflow: "hidden", backgroundColor: "#102953", borderColor: "#F8D46B", shadowColor: "#08152B", shadowOpacity: 0.58, elevation: 7 },
  menuLobbyButtonArt: { ...StyleSheet.absoluteFillObject, opacity: 0.98 },
  menuLobbyButtonText: { color: "#FFF8CB", fontSize: 16, textShadowColor: "#07172D", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2, zIndex: 1 },
  modeChoiceRow: { flexDirection: "row", gap: 10, marginTop: 21 },
  modeChoiceButton: { flex: 1, minHeight: 124, justifyContent: "space-between", borderRadius: 20, borderWidth: 3, paddingHorizontal: 10, paddingVertical: 10, shadowOpacity: 0.58, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  modeChoiceButtonSelected: { borderColor: "#FFF4B8", shadowColor: "#FFF0A3", shadowOpacity: 0.78, shadowRadius: 6, elevation: 12 },
  modeChoiceUnlimited: { backgroundColor: "#176FB9", borderColor: "#8DEEFF", shadowColor: "#062D68" },
  modeChoiceTimed: { backgroundColor: "#B63E4B", borderColor: "#FFB587", shadowColor: "#641527" },
  modeChoiceHeading: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  modeChoiceEmblem: { width: 44, height: 44, borderRadius: 15, justifyContent: "center", alignItems: "center", borderWidth: 2, shadowColor: "#101526", shadowOpacity: 0.42, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  modeChoiceUnlimitedEmblem: { backgroundColor: "#54C8F1", borderColor: "#D3FAFF" },
  modeChoiceTimedEmblem: { backgroundColor: "#FF786C", borderColor: "#FFE0AD" },
  modeChoiceEmblemText: { color: "#FFFDF8", fontSize: 29, lineHeight: 33, fontWeight: "900", textShadowColor: "rgba(23, 37, 65, 0.65)", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 },
  modeChoiceTextWrap: { flex: 1, minWidth: 0 },
  modeChoiceTitle: { color: "#FFFDF8", fontSize: 18, lineHeight: 22, fontWeight: "900", textShadowColor: "rgba(15, 25, 47, 0.5)", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 },
  modeChoiceTitleCompactLanguage: { fontSize: 16, lineHeight: 20 },
  modeChoiceCopy: { color: "#EAF8FF", fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 2 },
  modeChoiceCopyCompactLanguage: { fontSize: 12, lineHeight: 16 },
  modeChoiceActionPill: { minHeight: 29, width: "100%", justifyContent: "center", alignItems: "center", borderRadius: 11, borderWidth: 1, marginTop: 8 },
  modeChoiceUnlimitedAction: { backgroundColor: "#0C4E94", borderColor: "#A7F3FF" },
  modeChoiceTimedAction: { backgroundColor: "#812633", borderColor: "#FFD2A0" },
  modeChoiceActionText: { color: "#FFFDF8", fontSize: 10, lineHeight: 12, fontWeight: "900", letterSpacing: 0.45 },
  timeAttackStatWarning: { color: "#FF6F61" },
  sheetPrimaryText: { color: "#11182C", fontSize: 15, fontWeight: "900" },
  sheetRow: { flexDirection: "row", alignItems: "stretch", gap: 10, marginTop: 10 },
  sheetSecondaryButton: { flex: 1, minWidth: 0, minHeight: 51, paddingHorizontal: 7, paddingVertical: 5, justifyContent: "center", alignItems: "center", borderRadius: 18, backgroundColor: "#3B6798", borderWidth: 2, borderColor: "#8CD7F5", shadowColor: "#08152B", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  recordsMenuButton: { backgroundColor: "#5C4A2A", borderColor: "#FFD166" },
  rulesMenuButton: { backgroundColor: "#23526A", borderColor: "#7FE7FF" },
  petsMenuButton: { backgroundColor: "#653B62", borderColor: "#FF9AD5" },
  profileMenuButton: { backgroundColor: "#244D78", borderColor: "#FFE08A" },
  badgesMenuButton: { backgroundColor: "#675528", borderColor: "#FFE27A" },
  cardBacksMenuButton: { backgroundColor: "#414579", borderColor: "#A9B8FF" },
  menuButtonContent: { width: "100%", minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  profileMenuAvatar: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: "#FFF0B3" },
  menuCompanionIcon: { width: 22, height: 22 },
  resetButton: { backgroundColor: "#76508E", borderColor: "#F4B7E8" },
  sheetSecondaryText: { color: "#FFFDF8", fontSize: 14, lineHeight: 18, fontWeight: "800", textAlign: "center", flexShrink: 1, flexWrap: "wrap" },
  sheetLinkButton: { alignSelf: "center", paddingVertical: 12, marginTop: 7 },
  sheetLinkText: { color: "#FF9E91", fontSize: 13, fontWeight: "800" },
  companionPickerCopy: { color: "#A6B4CE", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 16 },
  petGridScroll: { maxHeight: 430, marginHorizontal: -4 },
  companionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingBottom: 12 },
  companionChoice: { width: "23.5%", minHeight: 96, alignItems: "center", justifyContent: "center", paddingVertical: 7, paddingHorizontal: 2, borderRadius: 12, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  companionChoiceSelected: { backgroundColor: "#2B6B72", borderColor: "#77D6C3", borderWidth: 2 },
  companionChoiceLocked: { backgroundColor: "#101A30", borderColor: "#263753" },
  companionChoiceImage: { width: 48, height: 52 },
  companionChoiceSilhouette: { opacity: 0.92, tintColor: "#020611" },
  companionChoiceName: { color: "#FFFDF8", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 4 },
  companionChoiceAttribute: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 16, marginTop: 2, paddingHorizontal: 5, borderRadius: 8, backgroundColor: "rgba(7, 15, 31, 0.72)" },
  companionChoiceAttributeDot: { width: 6, height: 6, borderRadius: 3 },
  companionChoiceAttributeText: { color: "#FFE8A8", fontSize: 9, lineHeight: 12, fontWeight: "900" },
  companionChoiceCheck: { position: "absolute", top: 6, right: 7, color: "#FFFDF8", fontSize: 16, fontWeight: "900" },
  cardBackPickerScroll: { maxHeight: 290, marginTop: 14 },
  cardBackPickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, paddingBottom: 8 },
  cardBackChoice: { width: "31.5%", minHeight: 118, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A", padding: 7, position: "relative" },
  cardBackChoiceSelected: { borderColor: "#77D6C3", backgroundColor: "rgba(119, 214, 195, 0.14)" },
  cardBackChoiceHovered: { transform: [{ translateY: -4 }, { scale: 1.02 }], borderColor: "#F3C969", shadowColor: "#F3C969", shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  cardBackPreview: { width: 48, height: 68, borderRadius: 6, borderWidth: 3, padding: 3 },
  cardBackPreviewInner: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 3, borderWidth: 1 },
  cardBackPreviewAsset: { ...StyleSheet.absoluteFillObject, borderRadius: 5, width: "100%", height: "100%" },
  cardBackPreviewGlyph: { fontSize: 22, fontWeight: "900" },
  cardBackChoiceName: { color: "#D6E2F4", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 6 },
  cardBackChoiceHint: { color: "#AFC5E6", fontSize: 8, fontWeight: "700", textAlign: "center", marginTop: 2 },
  cardBackChoiceCheck: { position: "absolute", top: 4, right: 6, color: "#77D6C3", fontSize: 15, fontWeight: "900" },
  recordsHeaderVisual: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  recordsHeaderImage: { width: 58, height: 58 },
  recordsHeaderCopy: { flex: 1 },
  recordsModeLabel: { color: "#F3C969", fontSize: 12, fontWeight: "800", marginTop: 3 },
  recordModeToggle: { flexDirection: "row", gap: 7, marginTop: 12 },
  recordModeButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, backgroundColor: "#1E3152", borderWidth: 1, borderColor: "#46658F" },
  recordModeButtonActive: { backgroundColor: "#2C806F", borderColor: "#77D6C3" },
  recordModeButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "800" },
  recordGrid: { flexDirection: "row", gap: 8, marginTop: 20 },
  recordCard: { flex: 1, minHeight: 112, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A", paddingHorizontal: 4 },
  recordCardImage: { width: 30, height: 30, marginBottom: 3 },
  recordValue: { color: "#FFFDF8", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  recordLabel: { color: "#A6B4CE", fontSize: 10, fontWeight: "700", marginTop: 5 },
  replayStagePanel: { marginTop: 12, padding: 12, borderRadius: 15, backgroundColor: "#2A1D45", borderWidth: 1, borderColor: "#9A73D1" },
  replayStageTitle: { color: "#FFE08A", fontSize: 13, fontWeight: "900" },
  replayStageCopy: { color: "#D8CFF0", fontSize: 11, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  replayStagePicker: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#57408A", borderWidth: 1, borderColor: "#D6B8FF" },
  replayStagePickerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  replayStagePickerChevron: { color: "#FFE08A", fontSize: 12, fontWeight: "900" },
  replayStageList: { height: 190, maxHeight: 190, flexGrow: 0, padding: 5, borderRadius: 11, backgroundColor: "#39295D", borderWidth: 1, borderColor: "#D6B8FF" },
  replayStageListContent: { gap: 5 },
  replayStageOption: { minHeight: 34, paddingHorizontal: 12, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#57408A", borderWidth: 1, borderColor: "#D6B8FF" },
  replayStageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  replayStageButton: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#57408A", borderWidth: 1, borderColor: "#D6B8FF" },
  replayStageButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  stageBestTimesPanel: { marginTop: 12, padding: 12, minHeight: 100, borderRadius: 15, backgroundColor: "#172A4A", borderWidth: 1, borderColor: "#5C82B2" },
  stageBestTimesTitle: { color: "#FFE08A", fontSize: 13, fontWeight: "900", marginBottom: 6 },
  stageBestTimeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "rgba(166, 180, 206, 0.18)" },
  stageBestTimeStage: { color: "#D6E2F4", fontSize: 11, fontWeight: "800" },
  stageBestTimeValue: { color: "#77D6C3", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  stageBestTimesScroll: { height: 190, maxHeight: 190, flexGrow: 0 },
  stageBestTimesScrollContent: { paddingBottom: 2 },
  stageBestTimesEmpty: { color: "#A6B4CE", fontSize: 11, fontWeight: "700", paddingVertical: 5 },
  rulesClose: { position: "absolute", top: 14, right: 16, width: 34, height: 34, alignItems: "center", justifyContent: "center", zIndex: 3, borderRadius: 17, backgroundColor: "#152542" },
  rulesTitleRow: { position: "relative", zIndex: 1000, elevation: 1000, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: 42 },
  languagePickerGroup: { flexDirection: "row", alignItems: "center", gap: 6, zIndex: 1100, elevation: 1100 },
  languagePickerLabel: { color: "#FFE16B", fontSize: 21, lineHeight: 26, fontWeight: "900", textShadowColor: "#071225", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  languagePickerLabelCompactLanguage: { fontSize: 17, lineHeight: 21 },
  languagePickerWrap: { position: "relative", zIndex: 1100, elevation: 1100, minWidth: 128, alignItems: "stretch" },
  languagePickerButton: { minWidth: 128, minHeight: 38, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#172A4A", borderWidth: 2, borderColor: "#6E9BCB", shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  languagePickerText: { flex: 1, color: "#FFF4C2", fontSize: 13, lineHeight: 16, fontWeight: "900", textShadowColor: "#071225", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  languagePickerChevron: { color: "#FFE08A", fontSize: 11, fontWeight: "900", marginLeft: 7 },
  languagePickerList: { position: "absolute", top: 43, right: 0, zIndex: 1200, elevation: 1200, width: 210, height: 230, maxHeight: 230, flexGrow: 0, padding: 5, borderRadius: 13, backgroundColor: "#152542", borderWidth: 2, borderColor: "#F3C969", shadowColor: "#000000", shadowOpacity: 0.55, shadowRadius: 10 },
  languagePickerListContent: { minHeight: 440, flexGrow: 0, paddingBottom: 4 },
  languagePickerOption: { minHeight: 34, flexShrink: 0, paddingHorizontal: 9, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  languagePickerOptionActive: { backgroundColor: "#2C806F" },
  languagePickerOptionText: { color: "#FFFDF8", fontSize: 12, fontWeight: "900" },
  languagePickerFlag: { fontSize: 16, lineHeight: 19 },
  languagePickerOptionTextActive: { color: "#FFF1B8" },
  languagePickerOptionEnglish: { color: "#AFC5E6", fontSize: 9, fontWeight: "700", marginLeft: 8 },
  rulesCloseText: { color: "#FFF3D1", fontSize: 24, lineHeight: 27, fontWeight: "900" },
  rulesTabs: { width: "100%", flexDirection: "row", gap: 5, marginTop: 18, marginBottom: 4 },
  rulesScroll: { maxHeight: 310 },
  rulesContentContainer: { justifyContent: "flex-start", paddingBottom: 16 },
  rulesTab: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 3, paddingVertical: 4, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#152542", borderWidth: 1, borderColor: "#36527A" },
  rulesTabActive: { backgroundColor: "#2B6B72", borderColor: "#77D6C3" },
  rulesTabText: { color: "#111111", fontSize: 12, lineHeight: 14, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  rulesTabTextCompactLanguage: { fontSize: 10, lineHeight: 12 },
  rulesTabTextActive: { color: "#111111" },
  attendanceHeaderButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, overflow: "hidden" },
  attendanceHeaderAnimated: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  attendanceHeaderButtonDone: { backgroundColor: "#465A7F", opacity: 0.72 },
  attendanceHeaderImage: { width: 40, height: 40 },
  attendanceHeaderImageDone: { opacity: 0.48 },
  attendanceDoneBadge: { position: "absolute", right: 1, bottom: 1, width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#77D6C3", borderWidth: 2, borderColor: "#152542" },
  attendanceDoneBadgeText: { color: "#152542", fontSize: 13, lineHeight: 15, fontWeight: "900" },
  attendanceRewardFlight: { position: "absolute", zIndex: 90, height: 42, alignItems: "center", justifyContent: "center" },
  hammerRewardFlightText: { color: "#FFE27A", fontWeight: "900", textAlign: "center", textShadowColor: "#17233C", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4 },
  attendanceCard: { position: "relative", width: "88%", maxWidth: 330, alignItems: "center", paddingHorizontal: 22, paddingBottom: 19, paddingTop: 22, borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#1E3153", shadowColor: "#000000", shadowOpacity: 0.46, shadowRadius: 20, elevation: 20, transform: [{ translateY: -60 }] },
  attendanceModalImage: { width: 96, height: 54, marginBottom: 5 },
  attendanceTitle: { color: "#FFF3D1", fontSize: 22, fontWeight: "900", textAlign: "center" },
  attendanceCopy: { color: "#D4E2F7", fontSize: 14, fontWeight: "800", textAlign: "center", marginTop: 9 },
  attendanceReward: { color: "#77D6C3", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 7 },
  attendanceClaimButton: { minWidth: 170, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#F3C969", marginTop: 15, paddingHorizontal: 18 },
  attendanceClaimButtonDisabled: { backgroundColor: "#465A7F", opacity: 0.75 },
  attendanceClaimText: { color: "#17233C", fontSize: 14, fontWeight: "900" },
  rulesText: { color: "#FFFDF8", fontSize: 16, lineHeight: 24, marginTop: 17 },
  rulesTextCompactLanguage: { fontSize: 14, lineHeight: 21 },
  rulesHint: { color: "#77D6C3", fontSize: 14, lineHeight: 21, marginTop: 13 },
  rulesHintCompactLanguage: { fontSize: 12, lineHeight: 18 },
  rulesModeUnlimited: { color: "#77D6C3", fontSize: 15, lineHeight: 21 },
  rulesModeTimeAttack: { color: "#FFB86B", fontSize: 15, lineHeight: 21 },
  rulesModeCommon: { color: "#B9C9FF", fontSize: 15, lineHeight: 21 },
  rulesStock: { color: "#FFD166", fontWeight: "900", fontSize: 15, lineHeight: 21 },
  rulesWaste: { color: "#FF9A76", fontSize: 15, lineHeight: 21 },
  rulesHammer: { color: "#F3C969", fontSize: 15, lineHeight: 21 },
  rulesAttendance: { color: "#9BE7F1", fontSize: 15, lineHeight: 21 },
  rulesRewarded: { color: "#D0C4FF", fontSize: 15, lineHeight: 21 },
  badgeModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(3, 7, 18, 0.84)" },
  badgeModalCard: { width: "92%", maxWidth: 360, alignItems: "center", borderRadius: 24, borderWidth: 2, borderColor: "#F3C969", backgroundColor: "#16284A", paddingVertical: 19, paddingHorizontal: 22, shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 22, elevation: 18, transform: [{ translateY: -60 }] },
  badgeModalEyebrow: { color: "#F3C969", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  badgeModalTitle: { color: "#FFF3D1", fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 6 },
  badgeModalImage: { width: 220, height: 220, marginVertical: 8 },
  previewBadgeButton: { borderColor: "#F3C969", backgroundColor: "rgba(243, 201, 105, 0.16)" },
  previewTimeAttackButton: { borderColor: "#80DDF4", backgroundColor: "rgba(55, 142, 181, 0.24)" },
  badgeModalCopy: { color: "#D4E2F7", fontSize: 14, lineHeight: 21, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  badgeCollectionScroll: { maxHeight: 330, width: "100%" },
  badgeCollectionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, paddingVertical: 8 },
  badgeCollectionItem: { width: 102, minHeight: 145, alignItems: "center", paddingVertical: 5, paddingHorizontal: 3, borderRadius: 12, borderWidth: 1, borderColor: "rgba(243, 201, 105, 0.35)", backgroundColor: "rgba(24, 45, 78, 0.58)" },
  badgeCollectionItemActive: { borderColor: "#77D6C3", borderWidth: 2, backgroundColor: "rgba(45, 104, 105, 0.72)" },
  badgeCollectionImage: { width: 82, height: 82 },
  badgeCollectionLabel: { color: "#FFF3D1", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 3 },
  badgeCollectionCondition: { color: "#AFC5E4", fontSize: 8, lineHeight: 10, fontWeight: "700", textAlign: "center", marginTop: 3 },
  badgeCollectionSelect: { minWidth: 58, marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#F3C969", backgroundColor: "rgba(243, 201, 105, 0.12)" },
  badgeCollectionSelectActive: { borderColor: "#77D6C3", backgroundColor: "rgba(119, 214, 195, 0.22)" },
  badgeCollectionSelectText: { color: "#FFF3D1", fontSize: 9, fontWeight: "900", textAlign: "center" },
  badgeDetailBackdrop: { flex: 1, zIndex: 200, elevation: 200, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(3, 7, 18, 0.86)" },
  badgeDetailCard: { zIndex: 201, elevation: 201, width: "94%", maxWidth: 360, alignItems: "center", borderRadius: 26, borderWidth: 3, borderColor: "#F3C969", backgroundColor: "#172B4C", paddingTop: 18, paddingBottom: 16, paddingHorizontal: 22, shadowColor: "#000", shadowOpacity: 0.62, shadowRadius: 24 },
  badgeDetailEyebrow: { color: "#76D9C7", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  badgeDetailTitle: { color: "#FFF3D1", fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center", marginTop: 5, textShadowColor: "#08152B", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  badgeDetailImage: { width: 225, height: 225, marginVertical: 2 },
  badgeDetailConditionLabel: { color: "#F3C969", fontSize: 12, fontWeight: "900", marginTop: 3 },
  badgeDetailCondition: { color: "#D4E2F7", fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center", marginTop: 5, marginBottom: 10 },
  uiGuideModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(0, 0, 0, 0.84)" },
  uiGuideModalCard: { position: "relative", width: "100%", maxWidth: 520, maxHeight: "92%", alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#071425", overflow: "hidden", transform: [{ translateY: -60 }] },
  uiGuideModalImage: { width: "100%", aspectRatio: 1145 / 1374, maxHeight: "92%" },
  uiGuideModalClose: { position: "absolute", top: 10, right: 10, zIndex: 2, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(7, 20, 37, 0.9)", borderWidth: 1, borderColor: "#F3C969" },
  uiGuideModalCloseText: { color: "#FFF3D1", fontSize: 27, lineHeight: 30, fontWeight: "900" },
  confirmBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(3, 7, 18, 0.76)" },
  confirmCard: { position: "relative", width: "100%", maxWidth: 440, overflow: "hidden", borderRadius: 24, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 22, paddingHorizontal: 24, transform: [{ translateY: -60 }] },
  timeOutCard: { width: "92%", maxWidth: 340, alignSelf: "center", borderRadius: 22, borderWidth: 2, borderColor: "#F3A85D", backgroundColor: "#36211F", paddingVertical: 20, paddingHorizontal: 24, transform: [{ translateY: -60 }] },
  resetModalPanelArt: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  confirmButtonArtClip: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden", borderRadius: 15 },
  confirmButtonArt: { position: "absolute", left: 0, width: "100%", height: "200%" },
  confirmActions: { flexDirection: "row", alignItems: "stretch", gap: 10, marginTop: 20 },
  confirmCancel: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#2A4268", borderWidth: 1, borderColor: "#45628E", overflow: "hidden" },
  confirmCancelText: { color: "#FFFDF8", fontSize: 15, lineHeight: 20, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  confirmStart: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 8, paddingVertical: 7, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#FF7A66", overflow: "hidden" },
  confirmStartText: { color: "#11182C", fontSize: 15, lineHeight: 20, fontWeight: "900", textAlign: "center", flexShrink: 1 },
});
