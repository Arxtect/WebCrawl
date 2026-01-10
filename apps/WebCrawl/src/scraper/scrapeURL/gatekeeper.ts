import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

type BlockClass = "challenge" | "login" | "soft_block" | "thin" | "none";

type Signal =
  | { type: "contains_script"; value: string }
  | { type: "title_matches"; value: string }
  | { type: "body_text_len_lt"; value: number }
  | { type: "status_in"; value: number[] }
  | { type: "redirect_to_login"; value: string | string[] }
  | { type: "html_bytes_lt"; value: number }
  | { type: "visible_text_len_lt"; value: number }
  | { type: "main_content_len_lt"; value: number }
  | { type: "has_structured_data"; value: boolean };

type GatekeeperRule = {
  id: string;
  block_class: Exclude<BlockClass, "none">;
  signals: Signal[];
  confidence?: number;
};

type DomainRuleConfig = {
  rules?: GatekeeperRule[];
  thresholds?: ContentThresholds;
};

type GatekeeperConfig = {
  global?: DomainRuleConfig;
  domains?: Record<string, DomainRuleConfig>;
};

type ContentThresholds = {
  min_html_bytes: number;
  min_visible_text_chars: number;
  min_main_content_chars: number;
  require_structured_data: boolean;
};

export type GatekeeperEvidence = {
  ruleId: string;
  signals: string[];
  blockClass: BlockClass;
  confidence: number;
};

export type ContentQuality = {
  htmlBytes: number;
  visibleTextChars: number;
  mainContentChars: number;
  hasStructuredData: boolean;
  thresholds: ContentThresholds;
};

export type GatekeeperResult = {
  blockClass: BlockClass;
  confidence: number;
  evidence: GatekeeperEvidence[];
  quality: ContentQuality;
  contentStatus: "usable" | "thin" | "challenge" | "login" | "soft_block";
};

const defaultThresholds: ContentThresholds = {
  min_html_bytes: Number(process.env.MIN_HTML_BYTES ?? 2048),
  min_visible_text_chars: Number(process.env.MIN_VISIBLE_TEXT_CHARS ?? 600),
  min_main_content_chars: Number(process.env.MIN_MAIN_CONTENT_CHARS ?? 400),
  require_structured_data: false,
};

const configPath = process.env.GATEKEEPER_RULES_PATH || path.join(process.cwd(), "gatekeeper.rules.json");

let cachedConfig: GatekeeperConfig | null = null;

function loadConfig(): GatekeeperConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    cachedConfig = JSON.parse(raw) as GatekeeperConfig;
    return cachedConfig;
  } catch {
    cachedConfig = {};
    return cachedConfig;
  }
}

function getDomainConfig(url: string): DomainRuleConfig {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const cfg = loadConfig();
  const domainRules = cfg.domains?.[host];
  return {
    rules: domainRules?.rules ?? cfg.global?.rules ?? [],
    thresholds: {
      min_html_bytes: domainRules?.thresholds?.min_html_bytes ?? cfg.global?.thresholds?.min_html_bytes ?? defaultThresholds.min_html_bytes,
      min_visible_text_chars: domainRules?.thresholds?.min_visible_text_chars ?? cfg.global?.thresholds?.min_visible_text_chars ?? defaultThresholds.min_visible_text_chars,
      min_main_content_chars: domainRules?.thresholds?.min_main_content_chars ?? cfg.global?.thresholds?.min_main_content_chars ?? defaultThresholds.min_main_content_chars,
      require_structured_data: domainRules?.thresholds?.require_structured_data ?? cfg.global?.thresholds?.require_structured_data ?? defaultThresholds.require_structured_data,
    },
  };
}

