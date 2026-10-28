import { getChapterForStage, isChapterBossStage } from "./solitaire";
import type { CompanionAttackStyle } from "./companion-attack";
import { getMappedPetName } from "./pet-name-mapping";
import { getPostStoryBossSlot } from "./post-story-boss";

export type BattleAsset = {
  id: string;
  name: string;
  image: number;
  smallImage?: number;
  mediumImage?: number;
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
  { id: "anglerfish", name: "심해 아귀", image: require("../assets/images/monsters/enemy_anglerfish.png"), smallImage: require("../assets/images/monsters/enemy_anglerfish-small.webp"), mediumImage: require("../assets/images/monsters/enemy_anglerfish-medium.webp") },
  { id: "blue-shark", name: "푸른 상어", image: require("../assets/images/monsters/enemy_blue_shark.png"), smallImage: require("../assets/images/monsters/enemy_blue_shark-small.webp"), mediumImage: require("../assets/images/monsters/enemy_blue_shark-medium.webp") },
  { id: "pufferfish", name: "왕복어", image: require("../assets/images/monsters/enemy_pufferfish.png"), smallImage: require("../assets/images/monsters/enemy_pufferfish-small.webp"), mediumImage: require("../assets/images/monsters/enemy_pufferfish-medium.webp") },
  { id: "jellyfish-mage", name: "해파리 마도사", image: require("../assets/images/monsters/tower_jellyfish_mage.png"), smallImage: require("../assets/images/monsters/tower_jellyfish_mage-small.webp"), mediumImage: require("../assets/images/monsters/tower_jellyfish_mage-medium.webp") },
  { id: "hermit-cannon", name: "소라 대포병", image: require("../assets/images/monsters/tower_hermit_crab_cannon.png"), smallImage: require("../assets/images/monsters/tower_hermit_crab_cannon-small.webp"), mediumImage: require("../assets/images/monsters/tower_hermit_crab_cannon-medium.webp") },
  { id: "coral-golem", name: "산호 골렘", image: require("../assets/images/monsters/tower_coral_golem.png"), smallImage: require("../assets/images/monsters/tower_coral_golem-small.webp"), mediumImage: require("../assets/images/monsters/tower_coral_golem-medium.webp") },
  { id: "seahorse-caster", name: "해마 주문술사", image: require("../assets/images/monsters/tower_seahorse_caster.png"), smallImage: require("../assets/images/monsters/tower_seahorse_caster-small.webp"), mediumImage: require("../assets/images/monsters/tower_seahorse_caster-medium.webp") },
  { id: "squid-mage", name: "오징어 마법사", image: require("../assets/images/monsters/tower_squid_mage.png"), smallImage: require("../assets/images/monsters/tower_squid_mage-small.webp"), mediumImage: require("../assets/images/monsters/tower_squid_mage-medium.webp") },
  { id: "moonveil-witchfish", name: "문베일 마녀어", image: require("../assets/images/monsters/new_monster_moonveil_witchfish.png"), smallImage: require("../assets/images/monsters/new_monster_moonveil_witchfish-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_moonveil_witchfish-medium.webp") },
  { id: "tideforge-crab", name: "타이드포지 게", image: require("../assets/images/monsters/new_monster_tideforge_crab.png"), smallImage: require("../assets/images/monsters/new_monster_tideforge_crab-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_tideforge_crab-medium.webp") },
  { id: "abyssal-clockwork-eel", name: "심연 시계태엽 장어", image: require("../assets/images/monsters/new_monster_abyssal_clockwork_eel.png"), smallImage: require("../assets/images/monsters/new_monster_abyssal_clockwork_eel-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_abyssal_clockwork_eel-medium.webp") },
  { id: "reefstone-minotaur", name: "리프스톤 미노타우로스", image: require("../assets/images/monsters/new_monster_reefstone_minotaur.png"), smallImage: require("../assets/images/monsters/new_monster_reefstone_minotaur-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_reefstone_minotaur-medium.webp") },
  { id: "stormshell-oracle", name: "스톰셸 오라클", image: require("../assets/images/monsters/new_monster_stormshell_oracle.png"), smallImage: require("../assets/images/monsters/new_monster_stormshell_oracle-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_stormshell_oracle-medium.webp") },
  { id: "emberkelp-knight", name: "엠버켈프 기사", image: require("../assets/images/monsters/new_monster_emberkelp_knight.png"), smallImage: require("../assets/images/monsters/new_monster_emberkelp_knight-small.webp"), mediumImage: require("../assets/images/monsters/new_monster_emberkelp_knight-medium.webp") },
];

