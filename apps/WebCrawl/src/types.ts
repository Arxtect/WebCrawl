import { z } from "zod";

export type FormatObject =
  | { type: "markdown" }
  | { type: "html" }
  | { type: "rawHtml" }
  | { type: "links" }
  | { type: "images" };

const formatSchema = z.union([
  z.strictObject({ type: z.literal("markdown") }),
  z.strictObject({ type: z.literal("html") }),
  z.strictObject({ type: z.literal("rawHtml") }),
  z.strictObject({ type: z.literal("links") }),
  z.strictObject({ type: z.literal("images") }),
]);

const pdfParserWithOptions = z.strictObject({
  type: z.literal("pdf"),
  maxPages: z.number().int().positive().max(10000).optional(),
});

const parsersSchema = z
  .array(z.union([z.literal("pdf"), pdfParserWithOptions]))
  .optional();

export type Parsers = z.infer<typeof parsersSchema>;

export const scrapeOptions = z
  .strictObject({
    formats: z
      .preprocess(
        val => {
          if (!Array.isArray(val)) return val;
          return val.map(format =>
            typeof format === "string" ? { type: format } : format,
          );
        },
        formatSchema.array().optional().default([{ type: "markdown" }]),
      ),
    headers: z.record(z.string(), z.string()).optional(),
    includeTags: z.array(z.string()).optional(),
    excludeTags: z.array(z.string()).optional(),
    onlyMainContent: z.boolean().default(true),
    timeout: z.number().int().positive().optional(),
    waitFor: z.number().int().nonnegative().max(60000).default(0),
    parsers: parsersSchema,
    skipTlsVerification: z.boolean().optional(),
    removeBase64Images: z.boolean().default(true),
  })
  .transform(obj => obj);

export type ScrapeOptions = z.infer<typeof scrapeOptions>;

export type TeamFlags = {
  checkRobotsOnScrape?: boolean;
  unblockedDomains?: string[];
} | null;

export type Document = {
  markdown?: string;
  rawHtml?: string;
  html?: string;
  links?: string[];
  images?: string[];
  metadata: {
    sourceURL: string;
    url: string;
    statusCode: number;
    error?: string;
    numPages?: number;
    title?: string;
    contentType?: string;
    proxyUsed: "basic" | "stealth";
    [key: string]: unknown;
  };
  warning?: string;
};

export const crawlOptions = z.strictObject({
  limit: z.number().int().positive().max(10000).default(100),
  maxDepth: z.number().int().nonnegative().max(20).default(2),
  includes: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
  allowBackwardCrawling: z.boolean().default(false),
  allowExternalContentLinks: z.boolean().default(false),
  allowSubdomains: z.boolean().default(false),
  regexOnFullURL: z.boolean().default(false),
  headers: z.record(z.string(), z.string()).optional(),
  scrapeOptions: scrapeOptions.optional(),
});

export type CrawlOptions = z.infer<typeof crawlOptions>;

export function shouldParsePDF(parsers?: Parsers): boolean {
  if (!parsers) return true;
  return parsers.some(parser => {
    if (parser === "pdf") return true;
    if (typeof parser === "object" && parser !== null && "type" in parser) {
      return (parser as any).type === "pdf";
    }
    return false;
  });
}

export function getPDFMaxPages(parsers?: Parsers): number | undefined {
  if (!parsers) return undefined;
  const pdfParser = parsers.find(parser => {
    if (typeof parser === "object" && parser !== null && "type" in parser) {
      return (parser as any).type === "pdf";
    }
    return false;
  });
  if (pdfParser && typeof pdfParser === "object" && "maxPages" in pdfParser) {
    return (pdfParser as any).maxPages;
  }
  return undefined;
}