function matchesSignal(signal: Signal, ctx: { statusCode: number; html: string; title: string; finalUrl: string; visibleText: string; mainContentChars: number; htmlBytes: number }): boolean {
  switch (signal.type) {
    case "contains_script":
      return ctx.html.includes(signal.value);
    case "title_matches":
      return ctx.title.includes(signal.value);
    case "body_text_len_lt":
      return ctx.visibleText.length < signal.value;
    case "status_in":
      return signal.value.includes(ctx.statusCode);
    case "redirect_to_login": {
      const values = Array.isArray(signal.value) ? signal.value : [signal.value];
      return values.some(v => ctx.finalUrl.includes(v));
    }
    case "html_bytes_lt":
      return ctx.htmlBytes < signal.value;
    case "visible_text_len_lt":
      return ctx.visibleText.length < signal.value;
    case "main_content_len_lt":
      return ctx.mainContentChars < signal.value;
    case "has_structured_data":
      return signal.value ? ctx.html.includes("application/ld+json") : !ctx.html.includes("application/ld+json");
    default:
      return false;
  }
}

function detectStructuredData(html: string): boolean {
  const $ = cheerio.load(html);
  return $('script[type="application/ld+json"]').length > 0;
}

function getVisibleText(html: string): { text: string; mainContentChars: number } {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $.root().text().replace(/\s+/g, " ").trim();
  const main = $("main, article").text().replace(/\s+/g, " ").trim();
  return { text, mainContentChars: main.length > 0 ? main.length : text.length };
}

export function evaluateGatekeeper(input: {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  title: string;
  mainContentChars?: number;
}): GatekeeperResult {
  const domainConfig = getDomainConfig(input.finalUrl || input.url);
  const htmlBytes = Buffer.byteLength(input.html || "");
  const { text: visibleText, mainContentChars: derivedMain } = getVisibleText(input.html || "");
  const mainChars = input.mainContentChars ?? derivedMain;
  const hasStructuredData = detectStructuredData(input.html || "");

  const quality: ContentQuality = {
    htmlBytes,
    visibleTextChars: visibleText.length,
    mainContentChars: mainChars,
    hasStructuredData,
    thresholds: domainConfig.thresholds ?? defaultThresholds,
  };

  const ctx = {
    statusCode: input.statusCode,
    html: input.html || "",
    title: input.title || "",
    finalUrl: input.finalUrl || input.url,
    visibleText,
    mainContentChars: mainChars,
    htmlBytes,
  };

  const evidence: GatekeeperEvidence[] = [];

  for (const rule of domainConfig.rules ?? []) {
    const matchedSignals = rule.signals
      .filter(signal => matchesSignal(signal, ctx))
      .map(signal => signal.type);

    if (matchedSignals.length === rule.signals.length && matchedSignals.length > 0) {
      evidence.push({
        ruleId: rule.id,
        signals: matchedSignals,
        blockClass: rule.block_class,
        confidence: rule.confidence ?? Math.min(1, 0.5 + matchedSignals.length * 0.1),
      });
    }
  }

  let blockClass: BlockClass = "none";
  let confidence = 0;

  if (evidence.length > 0) {
    evidence.sort((a, b) => b.confidence - a.confidence);
    blockClass = evidence[0].blockClass;
    confidence = evidence[0].confidence;
  }

  // Content thinness check if no explicit block rule
  if (blockClass === "none") {
    const t = domainConfig.thresholds ?? defaultThresholds;
    const thinSignals: string[] = [];
    if (htmlBytes < (t.min_html_bytes ?? defaultThresholds.min_html_bytes)) thinSignals.push("html_bytes_lt");
    if (visibleText.length < (t.min_visible_text_chars ?? defaultThresholds.min_visible_text_chars)) thinSignals.push("visible_text_len_lt");
    if (mainChars < (t.min_main_content_chars ?? defaultThresholds.min_main_content_chars)) thinSignals.push("main_content_len_lt");
    if ((t.require_structured_data ?? defaultThresholds.require_structured_data) && !hasStructuredData) thinSignals.push("missing_structured_data");

    if (thinSignals.length > 0) {
      blockClass = "thin";
      confidence = Math.min(1, 0.4 + thinSignals.length * 0.15);
      evidence.push({
        ruleId: "content-thin",
        signals: thinSignals,
        blockClass: "thin",
        confidence,
      });
    }
  }

  const contentStatus =
    blockClass === "none"
      ? "usable"
      : blockClass === "thin"
        ? "thin"
        : blockClass === "login"
          ? "login"
          : blockClass === "soft_block"
            ? "soft_block"
            : "challenge";

  return {
    blockClass,
    confidence,
    evidence,
    quality,
    contentStatus,
  };
}
