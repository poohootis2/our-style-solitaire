import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: varchar("avatarUrl", { length: 2048 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  countryCode: varchar("countryCode", { length: 2 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userGameStates = mysqlTable("user_game_states", {
  userId: int("userId").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserGameState = typeof userGameStates.$inferSelect;
export type InsertUserGameState = typeof userGameStates.$inferInsert;

export const leaderboardEntries = mysqlTable("leaderboard_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mode: mysqlEnum("mode", ["unlimited", "timeAttack"]).notNull(),
  score: int("score").notNull().default(0),
  timeSeconds: int("timeSeconds"),
  stage: int("stage").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userModeUnique: uniqueIndex("leaderboard_user_mode_unique").on(table.userId, table.mode),
  modeScoreIndex: index("leaderboard_mode_score_index").on(table.mode, table.score),
}));

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type InsertLeaderboardEntry = typeof leaderboardEntries.$inferInsert;

export const leaderboardStageEntries = mysqlTable("leaderboard_stage_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mode: mysqlEnum("mode", ["unlimited", "timeAttack"]).notNull(),
  stage: int("stage").notNull(),
  score: int("score").notNull().default(0),
  timeSeconds: int("timeSeconds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userModeStageUnique: uniqueIndex("leaderboard_stage_user_mode_stage_unique").on(table.userId, table.mode, table.stage),
  modeStageScoreIndex: index("leaderboard_stage_mode_stage_score_index").on(table.mode, table.stage, table.score),
}));
export type LeaderboardStageEntry = typeof leaderboardStageEntries.$inferSelect;
export type InsertLeaderboardStageEntry = typeof leaderboardStageEntries.$inferInsert;
