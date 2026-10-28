import { getChapterForStage, isChapterBossStage } from "./solitaire";
import type { CompanionAttackStyle } from "./companion-attack";
import { getMappedPetName } from "./pet-name-mapping";

export type BattleAsset = {
  id: string;
  name: string;
  image: number;
  attackStyle?: CompanionAttackStyle;
};

export type BattleContent = {
  chapter: number;
  stage: number;
  isBoss: boolean;
  monster: BattleAsset;
  companion: BattleAsset;
  background: number;
  encounterType: "regular" | "boss" | "kingBoss" | "emperor";
  badgeId?: string;
  badgeImage?: number;
};

const regularMonsters: BattleAsset[] = [
  { id: "anglerfish", name: "심해 아귀", image: require("../assets/images/monsters/enemy_anglerfish.png") },
  { id: "blue-shark", name: "푸른 상어", image: require("../assets/images/monsters/enemy_blue_shark.png") },
  { id: "pufferfish", name: "왕복어", image: require("../assets/images/monsters/enemy_pufferfish.png") },
  { id: "jellyfish-mage", name: "해파리 마도사", image: require("../assets/images/monsters/tower_jellyfish_mage.png") },
  { id: "hermit-cannon", name: "소라 대포병", image: require("../assets/images/monsters/tower_hermit_crab_cannon.png") },
  { id: "coral-golem", name: "산호 골렘", image: require("../assets/images/monsters/tower_coral_golem.png") },
  { id: "seahorse-caster", name: "해마 주문술사", image: require("../assets/images/monsters/tower_seahorse_caster.png") },
  { id: "squid-mage", name: "오징어 마법사", image: require("../assets/images/monsters/tower_squid_mage.png") },
];

const bossEncounters: Array<{ id: string; name: string; image: number; badgeId: string; badgeImage: number }> = [
  { id: "ancient-shark", name: "고대 상어", image: require("../assets/images/monsters/boss_ancient_shark.png"), badgeId: "boss-01", badgeImage: require("../assets/images/boss-badges/boss-01-ancient-shark.png") },
  { id: "abyssal-anglerfish", name: "심연 아귀", image: require("../assets/images/monsters/boss_abyssal_anglerfish.png"), badgeId: "boss-02", badgeImage: require("../assets/images/boss-badges/boss-02-abyssal-anglerfish.png") },
  { id: "royal-pufferfish", name: "왕실 복어", image: require("../assets/images/monsters/boss_royal_pufferfish.png"), badgeId: "boss-03", badgeImage: require("../assets/images/boss-badges/boss-03-royal-pufferfish.png") },
  { id: "magma-turtle", name: "마그마 거북", image: require("../assets/images/monsters/boss_magma_turtle.png"), badgeId: "boss-04", badgeImage: require("../assets/images/boss-badges/boss-04-magma-turtle.png") },
  { id: "jellyfish-queen", name: "해파리 여왕", image: require("../assets/images/monsters/boss_jellyfish_queen.png"), badgeId: "boss-05", badgeImage: require("../assets/images/boss-badges/boss-05-jellyfish-queen.png") },
  { id: "hermit-cannon-commander", name: "소라 지휘관", image: require("../assets/images/monsters/boss_hermit_cannon_commander.png"), badgeId: "boss-06", badgeImage: require("../assets/images/boss-badges/boss-06-hermit-commander.png") },
  { id: "coral-golem-king", name: "산호 골렘 왕", image: require("../assets/images/monsters/boss_coral_golem_king.png"), badgeId: "boss-07", badgeImage: require("../assets/images/boss-badges/boss-07-coral-golem-king.png") },
  { id: "seahorse-emperor", name: "해마 황제", image: require("../assets/images/monsters/boss_seahorse_emperor.png"), badgeId: "boss-08", badgeImage: require("../assets/images/boss-badges/boss-08-seahorse-emperor.png") },
  { id: "squid-archmage", name: "오징어 대마법사", image: require("../assets/images/monsters/boss_squid_archmage.png"), badgeId: "boss-09", badgeImage: require("../assets/images/boss-badges/boss-09-squid-archmage.png") },
];

