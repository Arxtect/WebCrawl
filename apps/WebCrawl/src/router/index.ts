import { Elysia } from "elysia";
import { requestLogger } from "../middleware/requestLogger";
import { registerHealthRoutes } from "./health";
import { registerScrapeRoutes } from "./scrape";

export function createApp() {
  const app = new Elysia().use(requestLogger);
  registerHealthRoutes(app);
  registerScrapeRoutes(app);
  return app;
}

