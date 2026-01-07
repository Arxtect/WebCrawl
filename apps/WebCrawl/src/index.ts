import { config } from "./config";
import { createApp } from "./router";
import { logger } from "./lib/logger";

const app = createApp().listen({
  port: config.PORT,
  hostname: config.HOST,
});

logger.info("server_listening", {
  hostname: app.server?.hostname,
  port: app.server?.port,
});
