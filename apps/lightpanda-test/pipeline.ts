import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TurndownService from "turndown";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export type PipelineConfig = {
  cdpUrl: string;
  targetUrl: string;
  timeoutMs: number;
  waitForMs: number;
  onlyMainContent: boolean;
  removeBase64Images: boolean;
  userAgent: string;
};

export type LightpandaMetadata = {
  sourceURL: string;
  url: string;
  statusCode: number;
  title: string;
  contentType?: string;
  engine: "lightpanda";
};

export type PipelineResult = {
  success: boolean;
  document?: {
    html: string;
    rawHtml: string;
    markdown: string;
    links: string[];
    images: string[];
    metadata: LightpandaMetadata;
  };
  error?: string;
};

type ElementLike = { getAttribute: (name: string) => string | null };
type DocumentLike = { querySelectorAll: (selector: string) => ArrayLike<ElementLike> };
type Browser = Awaited<ReturnType<typeof puppeteer.connect>>;
type Page = Awaited<ReturnType<Browser["newPage"]>>;

export const DEFAULT_CDP_URL = "ws://127.0.0.1:8765";
export const DEFAULT_TARGET_URL = "https://example.com";
let pluginConfigured = false;

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getBaseConfig = (): PipelineConfig => ({
  cdpUrl: process.env.LIGHTPANDA_CDP_URL || DEFAULT_CDP_URL,
  targetUrl: DEFAULT_TARGET_URL,
  timeoutMs: toNumber(process.env.TIMEOUT_MS, 45000),
  waitForMs: toNumber(process.env.WAIT_FOR_MS, 1000),
  onlyMainContent: process.env.ONLY_MAIN_CONTENT !== "false",
  removeBase64Images: process.env.REMOVE_BASE64_IMAGES !== "false",
  userAgent: process.env.USER_AGENT || "WebCrawl-Lightpanda/0.1",
});

const toAbsoluteUrl = (base: string, value: string) => {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
};

const unique = (items: (string | null)[]) => {
  const seen = new Set<string>();
  items.forEach(item => {
    if (item) {
      seen.add(item);
    }
  });
  return Array.from(seen);
};

const buildMarkdown = (html: string) => {
  const turndownService = new TurndownService({ headingStyle: "atx" });
  turndownService.keep(["figure", "figcaption"]);
  return turndownService.turndown(html);
};

const extractLinks = (doc: DocumentLike, baseUrl: string) =>
  unique(
    Array.from(doc.querySelectorAll("a[href]")).map(link =>
      toAbsoluteUrl(baseUrl, link.getAttribute("href") || ""),
    ),
  );

const extractImages = (doc: DocumentLike, baseUrl: string, removeBase64: boolean) =>
  unique(
    Array.from(doc.querySelectorAll("img[src]")).map(image => {
      const src = image.getAttribute("src") || "";
      if (removeBase64 && src.startsWith("data:")) {
        return null;
      }
      return toAbsoluteUrl(baseUrl, src);
    }),
  );

export const runPipeline = async (config: PipelineConfig): Promise<PipelineResult> => {
  if (!pluginConfigured) {
    puppeteer.use(StealthPlugin());
    pluginConfigured = true;
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.connect({ browserWSEndpoint: config.cdpUrl });
    page = await browser.newPage();
    await page.setUserAgent(config.userAgent);

    const response = await page.goto(config.targetUrl, {
      waitUntil: "networkidle2",
      timeout: config.timeoutMs,
    });

    if (config.waitForMs > 0) {
      await new Promise(resolve => setTimeout(resolve, config.waitForMs));
    }

    const rawHtml = await page.content();
    const finalUrl = page.url();
    const title = (await page.title()) || "";
    const statusCode = response?.status() ?? 0;
    const contentType = response?.headers()["content-type"];

    const dom = new JSDOM(rawHtml, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const html = config.onlyMainContent && article?.content
      ? article.content
      : dom.window.document.body?.innerHTML || rawHtml;

    const markdown = buildMarkdown(html);
    const links = extractLinks(dom.window.document, finalUrl);
    const images = extractImages(dom.window.document, finalUrl, config.removeBase64Images);

    dom.window.close();

    return {
      success: true,
      document: {
        html,
        rawHtml,
        markdown,
        links,
        images,
        metadata: {
          sourceURL: config.targetUrl,
          url: finalUrl,
          statusCode,
          title: article?.title || title,
          contentType,
          engine: "lightpanda",
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
};
