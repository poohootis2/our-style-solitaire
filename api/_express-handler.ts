import { createApp } from "../server/_core/index";

const app = createApp();

export function expressHandler(req: any, res: any) {
  return app(req, res);
}
