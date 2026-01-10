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

const QUALITY_THRESHOLDS = {
  min_html_bytes: toNumber(process.env.MIN_HTML_BYTES, 2048),
  min_visible_text_chars: toNumber(process.env.MIN_VISIBLE_TEXT_CHARS, 600),
  min_main_content_chars: toNumber(process.env.MIN_MAIN_CONTENT_CHARS, 400),
};

const assessContent = (html: string, title: string, statusCode: number) => {
  const htmlBytes = Buffer.byteLength(html || "");
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const mainContentChars = visibleText.length;

  const signals: string[] = [];
  if (statusCode && [401, 403, 429].includes(statusCode)) signals.push("status_blocked");
  if (html.includes("captcha") || html.includes("zse-ck")) signals.push("challenge_script");
  if (title.includes("登录") || title.toLowerCase().includes("login")) signals.push("login_title");
  if (htmlBytes < QUALITY_THRESHOLDS.min_html_bytes) signals.push("html_too_small");
  if (visibleText.length < QUALITY_THRESHOLDS.min_visible_text_chars) signals.push("text_too_small");
  if (mainContentChars < QUALITY_THRESHOLDS.min_main_content_chars) signals.push("main_content_small");

  let contentStatus: "usable" | "thin" | "challenge" | "login" = "usable";
  if (signals.includes("login_title")) contentStatus = "login";
  else if (signals.includes("challenge_script") || signals.includes("status_blocked")) contentStatus = "challenge";
  else if (
    signals.includes("html_too_small") ||
    signals.includes("text_too_small") ||
    signals.includes("main_content_small")
  )
    contentStatus = "thin";

  return {
    contentStatus,
    signals,
    quality: {
      htmlBytes,
      visibleTextChars: visibleText.length,
      mainContentChars,
      thresholds: QUALITY_THRESHOLDS,
    },
  };
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

    const quality = assessContent(rawHtml, article?.title || title, statusCode);

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
          renderStatus: "loaded",
          contentStatus: quality.contentStatus,
          gatekeeper: {
            blockClass: quality.contentStatus === "usable" ? "none" : quality.contentStatus,
            confidence: quality.contentStatus === "usable" ? 0 : 0.6,
            evidence: [
              {
                ruleId: "lightpanda-quality",
                signals: quality.signals,
                blockClass: quality.contentStatus === "usable" ? "none" : quality.contentStatus,
                confidence: 0.6,
              },
            ],
            quality: quality.quality,
          },
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
