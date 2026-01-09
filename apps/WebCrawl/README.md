# WebCrawl

Lightweight, self-hosted page scraping microservice focused on high-performance extraction:

- Engines: fetch, playwright (optional microservice), PDF, document (docx/odt/rtf/xlsx)
- Outputs: markdown, raw HTML, links, images, metadata

## Run

```bash
bun run dev
```

## API

`POST /scrape`

```json
{
  "url": "https://example.com",
  "formats": [{ "type": "markdown" }, { "type": "links" }],
  "onlyMainContent": true
}
```

## Services

- Playwright microservice (optional): set `PLAYWRIGHT_MICROSERVICE_URL`
- Markdown conversion uses built-in Turndown.

## Deployment config

See `.env.example` for the full list. Common settings:

- `HOST` and `PORT`: bind address and port for the API server.
- `LOGGING_LEVEL`: log verbosity for the winston logger.
- `PLAYWRIGHT_MICROSERVICE_URL`: enable dynamic rendering for JS-heavy pages.
- `PROXY_SERVER`, `PROXY_USERNAME`, `PROXY_PASSWORD`: outbound proxy for fetch/playwright.
- `EXPOSE_ERROR_DETAILS`, `EXPOSE_ERROR_STACK`: return verbose errors (avoid in prod).
- `FIRECRAWL_DEBUG_FILTER_LINKS`: verbose link filter logs when crawling.

## Native

`@mendable/firecrawl-rs` is used as a local dependency in `packages/firecrawl-rs`.
