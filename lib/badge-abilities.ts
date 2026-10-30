import type { SupportedLanguage } from "./i18n";

export type BadgeAbilityKind =
  | "time-180"
  | "score-move"
  | "hammer-20"
  | "peek-3"
  | "foundation-score"
  | "first-move-score"
  | "combo-score"
  | "peek-2"
  | "time-bonus"
  | "boss-score"
  | "hammer-10"
  | "free-recycle"
  | "combo-time"
  | "score-multiplier"
  | "starting-hammer"
  | "peek-2-short"
  | "time-90"
  | "foundation-bonus"
  | "boss-hammer";

export type BadgeAbility = {
  kind: BadgeAbilityKind;
  value: number;
  intervalSeconds?: number;
};

const ABILITIES: Record<string, BadgeAbility> = {
  "boss-01": { kind: "time-180", value: 1, intervalSeconds: 180 },
  "boss-02": { kind: "score-move", value: 20 },
  "boss-03": { kind: "hammer-20", value: 1, intervalSeconds: 20 },
  "boss-04": { kind: "peek-3", value: 3 },
  "boss-05": { kind: "foundation-score", value: 5 },
  "boss-06": { kind: "first-move-score", value: 50 },
  "boss-07": { kind: "combo-score", value: 10 },
  "boss-08": { kind: "peek-2", value: 2 },
  "boss-09": { kind: "time-bonus", value: 1, intervalSeconds: 5 },
  "boss-10": { kind: "boss-score", value: 5 },
  "boss-11": { kind: "hammer-10", value: 1, intervalSeconds: 10 },
  "boss-12": { kind: "free-recycle", value: 1 },
  "boss-13": { kind: "combo-time", value: 2 },
  "boss-14": { kind: "score-multiplier", value: 5 },
  "boss-15": { kind: "starting-hammer", value: 1 },
  "king-boss-01": { kind: "peek-2-short", value: 2 },
  "king-boss-02": { kind: "time-90", value: 1, intervalSeconds: 90 },
  "king-boss-03": { kind: "foundation-bonus", value: 1 },
  "emperor-boss": { kind: "boss-hammer", value: 2 },
};

const TEXT: Record<BadgeAbilityKind, { ko: string; en: string }> = {
  "time-180": { ko: "3분마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 3 minutes" },
  "score-move": { ko: "정상 카드 이동마다 +20점", en: "+20 score for each correct card move" },
  "hammer-20": { ko: "정상 이동 20회마다 망치 +1", en: "+1 hammer every 20 correct moves" },
  "peek-3": { ko: "게임 시작 시 뒤집힌 카드 3초 공개", en: "Reveal face-down cards for 3 seconds at start" },
  "foundation-score": { ko: "파운데이션 정리 카드마다 +5점", en: "+5 score for each foundation card" },
  "first-move-score": { ko: "첫 정상 이동에 +50점", en: "+50 score on the first correct move" },
  "combo-score": { ko: "10콤보 달성 시 +10점 추가", en: "+10 score when reaching a 10-combo" },
  "peek-2": { ko: "게임 시작 시 카드 2장 공개", en: "Reveal 2 cards at game start" },
  "time-bonus": { ko: "정상 이동 5회마다 시간 1초 보너스", en: "+1 second every 5 correct moves" },
  "boss-score": { ko: "보스 명중마다 +5점", en: "+5 score for each boss hit" },
  "hammer-10": { ko: "정상 이동 10회마다 망치 +1", en: "+1 hammer every 10 correct moves" },
  "free-recycle": { ko: "첫 스톡 순환 1회 무료", en: "The first stock recycle is free" },
  "combo-time": { ko: "10콤보마다 콤보 시간 2초 연장", en: "+2 seconds to the combo timer at 10-combo" },
  "score-multiplier": { ko: "정리 점수 +5% 보너스", en: "+5% bonus to clear score" },
  "starting-hammer": { ko: "게임 시작 시 망치 +1", en: "+1 hammer at game start" },
  "peek-2-short": { ko: "게임 시작 시 카드 2장 2초 공개", en: "Reveal 2 cards for 2 seconds at start" },
  "time-90": { ko: "90초마다 경과시간 1초 단축", en: "Reduce elapsed time by 1 second every 90 seconds" },
  "foundation-bonus": { ko: "파운데이션 완성 시 +1 보너스", en: "+1 bonus when completing a foundation" },
  "boss-hammer": { ko: "보스 클리어 시 망치 +2", en: "+2 hammers after clearing a boss" },
};

export function getBadgeAbility(id: string): BadgeAbility {
  return ABILITIES[id] ?? { kind: "score-move", value: 10 };
}

export function getBadgeAbilityText(id: string, language: SupportedLanguage): string {
  const text = TEXT[getBadgeAbility(id).kind];
  return language === "ko" ? text.ko : text.en;
}
