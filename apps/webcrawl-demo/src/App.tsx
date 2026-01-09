import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState, type FormEvent } from "react";
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
  Copy,
  LayoutTemplate,
  ShieldAlert,
  Server,
  Filter,
} from "lucide-react";
import { cn } from "./lib/cn";

type FormatKey = "markdown" | "html" | "rawHtml" | "links" | "images";

type DocumentMetadata = {
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

type ScrapeDocument = {
  markdown?: string;
  rawHtml?: string;
  html?: string;
  links?: string[];
  images?: string[];
  metadata: DocumentMetadata;
  warning?: string;
};

type ScrapeResponse =
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

const formatOptions: { key: FormatKey; label: string; icon: React.ReactNode }[] = [
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

const defaultFormState = {
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

type StatusState = "idle" | "loading" | "success" | "error";

const statusStyles: Record<StatusState, { label: string; className: string; icon: React.ReactNode }> =
  {
    idle: { label: "准备就绪", className: "bg-slate-100 text-slate-600 border-slate-200", icon: <Clock className="w-3.5 h-3.5" /> },
    loading: { label: "正在抓取", className: "bg-blue-50 text-blue-600 border-blue-200 animate-pulse", icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
    success: { label: "请求成功", className: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    error: { label: "请求失败", className: "bg-rose-50 text-rose-600 border-rose-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  };

function parseTagList(value: string) {
  return value
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function joinUrl(base: string, path: string) {
  if (base.endsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  return `${base}${path}`;
}

export default function App() {
  const [formats, setFormats] =
    useState<Record<FormatKey, boolean>>(defaultFormats);
  const [formState, setFormState] = useState(defaultFormState);
  const [status, setStatus] = useState<StatusState>("idle");
  const [duration, setDuration] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRequest, setLastRequest] = useState<Record<string, unknown> | null>(
    null,
  );
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

  function updateForm<K extends keyof typeof formState>(
    key: K,
    value: (typeof formState)[K],
  ) {
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
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 shadow-lg shadow-teal-600/20">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">WebCrawl</h1>
              <p className="text-xs font-medium text-slate-500">API 测试控制台</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600 sm:block">
               端口: 3002 (API) / 5174 (Dev)
             </div>
             <a
               href="https://github.com/Arxtect/WebCrawl"
               target="_blank"
               rel="noreferrer"
               className="rounded-full bg-slate-900 p-2 text-white transition hover:bg-slate-700"
             >
               <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
             </a>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1.5fr] lg:items-start">
        {/* 左侧：控制面板 */}
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
                {/* 基础配置 */}
                <div className="space-y-4">
                  <FormSectionTitle>基础信息</FormSectionTitle>
                  
                  <div className="group relative">
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">目标 URL <span className="text-rose-500">*</span></label>
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

                {/* 格式选择 */}
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
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={formats[option.key]}
                          onChange={() => toggleFormat(option.key)}
                        />
                        <div className={cn(
                          "transition-transform group-active:scale-95",
                          formats[option.key] ? "text-teal-600" : "text-slate-400"
                        )}>
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

                {/* 高级选项 */}
                <div className="space-y-4">
                  <FormSectionTitle>抓取选项</FormSectionTitle>
                  <div className="grid gap-3">
                     {[
                       { key: 'onlyMainContent', label: '主要内容模式', desc: '智能提取主体，去除广告导航' },
                       { key: 'removeBase64Images', label: '精简响应体积', desc: '自动过滤 Base64 材质/内联图片' },
                       { key: 'skipTlsVerification', label: '允许自签名 TLS', desc: '不校验 SSL 证书合法性' , danger: true},
                     ].map((item) => (
                        <label
                          key={item.key}
                          className={cn(
                            "group flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all cursor-pointer",
                            formState[item.key as keyof typeof defaultFormState]
                              ? "border-teal-500 bg-teal-50/30"
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={formState[item.key as keyof typeof defaultFormState] as boolean}
                            onChange={event => updateForm(item.key as any, event.target.checked)}
                          />

                          <div className="min-w-0 flex-1">
                            <div className={cn("text-xs font-bold", item.danger && !formState[item.key as keyof typeof defaultFormState] ? "text-amber-600" : "text-slate-800")}>{item.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                          </div>
                          <div
                            className={cn(
                              "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all",
                              formState[item.key as keyof typeof defaultFormState]
                                ? "border-teal-600 bg-teal-600"
                                : "border-slate-200 bg-white"
                            )}
                          >
                             <span
                               className={cn(
                                 "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                                 formState[item.key as keyof typeof defaultFormState] ? "translate-x-6" : "translate-x-1"
                               )}
                             />
                          </div>
                        </label>
                     ))}
                  </div>
                </div>

                {/* 更多设置 (可折叠或直接展示) */}
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
                             <Filter className="w-3 h-3"/> 包含标签 (Selector)
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
                              <Filter className="w-3 h-3"/> 排除标签 (Selector)
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
                    <RefreshCw className="h-5 w-5 animate-spin text-teal-400"/>
                  ) : (
                    <Play className="h-5 w-5 text-teal-400 fill-teal-400"/>
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

        {/* 右侧：结果展示 */}
        <div className="min-w-0 space-y-6">
           <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
             <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  <Terminal className="h-4 w-4" />
                  响应结果
                </h2>
                <div className="flex items-center gap-3">
                   <span className={cn(
                     "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold shadow-sm transition-colors",
                     statusStyles[status].className
                   )}>
                     {statusStyles[status].icon}
                     {statusStyles[status].label}
                   </span>
                   <span className="font-mono text-xs font-medium text-slate-400">
                      {duration ? `${duration}ms` : ""}
                   </span>
                </div>
             </div>

             <div className="p-6">
                {/* 状态概览卡片 */}
                {response?.success && (
                  <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                     <SummaryItem label="HTTP 状态" value={summary?.statusCode} icon={<ServeIcon status={summary?.statusCode as number} />} />
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
                
                {/* 当没有响应时显示的空状态，但只有在idle时显示，loading时不显示或显示骨架屏 */}
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
                            "data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-50 data-[state=inactive]:hover:text-slate-700"
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
                        <ListPanel items={document?.links} emptyLabel="链接" icon={<LinkIcon className="h-5 w-5"/>}/>
                    </TabPanel>
                    <TabPanel value="images">
                        <ListPanel items={document?.images} emptyLabel="图片" icon={<ImageIcon className="h-5 w-5"/>} />
                    </TabPanel>
                    <TabPanel value="metadata">
                        <CodeBlock
                          content={JSON.stringify({ ...document?.metadata, ...(response.unsupportedFeatures ? { unsupportedFeatures: response.unsupportedFeatures } : {}) }, null, 2)}
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
    </div>
  );
}

// --- Components ---

function FormSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
      <span className="h-px flex-1 bg-slate-100"></span>
      {children}
      <span className="h-px flex-1 bg-slate-100"></span>
    </div>
  );
}

function SummaryItem({ label, value, className, icon }: { label: string; value?: string | number; className?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3", className)}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
         {icon}
         <span className="truncate" title={String(value)}>{value ?? "--"}</span>
      </div>
    </div>
  );
}

function ServeIcon({ status }: { status: number }) {
  if (status >= 200 && status < 300) return <div className="h-2 w-2 rounded-full bg-emerald-500" />;
  if (status >= 400) return <div className="h-2 w-2 rounded-full bg-rose-500" />;
  return <div className="h-2 w-2 rounded-full bg-amber-500" />;
}

function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content) return <div className="text-center py-10 text-slate-400 text-sm">暂无内容</div>;

  return (
    <div className="relative group rounded-xl border border-slate-200 bg-slate-900 text-slate-50">
       <button
         onClick={handleCopy}
         className="absolute right-3 top-3 rounded-lg bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
         title="复制内容"
       >
         {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
       </button>
      <div className="absolute left-4 top-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
        {language}
      </div>
      <pre className="max-h-[500px] overflow-auto p-4 pt-10 text-xs font-mono leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
        {content}
      </pre>
    </div>
  );
}

function ListPanel({ items, emptyLabel, icon }: { items?: string[]; emptyLabel: string; icon: React.ReactNode }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-slate-400">
        <div className="mb-2 opacity-50">{icon}</div>
        <div className="text-sm">暂无 {emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
      {items.map((item, i) => (
        <a
          key={i}
          href={item}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          <div className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-400">
            {emptyLabel === '图片' ? <ImageIcon className="h-3 w-3"/> : <LinkIcon className="h-3 w-3"/>}
          </div>
          <span className="truncate font-mono">{item}</span>
        </a>
      ))}
    </div>
  );
}

function TabPanel({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Content value={value} className="focus:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </Tabs.Content>
  );
}
