import { getBaseConfig, runPipeline, type PipelineConfig } from "./pipeline";

type RequestPayload = Partial<{
  url: string;
  timeout: number | string;
  waitFor: number | string;
  timeoutMs: number | string;
  waitForMs: number | string;
  onlyMainContent: boolean;
  removeBase64Images: boolean;
  userAgent: string;
  cdpUrl: string;
}>;

const log = (message: string) => {
  process.stderr.write(`[lightpanda-server] ${message}\n`);
};

const toNumber = (value: number | string | undefined, fallback: number) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
  return fallback;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const buildConfig = (payload: RequestPayload, targetUrl: string): PipelineConfig => {
  const base = getBaseConfig();
  return {
    ...base,
    targetUrl,
    timeoutMs: toNumber(payload.timeoutMs ?? payload.timeout, base.timeoutMs),
    waitForMs: toNumber(payload.waitForMs ?? payload.waitFor, base.waitForMs),
    onlyMainContent: typeof payload.onlyMainContent === "boolean" ? payload.onlyMainContent : base.onlyMainContent,
    removeBase64Images: typeof payload.removeBase64Images === "boolean" ? payload.removeBase64Images : base.removeBase64Images,
    userAgent: payload.userAgent || base.userAgent,
    cdpUrl: payload.cdpUrl || base.cdpUrl,
  };
};

const parsedPort = Number(process.env.LIGHTPANDA_SERVER_PORT || 8790);
const port = Number.isFinite(parsedPort) ? parsedPort : 8790;

log(`Lightpanda server listening on http://127.0.0.1:${port}`);

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true });
    }

    if (url.pathname !== "/scrape") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let payload: RequestPayload | null = null;
    if (request.headers.get("content-type")?.includes("application/json")) {
      try {
        payload = (await request.json()) as RequestPayload;
      } catch {
        return jsonResponse({ success: false, error: "Invalid JSON payload." }, 400);
      }
    }

    if (!payload?.url) {
      return jsonResponse({ success: false, error: "Missing url in request payload." }, 400);
    }

    const config = buildConfig(payload, payload.url);
    const start = performance.now();
    log(`Scrape ${config.targetUrl}`);

    const result = await runPipeline(config);
    log(`Done in ${Math.round(performance.now() - start)}ms`);

    return jsonResponse(result, result.success ? 200 : 500);
  },
});
