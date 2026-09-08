export type CompanionAttackStyle = "red" | "blue" | "orange" | "white";

export type CompanionAttackSource = {
  attackStyle?: CompanionAttackStyle;
};

export function getPetAttackStyle(petId: string): CompanionAttackStyle {
  const numericId = Number(petId.match(/(\d+)$/)?.[1] ?? 0);
  return numericId % 4 === 0 ? "red" : numericId % 4 === 1 ? "blue" : numericId % 4 === 2 ? "orange" : "white";
}

export function getCompanionAttackStyle(companion: CompanionAttackSource, rosterIndex = 0): CompanionAttackStyle {
  return companion.attackStyle ?? (["red", "blue", "orange", "white"] as const)[rosterIndex % 4];
}

export const companionAttackColors: Record<CompanionAttackStyle, string> = {
  red: "#FF4F64",
  blue: "#5FA8FF",
  orange: "#FF9A3D",
  white: "#FFFFFF",
};
