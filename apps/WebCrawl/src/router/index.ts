import { Elysia } from "elysia";
import { requestLogger } from "../middleware/requestLogger";
import { registerHealthRoutes } from "./health";
import { registerScrapeRoutes } from "./scrape";
import { registerCrawlRoutes } from "./crawl";

export function createApp() {
  const app = new Elysia().use(requestLogger);
  registerHealthRoutes(app);
  registerScrapeRoutes(app);
  registerCrawlRoutes(app);
  return app;
}