const bossEncounters: Array<BattleAsset & { badgeId: string; badgeImage: number }> = [
  { id: "ancient-shark", name: "고대 상어", image: require("../assets/images/monsters/boss_ancient_shark.png"), smallImage: require("../assets/images/monsters/boss_ancient_shark-small.webp"), mediumImage: require("../assets/images/monsters/boss_ancient_shark-medium.webp"), badgeId: "boss-01", badgeImage: require("../assets/images/boss-badges/boss-01-ancient-shark.png") },
  { id: "abyssal-anglerfish", name: "심연 아귀", image: require("../assets/images/monsters/boss_abyssal_anglerfish.png"), smallImage: require("../assets/images/monsters/boss_abyssal_anglerfish-small.webp"), mediumImage: require("../assets/images/monsters/boss_abyssal_anglerfish-medium.webp"), badgeId: "boss-02", badgeImage: require("../assets/images/boss-badges/boss-02-abyssal-anglerfish.png") },
  { id: "royal-pufferfish", name: "왕실 복어", image: require("../assets/images/monsters/boss_royal_pufferfish.png"), smallImage: require("../assets/images/monsters/boss_royal_pufferfish-small.webp"), mediumImage: require("../assets/images/monsters/boss_royal_pufferfish-medium.webp"), badgeId: "boss-03", badgeImage: require("../assets/images/boss-badges/boss-03-royal-pufferfish.png") },
  { id: "magma-turtle", name: "마그마 거북", image: require("../assets/images/monsters/boss_magma_turtle.png"), smallImage: require("../assets/images/monsters/boss_magma_turtle-small.webp"), mediumImage: require("../assets/images/monsters/boss_magma_turtle-medium.webp"), badgeId: "boss-04", badgeImage: require("../assets/images/boss-badges/boss-04-magma-turtle.png") },
  { id: "jellyfish-queen", name: "해파리 여왕", image: require("../assets/images/monsters/boss_jellyfish_queen.png"), smallImage: require("../assets/images/monsters/boss_jellyfish_queen-small.webp"), mediumImage: require("../assets/images/monsters/boss_jellyfish_queen-medium.webp"), badgeId: "boss-05", badgeImage: require("../assets/images/boss-badges/boss-05-jellyfish-queen.png") },
  { id: "hermit-cannon-commander", name: "소라 지휘관", image: require("../assets/images/monsters/boss_hermit_cannon_commander.png"), smallImage: require("../assets/images/monsters/boss_hermit_cannon_commander-small.webp"), mediumImage: require("../assets/images/monsters/boss_hermit_cannon_commander-medium.webp"), badgeId: "boss-06", badgeImage: require("../assets/images/boss-badges/boss-06-hermit-commander.png") },
  { id: "coral-golem-king", name: "산호 골렘 왕", image: require("../assets/images/monsters/boss_coral_golem_king.png"), smallImage: require("../assets/images/monsters/boss_coral_golem_king-small.webp"), mediumImage: require("../assets/images/monsters/boss_coral_golem_king-medium.webp"), badgeId: "boss-07", badgeImage: require("../assets/images/boss-badges/boss-07-coral-golem-king.png") },
  { id: "seahorse-emperor", name: "해마 황제", image: require("../assets/images/monsters/boss_seahorse_emperor.png"), smallImage: require("../assets/images/monsters/boss_seahorse_emperor-small.webp"), mediumImage: require("../assets/images/monsters/boss_seahorse_emperor-medium.webp"), badgeId: "boss-08", badgeImage: require("../assets/images/boss-badges/boss-08-seahorse-emperor.png") },
  { id: "squid-archmage", name: "오징어 대마법사", image: require("../assets/images/monsters/boss_squid_archmage.png"), smallImage: require("../assets/images/monsters/boss_squid_archmage-small.webp"), mediumImage: require("../assets/images/monsters/boss_squid_archmage-medium.webp"), badgeId: "boss-09", badgeImage: require("../assets/images/boss-badges/boss-09-squid-archmage.png") },
  { id: "moonveil-witchfish-matriarch", name: "문베일 마녀어 여왕", image: require("../assets/images/monsters/boss_moonveil_witchfish_matriarch.png"), smallImage: require("../assets/images/monsters/boss_moonveil_witchfish_matriarch-small.webp"), mediumImage: require("../assets/images/monsters/boss_moonveil_witchfish_matriarch-medium.webp"), badgeId: "boss-10", badgeImage: require("../assets/images/boss-badges/badge_moonveil_witchfish_matriarch.png") },
  { id: "tideforge-dread-admiral", name: "타이드포지 공포 제독", image: require("../assets/images/monsters/boss_tideforge_dread_admiral.png"), smallImage: require("../assets/images/monsters/boss_tideforge_dread_admiral-small.webp"), mediumImage: require("../assets/images/monsters/boss_tideforge_dread_admiral-medium.webp"), badgeId: "boss-11", badgeImage: require("../assets/images/boss-badges/badge_tideforge_dread_admiral.png") },
  { id: "abyssal-clockwork-eel-leviathan", name: "심연 시계태엽 레비아탄", image: require("../assets/images/monsters/boss_abyssal_clockwork_eel_leviathan.png"), smallImage: require("../assets/images/monsters/boss_abyssal_clockwork_eel_leviathan-small.webp"), mediumImage: require("../assets/images/monsters/boss_abyssal_clockwork_eel_leviathan-medium.webp"), badgeId: "boss-12", badgeImage: require("../assets/images/boss-badges/badge_abyssal_clockwork_eel_leviathan.png") },
  { id: "reefstone-minotaur-king", name: "리프스톤 미노타우로스 왕", image: require("../assets/images/monsters/boss_reefstone_minotaur_king.png"), smallImage: require("../assets/images/monsters/boss_reefstone_minotaur_king-small.webp"), mediumImage: require("../assets/images/monsters/boss_reefstone_minotaur_king-medium.webp"), badgeId: "boss-13", badgeImage: require("../assets/images/boss-badges/badge_reefstone_minotaur_king.png") },
  { id: "stormshell-celestial-seer", name: "스톰셸 천상 예언자", image: require("../assets/images/monsters/boss_stormshell_celestial_seer.png"), smallImage: require("../assets/images/monsters/boss_stormshell_celestial_seer-small.webp"), mediumImage: require("../assets/images/monsters/boss_stormshell_celestial_seer-medium.webp"), badgeId: "boss-14", badgeImage: require("../assets/images/boss-badges/badge_stormshell_celestial_seer.png") },
  { id: "emberkelp-inferno-warden", name: "엠버켈프 지옥 수호자", image: require("../assets/images/monsters/boss_emberkelp_inferno_warden.png"), smallImage: require("../assets/images/monsters/boss_emberkelp_inferno_warden-small.webp"), mediumImage: require("../assets/images/monsters/boss_emberkelp_inferno_warden-medium.webp"), badgeId: "boss-15", badgeImage: require("../assets/images/boss-badges/badge_emberkelp_inferno_warden.png") },
];

