# lightpanda-test

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

To start the Lightpanda API server:

```bash
bun run server
```

Example request:

```bash
curl -X POST http://127.0.0.1:8790/scrape ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://example.com\",\"onlyMainContent\":true}"
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