const kingBossEncounters = [
  { id: "fusion-abyssal-predator", name: "심연 포식자", image: require("../assets/images/monsters/fusion_trinity_abyssal_royal_predator.png"), badgeId: "king-boss-01", badgeImage: require("../assets/images/boss-badges/king-boss-01-abyssal-predator.png") },
  { id: "fusion-magma-coral", name: "산호 여왕", image: require("../assets/images/monsters/fusion_trinity_magma_coral_queen.png"), badgeId: "king-boss-02", badgeImage: require("../assets/images/boss-badges/king-boss-02-coral-queen.png") },
  { id: "fusion-arcane-artillery", name: "비전 포병", image: require("../assets/images/monsters/fusion_trinity_arcane_artillery.png"), badgeId: "king-boss-03", badgeImage: require("../assets/images/boss-badges/king-boss-03-arcane-artillery.png") },
];

const emperorEncounter = { id: "oceanic-omni-emperor", name: "대양의 옴니 황제", image: require("../assets/images/monsters/final_boss_oceanic_omni_emperor.png"), badgeId: "emperor-boss", badgeImage: require("../assets/images/boss-badges/emperor-boss-oceanic-omni.png") };

const companions: BattleAsset[] = [
  { id: "cloud-tiger", name: getMappedPetName("pet-029", "구름 호랑이"), image: require("../assets/images/characters/029_cloud-tiger.png"), attackStyle: "orange" },
  { id: "gumiho-tail", name: getMappedPetName("pet-042", "구미호 꼬리"), image: require("../assets/images/characters/042_gumiho-tail.png"), attackStyle: "red" },
  { id: "mochi-rabbit", name: getMappedPetName("pet-051", "모찌 토끼"), image: require("../assets/images/characters/051_mochi-rabbit.png"), attackStyle: "white" },
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
  let encounterType: BattleContent["encounterType"] = "regular";
  let monster: BattleAsset = regularMonsters[(safeStage - 1) % regularMonsters.length];
  let badgeId: string | undefined;
  let badgeImage: number | undefined;

  // Stages 1–81: eight regular encounters, then one numbered boss.
  if (safeStage <= 81 && safeStage % 9 === 0) {
    const boss = bossEncounters[safeStage / 9 - 1];
    encounterType = "boss";
    monster = boss;
    badgeId = boss.badgeId;
    badgeImage = boss.badgeImage;
  } else if (safeStage >= 82 && safeStage <= 111) {
    // After Boss 09: three king bosses, each followed by Boss 01–09.
    const offset = safeStage - 82;
    if (offset === 0 || offset === 10 || offset === 20) {
      const king = kingBossEncounters[offset / 10];
      encounterType = "kingBoss";
      monster = king;
      badgeId = king.badgeId;
      badgeImage = king.badgeImage;
    } else {
      const repeatedBoss = bossEncounters[(offset - Math.floor(offset / 10) - 1) % bossEncounters.length];
      encounterType = "boss";
      monster = repeatedBoss;
      badgeId = repeatedBoss.badgeId;
      badgeImage = repeatedBoss.badgeImage;
    }
  } else if (safeStage === 112 || safeStage === 113 || safeStage === 114) {
    const king = kingBossEncounters[safeStage - 112];
    encounterType = "kingBoss";
    monster = king;
    badgeId = king.badgeId;
    badgeImage = king.badgeImage;
  } else if (safeStage >= 115) {
    encounterType = "emperor";
    monster = emperorEncounter;
    badgeId = emperorEncounter.badgeId;
    badgeImage = emperorEncounter.badgeImage;
  }

  const chapter = safeStage <= 81 ? Math.floor((safeStage - 1) / 9) + 1 : 10;
  return {
    chapter,
    stage: safeStage,
    isBoss: encounterType !== "regular",
    encounterType,
    badgeId,
    badgeImage,
    monster,
    companion: companions[(safeStage - 1) % companions.length],
    background: (landscape ? landscapeBackgrounds : portraitBackgrounds)[(safeStage - 1) % (landscape ? landscapeBackgrounds.length : portraitBackgrounds.length)],
  };
}
export function getCompanionRoster(): BattleAsset[] {
  return [...companions];
}
