import { Logger } from "winston";
import { ScrapeOptions, scrapeOptions, Document, TeamFlags } from "../../types";
import { logger as _logger } from "../../lib/logger";
import {
  buildFallbackList,
  Engine,
  EngineScrapeResult,
  FeatureFlag,
  scrapeURLWithEngine,
} from "./engines";
import { parseMarkdown } from "../../lib/html-to-markdown";
import { hasFormatOfType } from "../../lib/format-utils";
import {
  AddFeatureError,
  EngineError,
  NoEnginesLeftError,
  PDFAntibotError,
  DocumentAntibotError,
  SSLError,
  PDFInsufficientTimeError,
  DNSResolutionError,
  EngineUnsuccessfulError,
  ProxySelectionError,
} from "./error";
import { executeTransformers } from "./transformers";
import { htmlTransform } from "./lib/removeUnwantedElements";
import { rewriteUrl } from "./lib/rewriteUrl";
import { AbortInstance, AbortManager } from "./lib/abortManager";
import { ScrapeJobTimeoutError, CrawlDenialError } from "../../lib/error";

export type ScrapeUrlResponse =
  | {
      success: true;
      document: Document;
      unsupportedFeatures?: Set<FeatureFlag>;
    }
  | {
      success: false;
      error: any;
    };

export type Meta = {
  id: string;
  url: string;
  rewrittenUrl?: string;
  options: ScrapeOptions & { skipTlsVerification: boolean };
  internalOptions: InternalOptions;
  logger: Logger;
  abort: AbortManager;
  featureFlags: Set<FeatureFlag>;
  abortHandle?: NodeJS.Timeout;
};

function buildFeatureFlags(url: string): Set<FeatureFlag> {
  const flags: Set<FeatureFlag> = new Set();
  const urlO = new URL(url);
  const lowerPath = urlO.pathname.toLowerCase();

  const isDocument =
    lowerPath.endsWith(".docx") ||
    lowerPath.endsWith(".odt") ||
    lowerPath.endsWith(".rtf") ||
    lowerPath.endsWith(".xlsx") ||
    lowerPath.endsWith(".xls") ||
    lowerPath.includes(".docx/") ||
    lowerPath.includes(".odt/") ||
    lowerPath.includes(".rtf/") ||
    lowerPath.includes(".xlsx/") ||
    lowerPath.includes(".xls/");

  if (isDocument) {
    flags.add("document");
  } else if (lowerPath.endsWith(".pdf") || lowerPath.includes(".pdf/")) {
    flags.add("pdf");
  }

  if (urlO.searchParams.has("waitFor")) {
    flags.add("waitFor");
  }

  return flags;
}

async function buildMetaObject(
  id: string,
  url: string,
  options: ScrapeOptions,
  internalOptions: InternalOptions,
): Promise<Meta> {
  const logger = _logger.child({
    module: "ScrapeURL",
    scrapeId: id,
    scrapeURL: url,
    teamId: internalOptions.teamId,
  });

  const abortController = new AbortController();
  const abortHandle =
    options.timeout !== undefined
      ? setTimeout(
          () =>
            abortController.abort(
              new ScrapeJobTimeoutError("Scrape timed out"),
            ),
          options.timeout,
        )
      : undefined;

  const abort = new AbortManager(
    internalOptions.externalAbort,
    options.timeout !== undefined
      ? {
          signal: abortController.signal,
          tier: "scrape",
          timesOutAt: new Date(Date.now() + options.timeout),
          throwable() {
            return new ScrapeJobTimeoutError("Scrape timed out");
          },
        }
      : undefined,
  );

  return {
    id,
    url,
    rewrittenUrl: rewriteUrl(url),
    options: {
      ...options,
      skipTlsVerification:
        options.skipTlsVerification ??
        (options.headers && Object.keys(options.headers).length > 0
          ? false
          : true),
    },
    internalOptions,
    logger,
    abort,
    featureFlags: buildFeatureFlags(url),
    abortHandle,
  };
}

export type InternalOptions = {
  teamId: string;
  crawlId?: string;
  externalAbort?: AbortInstance;
  teamFlags?: TeamFlags;
};

type EngineScrapeResultWithContext = {
  engine: Engine;
  unsupportedFeatures: Set<FeatureFlag>;
  result: EngineScrapeResult;
};

