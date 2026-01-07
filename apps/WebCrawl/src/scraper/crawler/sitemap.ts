import type { Logger } from "winston";
import { logger as _logger } from "../../lib/logger";
import { scrapeURL } from "../scrapeURL";
import { scrapeOptions } from "../../types";
import {
  processSitemap,
  SitemapProcessingResult,
} from "@mendable/firecrawl-rs";
import { fetchFileToBuffer } from "../scrapeURL/engines/utils/downloadFile";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { SitemapError } from "../../lib/error";

type SitemapScrapeOptions = {
  url: string;
  crawlId: string;
  logger?: Logger;
  headers?: Record<string, string>;
};

type SitemapData = {
  urls: URL[];
  sitemaps: URL[];
};

const gunzipAsync = promisify(gunzip);

async function getSitemapXMLGZ(
  options: SitemapScrapeOptions,
): Promise<string> {
  const { buffer } = await fetchFileToBuffer(options.url, false, {
    headers: options.headers,
  });
  const decompressed = await gunzipAsync(buffer);
  return decompressed.toString("utf-8");
}

async function getSitemapXML(options: SitemapScrapeOptions): Promise<string> {
  if (options.url.toLowerCase().endsWith(".gz")) {
    return await getSitemapXMLGZ(options);
  }

  const response = await scrapeURL(
    "sitemap;" + options.crawlId,
    options.url,
    scrapeOptions.parse({
      formats: ["rawHtml"],
      ...(options.headers ? { headers: options.headers } : {}),
    }),
    {
      teamId: "sitemap",
      crawlId: options.crawlId,
    },
  );

  if (
    response.success &&
    response.document.metadata.statusCode >= 200 &&
    response.document.metadata.statusCode < 300
  ) {
    return response.document.rawHtml!;
  }

  if (!response.success) {
    throw new SitemapError("Failed to scrape sitemap", response.error);
  }

  throw new SitemapError(
    "Failed to scrape sitemap",
    response.document.metadata.statusCode,
  );
}

export async function scrapeSitemap(
  options: SitemapScrapeOptions,
): Promise<SitemapData> {
  const logger = (options.logger ?? _logger).child({
    module: "crawler",
    method: "scrapeSitemap",
    crawlId: options.crawlId,
    sitemapUrl: options.url,
  });

  logger.info("Scraping sitemap");

  const xml = await getSitemapXML(options);

  logger.info("Processing sitemap");

  let instructions: SitemapProcessingResult;
  try {
    instructions = await processSitemap(xml);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("XML parsing error") ||
      errorMessage.includes("Parse sitemap error")
    ) {
      throw new SitemapError(errorMessage, error);
    }
    throw error;
  }

  const sitemapData: SitemapData = {
    urls: [],
    sitemaps: [],
  };

  for (const instruction of instructions.instructions) {
    if (instruction.action === "recurse") {
      sitemapData.sitemaps.push(...instruction.urls.map(url => new URL(url)));
    } else if (instruction.action === "process") {
      sitemapData.urls.push(...instruction.urls.map(url => new URL(url)));
    }
  }

  logger.info("Processed sitemap", {
    urls: sitemapData.urls.length,
    sitemaps: sitemapData.sitemaps.length,
  });

  return sitemapData;
}
