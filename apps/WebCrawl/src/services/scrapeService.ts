import { v7 as uuidv7 } from "uuid";
import { scrapeURL } from "../scraper/scrapeURL";
import type { ScrapeOptions } from "../types";

export async function scrapeSingle(
  url: string,
  options: ScrapeOptions,
  context?: {
    requestId?: string;
  },
) {
  return scrapeURL(context?.requestId ?? uuidv7(), url, options, {
    teamId: "self-hosted",
    teamFlags: { checkRobotsOnScrape: true },
  });
}

