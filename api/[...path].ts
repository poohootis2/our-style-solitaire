import { createApp } from "../server/_core/index";

// Vercel invokes this catch-all function for /api/* and Express dispatches
// the request to the existing OAuth, health, storage, and tRPC routes.
const app = createApp();

// Use an explicit Vercel handler instead of exporting the Express instance
// directly. This prevents Vercel from treating the bundled module as a
// static response and guarantees that /api/* requests reach Express.
export default function handler(req: Parameters<typeof app>[0], res: Parameters<typeof app>[1]) {
  return app(req, res);
}
