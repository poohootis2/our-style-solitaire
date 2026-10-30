import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, leaderboardEntries, leaderboardStageEntries, userGameStates, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { aggregateOverallLeaderboardRows, type LeaderboardAggregateRow } from "./leaderboard-aggregation";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connectionUrl = new URL(process.env.DATABASE_URL);
      const isTiDbCloud = connectionUrl.hostname.endsWith("tidbcloud.com");
      const pool = createPool({
        host: connectionUrl.hostname,
        port: connectionUrl.port ? Number(connectionUrl.port) : 3306,
        user: decodeURIComponent(connectionUrl.username),
        password: decodeURIComponent(connectionUrl.password),
        database: decodeURIComponent(connectionUrl.pathname.replace(/^\//, "")),
        waitForConnections: true,
        connectionLimit: 5,
        ssl: isTiDbCloud ? { rejectUnauthorized: true } : undefined,
      });
      // drizzle-orm and mysql2 can expose different Pool declaration paths;
      // the runtime object is the compatible mysql2 promise pool.
      _db = drizzle(pool as never);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Safe production diagnostic: exposes only table row counts, never user data. */
export async function getDatabaseHealthSummary() {
  const db = await getDb();
  if (!db) return { available: false, users: 0, gameStates: 0, overallRankings: 0, stageRankings: 0 };

  try {
    const [userCount, gameStateCount, overallRankingCount, stageRankingCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(userGameStates),
      db.select({ count: sql<number>`count(*)` }).from(leaderboardEntries),
      db.select({ count: sql<number>`count(*)` }).from(leaderboardStageEntries),
    ]);
    return {
      available: true,
      users: Number(userCount[0]?.count ?? 0),
      gameStates: Number(gameStateCount[0]?.count ?? 0),
      overallRankings: Number(overallRankingCount[0]?.count ?? 0),
      stageRankings: Number(stageRankingCount[0]?.count ?? 0),
    };
  } catch (error) {
    console.error("[Database] Health summary failed", error);
    return { available: false, users: 0, gameStates: 0, overallRankings: 0, stageRankings: 0 };
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "countryCode", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserGameState(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userGameStates).where(eq(userGameStates.userId, userId)).limit(1);
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].payload) as unknown; } catch { return null; }
}

export async function upsertUserGameState(userId: number, payload: unknown) {
  const db = await getDb();
  if (!db) return;
  const serialized = JSON.stringify(payload);
  if (serialized.length > 500_000) throw new Error("Cloud save payload is too large.");
  await db.insert(userGameStates).values({ userId, payload: serialized, updatedAt: new Date() }).onDuplicateKeyUpdate({
    set: { payload: serialized, updatedAt: new Date() },
  });
}

export async function updateUserCountry(userId: number, countryCode: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ countryCode }).where(eq(users.id, userId));
}