async function scrapeURLWithFallbacks(meta: Meta): Promise<ScrapeUrlResponse> {
  let attempts = 0;

  while (attempts < 3) {
    attempts += 1;
    const fallbackList = await buildFallbackList(meta);
    const enginesAttempted: string[] = [];
    let lastError: unknown = null;

    for (const { engine, unsupportedFeatures } of fallbackList) {
      enginesAttempted.push(engine);
      try {
        const engineResult = await scrapeURLWithEngine(meta, engine);

        const needsMarkdown = hasFormatOfType(meta.options.formats, "markdown");
        let checkMarkdown = engineResult.html?.trim() ?? "";

        if (needsMarkdown) {
          const requestId = meta.id || meta.internalOptions.crawlId;
          checkMarkdown = await parseMarkdown(
            await htmlTransform(
              engineResult.html,
              meta.url,
              scrapeOptions.parse({ onlyMainContent: true }),
            ),
            { logger: meta.logger, requestId },
          );

          if (checkMarkdown.trim().length === 0) {
            checkMarkdown = await parseMarkdown(
              await htmlTransform(
                engineResult.html,
                meta.url,
                scrapeOptions.parse({ onlyMainContent: false }),
              ),
              { logger: meta.logger, requestId },
            );
          }
        }

        const isLongEnough = checkMarkdown.trim().length > 0;
        const isGoodStatusCode =
          (engineResult.statusCode >= 200 && engineResult.statusCode < 300) ||
          engineResult.statusCode === 304;
        const hasNoPageError = engineResult.error === undefined;

        if (isLongEnough || !isGoodStatusCode) {
          const wrapped: EngineScrapeResultWithContext = {
            engine,
            unsupportedFeatures,
            result: engineResult,
          };
          return await finalizeDocument(meta, wrapped, enginesAttempted);
        }

        throw new EngineUnsuccessfulError(engine);
      } catch (error) {
        if (error instanceof AddFeatureError) {
          meta.featureFlags = new Set([
            ...meta.featureFlags,
            ...error.featureFlags,
          ]);
          lastError = error;
          break;
        }
        if (
          error instanceof EngineError ||
          error instanceof SSLError ||
          error instanceof DNSResolutionError ||
          error instanceof PDFAntibotError ||
          error instanceof DocumentAntibotError ||
          error instanceof PDFInsufficientTimeError ||
          error instanceof ProxySelectionError
        ) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    if (lastError instanceof AddFeatureError) {
      continue;
    }

    return {
      success: false,
      error: lastError ?? new NoEnginesLeftError([]),
    };
  }

  return {
    success: false,
    error: new NoEnginesLeftError([]),
  };
}

async function finalizeDocument(
  meta: Meta,
  result: EngineScrapeResultWithContext,
  enginesAttempted: string[],
): Promise<ScrapeUrlResponse> {
  meta.logger.info("Scrape completed", {
    engine: result.engine,
    enginesAttempted,
  });

  let document: Document = {
    markdown: result.result.markdown,
    rawHtml: result.result.html,
    metadata: {
      sourceURL: meta.url,
      url: result.result.url,
      statusCode: result.result.statusCode,
      error: result.result.error,
      numPages: result.result.pdfMetadata?.numPages,
      ...(result.result.pdfMetadata?.title
        ? { title: result.result.pdfMetadata.title }
        : {}),
      contentType: result.result.contentType,
      proxyUsed: result.result.proxyUsed ?? "basic",
    },
  };

  const doc = await executeTransformers(meta, document);
  return {
    success: true,
    document: doc,
    unsupportedFeatures: result.unsupportedFeatures,
  };
}

export async function scrapeURL(
  id: string,
  url: string,
  options: ScrapeOptions,
  internalOptions: InternalOptions,
): Promise<ScrapeUrlResponse> {
  const meta = await buildMetaObject(id, url, options, internalOptions);

  try {
    const result = await scrapeURLWithFallbacks(meta);
    if (result.success && !hasFormatOfType(meta.options.formats, "rawHtml")) {
      delete result.document.rawHtml;
    }
    return result;
  } catch (error) {
    return { success: false, error };
  } finally {
    if (meta.abortHandle) {
      clearTimeout(meta.abortHandle);
    }
    meta.abort.dispose();
  }
}
