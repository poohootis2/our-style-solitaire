import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { protectedProcedure } from "./_core/trpc";
import { getLeaderboard, getLeaderboardByStage, getLeaderboardSnapshot, getLeaderboardStageSnapshot, findUserByName, getUserGameState, updateUserCountry, updateUserName, upsertLeaderboardEntry, upsertUserGameState } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const FORBIDDEN_PROFILE_WORDS = [
  "admin", "administrator", "moderator", "support", "official", "system",
  "운영자", "관리자", "공식", "씨발", "시발", "병신", "개새끼", "좆", "보지", "자지",
];

function validateProfileName(value: string | null) {
  const name = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return null;
  const hasKorean = /[\uAC00-\uD7A3]/.test(name);
  const maxLength = hasKorean ? 5 : 10;
  if (Array.from(name).length > maxLength) {
    throw new TRPCError({ code: "BAD_REQUEST", message: hasKorean ? "한글 아이디는 5글자까지 입력할 수 있습니다." : "영문 아이디는 10자까지 입력할 수 있습니다." });
  }
  const folded = name.toLocaleLowerCase("ko-KR");
  if (FORBIDDEN_PROFILE_WORDS.some((word) => folded.includes(word))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "사용할 수 없는 단어가 포함된 아이디입니다." });
  }
  return name;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      console.info("[Session-v3] auth.me", { authenticated: Boolean(opts.ctx.user) });
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  profile: router({
    me: protectedProcedure.query(({ ctx }) => ({
      name: ctx.user.name,
      email: ctx.user.email,
      countryCode: ctx.user.countryCode,
    })),
    updateCountry: protectedProcedure.input(z.object({ countryCode: z.string().regex(/^[A-Z]{2}$/).nullable() })).mutation(async ({ ctx, input }) => {
      await updateUserCountry(ctx.user.id, input.countryCode);
      return { countryCode: input.countryCode };
    }),
    updateName: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(10).nullable() })).mutation(async ({ ctx, input }) => {
      const name = validateProfileName(input.name);
      if (name) {
        const duplicate = await findUserByName(name, ctx.user.id);
        if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });
      }
      await updateUserName(ctx.user.id, name);
      return { name };
    }),
  }),

  leaderboard: router({
    top: publicProcedure.input(z.object({ mode: z.enum(["unlimited", "timeAttack"]) })).query(async ({ input }) => {
      const rows = await getLeaderboard(input.mode);
      console.info("[Ranking-v3] top", { mode: input.mode, rowCount: rows.length });
      return rows;
    }),
    byStage: publicProcedure.input(z.object({ mode: z.enum(["unlimited", "timeAttack"]), stage: z.number().int().min(1).max(10000) })).query(async ({ input }) => {
      const rows = await getLeaderboardByStage(input.mode, input.stage);
      console.info("[Ranking-v3] byStage", { mode: input.mode, stage: input.stage, rowCount: rows.length });
      return rows;
    }),
    snapshot: protectedProcedure.input(z.object({ mode: z.enum(["unlimited", "timeAttack"]) })).query(({ ctx, input }) => getLeaderboardSnapshot(ctx.user.id, input.mode)),
    stageSnapshot: protectedProcedure.input(z.object({ mode: z.enum(["unlimited", "timeAttack"]), stage: z.number().int().min(1).max(10000) })).query(({ ctx, input }) => getLeaderboardStageSnapshot(ctx.user.id, input.mode, input.stage)),
    submit: protectedProcedure.input(z.object({ mode: z.enum(["unlimited", "timeAttack"]), score: z.number().int().min(0).max(2147483647), timeSeconds: z.number().int().min(0).max(2147483647).nullable().optional(), stage: z.number().int().min(1).max(10000) })).mutation(({ ctx, input }) => upsertLeaderboardEntry({ userId: ctx.user.id, ...input })),
  }),

  gameState: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const state = await getUserGameState(ctx.user.id);
      console.info("[GameState-v3] get", { found: state !== null });
      return state;
    }),
    save: protectedProcedure.input(z.object({ payload: z.string().max(500_000) })).mutation(({ ctx, input }) => upsertUserGameState(ctx.user.id, JSON.parse(input.payload))),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
