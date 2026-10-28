export const ATTENDANCE_SPECIAL_PET_IDS = [
  "pet-021", // 새벽 호랑이
  "pet-023", // 눈꽃 호랑이
  "pet-080", // 코랄 드래곤
  "pet-113", // 별빛 드래곤
  "pet-117", // 번개 라이온
] as const;

/** 1~5일차는 10~50개를 지급하고, 6일차부터 다시 10개로 10일 주기를 반복합니다. */
export function getAttendanceHammerReward(day: number): number {
  if (!Number.isFinite(day) || day < 1) return 0;
  return ((Math.floor(day) - 1) % 5 + 1) * 10;
}

export function isSpecialAttendanceDay(day: number): boolean {
  return day > 0 && day % 10 === 0;
}

/** 아직 보유하지 않은 특별 펫 중 하나를 무작위로 고릅니다. */
export function pickAttendancePet(unlockedPetIds: string[], random = Math.random): string | null {
  const candidates = ATTENDANCE_SPECIAL_PET_IDS.filter((id) => !unlockedPetIds.includes(id));
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length));
  return candidates[index] ?? null;
}