export async function updateUserName(userId: number, name: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

export async function findUserByName(name: string, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = name.trim().toLocaleLowerCase("en-US");
  const rows = await db.select({ id: users.id, name: users.name }).from(users)
    .where(sql`LOWER(${users.name}) = ${normalized}`)
    .limit(10);
  return rows.find((row) => row.id !== excludeUserId);
}

/**
 * Rebuild the overall board from durable per-stage records as well as the
 * legacy overall table. This keeps users from disappearing when an older
 * client submitted stage rows but never created an aggregate row.
 */
async function getOverallLeaderboardRows(mode: "unlimited" | "timeAttack") {
  const db = await getDb();
  if (!db) return [] as LeaderboardAggregateRow[];

  const stageRows = await db.select({
    id: leaderboardStageEntries.id,
    userId: leaderboardStageEntries.userId,
    mode: leaderboardStageEntries.mode,
    score: leaderboardStageEntries.score,
    timeSeconds: leaderboardStageEntries.timeSeconds,
    stage: leaderboardStageEntries.stage,
    name: users.name,
    countryCode: users.countryCode,
  }).from(leaderboardStageEntries)
    .leftJoin(users, eq(leaderboardStageEntries.userId, users.id))
    .where(eq(leaderboardStageEntries.mode, mode));

  const legacyRows = await db.select({
    id: leaderboardEntries.id,
    userId: leaderboardEntries.userId,
    mode: leaderboardEntries.mode,
    score: leaderboardEntries.score,
    timeSeconds: leaderboardEntries.timeSeconds,
    stage: leaderboardEntries.stage,
    name: users.name,
    countryCode: users.countryCode,
  }).from(leaderboardEntries)
    .leftJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(eq(leaderboardEntries.mode, mode));

  return aggregateOverallLeaderboardRows(
    stageRows as LeaderboardAggregateRow[],
    legacyRows as LeaderboardAggregateRow[],
    mode,
  );
}

export async function getLeaderboard(mode: "unlimited" | "timeAttack") {
  return getOverallLeaderboardRows(mode);
}


export async function getLeaderboardByStage(mode: "unlimited" | "timeAttack", stage: number) {
  const db = await getDb();
  if (!db) return [];
  const stageRows = await db.select({
    id: leaderboardStageEntries.id,
    userId: leaderboardStageEntries.userId,
    mode: leaderboardStageEntries.mode,
    score: leaderboardStageEntries.score,
    timeSeconds: leaderboardStageEntries.timeSeconds,
    stage: leaderboardStageEntries.stage,
    name: users.name,
    countryCode: users.countryCode,
  }).from(leaderboardStageEntries)
    .leftJoin(users, eq(leaderboardStageEntries.userId, users.id))
    .where(and(eq(leaderboardStageEntries.mode, mode), eq(leaderboardStageEntries.stage, stage)))
    .orderBy(desc(leaderboardStageEntries.score), asc(leaderboardStageEntries.timeSeconds), desc(leaderboardStageEntries.updatedAt))
    .limit(20);
  if (stageRows.length) return stageRows;

  // Backward compatibility: older app versions wrote only the user's overall
  // record. If that record represents the requested highest stage, show it
  // immediately instead of reporting an empty stage ranking.
  return db.select({
    id: leaderboardEntries.id,
    userId: leaderboardEntries.userId,
    mode: leaderboardEntries.mode,
    score: leaderboardEntries.score,
    timeSeconds: leaderboardEntries.timeSeconds,
    stage: leaderboardEntries.stage,
    name: users.name,
    countryCode: users.countryCode,
  }).from(leaderboardEntries)
    .leftJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(and(eq(leaderboardEntries.mode, mode), eq(leaderboardEntries.stage, stage)))
    .orderBy(desc(leaderboardEntries.score), asc(leaderboardEntries.timeSeconds), desc(leaderboardEntries.updatedAt))
    .limit(20);
}

export async function getLeaderboardStageSnapshot(userId: number, mode: "unlimited" | "timeAttack", stage: number) {
  const db = await getDb();
  if (!db) return { rows: [], myRank: null as number | null, myTimeSeconds: null as number | null };
  let rows = await db.select({
    id: leaderboardStageEntries.id,
    userId: leaderboardStageEntries.userId,
    mode: leaderboardStageEntries.mode,
    score: leaderboardStageEntries.score,
    timeSeconds: leaderboardStageEntries.timeSeconds,
    stage: leaderboardStageEntries.stage,
    name: users.name,
    countryCode: users.countryCode,
  }).from(leaderboardStageEntries)
    .leftJoin(users, eq(leaderboardStageEntries.userId, users.id))
    .where(and(eq(leaderboardStageEntries.mode, mode), eq(leaderboardStageEntries.stage, stage)))
    .orderBy(desc(leaderboardStageEntries.score), asc(leaderboardStageEntries.timeSeconds), desc(leaderboardStageEntries.updatedAt));
  if (!rows.length) {
    rows = await db.select({
      id: leaderboardEntries.id,
      userId: leaderboardEntries.userId,
      mode: leaderboardEntries.mode,
      score: leaderboardEntries.score,
      timeSeconds: leaderboardEntries.timeSeconds,
      stage: leaderboardEntries.stage,
      name: users.name,
      countryCode: users.countryCode,
    }).from(leaderboardEntries)
      .leftJoin(users, eq(leaderboardEntries.userId, users.id))
      .where(and(eq(leaderboardEntries.mode, mode), eq(leaderboardEntries.stage, stage)))
      .orderBy(desc(leaderboardEntries.score), asc(leaderboardEntries.timeSeconds), desc(leaderboardEntries.updatedAt));
  }
  const index = rows.findIndex((row) => row.userId === userId);
  return { rows: rows.slice(0, 20), myRank: index >= 0 ? index + 1 : null, myTimeSeconds: index >= 0 ? rows[index].timeSeconds : null };
}

export async function getLeaderboardSnapshot(userId: number, mode: "unlimited" | "timeAttack") {
  const rows = await getOverallLeaderboardRows(mode);
  const index = rows.findIndex((row) => row.userId === userId);
  return { rows: rows.slice(0, 20), myRank: index >= 0 ? index + 1 : null, myTimeSeconds: index >= 0 ? rows[index].timeSeconds : null };
}

export async function upsertLeaderboardEntry(input: { userId: number; mode: "unlimited" | "timeAttack"; score: number; timeSeconds?: number | null; stage: number }) {
  const db = await getDb();
  if (!db) return;

  // Keep one best record per user and stage. The overall board is derived from
  // these durable stage records so later-stage progress cannot be lost when its
  // single-stage score happens to be lower than an older stage.
  const stageExisting = await db.select({ score: leaderboardStageEntries.score, timeSeconds: leaderboardStageEntries.timeSeconds })
    .from(leaderboardStageEntries)
    .where(and(eq(leaderboardStageEntries.userId, input.userId), eq(leaderboardStageEntries.mode, input.mode), eq(leaderboardStageEntries.stage, input.stage)))
    .limit(1);
  const previousStage = stageExisting[0];
  const previousStageTime = previousStage?.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  const nextStageTime = input.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  const betterStageRecord = !previousStage
    || input.score > previousStage.score
    || (input.score === previousStage.score && nextStageTime < previousStageTime);
  if (betterStageRecord) {
    await db.insert(leaderboardStageEntries).values({ userId: input.userId, mode: input.mode, stage: input.stage, score: input.score, timeSeconds: input.timeSeconds ?? null }).onDuplicateKeyUpdate({
      set: { score: input.score, timeSeconds: input.timeSeconds ?? null, updatedAt: new Date() },
    });
  }

  const stageRows = await db.select({ stage: leaderboardStageEntries.stage, score: leaderboardStageEntries.score, timeSeconds: leaderboardStageEntries.timeSeconds })
    .from(leaderboardStageEntries)
    .where(and(eq(leaderboardStageEntries.userId, input.userId), eq(leaderboardStageEntries.mode, input.mode)));
  if (!stageRows.length) return;
  const aggregateScore = stageRows.reduce((total, row) => total + row.score, 0);
  const highestStage = Math.max(...stageRows.map((row) => row.stage));
  const bestStageTime = stageRows
    .filter((row) => row.stage === highestStage)
    .map((row) => row.timeSeconds)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0] ?? null;

  const existingOverall = await db.select({ stage: leaderboardEntries.stage, score: leaderboardEntries.score, timeSeconds: leaderboardEntries.timeSeconds })
    .from(leaderboardEntries)
    .where(and(eq(leaderboardEntries.userId, input.userId), eq(leaderboardEntries.mode, input.mode)))
    .limit(1);
  const previousOverall = existingOverall[0];
  const previousOverallTime = previousOverall?.timeSeconds ?? Number.MAX_SAFE_INTEGER;
  const aggregateIsBetter = !previousOverall
    || highestStage > previousOverall.stage
    || (highestStage === previousOverall.stage && aggregateScore > previousOverall.score)
    || (highestStage === previousOverall.stage && aggregateScore === previousOverall.score && (bestStageTime ?? Number.MAX_SAFE_INTEGER) < previousOverallTime);
  if (aggregateIsBetter) {
    await db.insert(leaderboardEntries).values({
      userId: input.userId,
      mode: input.mode,
      score: aggregateScore,
      timeSeconds: bestStageTime,
      stage: highestStage,
    }).onDuplicateKeyUpdate({
      set: { score: aggregateScore, timeSeconds: bestStageTime, stage: highestStage, updatedAt: new Date() },
    });
  }
}
