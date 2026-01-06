import { config } from "../../../config";
import { Meta } from "..";
import { documentMaxReasonableTime, scrapeDocument } from "./document";
import { pdfMaxReasonableTime, scrapePDF } from "./pdf";
import { fetchMaxReasonableTime, scrapeURLWithFetch } from "./fetch";
import {
  playwrightMaxReasonableTime,
  scrapeURLWithPlaywright,
} from "./playwright";

export type Engine = "playwright" | "fetch" | "pdf" | "document";

export type FeatureFlag = "pdf" | "document" | "waitFor";

const usePlaywright =
  config.PLAYWRIGHT_MICROSERVICE_URL !== "" &&
  config.PLAYWRIGHT_MICROSERVICE_URL !== undefined;

export type EngineScrapeResult = {
  url: string;
  html: string;
  markdown?: string;
  statusCode: number;
  error?: string;
  pdfMetadata?: { numPages: number; title?: string };
  contentType?: string;
  proxyUsed: "basic" | "stealth";
};

const engineHandlers: {
  [E in Engine]: (meta: Meta) => Promise<EngineScrapeResult>;
} = {
  playwright: scrapeURLWithPlaywright,
  fetch: scrapeURLWithFetch,
  pdf: scrapePDF,
  document: scrapeDocument,
};

const engineMRTs: {
  [E in Engine]: (meta: Meta) => number;
} = {
  playwright: playwrightMaxReasonableTime,
  fetch: fetchMaxReasonableTime,
  pdf: pdfMaxReasonableTime,
  document: documentMaxReasonableTime,
};

export async function buildFallbackList(meta: Meta): Promise<
  {
    engine: Engine;
    unsupportedFeatures: Set<FeatureFlag>;
  }[]
> {
  const engines: Engine[] = [];

  if (meta.featureFlags.has("document")) {
    engines.push("document");
  } else if (meta.featureFlags.has("pdf")) {
    engines.push("pdf");
  }

  if (usePlaywright) {
    engines.push("playwright");
  }

  engines.push("fetch");

  return engines.map(engine => ({
    engine,
    unsupportedFeatures: new Set<FeatureFlag>(),
  }));
}

export async function scrapeURLWithEngine(
  meta: Meta,
  engine: Engine,
): Promise<EngineScrapeResult> {
  const fn = engineHandlers[engine];
  const logger = meta.logger.child({
    method: fn.name ?? "scrapeURLWithEngine",
    engine,
  });

  return await fn({ ...meta, logger });
}

export function getEngineMaxReasonableTime(meta: Meta, engine: Engine): number {
  const mrt = engineMRTs[engine];
  if (mrt === undefined) {
    meta.logger.warn("No MRT for engine", { engine });
    return 30000;
  }
  return mrt(meta);
}
