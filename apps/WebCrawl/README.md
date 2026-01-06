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
- HTML-to-Markdown microservice (optional): set `HTML_TO_MARKDOWN_SERVICE_URL`

## Native

`@mendable/firecrawl-rs` is used as a local dependency in `apps/WebCrawl/native`.
