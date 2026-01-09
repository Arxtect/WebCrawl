import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Globe,
  Clock,
  Settings,
  Play,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Terminal,
  AlertCircle,
  CheckCircle,
  LayoutTemplate,
  ShieldAlert,
  Server,
  Filter,
} from "lucide-react";
import { cn } from "../lib/cn";
import { CodeBlock } from "../components/CodeBlock";
import { FormSectionTitle } from "../components/FormSectionTitle";
import { ListPanel } from "../components/ListPanel";
import { SummaryItem } from "../components/SummaryItem";
import { TabPanel } from "../components/TabPanel";
import { joinUrl, parseTagList } from "../utils/request";
import type { FormatKey, FormState, ScrapeResponse, StatusState } from "../types/scrape";

const formatOptions: { key: FormatKey; label: string; icon: ReactNode }[] = [
  { key: "markdown", label: "Markdown", icon: <FileText className="w-4 h-4" /> },
  { key: "html", label: "HTML", icon: <LayoutTemplate className="w-4 h-4" /> },
  { key: "rawHtml", label: "原始 HTML", icon: <Code className="w-4 h-4" /> },
  { key: "links", label: "链接", icon: <LinkIcon className="w-4 h-4" /> },
  { key: "images", label: "图片", icon: <ImageIcon className="w-4 h-4" /> },
];

const tabOptions = [
  { value: "markdown", label: "Markdown", icon: <FileText className="w-4 h-4" /> },
  { value: "html", label: "预览", icon: <LayoutTemplate className="w-4 h-4" /> },
  { value: "rawHtml", label: "源码", icon: <Code className="w-4 h-4" /> },
  { value: "links", label: "链接", icon: <LinkIcon className="w-4 h-4" /> },
  { value: "images", label: "图片", icon: <ImageIcon className="w-4 h-4" /> },
  { value: "metadata", label: "元数据", icon: <Terminal className="w-4 h-4" /> },
  { value: "request", label: "请求", icon: <Server className="w-4 h-4" /> },
];

const defaultFormats: Record<FormatKey, boolean> = {
  markdown: true,
  html: false,
  rawHtml: false,
  links: false,
  images: false,
};

const defaultFormState: FormState = {
  targetUrl: "",
  onlyMainContent: true,
  removeBase64Images: true,
  skipTlsVerification: false,
  waitFor: "",
  timeout: "",
  includeTags: "",
  excludeTags: "",
  headers: "",
};

