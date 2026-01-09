import { useMemo, useState, type ReactNode } from "react";
import { Sparkles, Gauge, FileText, Play, RefreshCw, AlertCircle, Orbit } from "lucide-react";
import { cn } from "../lib/cn";
import { CodeBlock } from "../components/CodeBlock";
import { getStats, similarityScore } from "../data/samples";
import { joinUrl } from "../utils/request";
import type { LightpandaResponse, ScrapeResponse, StatusState } from "../types/scrape";

const statusStyles: Record<StatusState, { label: string; className: string }> = {
  idle: { label: "准备就绪", className: "bg-slate-100 text-slate-600 border-slate-200" },
  loading: { label: "运行中", className: "bg-blue-50 text-blue-600 border-blue-200 animate-pulse" },
  success: { label: "成功", className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  error: { label: "失败", className: "bg-rose-50 text-rose-600 border-rose-200" },
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export function LightpandaView() {
  const [targetUrl, setTargetUrl] = useState("");
  const [onlyMainContent, setOnlyMainContent] = useState(true);
  const [removeBase64Images, setRemoveBase64Images] = useState(true);
  const [timeout, setTimeout] = useState("");
  const [waitFor, setWaitFor] = useState("");
  const [runWebcrawl, setRunWebcrawl] = useState(true);
  const [runLightpanda, setRunLightpanda] = useState(true);

  const [webcrawlStatus, setWebcrawlStatus] = useState<StatusState>("idle");
  const [lightpandaStatus, setLightpandaStatus] = useState<StatusState>("idle");
  const [webcrawlResponse, setWebcrawlResponse] = useState<ScrapeResponse | null>(null);
  const [lightpandaResponse, setLightpandaResponse] = useState<LightpandaResponse | null>(null);
  const [webcrawlError, setWebcrawlError] = useState("");
  const [lightpandaError, setLightpandaError] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  const webcrawlMarkdown = webcrawlResponse?.success ? webcrawlResponse.document.markdown ?? "" : "";
  const lightpandaMarkdown = lightpandaResponse?.success ? lightpandaResponse.document.markdown ?? "" : "";
  const webcrawlStats = useMemo(() => getStats(webcrawlMarkdown), [webcrawlMarkdown]);
  const lightpandaStats = useMemo(() => getStats(lightpandaMarkdown), [lightpandaMarkdown]);
  const similarity = useMemo(() => similarityScore(webcrawlMarkdown, lightpandaMarkdown), [webcrawlMarkdown, lightpandaMarkdown]);

  const webcrawlSummary = webcrawlResponse?.success ? webcrawlResponse.document.metadata : null;
  const lightpandaSummary = lightpandaResponse?.success ? lightpandaResponse.document.metadata : null;
  const canRun = runWebcrawl || runLightpanda;

  const resetResults = () => {
    setWebcrawlStatus("idle");
    setLightpandaStatus("idle");
    setWebcrawlResponse(null);
    setLightpandaResponse(null);
    setWebcrawlError("");
    setLightpandaError("");
    setDuration(null);
  };

  const fetchWebcrawl = async () => {
    const body: Record<string, unknown> = {
      url: targetUrl.trim(),
      formats: [
        { type: "markdown" },
        { type: "html" },
        { type: "rawHtml" },
        { type: "links" },
        { type: "images" },
      ],
      onlyMainContent,
      removeBase64Images,
    };

    const waitForValue = Number(waitFor);
    if (!Number.isNaN(waitForValue) && waitForValue > 0) {
      body.waitFor = waitForValue;
    }

    const timeoutValue = Number(timeout);
    if (!Number.isNaN(timeoutValue) && timeoutValue > 0) {
      body.timeout = timeoutValue;
    }

    const endpoint = joinUrl("/api", "/scrape");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ScrapeResponse;
  };

  const fetchLightpanda = async () => {
    const body: Record<string, unknown> = {
      url: targetUrl.trim(),
      onlyMainContent,
      removeBase64Images,
    };

    const waitForValue = Number(waitFor);
    if (!Number.isNaN(waitForValue) && waitForValue > 0) {
      body.waitFor = waitForValue;
    }

    const timeoutValue = Number(timeout);
    if (!Number.isNaN(timeoutValue) && timeoutValue > 0) {
      body.timeout = timeoutValue;
    }

    const endpoint = joinUrl("/lightpanda-api", "/scrape");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as LightpandaResponse;
  };

  const handleRun = async () => {
    if (!targetUrl.trim()) {
      setWebcrawlError("请输入目标 URL。");
      setLightpandaError("请输入目标 URL。");
      setWebcrawlStatus("error");
      setLightpandaStatus("error");
      return;
    }
    if (!canRun) {
      setWebcrawlError("请至少选择一个引擎运行。");
      setLightpandaError("请至少选择一个引擎运行。");
      setWebcrawlStatus("error");
      setLightpandaStatus("error");
      return;
    }

    setWebcrawlError("");
    setLightpandaError("");
    setDuration(null);

    if (runWebcrawl) {
      setWebcrawlStatus("loading");
    } else {
      setWebcrawlStatus("idle");
      setWebcrawlResponse(null);
    }

    if (runLightpanda) {
      setLightpandaStatus("loading");
    } else {
      setLightpandaStatus("idle");
      setLightpandaResponse(null);
    }

    const start = performance.now();
    const results = await Promise.allSettled([
      runWebcrawl ? fetchWebcrawl() : Promise.resolve(null),
      runLightpanda ? fetchLightpanda() : Promise.resolve(null),
    ]);

    const [webcrawlResult, lightpandaResult] = results;

    if (runWebcrawl) {
      if (webcrawlResult.status === "fulfilled" && webcrawlResult.value) {
        setWebcrawlResponse(webcrawlResult.value);
        setWebcrawlStatus(webcrawlResult.value.success ? "success" : "error");
        if (!webcrawlResult.value.success) {
          setWebcrawlError(getErrorMessage(webcrawlResult.value.error));
        }
      } else if (webcrawlResult.status === "rejected") {
        setWebcrawlStatus("error");
        setWebcrawlError(getErrorMessage(webcrawlResult.reason));
      }
    }

    if (runLightpanda) {
      if (lightpandaResult.status === "fulfilled" && lightpandaResult.value) {
        setLightpandaResponse(lightpandaResult.value);
        setLightpandaStatus(lightpandaResult.value.success ? "success" : "error");
        if (!lightpandaResult.value.success) {
          setLightpandaError(getErrorMessage(lightpandaResult.value.error));
        }
      } else if (lightpandaResult.status === "rejected") {
        setLightpandaStatus("error");
        setLightpandaError(getErrorMessage(lightpandaResult.reason));
      }
    }

    setDuration(Math.round(performance.now() - start));
  };

  return (
    <main className="mx-auto mt-8 max-w-7xl space-y-8 px-6 pb-16">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-50 p-3 text-teal-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lightpanda 对比台</h2>
              <p className="text-xs text-slate-500">对比 WebCrawl 与 Lightpanda 的真实输出，确认产线质量。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="text-xs font-bold uppercase text-slate-400">抓取配置</div>
              <div className="mt-3 grid gap-3">
                <div className="group relative">
                  <label className="mb-1 block text-xs font-medium text-slate-500">目标 URL</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition focus:border-teal-500 focus:bg-white focus:outline-none"
                    value={targetUrl}
                    onChange={event => setTargetUrl(event.target.value)}
                    placeholder="https://example.com"
                    required
                    type="url"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">仅主内容</span>
                    <input
                      type="checkbox"
                      checked={onlyMainContent}
                      onChange={event => setOnlyMainContent(event.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">过滤 Base64 图片</span>
                    <input
                      type="checkbox"
                      checked={removeBase64Images}
                      onChange={event => setRemoveBase64Images(event.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className="mb-1 block text-xs font-medium text-slate-500">等待 (ms)</label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-teal-500 focus:bg-white focus:outline-none"
                      value={waitFor}
                      onChange={event => setWaitFor(event.target.value)}
                      placeholder="1000"
                    />
                  </div>
                  <div className="group">
                    <label className="mb-1 block text-xs font-medium text-slate-500">超时 (ms)</label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-teal-500 focus:bg-white focus:outline-none"
                      value={timeout}
                      onChange={event => setTimeout(event.target.value)}
                      placeholder="45000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">运行 WebCrawl</span>
                    <input
                      type="checkbox"
                      checked={runWebcrawl}
                      onChange={event => setRunWebcrawl(event.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">运行 Lightpanda</span>
                    <input
                      type="checkbox"
                      checked={runLightpanda}
                      onChange={event => setRunLightpanda(event.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!canRun || webcrawlStatus === "loading" || lightpandaStatus === "loading"}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Play className="h-4 w-4 text-teal-400" />
                  开始对比
                </button>
                <button
                  type="button"
                  onClick={resetResults}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  清空结果
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">Similarity</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">{similarity}%</div>
              </div>
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-600">
                <Gauge className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">基于词汇 Jaccard 相似度的粗略指标。</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                输出统计
              </div>
              <span className="text-[10px] font-mono text-slate-300">{duration ? `${duration}ms` : ""}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <StatCard label="WebCrawl 字数" value={webcrawlStats.words} />
              <StatCard label="Lightpanda 字数" value={lightpandaStats.words} />
              <StatCard label="WebCrawl 行数" value={webcrawlStats.lines} />
              <StatCard label="Lightpanda 行数" value={lightpandaStats.lines} />
              <StatCard label="WebCrawl 字符" value={webcrawlStats.characters} />
              <StatCard label="Lightpanda 字符" value={lightpandaStats.characters} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-400">运行状态</div>
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <StatusRow label="WebCrawl" status={webcrawlStatus} />
              <StatusRow label="Lightpanda" status={lightpandaStatus} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ResultPanel
          title="WebCrawl 输出"
          status={webcrawlStatus}
          errorMessage={webcrawlError}
          metadata={webcrawlSummary}
          linksCount={webcrawlResponse?.success ? webcrawlResponse.document.links?.length ?? 0 : 0}
          imagesCount={webcrawlResponse?.success ? webcrawlResponse.document.images?.length ?? 0 : 0}
        >
          <CodeBlock content={webcrawlMarkdown} language="markdown" />
        </ResultPanel>
        <ResultPanel
          title="Lightpanda 输出"
          status={lightpandaStatus}
          errorMessage={lightpandaError}
          metadata={lightpandaSummary}
          linksCount={lightpandaResponse?.success ? lightpandaResponse.document.links.length : 0}
          imagesCount={lightpandaResponse?.success ? lightpandaResponse.document.images.length : 0}
        >
          <CodeBlock content={lightpandaMarkdown} language="markdown" />
        </ResultPanel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
            <Orbit className="h-4 w-4" />
            提示
          </div>
          <p className="mt-3 text-xs text-slate-500">
            需要先启动 `apps/WebCrawl` API 与 `apps/lightpanda-test` 服务，然后再运行对比。
          </p>
          <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
            <div><span className="font-semibold text-slate-600">WebCrawl:</span> bun run dev</div>
            <div><span className="font-semibold text-slate-600">Lightpanda Server:</span> bun run server</div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Lightpanda Metadata</div>
          <div className="mt-4 space-y-2 text-xs text-slate-500">
            <MetaRow label="状态码" value={lightpandaSummary?.statusCode} />
            <MetaRow label="标题" value={lightpandaSummary?.title} />
            <MetaRow label="内容类型" value={lightpandaSummary?.contentType} />
            <MetaRow label="URL" value={lightpandaSummary?.url} />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2")}>
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: StatusState }) {
  const styles = statusStyles[status];
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold", styles.className)}>{styles.label}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
      <span className="max-w-[260px] truncate text-right font-mono text-[10px] text-slate-600">{value ?? "--"}</span>
    </div>
  );
}

function ResultPanel({
  title,
  status,
  errorMessage,
  metadata,
  linksCount,
  imagesCount,
  children,
}: {
  title: string;
  status: StatusState;
  errorMessage: string;
  metadata?: { statusCode?: number; title?: string };
  linksCount: number;
  imagesCount: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase text-slate-400">{title}</div>
          <div className="text-sm font-semibold text-slate-700">{metadata?.title || "等待输出"}</div>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold", statusStyles[status].className)}>
          {statusStyles[status].label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500">
        <MetaTile label="Status" value={metadata?.statusCode ?? "--"} />
        <MetaTile label="Links" value={linksCount} />
        <MetaTile label="Images" value={imagesCount} />
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {status === "success" && !errorMessage ? (
        <div className="mt-4">{children}</div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-xs text-slate-400">
          {status === "loading" ? (
            <RefreshCw className="h-6 w-6 animate-spin text-teal-400" />
          ) : (
            <FileText className="h-6 w-6" />
          )}
          <div className="mt-2">{status === "loading" ? "正在获取输出..." : "暂无数据"}</div>
        </div>
      )}
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}
