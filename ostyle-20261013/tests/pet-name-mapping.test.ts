import { describe, expect, it } from "vitest";

import { getMappedPetName, PET_NAME_MAPPING } from "../lib/pet-name-mapping";

describe("CellGuard pet name mapping", () => {
  it("contains the new names for representative available pet IDs", () => {
    expect(PET_NAME_MAPPING["pet-003"]).toBe("별멍이질주");
    expect(PET_NAME_MAPPING["pet-029"]).toBe("줄범성운");
    expect(PET_NAME_MAPPING["pet-051"]).toBe("몽글펫새싹");
    expect(PET_NAME_MAPPING["pet-120"]).toBe("별빛수태초");
  });

  it("provides the mapped names used by the three battle companions", () => {
    expect(PET_NAME_MAPPING["pet-029"]).toBe("줄범성운");
    expect(PET_NAME_MAPPING["pet-042"]).toBe("운령수호");
    expect(PET_NAME_MAPPING["pet-051"]).toBe("몽글펫새싹");
  });

  it("keeps a fallback for a pet ID without a mapping", () => {
    expect(getMappedPetName("pet-not-yet-added", "기존 이름")).toBe("기존 이름");
  });
});
