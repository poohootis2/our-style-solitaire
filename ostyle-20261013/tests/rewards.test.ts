import { describe, expect, it } from "vitest";
import { ATTENDANCE_SPECIAL_PET_IDS, getAttendanceHammerReward, isSpecialAttendanceDay, pickAttendancePet } from "../lib/rewards";

describe("출석 보상 규칙", () => {
  it("1~5일차는 10~50개이고 6일차부터 10개로 다시 반복한다", () => {
    expect(Array.from({ length: 10 }, (_, index) => getAttendanceHammerReward(index + 1))).toEqual([10, 20, 30, 40, 50, 10, 20, 30, 40, 50]);
    expect(getAttendanceHammerReward(11)).toBe(10);
    expect(getAttendanceHammerReward(15)).toBe(50);
    expect(getAttendanceHammerReward(16)).toBe(10);
  });

  it("10일 주기의 마지막 날마다 특별 펫 추첨을 활성화한다", () => {
    expect(isSpecialAttendanceDay(10)).toBe(true);
    expect(isSpecialAttendanceDay(20)).toBe(true);
    expect(isSpecialAttendanceDay(30)).toBe(true);
    expect(isSpecialAttendanceDay(9)).toBe(false);
  });

  it("보유하지 않은 특별 펫만 무작위로 선택하고 모두 보유하면 중복 지급하지 않는다", () => {
    expect(pickAttendancePet([], () => 0)).toBe(ATTENDANCE_SPECIAL_PET_IDS[0]);
    expect(pickAttendancePet([ATTENDANCE_SPECIAL_PET_IDS[0]], () => 0)).toBe(ATTENDANCE_SPECIAL_PET_IDS[1]);
    expect(pickAttendancePet([...ATTENDANCE_SPECIAL_PET_IDS])).toBeNull();
  });
});
