export type StageProgressRecord = {
  stageBestTimes?: Record<string, number>;
  stageBestScores?: Record<string, number>;
};

function recordedStages(record: StageProgressRecord | undefined, stageLimit: number): number[] {
  return [...Object.keys(record?.stageBestTimes ?? {}), ...Object.keys(record?.stageBestScores ?? {})]
    .map(Number)
    .filter((stage) => Number.isInteger(stage) && stage >= 1 && stage <= stageLimit);
}

/**
 * Returns only a stage supported by an actual saved clear record.
 * Navigation and update recovery must use this strict form so an old
 * browse-state value cannot unlock a future stage again.
 */
export function getLastVerifiedClearedStage(
  record: StageProgressRecord | undefined,
  stageLimit: number,
): number {
  const stages = recordedStages(record, stageLimit);
  return stages.length ? Math.max(...stages) : 0;
}

/** Returns the last genuinely cleared stage without trusting an old browse-state value. */
export function getLastClearedStage(
  record: StageProgressRecord | undefined,
  storedNextStage: number | undefined,
  stageLimit: number,
): number {
  const stages = recordedStages(record, stageLimit);
  if (stages.length) return Math.max(...stages);
  return Math.max(0, Math.min(stageLimit, Math.floor(storedNextStage ?? 1) - 1));
}
