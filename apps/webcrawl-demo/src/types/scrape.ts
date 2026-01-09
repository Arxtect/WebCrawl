export type FormatKey = "markdown" | "html" | "rawHtml" | "links" | "images";

export type DocumentMetadata = {
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

export type ScrapeDocument = {
  markdown?: string;
  rawHtml?: string;
  html?: string;
  links?: string[];
  images?: string[];
  metadata: DocumentMetadata;
  warning?: string;
};

export type ScrapeResponse =
  | {
      success: true;
      document: ScrapeDocument;
      unsupportedFeatures?: string[];
    }
  | {
      success: false;
      error: unknown;
      requestId?: string;
    };

export type StatusState = "idle" | "loading" | "success" | "error";

export type FormState = {
  targetUrl: string;
  onlyMainContent: boolean;
  removeBase64Images: boolean;
  skipTlsVerification: boolean;
  waitFor: string;
  timeout: string;
  includeTags: string;
  excludeTags: string;
  headers: string;
};

export type LightpandaMetadata = {
  sourceURL: string;
  url: string;
  statusCode: number;
  title: string;
  contentType?: string;
  engine: "lightpanda";
};

export type LightpandaDocument = {
  markdown: string;
  rawHtml: string;
  html: string;
  links: string[];
  images: string[];
  metadata: LightpandaMetadata;
};

export type LightpandaResponse =
  | {
      success: true;
      document: LightpandaDocument;
    }
  | {
      success: false;
      error: string;
    };
