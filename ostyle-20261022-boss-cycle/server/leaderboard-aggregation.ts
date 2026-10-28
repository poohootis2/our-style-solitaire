export type LeaderboardMode = "unlimited" | "timeAttack";

export type LeaderboardAggregateRow = {
  id: number;
  userId: number;
  mode: LeaderboardMode;
  score: number;
  timeSeconds: number | null;
  stage: number;
  name: string | null;
  countryCode: string | null;
};

const timeValue = (value: number | null) => value ?? Number.MAX_SAFE_INTEGER;

function chooseHigherStageRow(current: LeaderboardAggregateRow, candidate: LeaderboardAggregateRow) {
  if (candidate.stage > current.stage) return candidate;
  if (candidate.stage < current.stage) return current;
  return timeValue(candidate.timeSeconds) < timeValue(current.timeSeconds) ? candidate : current;
}

/**
 * Produces exactly one overall entry per player from all durable stage records.
 * A legacy overall entry is kept for players who have no stage rows and acts as
 * a floor for partially migrated players, so older data is never lost.
 */
export function aggregateOverallLeaderboardRows(
  stageRows: LeaderboardAggregateRow[],
  legacyRows: LeaderboardAggregateRow[],
  mode: LeaderboardMode,
): LeaderboardAggregateRow[] {
  const aggregate = new Map<number, LeaderboardAggregateRow>();

  for (const row of stageRows) {
    const current = aggregate.get(row.userId);
    if (!current) {
      aggregate.set(row.userId, { ...row });
      continue;
    }

    const stageRepresentative = chooseHigherStageRow(current, row);
    aggregate.set(row.userId, {
      ...stageRepresentative,
      score: current.score + row.score,
      name: row.name ?? current.name,
      countryCode: row.countryCode ?? current.countryCode,
    });
  }

  for (const legacy of legacyRows) {
    const current = aggregate.get(legacy.userId);
    if (!current) {
      aggregate.set(legacy.userId, { ...legacy });
      continue;
    }

    const stageRepresentative = chooseHigherStageRow(current, legacy);
    // A legacy entry may contain stages saved before per-stage tracking existed.
    // Preserve that total until the user's complete stage history has been
    // re-submitted by a newer client.
    aggregate.set(legacy.userId, {
      ...stageRepresentative,
      score: Math.max(current.score, legacy.score),
      name: legacy.name ?? current.name,
      countryCode: legacy.countryCode ?? current.countryCode,
    });
  }

  return [...aggregate.values()]
    .sort((left, right) => mode === "timeAttack"
      ? right.stage - left.stage
        || right.score - left.score
        || timeValue(left.timeSeconds) - timeValue(right.timeSeconds)
        || left.userId - right.userId
      : right.score - left.score
        || right.stage - left.stage
        || left.userId - right.userId)
    .slice(0, 20);
}
