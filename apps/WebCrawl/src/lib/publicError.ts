import { CrawlDenialError, TransportableError } from "./error";

export type PublicError = {
  code: string;
  message: string;
};

export function toPublicError(error: unknown): PublicError {
  if (error instanceof CrawlDenialError) {
    return { code: error.code, message: "Crawl denied by policy." };
  }

  if (error instanceof TransportableError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    switch (error.name) {
      case "EngineUnsuccessfulError":
      case "NoEnginesLeftError":
        return {
          code: "SCRAPE_FAILED",
          message: "Scrape failed to produce usable content.",
        };
      default:
        return { code: "INTERNAL_ERROR", message: "Internal server error." };
    }
  }

  return { code: "INTERNAL_ERROR", message: "Internal server error." };
}
