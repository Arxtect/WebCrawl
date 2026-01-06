import { Meta } from "../..";
import { EngineScrapeResult } from "..";
import escapeHtml from "escape-html";
import PdfParse from "pdf-parse";
import { downloadFile, fetchFileToBuffer } from "../utils/downloadFile";
import {
  PDFAntibotError,
  PDFInsufficientTimeError,
  PDFPrefetchFailed,
  EngineUnsuccessfulError,
} from "../../error";
import { readFile, unlink } from "node:fs/promises";
import type { Response } from "undici";
import { shouldParsePDF, getPDFMaxPages } from "../../../../types";
import { getPdfMetadata } from "@mendable/firecrawl-rs";

type PDFProcessorResult = { html: string; markdown?: string };

const MILLISECONDS_PER_PAGE = 150;

async function scrapePDFWithParsePDF(
  meta: Meta,
  tempFilePath: string,
): Promise<PDFProcessorResult> {
  meta.logger.debug("Processing PDF document with parse-pdf", { tempFilePath });

  const result = await PdfParse(await readFile(tempFilePath));
  const escaped = escapeHtml(result.text);

  return {
    markdown: escaped,
    html: escaped,
  };
}

export async function scrapePDF(meta: Meta): Promise<EngineScrapeResult> {
  const shouldParse = shouldParsePDF(meta.options.parsers);
  const maxPages = getPDFMaxPages(meta.options.parsers);

  if (!shouldParse) {
    const file = await fetchFileToBuffer(
      meta.rewrittenUrl ?? meta.url,
      meta.options.skipTlsVerification,
      {
        headers: meta.options.headers,
        signal: meta.abort.asSignal(),
      },
    );

    const ct = file.response.headers.get("Content-Type");
    if (ct && !ct.includes("application/pdf")) {
      if (!meta.featureFlags.has("pdf")) {
        throw new EngineUnsuccessfulError("pdf");
      }
      throw new PDFAntibotError();
    }

    const content = file.buffer.toString("base64");
    return {
      url: file.response.url,
      statusCode: file.response.status,
      html: content,
      markdown: content,
      proxyUsed: "basic",
    };
  }

  const { response, tempFilePath } = await downloadFile(
    meta.id,
    meta.rewrittenUrl ?? meta.url,
    meta.options.skipTlsVerification,
    {
      headers: meta.options.headers,
      signal: meta.abort.asSignal(),
    },
  );

  try {
    if ((response as any).headers) {
      const r: Response = response as any;
      const ct = r.headers.get("Content-Type");
      if (ct && !ct.includes("application/pdf")) {
        if (!meta.featureFlags.has("pdf")) {
          throw new EngineUnsuccessfulError("pdf");
        }
        throw new PDFAntibotError();
      }
    }

    const pdfMetadata = await getPdfMetadata(tempFilePath);
    const effectivePageCount = maxPages
      ? Math.min(pdfMetadata.numPages, maxPages)
      : pdfMetadata.numPages;

    if (
      effectivePageCount * MILLISECONDS_PER_PAGE >
      (meta.abort.scrapeTimeout() ?? Infinity)
    ) {
      throw new PDFInsufficientTimeError(
        effectivePageCount,
        effectivePageCount * MILLISECONDS_PER_PAGE + 5000,
      );
    }

    const result = await scrapePDFWithParsePDF(
      {
        ...meta,
        logger: meta.logger.child({
          method: "scrapePDF/scrapePDFWithParsePDF",
        }),
      },
      tempFilePath,
    );

    return {
      url: response.url ?? meta.rewrittenUrl ?? meta.url,
      statusCode: response.status,
      html: result?.html ?? "",
      markdown: result?.markdown ?? "",
      pdfMetadata: {
        numPages: effectivePageCount,
        title: pdfMetadata.title,
      },
      contentType: response.headers?.get("content-type") ?? undefined,
      proxyUsed: "basic",
    };
  } finally {
    try {
      await unlink(tempFilePath);
    } catch (error) {
      meta.logger?.warn("Failed to clean up temporary PDF file", {
        error,
        tempFilePath,
      });
    }
  }
}

export function pdfMaxReasonableTime(meta: Meta): number {
  return 120000;
}
