import { getChapterForStage, isChapterBossStage } from "./solitaire";

export type BattleAsset = {
  id: string;
  name: string;
  image: number;
};

export type BattleContent = {
  chapter: number;
  stage: number;
  isBoss: boolean;
  monster: BattleAsset;
  companion: BattleAsset;
  background: number;
};

const monstersByChapter: Record<number, { regular: BattleAsset[]; boss: BattleAsset }> = {
  1: {
    regular: [
      { id: "anglerfish", name: "심해 아귀", image: require("../assets/images/monsters/enemy_anglerfish.png") },
      { id: "blue-shark", name: "푸른 상어", image: require("../assets/images/monsters/enemy_blue_shark.png") },
      { id: "pufferfish", name: "왕복어", image: require("../assets/images/monsters/enemy_pufferfish.png") },
    ],
    boss: { id: "coral-golem-king", name: "산호 골렘 왕", image: require("../assets/images/monsters/boss_coral_golem_king.png") },
  },
  2: {
    regular: [
      { id: "jellyfish-mage", name: "해파리 마도사", image: require("../assets/images/monsters/tower_jellyfish_mage.png") },
      { id: "hermit-cannon", name: "소라 대포병", image: require("../assets/images/monsters/tower_hermit_crab_cannon.png") },
      { id: "coral-golem", name: "산호 골렘", image: require("../assets/images/monsters/tower_coral_golem.png") },
    ],
    boss: { id: "jellyfish-queen", name: "해파리 여왕", image: require("../assets/images/monsters/boss_jellyfish_queen.png") },
  },
  3: {
    regular: [
      { id: "seahorse-caster", name: "해마 주문술사", image: require("../assets/images/monsters/tower_seahorse_caster.png") },
      { id: "squid-mage", name: "오징어 마법사", image: require("../assets/images/monsters/tower_squid_mage.png") },
      { id: "ancient-shark", name: "고대 상어", image: require("../assets/images/monsters/boss_ancient_shark.png") },
    ],
    boss: { id: "squid-archmage", name: "오징어 대마법사", image: require("../assets/images/monsters/boss_squid_archmage.png") },
  },
  4: {
    regular: [
      { id: "magma-turtle", name: "마그마 거북", image: require("../assets/images/monsters/boss_magma_turtle.png") },
      { id: "seahorse-emperor", name: "해마 황제", image: require("../assets/images/monsters/boss_seahorse_emperor.png") },
      { id: "royal-pufferfish", name: "왕실 복어", image: require("../assets/images/monsters/boss_royal_pufferfish.png") },
      { id: "abyssal-anglerfish", name: "심연 아귀", image: require("../assets/images/monsters/boss_abyssal_anglerfish.png") },
      { id: "fusion-magma-coral", name: "융합 산호 여왕", image: require("../assets/images/monsters/fusion_trinity_magma_coral_queen.png") },
      { id: "fusion-arcane-artillery", name: "융합 비전 포병", image: require("../assets/images/monsters/fusion_trinity_arcane_artillery.png") },
      { id: "fusion-abyssal-predator", name: "융합 심연 포식자", image: require("../assets/images/monsters/fusion_trinity_abyssal_royal_predator.png") },
    ],
    boss: { id: "oceanic-omni-emperor", name: "대양의 옴니 황제", image: require("../assets/images/monsters/final_boss_oceanic_omni_emperor.png") },
  },
};

const companions: BattleAsset[] = [
  { id: "cloud-tiger", name: "구름 호랑이", image: require("../assets/images/characters/029_구름 호랑이.png") },
  { id: "gumiho-tail", name: "구미호 꼬리", image: require("../assets/images/characters/042_구미호 꼬리.png") },
  { id: "mochi-rabbit", name: "모찌 토끼", image: require("../assets/images/characters/051_모찌 토끼.png") },
];

const landscapeBackgrounds: number[] = [
  require("../assets/images/backgrounds/landscape/battle-arena-abyssal-pearl-palace.jpg"),
  require("../assets/images/backgrounds/landscape/battle-arena-clockwork-hourglass.jpg"),
  require("../assets/images/backgrounds/landscape/battle-arena-eclipse-observatory.jpg"),
  require("../assets/images/backgrounds/landscape/battle-arena-tempest-bastion.jpg"),
];

const portraitBackgrounds: number[] = [
  require("../assets/images/backgrounds/portrait/adventure_sky_no_person.jpg"),
  require("../assets/images/backgrounds/portrait/adventure_water_no_person.jpg"),
  require("../assets/images/backgrounds/portrait/enchanted_forest_bg.jpg"),
  require("../assets/images/backgrounds/portrait/fantasy_style_1_sky_island.jpg"),
  require("../assets/images/backgrounds/portrait/fantasy_style_2_crystal_lake.jpg"),
];

export function getBattleContent(stage: number, landscape: boolean): BattleContent {
  const safeStage = Math.max(1, stage);
  const chapter = getChapterForStage(safeStage);
  const roster = monstersByChapter[chapter];
  const isBoss = isChapterBossStage(safeStage);
  const regularIndex = (safeStage - 1) % roster.regular.length;
  return {
    chapter,
    stage: safeStage,
    isBoss,
    monster: isBoss ? roster.boss : roster.regular[regularIndex],
    companion: companions[(safeStage - 1) % companions.length],
    background: (landscape ? landscapeBackgrounds : portraitBackgrounds)[(safeStage - 1) % (landscape ? landscapeBackgrounds.length : portraitBackgrounds.length)],
  };
}

export function getCompanionRoster(): BattleAsset[] {
  return [...companions];
}
