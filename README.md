# WebCrawl 单体仓库

WebCrawl 是一个轻量的自托管页面抓取服务，支持可选的 Playwright 渲染，
并提供现代化的 React Demo 用于测试抓取结果。

## 应用列表

- `apps/WebCrawl`: 核心 API 服务（Bun + Elysia）
- `apps/playwright-service-ts`: 可选 Playwright 微服务
- `apps/webcrawl-demo`: React + Tailwind Demo 控制台

## 共享包

- `packages/firecrawl-rs`: 本地 N-API 原生模块

## 环境要求

- Node.js 18+（或使用 Bun）
- 包管理器（bun、pnpm、npm 或 yarn）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

也可以改用 `bun install`、`npm install` 或 `yarn install`。

## 启动方式

启动 API 服务：

```bash
cd apps/WebCrawl
bun run dev
```

启动 Playwright 微服务（可选）：

```bash
cd apps/playwright-service-ts
pnpm run dev
```

启动 Demo 前端：

```bash
cd apps/webcrawl-demo
pnpm run dev
```

Demo 运行在 `http://localhost:5174`，并通过 `/api` 代理到
`http://localhost:3002`。

## API 概览

### `POST /scrape`

- `url` **(必填)**：目标地址。
- `formats`（可选，默认 `[{"type":"markdown"}]`）：`markdown` | `html` | `rawHtml` | `links` | `images`.
- `onlyMainContent`（bool，默认 `true`）：优先正文抽取。
- `headers`（record，可选）：自定义请求头。
- `includeTags` / `excludeTags`（string[]，可选）：限制/排除标签。
- `timeout`（ms，可选）：抓取超时。
- `waitFor`（ms，默认 `0`）：渲染等待时间。
- `parsers`（可选）：`["pdf"]` 或 `{ "type": "pdf", "maxPages": 100 }`。
- `skipTlsVerification`（bool，可选）：忽略 TLS 校验。
- `removeBase64Images`（bool，默认 `true`）。

示例：

```json
{
  "url": "https://example.com",
  "formats": [{ "type": "markdown" }, { "type": "links" }],
  "headers": { "User-Agent": "WebCrawl/1.0" },
  "waitFor": 1000,
  "onlyMainContent": true,
  "removeBase64Images": true
}
```

响应（成功）：

```json
{
  "success": true,
  "document": {
    "markdown": "...",
    "links": ["https://..."],
    "metadata": {
      "sourceURL": "https://example.com",
      "url": "https://example.com",
      "statusCode": 200,
      "contentType": "text/html",
      "proxyUsed": "basic",
      "gatekeeper": { "blockClass": "none", "contentStatus": "usable", "quality": {...} }
    }
  }
}
```

### `POST /crawl`

对站点爬取并批量调用 `scrape`。

- `url` **(必填)**：起始地址。
- `limit`（默认 `100`）：最多抓取页面数。
- `maxDepth`（默认 `2`）：抓取深度。
- `includes` / `excludes`（string[]，可选）：URL 包含/排除规则。
- `allowBackwardCrawling`（bool，默认 `false`）。
- `allowExternalContentLinks`（bool，默认 `false`）。
- `allowSubdomains`（bool，默认 `false`）。
- `regexOnFullURL`（bool，默认 `false`）：使用完整 URL 做正则。
- `headers`（record，可选）：全局请求头。
- `scrapeOptions`：同 `/scrape` 的参数，作用于每个页面。

请求示例：

```json
{
  "url": "https://example.com",
  "limit": 20,
  "maxDepth": 1,
  "includes": ["example.com/docs"],
  "scrapeOptions": {
    "formats": [{ "type": "markdown" }, { "type": "links" }],
    "onlyMainContent": true
  }
}
```

响应（成功）：

```json
{
  "success": true,
  "pages": [ { "markdown": "...", "metadata": { "url": "https://..." } } ],
  "errors": [ { "url": "...", "error": "..." } ],
  "stats": { "discovered": 20, "processed": 20, "succeeded": 18, "failed": 2 }
}
```

## 引擎与反爬策略（简要）

- 默认引擎优先级：document/pdf → Playwright（如配置 `PLAYWRIGHT_MICROSERVICE_URL`）→ fetch。
- 若 Playwright 返回 401/403 或响应有 `Set-Cookie`，同引擎会自动再尝试一次后再回退。
- Gatekeeper 会根据大小/状态/特征脚本输出 `contentStatus`（usable/thin/challenge/login/soft_block），写入 metadata。

## 配置

常用环境变量：

- `HOST`, `PORT`: API 服务监听地址与端口。
- `LOGGING_LEVEL`: Winston 日志级别。
- `PLAYWRIGHT_MICROSERVICE_URL`: 开启 Playwright 渲染。
- `PROXY_SERVER`, `PROXY_USERNAME`, `PROXY_PASSWORD`: 出站代理。
- `EXPOSE_ERROR_DETAILS`, `EXPOSE_ERROR_STACK`: 输出详细错误信息。
- `GATEKEEPER_RULES_PATH`: 可配置规则文件（参考 `apps/WebCrawl/gatekeeper.rules.json.example`）。
- `MIN_HTML_BYTES`, `MIN_VISIBLE_TEXT_CHARS`, `MIN_MAIN_CONTENT_CHARS`: 内容判定阈值。

完整列表见 `apps/WebCrawl/.env.example`。

## 项目结构

- 根目录 `package.json` 声明 `apps/*` 工作区。
- 根目录 `tsconfig.json` 提供共享的 TypeScript 默认配置。
- 各应用 `tsconfig.json` 继承根配置。