const kingBossEncounters = [
  { id: "fusion-abyssal-predator", name: "심연 포식자", image: require("../assets/images/monsters/fusion_trinity_abyssal_royal_predator.png"), smallImage: require("../assets/images/monsters/fusion_trinity_abyssal_royal_predator-small.webp"), mediumImage: require("../assets/images/monsters/fusion_trinity_abyssal_royal_predator-medium.webp"), badgeId: "king-boss-01", badgeImage: require("../assets/images/boss-badges/king-boss-01-abyssal-predator.png") },
  { id: "fusion-magma-coral", name: "산호 여왕", image: require("../assets/images/monsters/fusion_trinity_magma_coral_queen.png"), smallImage: require("../assets/images/monsters/fusion_trinity_magma_coral_queen-small.webp"), mediumImage: require("../assets/images/monsters/fusion_trinity_magma_coral_queen-medium.webp"), badgeId: "king-boss-02", badgeImage: require("../assets/images/boss-badges/king-boss-02-coral-queen.png") },
  { id: "fusion-arcane-artillery", name: "비전 포병", image: require("../assets/images/monsters/fusion_trinity_arcane_artillery.png"), smallImage: require("../assets/images/monsters/fusion_trinity_arcane_artillery-small.webp"), mediumImage: require("../assets/images/monsters/fusion_trinity_arcane_artillery-medium.webp"), badgeId: "king-boss-03", badgeImage: require("../assets/images/boss-badges/king-boss-03-arcane-artillery.png") },
];