const statusStyles: Record<StatusState, { label: string; className: string; icon: ReactNode }> = {
  idle: { label: "准备就绪", className: "bg-slate-100 text-slate-600 border-slate-200", icon: <Clock className="w-3.5 h-3.5" /> },
  loading: { label: "正在抓取", className: "bg-blue-50 text-blue-600 border-blue-200 animate-pulse", icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  success: { label: "请求成功", className: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  error: { label: "请求失败", className: "bg-rose-50 text-rose-600 border-rose-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

export function WebCrawlView() {
  const [formats, setFormats] = useState<Record<FormatKey, boolean>>(defaultFormats);
  const [formState, setFormState] = useState(defaultFormState);
  const [status, setStatus] = useState<StatusState>("idle");
  const [duration, setDuration] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRequest, setLastRequest] = useState<Record<string, unknown> | null>(null);
  const [response, setResponse] = useState<ScrapeResponse | null>(null);
  const [activeTab, setActiveTab] = useState("markdown");

  const requestPreview = useMemo(() => {
    if (!lastRequest && !response) {
      return "";
    }
    return JSON.stringify({ request: lastRequest, response }, null, 2);
  }, [lastRequest, response]);

  const document = response && response.success ? response.document : null;
  const summary = document?.metadata;

  function updateForm<K extends keyof typeof formState>(key: K, value: (typeof formState)[K]) {
    setFormState(prev => ({ ...prev, [key]: value }));
  }

  function toggleFormat(key: FormatKey) {
    setFormats(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function resetForm() {
    setFormats(defaultFormats);
    setFormState(defaultFormState);
    setStatus("idle");
    setDuration(null);
    setErrorMessage("");
    setLastRequest(null);
    setResponse(null);
    setActiveTab("markdown");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!formState.targetUrl.trim()) {
      setStatus("error");
      setErrorMessage("请输入目标 URL。");
      return;
    }

    let headers: Record<string, string> | undefined;
    if (formState.headers.trim()) {
      try {
        headers = JSON.parse(formState.headers.trim());
      } catch {
        setStatus("error");
        setErrorMessage("请求头必须是合法的 JSON。");
        return;
      }
    }

    const selectedFormats = formatOptions
      .filter(option => formats[option.key])
      .map(option => ({ type: option.key }));

    const body: Record<string, unknown> = {
      url: formState.targetUrl.trim(),
      formats: selectedFormats.length ? selectedFormats : [{ type: "markdown" }],
      onlyMainContent: formState.onlyMainContent,
      removeBase64Images: formState.removeBase64Images,
    };

    if (formState.skipTlsVerification) {
      body.skipTlsVerification = true;
    }

    const waitFor = Number(formState.waitFor);
    if (!Number.isNaN(waitFor) && waitFor > 0) {
      body.waitFor = waitFor;
    }

    const timeout = Number(formState.timeout);
    if (!Number.isNaN(timeout) && timeout > 0) {
      body.timeout = timeout;
    }

    const includeTags = parseTagList(formState.includeTags);
    if (includeTags.length > 0) {
      body.includeTags = includeTags;
    }

    const excludeTags = parseTagList(formState.excludeTags);
    if (excludeTags.length > 0) {
      body.excludeTags = excludeTags;
    }

    if (headers) {
      body.headers = headers;
    }

    setStatus("loading");
    setDuration(null);
    setLastRequest(body);
    setResponse(null);

    const start = performance.now();
    try {
      const endpoint = joinUrl("/api", "/scrape");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as ScrapeResponse;
      setResponse(payload);
      setStatus(payload.success ? "success" : "error");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setDuration(Math.round(performance.now() - start));
    }
  }

  return (
    <main className="mx-auto mt-8 grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1.5fr] lg:items-start">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Settings className="h-4 w-4" />
              配置参数
            </h2>
          </div>

          <form className="p-6" onSubmit={handleSubmit}>
            <div className="space-y-8">
              <div className="space-y-4">
                <FormSectionTitle>基础信息</FormSectionTitle>

                <div className="group relative">
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    目标 URL <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-teal-500" />
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 transition focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-300"
                      value={formState.targetUrl}
                      onChange={event => updateForm("targetUrl", event.target.value)}
                      placeholder="https://example.com"
                      required
                      type="url"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <FormSectionTitle>输出格式</FormSectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {formatOptions.map(option => (
                    <label
                      key={option.key}
                      className={cn(
                        "group relative cursor-pointer flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-sm font-semibold transition-all duration-200",
                        formats[option.key]
                          ? "border-teal-300 bg-white text-slate-800 ring-2 ring-teal-100 shadow-sm"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formats[option.key]}
                        onChange={() => toggleFormat(option.key)}
                      />
                      <div className={cn("transition-transform group-active:scale-95", formats[option.key] ? "text-teal-600" : "text-slate-400")}>
                        {option.icon}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">{option.label}</span>
                      {formats[option.key] && (
                        <div className="absolute right-2 top-2">
                          <CheckCircle className="h-4 w-4 text-teal-600" />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <FormSectionTitle>抓取选项</FormSectionTitle>
                <div className="grid gap-3">
                  {[
                    { key: "onlyMainContent", label: "主要内容模式", desc: "智能提取主体，去除广告导航" },
                    { key: "removeBase64Images", label: "精简响应体积", desc: "自动过滤 Base64 材质/内联图片" },
                    { key: "skipTlsVerification", label: "允许自签名 TLS", desc: "不校验 SSL 证书合法性", danger: true },
                  ].map(item => (
                    <label
                      key={item.key}
                      className={cn(
                        "group flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all cursor-pointer",
                        formState[item.key as keyof typeof defaultFormState]
                          ? "border-teal-500 bg-teal-50/30"
                          : "border-slate-100 hover:border-slate-200",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formState[item.key as keyof typeof defaultFormState] as boolean}
                        onChange={event => updateForm(item.key as keyof typeof formState, event.target.checked as never)}
                      />

                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "text-xs font-bold",
                            item.danger && !formState[item.key as keyof typeof defaultFormState] ? "text-amber-600" : "text-slate-800",
                          )}
                        >
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                      <div
                        className={cn(
                          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all",
                          formState[item.key as keyof typeof defaultFormState]
                            ? "border-teal-600 bg-teal-600"
                            : "border-slate-200 bg-white",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                            formState[item.key as keyof typeof defaultFormState] ? "translate-x-6" : "translate-x-1",
                          )}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-dashed border-slate-200 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="group relative">
                    <label className="mb-1 block text-xs font-medium text-slate-500">等待 (ms)</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
                        value={formState.waitFor}
                        onChange={e => updateForm("waitFor", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="group relative">
                    <label className="mb-1 block text-xs font-medium text-slate-500">超时 (ms)</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
                        value={formState.timeout}
                        onChange={e => updateForm("timeout", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="group">
                    <label className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-500">
                      <Filter className="w-3 h-3" /> 包含标签 (Selector)
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs transition focus:border-teal-500 focus:bg-white focus:outline-none"
                      value={formState.includeTags}
                      onChange={e => updateForm("includeTags", e.target.value)}
                      placeholder="article, #main-content"
                    />
                  </div>
                  <div className="group">
                    <label className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-500">
                      <Filter className="w-3 h-3" /> 排除标签 (Selector)
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs transition focus:border-teal-500 focus:bg-white focus:outline-none"
                      value={formState.excludeTags}
                      onChange={e => updateForm("excludeTags", e.target.value)}
                      placeholder="nav, footer, .ads"
                    />
                  </div>
                  <div className="group">
                    <label className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-500">
                      自定义 Header (JSON)
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono transition focus:border-teal-500 focus:bg-white focus:outline-none min-h-[80px]"
                      value={formState.headers}
                      onChange={e => updateForm("headers", e.target.value)}
                      placeholder='{"User-Agent": "MyCrawler/1.0"}'
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3 pt-6 border-t border-slate-100">
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex flex-[2] items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-1 hover:bg-slate-800 hover:shadow-slate-900/40 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:transform-none"
              >
                {status === "loading" ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-teal-400" />
                ) : (
                  <Play className="h-5 w-5 text-teal-400 fill-teal-400" />
                )}
                {status === "loading" ? "正在执行..." : "立即抓取数据"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-xs font-bold text-slate-400 transition-all hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              >
                <RefreshCw className="h-4 w-4" />
                <span>重置</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Terminal className="h-4 w-4" />
              响应结果
            </h2>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold shadow-sm transition-colors",
                  statusStyles[status].className,
                )}
              >
                {statusStyles[status].icon}
                {statusStyles[status].label}
              </span>
              <span className="font-mono text-xs font-medium text-slate-400">{duration ? `${duration}ms` : ""}</span>
            </div>
          </div>

          <div className="p-6">
            {response?.success && (
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryItem label="HTTP 状态" value={summary?.statusCode} statusCode={summary?.statusCode as number} />
                <SummaryItem label="Content-Type" value={summary?.contentType} />
                <SummaryItem label="页面标题" value={summary?.title} className="col-span-2" />
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600 flex items-start gap-3">
                <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
                <div>
                  <div className="font-bold">发生错误</div>
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            {response && !response.success && !errorMessage && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(response.error, null, 2)}</pre>
              </div>
            )}

            {!response && status === "idle" && !errorMessage && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Globe className="h-16 w-16 mb-4 stroke-[1.5]" />
                <p className="text-sm font-medium">输入 URL 并点击开始抓取</p>
              </div>
            )}

            {response?.success && (
              <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="mt-2">
                <Tabs.List className="mb-6 flex flex-wrap gap-2 border-b border-slate-100 pb-2">
                  {tabOptions.map(tab => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "group flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
                        "data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:ring-1 data-[state=active]:ring-teal-200",
                        "data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-50 data-[state=inactive]:hover:text-slate-700",
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                <TabPanel value="markdown">
                  <CodeBlock content={document?.markdown ?? ""} language="markdown" />
                </TabPanel>
                <TabPanel value="html">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <iframe
                      title="HTML 预览"
                      className="h-[500px] w-full bg-white"
                      sandbox=""
                      srcDoc={document?.html || document?.rawHtml || ""}
                    />
                  </div>
                </TabPanel>
                <TabPanel value="rawHtml">
                  <CodeBlock content={document?.rawHtml ?? ""} language="html" />
                </TabPanel>
                <TabPanel value="links">
                  <ListPanel items={document?.links} emptyLabel="链接" />
                </TabPanel>
                <TabPanel value="images">
                  <ListPanel items={document?.images} emptyLabel="图片" />
                </TabPanel>
                <TabPanel value="metadata">
                  <CodeBlock
                    content={JSON.stringify(
                      { ...document?.metadata, ...(response.unsupportedFeatures ? { unsupportedFeatures: response.unsupportedFeatures } : {}) },
                      null,
                      2,
                    )}
                    language="json"
                  />
                </TabPanel>
                <TabPanel value="request">
                  <CodeBlock content={requestPreview} language="json" />
                </TabPanel>
              </Tabs.Root>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
