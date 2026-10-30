import { expressHandler } from "../_express-handler";

// Vercel can otherwise treat procedure names such as `leaderboard.top` as
// static file-like paths. A dedicated dynamic route ensures every tRPC
// procedure is dispatched to the shared Express /api/trpc middleware.
export default expressHandler;