const emperorEncounter = { id: "oceanic-omni-emperor", name: "대양의 옴니 황제", image: require("../assets/images/monsters/final_boss_oceanic_omni_emperor.png"), smallImage: require("../assets/images/monsters/final_boss_oceanic_omni_emperor-small.webp"), mediumImage: require("../assets/images/monsters/final_boss_oceanic_omni_emperor-medium.webp"), badgeId: "emperor-boss", badgeImage: require("../assets/images/boss-badges/emperor-boss-oceanic-omni.png") };

const companions: BattleAsset[] = [
  { id: "cloud-tiger", name: getMappedPetName("pet-029", "구름 호랑이"), image: require("../assets/images/characters/029_cloud-tiger.png"), smallImage: require("../assets/images/characters/029_cloud-tiger-small.webp"), mediumImage: require("../assets/images/characters/029_cloud-tiger-medium.webp"), attackStyle: "orange" },
  { id: "gumiho-tail", name: getMappedPetName("pet-042", "구미호 꼬리"), image: require("../assets/images/characters/042_gumiho-tail.png"), smallImage: require("../assets/images/characters/042_gumiho-tail-small.webp"), mediumImage: require("../assets/images/characters/042_gumiho-tail-medium.webp"), attackStyle: "red" },
  { id: "mochi-rabbit", name: getMappedPetName("pet-051", "모찌 토끼"), image: require("../assets/images/characters/051_mochi-rabbit.png"), smallImage: require("../assets/images/characters/051_mochi-rabbit-small.webp"), mediumImage: require("../assets/images/characters/051_mochi-rabbit-medium.webp"), attackStyle: "white" },
];

const portraitBackgrounds: number[] = [
  require("../assets/images/backgrounds/portrait/pastel_fairytale_01_cloud_village.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_02_snowy_village.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_03_lighthouse_hill.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_04_flower_hill.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_05_rooftop_garden.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_06_gingerbread_village.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_07_lantern_lake.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_08_enchanted_forest.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_09_crystal_cave.webp"),
  require("../assets/images/backgrounds/portrait/pastel_fairytale_10_attic_study.webp"),
];

// The supplied artwork is portrait-oriented, so use the same ordered set in
// landscape mode instead of mixing in the old dark arena artwork.
const landscapeBackgrounds = portraitBackgrounds;

export function getBattleContent(stage: number, landscape: boolean): BattleContent {
  const safeStage = Math.max(1, stage);
  let encounterType: BattleContent["encounterType"] = "regular";
  let monster: BattleAsset = regularMonsters[(safeStage - 1) % regularMonsters.length];
  let badgeId: string | undefined;
  let badgeImage: number | undefined;

  // Story stages use one complete 14-monster cycle followed by one boss.
  // This gives boss stages at 15, 30, 45, 60, 75, 90, and 105.
  if (safeStage <= 115 && safeStage % 15 === 0) {
    const boss = bossEncounters[((safeStage / 15) - 1) % bossEncounters.length];
    encounterType = "boss";
    monster = boss;
    badgeId = boss.badgeId;
    badgeImage = boss.badgeImage;
  } else if (safeStage > 115) {
    // Stage 115 is the end of the story rotation. From stage 116 onward,
    // cycle through Boss 01–15, King Boss 01–03, then the Emperor.
    // Every boss-type encounter exposes its badge; the collection de-duplicates
    // already unlocked IDs, so repeating the cycle does not create duplicates.
    const postStoryBossSlot = getPostStoryBossSlot(safeStage);
    if (!postStoryBossSlot) return getBattleContent(116, landscape);
    if (postStoryBossSlot.kind === "boss") {
      encounterType = "boss";
      const boss = bossEncounters[postStoryBossSlot.index];
      monster = boss;
      // A boss badge is granted when a boss appears. The collection itself
      // de-duplicates already unlocked badge IDs.
      badgeId = boss.badgeId;
      badgeImage = boss.badgeImage;
    } else if (postStoryBossSlot.kind === "kingBoss") {
      encounterType = "kingBoss";
      const kingBoss = kingBossEncounters[postStoryBossSlot.index];
      monster = kingBoss;
      badgeId = kingBoss.badgeId;
      badgeImage = kingBoss.badgeImage;
    } else {
      encounterType = "emperor";
      monster = emperorEncounter;
      badgeId = emperorEncounter.badgeId;
      badgeImage = emperorEncounter.badgeImage;
    }
  }

  const chapter = safeStage <= 115 ? Math.floor((safeStage - 1) / 15) + 1 : 9;
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
