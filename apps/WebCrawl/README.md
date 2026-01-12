# WebCrawl API

轻量自托管抓取微服务，支持 fetch / playwright / PDF / document 引擎，输出 markdown / HTML / 链接 / 图片 / metadata。

## 服务启动

```bash
cd apps/WebCrawl
bun run dev
```

如需浏览器渲染，先启动 `apps/playwright-service-ts` 并在 `.env` 设置 `PLAYWRIGHT_MICROSERVICE_URL=http://localhost:3003/scrape` 或 `/scrape-enhanced`。

## 1) POST /scrape

单页抓取。

请求体：
```json
{
  "url": "https://example.com",
  "formats": [{ "type": "markdown" }, { "type": "links" }],
  "onlyMainContent": true,
  "headers": { "User-Agent": "WebCrawl/1.0" },
  "waitFor": 1000,
  "timeout": 30000,
  "parsers": ["pdf"],
  "skipTlsVerification": false,
  "removeBase64Images": true
}
```

字段说明：
- `url` (string, required)
- `formats` (array, default `[{"type":"markdown"}]`): `markdown` | `html` | `rawHtml` | `links` | `images`
- `onlyMainContent` (bool, default true)
- `headers` (record<string,string>, optional)
- `includeTags` / `excludeTags` (string[], optional)
- `timeout` (ms, optional)
- `waitFor` (ms, default 0)
- `parsers` (optional): `["pdf"]` 或 `{ "type": "pdf", "maxPages": 100 }`
- `skipTlsVerification` (bool, optional)
- `removeBase64Images` (bool, default true)

成功响应：
```json
{
  "success": true,
  "document": {
    "markdown": "...",
    "links": ["https://..."],
    "rawHtml": "<html>...</html>",
    "metadata": {
      "sourceURL": "https://example.com",
      "url": "https://example.com",
      "statusCode": 200,
      "contentType": "text/html",
      "proxyUsed": "basic",
      "renderStatus": "loaded",
      "contentStatus": "usable",
      "gatekeeper": {
        "blockClass": "none",
        "confidence": 0,
        "quality": {
          "htmlBytes": 12345,
          "visibleTextChars": 4567,
          "mainContentChars": 4567
        }
      }
    }
  }
}
```

失败响应：
```json
{ "success": false, "error": { "name": "...", "message": "..." } }
```

## 2) POST /crawl

站点爬取，内部批量调用 `/scrape`。

请求体：
```json
{
  "url": "https://example.com",
  "limit": 20,
  "maxDepth": 1,
  "includes": ["example.com/docs"],
  "excludes": ["logout"],
  "allowSubdomains": false,
  "allowExternalContentLinks": false,
  "headers": { "User-Agent": "WebCrawl/1.0" },
  "scrapeOptions": {
    "formats": [{ "type": "markdown" }, { "type": "links" }],
    "onlyMainContent": true
  }
}
```

字段说明：
- `url` (string, required)
- `limit` (int, default 100)
- `maxDepth` (int, default 2)
- `includes` / `excludes` (string[], optional)
- `allowBackwardCrawling` (bool, default false)
- `allowExternalContentLinks` (bool, default false)
- `allowSubdomains` (bool, default false)
- `regexOnFullURL` (bool, default false)
- `headers` (record, optional)
- `scrapeOptions`：同 `/scrape` 请求体

成功响应：
```json
{
  "success": true,
  "pages": [ { "markdown": "...", "metadata": { "url": "https://..." } } ],
  "errors": [ { "url": "...", "error": "..." } ],
  "stats": { "discovered": 20, "processed": 20, "succeeded": 18, "failed": 2 }
}
```

## 3) 健康检查

`GET /health` → `{ "ok": true }`

## 4) 引擎与重试行为

- 引擎优先级：document/pdf → playwright（如果配置）→ fetch。
- 当 playwright/fetch 收到 401/403 或响应含 `Set-Cookie` 时，同引擎自动重试最多 2 次后再回退。
- Gatekeeper 输出 `contentStatus`（usable/thin/challenge/login/soft_block），写入 metadata。

## 配置要点

- `PLAYWRIGHT_MICROSERVICE_URL`: 指向浏览器微服务 `/scrape` 或 `/scrape-enhanced`。
- `GATEKEEPER_RULES_PATH`: 规则文件，参考 `apps/WebCrawl/gatekeeper.rules.json.example`。
- `MIN_HTML_BYTES` / `MIN_VISIBLE_TEXT_CHARS` / `MIN_MAIN_CONTENT_CHARS`: 内容判定阈值。
- 其他见 `apps/WebCrawl/.env.example`。

## Playwright 微服务接口（引用）

默认入口 `/scrape` 或 `/scrape-enhanced`：
```json
{
  "url": "https://example.com",
  "wait_after_load": 0,
  "timeout": 15000,
  "headers": { "User-Agent": "..." },
  "skip_tls_verification": false,
  "use_stealth": true
}
```
返回字段：`content`, `pageStatusCode`, `contentType`, `render_status`, `content_status`, `evidence`.
