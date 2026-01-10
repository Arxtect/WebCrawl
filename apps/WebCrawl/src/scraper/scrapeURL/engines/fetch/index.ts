import * as undici from "undici";
import { EngineScrapeResult } from "..";
import { Meta } from "../..";
import { SSLError } from "../../error";
import { specialtyScrapeCheck } from "../utils/specialtyHandler";
import {
  getSecureDispatcher,
  InsecureConnectionError,
} from "../utils/safeFetch";
import { TextDecoder } from "util";

type CacheEntry = {
  etag?: string;
  lastModified?: string;
  body?: string;
  contentType?: string;
  status?: number;
};

const responseCache = new Map<string, CacheEntry>();

export async function scrapeURLWithFetch(
  meta: Meta,
): Promise<EngineScrapeResult> {
  let response: {
    url: string;
    body: string;
    status: number;
    headers: [string, string][];
  };

  try {
    const cached = responseCache.get(meta.rewrittenUrl ?? meta.url);
    const conditionalHeaders: Record<string, string> = {};
    if (cached?.etag && !meta.options.headers?.["If-None-Match"]) {
      conditionalHeaders["If-None-Match"] = cached.etag;
    }
    if (cached?.lastModified && !meta.options.headers?.["If-Modified-Since"]) {
      conditionalHeaders["If-Modified-Since"] = cached.lastModified;
    }

    const x = await undici.fetch(meta.rewrittenUrl ?? meta.url, {
      dispatcher: getSecureDispatcher(meta.options.skipTlsVerification),
      redirect: "follow",
      headers: { ...meta.options.headers, ...conditionalHeaders },
      signal: meta.abort.asSignal(),
    });

    if (x.status === 304 && cached?.body) {
      response = {
        url: x.url,
        body: cached.body,
        status: cached.status ?? 304,
        headers: [...x.headers],
      };
      return {
        url: response.url,
        html: response.body,
        statusCode: response.status,
        contentType: cached.contentType,
        proxyUsed: "basic",
        headers: Object.fromEntries(response.headers as any),
        trace: { renderStatus: "loaded" },
      };
    }

    const buf = Buffer.from(await x.arrayBuffer());
    let text = buf.toString("utf8");
    const charset = (text.match(
      /<meta\b[^>]*charset\s*=\s*["']?([^"'\s\/>]+)/i,
    ) ?? [])[1];
    try {
      if (charset) {
        text = new TextDecoder(charset.trim()).decode(buf);
      }
    } catch (error) {
      meta.logger.warn("Failed to re-parse with correct charset", {
        charset,
        error,
      });
    }

    response = {
      url: x.url,
      body: text,
      status: x.status,
      headers: [...x.headers],
    };

    const etag = x.headers.get("etag") ?? undefined;
    const lastModified = x.headers.get("last-modified") ?? undefined;
    responseCache.set(meta.rewrittenUrl ?? meta.url, {
      etag,
      lastModified,
      body: text,
      contentType:
        (response.headers.find(x => x[0].toLowerCase() === "content-type") ??
          [])[1] ?? undefined,
      status: x.status,
    });
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.cause instanceof InsecureConnectionError
    ) {
      throw error.cause;
    } else if (
      error instanceof Error &&
      error.message === "fetch failed" &&
      error.cause &&
      (error.cause as any).code === "CERT_HAS_EXPIRED"
    ) {
      throw new SSLError(meta.options.skipTlsVerification);
    } else {
      throw error;
    }
  }

  await specialtyScrapeCheck(
    meta.logger.child({ method: "scrapeURLWithFetch/specialtyScrapeCheck" }),
    Object.fromEntries(response.headers as any),
  );

  return {
    url: response.url,
    html: response.body,
    statusCode: response.status,
    contentType:
      (response.headers.find(x => x[0].toLowerCase() === "content-type") ??
        [])[1] ?? undefined,

    headers: Object.fromEntries(response.headers as any),
    proxyUsed: "basic",
    trace: { renderStatus: "loaded" },
  };
}

export function fetchMaxReasonableTime(meta: Meta): number {
  return 15000;
}
