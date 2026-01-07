import { v7 as uuidv7 } from "uuid";
import { scrapeURL } from "../scraper/scrapeURL";
import { WebCrawler } from "../scraper/WebScraper/crawler";
import { getAdjustedMaxDepth, getURLDepth } from "../scraper/WebScraper/utils/maxDepthUtils";
import { hasFormatOfType } from "../lib/format-utils";
import { CrawlOptions, Document, ScrapeOptions, scrapeOptions } from "../types";

type CrawlError = { url: string; error: unknown };

function ensureRawHtml(formats: ScrapeOptions["formats"]): ScrapeOptions["formats"] {
  if (hasFormatOfType(formats, "rawHtml")) {
    return formats;
  }
  return [...(formats ?? []), { type: "rawHtml" }];
}

export async function crawlSite(
  url: string,
  options: CrawlOptions,
  context?: { requestId?: string },
): Promise<
  | {
      success: true;
      pages: Document[];
      errors: CrawlError[];
      stats: {
        discovered: number;
        processed: number;
        succeeded: number;
        failed: number;
      };
    }
  | { success: false; error: unknown }
> {
  try {
    const crawlId = context?.requestId ?? uuidv7();
    const pageOptions = scrapeOptions.parse(options.scrapeOptions ?? {});
    const headers = { ...options.headers, ...pageOptions.headers };
    const crawlFormats = ensureRawHtml(pageOptions.formats);
    const maxDepth = getAdjustedMaxDepth(url, options.maxDepth);
    const baseDepth = getURLDepth(url);

    const crawler = new WebCrawler({
      jobId: crawlId,
      initialUrl: url,
      includes: options.includes,
      excludes: options.excludes,
      limit: options.limit,
      maxCrawledDepth: maxDepth,
      allowBackwardCrawling: options.allowBackwardCrawling,
      allowExternalContentLinks: options.allowExternalContentLinks,
      allowSubdomains: options.allowSubdomains,
      ignoreRobotsTxt: options.ignoreRobotsTxt,
      regexOnFullURL: options.regexOnFullURL,
      headers,
    });

    if (!options.ignoreRobotsTxt) {
      try {
        const robotsTxt = await crawler.getRobotsTxt(
          pageOptions.skipTlsVerification ?? false,
        );
        crawler.importRobotsTxt(robotsTxt);
      } catch {
        // If robots.txt fails, default to allowing crawl.
      }
    }

    const discovered = new Set<string>();
    const queue: string[] = [];
    const enqueue = (target: string) => {
      if (discovered.has(target)) return;
      if (discovered.size >= options.limit) return;
      discovered.add(target);
      queue.push(target);
    };

    enqueue(url);

    try {
      await crawler.tryGetSitemap(urls => {
        urls.forEach(enqueue);
      });
    } catch {
      // Sitemap failures are non-fatal; continue with direct crawl.
    }

    const pages: Document[] = [];
    const errors: CrawlError[] = [];
    let processed = 0;

    const scrapeRequestOptions = {
      ...pageOptions,
      headers,
      formats: crawlFormats,
    };

    while (queue.length > 0 && processed < options.limit) {
      const currentUrl = queue.shift()!;
      processed += 1;

      const result = await scrapeURL(
        `${crawlId}:${processed}`,
        currentUrl,
        scrapeRequestOptions,
        {
          teamId: "self-hosted",
          crawlId,
          teamFlags: { checkRobotsOnScrape: false },
        },
      );

      if (!result.success) {
        errors.push({ url: currentUrl, error: result.error });
        continue;
      }

      const doc = result.document;
      const contentType = (doc.metadata.contentType ?? "").toLowerCase();
      const html = doc.rawHtml ?? doc.html ?? "";
      const looksLikeHtml = html.trim().startsWith("<");

      if (html && (contentType.includes("text/html") || looksLikeHtml)) {
        const relativeDepth = Math.max(0, getURLDepth(currentUrl) - baseDepth);
        crawler.setCurrentDiscoveryDepth(relativeDepth);

        const links = await crawler.extractLinksFromHTML(html, currentUrl);
        const remaining = Math.max(0, options.limit - discovered.size);
        if (remaining > 0 && relativeDepth < options.maxDepth) {
          const filtered = await crawler.filterLinks(
            links,
            remaining,
            maxDepth,
            false,
            false,
          );
          filtered.links.forEach(enqueue);
        }
      }

      if (!hasFormatOfType(pageOptions.formats, "rawHtml")) {
        delete doc.rawHtml;
      }

      pages.push(doc);
    }

    return {
      success: true,
      pages,
      errors,
      stats: {
        discovered: discovered.size,
        processed,
        succeeded: pages.length,
        failed: errors.length,
      },
    };
  } catch (error) {
    return { success: false, error };
  }
}
