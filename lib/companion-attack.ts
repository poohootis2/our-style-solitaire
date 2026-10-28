export type CompanionAttackStyle = "red" | "blue" | "orange" | "white";

export type CompanionAttackSource = {
  attackStyle?: CompanionAttackStyle;
};

// Pet attack cards are assigned from the dominant visual color of each pet art.
// The four existing card families are used: red/fire, blue/ice, orange/lightning, white-shadow.
// This is a static map so native builds do not inspect image pixels at runtime.
const PET_ATTACK_STYLE_BY_ID: Record<string, CompanionAttackStyle> = {
  "pet-003": "orange",
  "pet-004": "red",
  "pet-005": "blue",
  "pet-006": "orange",
  "pet-007": "white",
  "pet-008": "blue",
  "pet-009": "orange",
  "pet-010": "orange",
  "pet-012": "blue",
  "pet-015": "orange",
  "pet-017": "blue",
  "pet-019": "white",
  "pet-021": "orange",
  "pet-022": "orange",
  "pet-023": "blue",
  "pet-024": "blue",
  "pet-025": "blue",
  "pet-026": "blue",
  "pet-027": "blue",
  "pet-028": "orange",
  "pet-029": "blue",
  "pet-030": "blue",
  "pet-032": "blue",
  "pet-033": "blue",
  "pet-034": "orange",
  "pet-036": "orange",
  "pet-037": "blue",
  "pet-038": "orange",
  "pet-039": "blue",
  "pet-040": "orange",
  "pet-042": "orange",
  "pet-047": "orange",
  "pet-048": "orange",
  "pet-051": "orange",
  "pet-055": "blue",
  "pet-056": "orange",
  "pet-057": "blue",
  "pet-058": "orange",
  "pet-059": "orange",
  "pet-060": "blue",
  "pet-061": "orange",
  "pet-062": "blue",
  "pet-063": "blue",
  "pet-064": "orange",
  "pet-065": "blue",
  "pet-066": "orange",
  "pet-067": "orange",
  "pet-068": "orange",
  "pet-069": "blue",
  "pet-070": "blue",
  "pet-077": "blue",
  "pet-078": "blue",
  "pet-079": "orange",
  "pet-080": "blue",
  "pet-081": "orange",
  "pet-082": "orange",
  "pet-083": "blue",
  "pet-084": "orange",
  "pet-085": "blue",
  "pet-086": "orange",
  "pet-087": "orange",
  "pet-097": "orange",
  "pet-098": "orange",
  "pet-101": "orange",
  "pet-102": "orange",
  "pet-104": "orange",
  "pet-105": "orange",
  "pet-106": "blue",
  "pet-107": "orange",
  "pet-108": "blue",
  "pet-109": "orange",
  "pet-110": "orange",
  "pet-111": "orange",
  "pet-112": "orange",
  "pet-113": "blue",
  "pet-115": "blue",
  "pet-116": "blue",
  "pet-117": "orange",
  "pet-118": "blue",
  "pet-119": "blue",
  "pet-120": "orange",
};

export function getPetAttackStyle(petId: string): CompanionAttackStyle {
  return PET_ATTACK_STYLE_BY_ID[petId] ?? "white";
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
