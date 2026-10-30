import type { SupportedLanguage } from "./i18n";

export type BadgeAbilityKind =
  | "time-180"
  | "score-move-10"
  | "hammer-clean-30"
  | "peek-3"
  | "foundation-score-1"
  | "first-move-score"
  | "combo-score"
  | "peek-3-cards"
  | "clean-time-5"
  | "boss-score-1"
  | "stock-first-card"
  | "free-recycle"
  | "combo-time"
  | "score-multiplier"
  | "starting-hammer"
  | "random-peek-2"
  | "time-90"
  | "foundation-bonus"
  | "boss-hammer";

export type BadgeAbility = {
  kind: BadgeAbilityKind;
  value: number;
  intervalSeconds?: number;
  intervalMoves?: number;
};

const ABILITIES: Record<string, BadgeAbility> = {
  "boss-01": { kind: "time-180", value: 1, intervalSeconds: 180 },
  "boss-02": { kind: "score-move-10", value: 20, intervalMoves: 10 },
  "boss-03": { kind: "hammer-clean-30", value: 1, intervalMoves: 30 },
  "boss-04": { kind: "peek-3", value: 3 },
  "boss-05": { kind: "foundation-score-1", value: 1 },
  "boss-06": { kind: "first-move-score", value: 50 },
  "boss-07": { kind: "combo-score", value: 10 },
  "boss-08": { kind: "peek-3-cards", value: 3 },
  "boss-09": { kind: "clean-time-5", value: 1, intervalMoves: 5 },
  "boss-10": { kind: "boss-score-1", value: 1 },
  "boss-11": { kind: "stock-first-card", value: 1 },
  "boss-12": { kind: "free-recycle", value: 1 },
  "boss-13": { kind: "combo-time", value: 2 },
  "boss-14": { kind: "score-multiplier", value: 5 },
  "boss-15": { kind: "starting-hammer", value: 1 },
  "king-boss-01": { kind: "random-peek-2", value: 2 },
  "king-boss-02": { kind: "time-90", value: 1, intervalSeconds: 90 },
  "king-boss-03": { kind: "foundation-bonus", value: 1 },
  "emperor-boss": { kind: "boss-hammer", value: 1 },
};

const TEXT: Record<BadgeAbilityKind, { ko: string; en: string }> = {
  "time-180": { ko: "3분마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 3 minutes" },
  "score-move-10": { ko: "정상 카드 이동 10개마다 +20점", en: "+20 score every 10 correct card moves" },
  "hammer-clean-30": { ko: "취소·망치 사용 없이 정상 이동 30회마다 망치 +1", en: "+1 hammer every 30 correct moves without undo or hammer" },
  "peek-3": { ko: "게임 시작 시 뒤집힌 카드 3초 공개", en: "Reveal face-down cards for 3 seconds at start" },
  "foundation-score-1": { ko: "파운데이션에 카드를 놓을 때마다 +1점", en: "+1 score whenever a card is placed on a foundation" },
  "first-move-score": { ko: "첫 정상 이동에 +50점", en: "+50 score on the first correct move" },
  "combo-score": { ko: "10콤보 달성 시 +10점 추가", en: "+10 score when reaching a 10-combo" },
  "peek-3-cards": { ko: "게임 시작 시 카드 3장 공개", en: "Reveal 3 cards at game start" },
  "clean-time-5": { ko: "취소·망치 없이 정상 이동 5회마다 시간 1초 보너스", en: "+1 second every 5 correct moves without undo or hammer" },
  "boss-score-1": { ko: "보스 명중 시마다 +1점", en: "+1 score for each boss hit" },
  "stock-first-card": { ko: "게임 시작 시 스톡 첫 번째 카드 공개", en: "Reveal the first stock card at game start" },
  "free-recycle": { ko: "첫 스톡 순환 1회 무료", en: "The first stock recycle is free" },
  "combo-time": { ko: "10콤보마다 콤보 시간 2초 연장", en: "+2 seconds to the combo timer at 10-combo" },
  "score-multiplier": { ko: "정리 점수 +5% 보너스", en: "+5% bonus to clear score" },
  "starting-hammer": { ko: "게임 시작 시 망치 +1", en: "+1 hammer at game start" },
  "random-peek-2": { ko: "3분마다 랜덤 카드 2장을 2초간 공개", en: "Reveal 2 random cards for 2 seconds every 3 minutes" },
  "time-90": { ko: "90초마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 90 seconds" },
  "foundation-bonus": { ko: "파운데이션 완성 시 +1 보너스", en: "+1 bonus when completing a foundation" },
  "boss-hammer": { ko: "보스 클리어 시 망치 +2", en: "+2 hammers after clearing a boss" },
};

export function getBadgeAbility(id: string): BadgeAbility {
  return ABILITIES[id] ?? { kind: "score-move-10", value: 20, intervalMoves: 10 };
}

export function getBadgeAbilityText(id: string, language: SupportedLanguage): string {
  const text = TEXT[getBadgeAbility(id).kind];
  return language === "ko" ? text.ko : text.en;
}
