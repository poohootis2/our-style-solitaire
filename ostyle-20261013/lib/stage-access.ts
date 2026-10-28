export type StageProgressRecord = {
  stageBestTimes?: Record<string, number>;
  stageBestScores?: Record<string, number>;
};

/** Returns the last genuinely cleared stage without trusting an old browse-state value. */
export function getLastClearedStage(
  record: StageProgressRecord | undefined,
  storedNextStage: number | undefined,
  stageLimit: number,
): number {
  const recordedStages = [...Object.keys(record?.stageBestTimes ?? {}), ...Object.keys(record?.stageBestScores ?? {})]
    .map(Number)
    .filter((stage) => Number.isInteger(stage) && stage >= 1 && stage <= stageLimit);
  if (recordedStages.length) return Math.max(...recordedStages);
  return Math.max(0, Math.min(stageLimit, Math.floor(storedNextStage ?? 1) - 1));
}
