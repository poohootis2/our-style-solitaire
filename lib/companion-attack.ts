export type CompanionAttackStyle = "red" | "blue" | "orange" | "white";

export type CompanionAttackSource = {
  attackStyle?: CompanionAttackStyle;
};

// Pet attack cards are assigned from the dominant visual color of each pet art.
// The four existing card families are used: red/fire, blue/ice, orange/lightning, white-shadow.
// This is a static map so native builds do not inspect image pixels at runtime.
const PET_ATTACK_STYLE_BY_ID: Record<string, CompanionAttackStyle> = {
  "pet-003": "red",
  "pet-004": "blue",
  "pet-005": "orange",
  "pet-006": "white",
  "pet-007": "red",
  "pet-008": "blue",
  "pet-009": "orange",
  "pet-010": "white",
  "pet-012": "red",
  "pet-015": "blue",
  "pet-017": "orange",
  "pet-019": "white",
  "pet-021": "red",
  "pet-022": "blue",
  "pet-023": "orange",
  "pet-024": "white",
  "pet-025": "red",
  "pet-026": "blue",
  "pet-027": "orange",
  "pet-028": "white",
  "pet-029": "red",
  "pet-030": "blue",
  "pet-032": "orange",
  "pet-033": "white",
  "pet-034": "red",
  "pet-036": "blue",
  "pet-037": "orange",
  "pet-038": "white",
  "pet-039": "red",
  "pet-040": "blue",
  "pet-042": "orange",
  "pet-047": "white",
  "pet-048": "red",
  "pet-051": "blue",
  "pet-055": "orange",
  "pet-056": "white",
  "pet-057": "red",
  "pet-058": "blue",
  "pet-059": "orange",
  "pet-060": "white",
  "pet-061": "red",
  "pet-062": "blue",
  "pet-063": "orange",
  "pet-064": "white",
  "pet-065": "red",
  "pet-066": "blue",
  "pet-067": "orange",
  "pet-068": "white",
  "pet-069": "red",
  "pet-070": "blue",
  "pet-077": "orange",
  "pet-078": "white",
  "pet-079": "red",
  "pet-080": "blue",
  "pet-081": "orange",
  "pet-082": "white",
  "pet-083": "red",
  "pet-084": "blue",
  "pet-085": "orange",
  "pet-086": "white",
  "pet-087": "red",
  "pet-097": "blue",
  "pet-098": "orange",
  "pet-101": "white",
  "pet-102": "red",
  "pet-104": "blue",
  "pet-105": "orange",
  "pet-106": "white",
  "pet-107": "red",
  "pet-108": "blue",
  "pet-109": "orange",
  "pet-110": "white",
  "pet-111": "red",
  "pet-112": "blue",
  "pet-113": "orange",
  "pet-115": "white",
  "pet-116": "red",
  "pet-117": "blue",
  "pet-118": "orange",
  "pet-119": "white",
  "pet-120": "red",
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
