export type PostStoryBossKind = "boss" | "kingBoss" | "emperor";

/** 9 regular bosses + 3 king bosses + the emperor. */
export const POST_STORY_BOSS_COUNT = 13;

/**
 * Returns the repeating boss slot for post-story stages.
 * Stage 115 remains the original final boss; the repeating sequence starts at 116.
 */
export function getPostStoryBossSlot(stage: number): { kind: PostStoryBossKind; index: number } | null {
  const safeStage = Math.floor(stage);
  if (!Number.isFinite(safeStage) || safeStage < 116) return null;

  const slot = (safeStage - 116) % POST_STORY_BOSS_COUNT;
  if (slot < 9) return { kind: "boss", index: slot };
  if (slot < 12) return { kind: "kingBoss", index: slot - 9 };
  return { kind: "emperor", index: 0 };
}
