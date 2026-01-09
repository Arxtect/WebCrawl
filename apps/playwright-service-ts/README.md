# Playwright Scrape API

This is a simple web scraping service built with Express and Playwright, with optional stealth mode using puppeteer-extra.

## Features

- Scrapes HTML content from specified URLs.
- **Stealth Mode**: Uses puppeteer-extra with stealth plugin for advanced anti-detection.
- **Realistic User-Agents**: Rotates through realistic browser fingerprints.
- Blocks requests to known ad-serving domains.
- Blocks media files to reduce bandwidth usage.
- Uses random user-agent strings to avoid detection.
- Strategy to ensure the page is fully rendered.

## Install
```bash
npm install
npx playwright install
```

## RUN
```bash
npm run build
npm start
```
OR
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3003 |
| `BLOCK_MEDIA` | Block media files | False |
| `MAX_CONCURRENT_PAGES` | Maximum concurrent scraping pages | 10 |
| `PROXY_SERVER` | Proxy server URL | null |
| `PROXY_USERNAME` | Proxy username | null |
| `PROXY_PASSWORD` | Proxy password | null |
| `USE_STEALTH` | Enable stealth mode by default | False |

## API Endpoints

### POST /scrape
Standard scraping endpoint using Playwright.

```bash
curl -X POST http://localhost:3003/scrape \
-H "Content-Type: application/json" \
-d '{
  "url": "https://example.com",
  "wait_after_load": 1000,
  "timeout": 15000,
  "headers": {
    "Custom-Header": "value"
  },
  "check_selector": "#content"
}'
```

### POST /scrape-stealth
Stealth scraping endpoint using puppeteer-extra with stealth plugin for maximum anti-detection.

```bash
curl -X POST http://localhost:3003/scrape-stealth \
-H "Content-Type: application/json" \
-d '{
  "url": "https://example.com",
  "wait_after_load": 1000,
  "timeout": 15000
}'
```

### POST /scrape-enhanced
Enhanced scraping endpoint with optional stealth mode toggle.

```bash
curl -X POST http://localhost:3003/scrape-enhanced \
-H "Content-Type: application/json" \
-d '{
  "url": "https://example.com",
  "wait_after_load": 1000,
  "timeout": 15000,
  "use_stealth": true
}'
```

## Stealth Features

The stealth mode provides the following anti-detection measures:

1. **puppeteer-extra-plugin-stealth**: Evades common bot detection techniques
2. **Realistic User-Agents**: Uses up-to-date Chrome, Firefox, Safari, and Edge user agents
3. **WebDriver Property Override**: Hides the `navigator.webdriver` property
4. **Plugin Spoofing**: Simulates realistic browser plugins
5. **WebGL Vendor Override**: Spoofs WebGL vendor and renderer info
6. **Hardware Concurrency**: Simulates realistic hardware specs
7. **Language Headers**: Sets realistic Accept-Language headers
8. **Sec-CH-UA Headers**: Adds proper Client Hints headers

## USING WITH WEBCRAWL

Add `PLAYWRIGHT_MICROSERVICE_URL=http://localhost:3003/scrape` to `/apps/api/.env` to configure the API to use this Playwright microservice for scraping operations.

For stealth mode, use `PLAYWRIGHT_MICROSERVICE_URL=http://localhost:3003/scrape-stealth`.
