import type { Elysia } from "elysia";
import { crawlOptions } from "../types";
import { crawlSite } from "../services/crawlService";
import { logger } from "../lib/logger";
import { serializeError } from "../lib/serializeError";
import { config } from "../config";
import { toPublicError } from "../lib/publicError";

export function registerCrawlRoutes(app: Elysia) {
  return app.post("/crawl", async ctx => {
    const { body, set } = ctx as any;
    const requestId = (ctx as any).requestId as string | undefined;
    const url = (body as any)?.url;
    if (!url || typeof url !== "string") {
      set.status = 400;
      return { success: false, error: "Missing url" };
    }

    const { url: _url, ...options } = body as Record<string, unknown>;
    const parsed = crawlOptions.safeParse(options);
    if (!parsed.success) {
      set.status = 400;
      return {
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten(),
      };
    }

    const result = await crawlSite(url, parsed.data, { requestId });
    if (!result.success) {
      set.status = 502;
      const errorForLog = serializeError(result.error, { includeStack: true });
      const errorForResponse = config.EXPOSE_ERROR_DETAILS
        ? {
            ...toPublicError(result.error),
            ...(config.EXPOSE_ERROR_STACK
              ? { stack: (errorForLog as any).stack }
              : {}),
          }
        : toPublicError(result.error);
      logger.error("crawl_failed", {
        requestId,
        url,
        error: errorForLog,
      });
      console.error("crawl_failed", { requestId, url, error: errorForLog });
      return {
        success: false,
        requestId,
        error: errorForResponse,
      };
    }

    return result;
  });
}
