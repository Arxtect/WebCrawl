import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { chromium, Browser, BrowserContext, Route, Request as PlaywrightRequest, Page, errors as PlaywrightErrors } from 'playwright';
import dotenv from 'dotenv';
import UserAgent from 'user-agents';
import fs from 'fs';
import path from 'path';
import { getError } from './helpers/get_error';
import { 
  initializeStealthBrowser, 
  closeStealthBrowser, 
  scrapeWithStealth,
  getStealthBrowser 
} from './helpers/stealth';
import { getRealisticUserAgent, getRealisticHeaders, UserAgentRotator } from './helpers/userAgent';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(bodyParser.json());

const BLOCK_MEDIA = (process.env.BLOCK_MEDIA || 'False').toUpperCase() === 'TRUE';
const MAX_CONCURRENT_PAGES = Math.max(1, Number.parseInt(process.env.MAX_CONCURRENT_PAGES ?? '10', 10) || 10);

const PROXY_SERVER = process.env.PROXY_SERVER || null;
const PROXY_USERNAME = process.env.PROXY_USERNAME || null;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || null;
const USE_STEALTH = (process.env.USE_STEALTH || 'True').toUpperCase() === 'TRUE';
const ENABLE_STORAGE_CACHE = (process.env.ENABLE_STORAGE_CACHE || 'True').toUpperCase() === 'TRUE';
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage');

const ensureStorageDir = () => {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
};

const getStoragePathForUrl = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.join(STORAGE_DIR, `${host}.json`);
  } catch {
    return path.join(STORAGE_DIR, `unknown.json`);
  }
};

const CONTENT_THRESHOLDS = {
  min_html_bytes: Number(process.env.MIN_HTML_BYTES ?? 2048),
  min_visible_text_chars: Number(process.env.MIN_VISIBLE_TEXT_CHARS ?? 600),
  min_main_content_chars: Number(process.env.MIN_MAIN_CONTENT_CHARS ?? 400),
};

// User agent rotator for enhanced anti-detection
const userAgentRotator = new UserAgentRotator('desktop', 5);

class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      if (nextResolve) {
        this.permits--;
        nextResolve();
      }
    }
  }

  getAvailablePermits(): number {
    return this.permits;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
const pageSemaphore = new Semaphore(MAX_CONCURRENT_PAGES);

const AD_SERVING_DOMAINS = [
  'doubleclick.net',
  'adservice.google.com',
  'googlesyndication.com',
  'googletagservices.com',
  'googletagmanager.com',
  'google-analytics.com',
  'adsystem.com',
  'adservice.com',
  'adnxs.com',
  'ads-twitter.com',
  'facebook.net',
  'fbcdn.net',
  'amazon-adsystem.com'
];

const stripText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const detectContentStatus = (html: string, status: number | null, finalUrl: string, title: string) => {
  const htmlBytes = Buffer.byteLength(html || '');
  const visibleText = stripText(html || '');
  const mainContentChars = visibleText.length;
  const signals: string[] = [];

  if (status && [403, 429].includes(status)) signals.push('status_blocked');
  if (html.includes('zse-ck') || html.includes('gee-test') || html.includes('captcha')) signals.push('challenge_script');
  if (title.includes('登录') || title.toLowerCase().includes('login')) signals.push('title_login');
  if (finalUrl && /login|signin/.test(finalUrl)) signals.push('redirect_to_login');
  if (htmlBytes < CONTENT_THRESHOLDS.min_html_bytes) signals.push('html_too_small');
  if (visibleText.length < CONTENT_THRESHOLDS.min_visible_text_chars) signals.push('text_too_small');
  if (mainContentChars < CONTENT_THRESHOLDS.min_main_content_chars) signals.push('main_content_small');

  let content_status: 'usable' | 'thin' | 'challenge' | 'login' | 'soft_block' = 'usable';
  if (signals.includes('title_login') || signals.includes('redirect_to_login')) {
    content_status = 'login';
  } else if (signals.includes('challenge_script') || signals.includes('status_blocked')) {
    content_status = 'challenge';
  } else if (
    signals.includes('html_too_small') ||
    signals.includes('text_too_small') ||
    signals.includes('main_content_small')
  ) {
    content_status = 'thin';
  }

  return {
    content_status,
    matched_signals: signals,
    quality: {
      htmlBytes,
      visibleTextChars: visibleText.length,
      mainContentChars,
    },
  };
};

const persistStorageState = async (context: BrowserContext | null, url: string | undefined) => {
  if (!context || !url || !ENABLE_STORAGE_CACHE) return;
  try {
    ensureStorageDir();
    const statePath = getStoragePathForUrl(url);
    await context.storageState({ path: statePath });
  } catch (err) {
    console.warn('Failed to persist storage state', err);
  }
};

interface UrlModel {
  url: string;
  wait_after_load?: number;
  timeout?: number;
  headers?: { [key: string]: string };
  check_selector?: string;
  skip_tls_verification?: boolean;
}

let browser: Browser;

const initializeBrowser = async () => {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
};

const createContext = async (skipTlsVerification: boolean = false, useEnhancedStealth: boolean = false, persistKey?: string) => {
  // Use realistic user agent from our custom module for better anti-detection
  const userAgent = useEnhancedStealth ? userAgentRotator.getNext() : new UserAgent().toString();
  const viewport = { width: 1280, height: 800 };

  const contextOptions: any = {
    userAgent,
    viewport,
    ignoreHTTPSErrors: skipTlsVerification,
  };

  if (ENABLE_STORAGE_CACHE && persistKey) {
    ensureStorageDir();
    const statePath = getStoragePathForUrl(persistKey);
    if (fs.existsSync(statePath)) {
      contextOptions.storageState = statePath;
    }
  }

  // Add extra headers for stealth mode
  if (useEnhancedStealth) {
    contextOptions.extraHTTPHeaders = getRealisticHeaders(userAgent);
  }

  if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
    contextOptions.proxy = {
      server: PROXY_SERVER,
      username: PROXY_USERNAME,
      password: PROXY_PASSWORD,
    };
  } else if (PROXY_SERVER) {
    contextOptions.proxy = {
      server: PROXY_SERVER,
    };
  }

  const newContext = await browser.newContext(contextOptions);

  if (BLOCK_MEDIA) {
    await newContext.route('**/*.{png,jpg,jpeg,gif,svg,mp3,mp4,avi,flac,ogg,wav,webm}', async (route: Route, request: PlaywrightRequest) => {
      await route.abort();
    });
  }

  // Intercept all requests to avoid loading ads
  await newContext.route('**/*', (route: Route, request: PlaywrightRequest) => {
    const requestUrl = new URL(request.url());
    const hostname = requestUrl.hostname;

    if (AD_SERVING_DOMAINS.some(domain => hostname.includes(domain))) {
      console.log(hostname);
      return route.abort();
    }
    return route.continue();
  });
  
  return newContext;
};

const shutdownBrowser = async () => {
  if (browser) {
    await browser.close();
  }
};

const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString);
    return true;
  } catch (_) {
    return false;
  }
};

type ScrapeResult = {
  content: string;
  status: number | null;
  headers: Record<string, string> | null;
  contentType?: string;
  renderStatus: 'loaded' | 'timeout' | 'nav_error';
  finalUrl: string;
  title: string;
  contentStatus: 'usable' | 'thin' | 'challenge' | 'login' | 'soft_block';
  evidence: {
    matched_signals: string[];
    quality: {
      htmlBytes: number;
      visibleTextChars: number;
      mainContentChars: number;
    };
  };
};

const scrapePage = async (page: Page, url: string, waitUntil: 'load' | 'networkidle', waitAfterLoad: number, timeout: number, checkSelector: string | undefined): Promise<ScrapeResult> => {
  console.log(`Navigating to ${url} with waitUntil: ${waitUntil} and timeout: ${timeout}ms`);
  let renderStatus: 'loaded' | 'timeout' | 'nav_error' = 'loaded';
  let response = null;

  try {
    response = await page.goto(url, { waitUntil, timeout });
  } catch (error) {
    if (error instanceof PlaywrightErrors.TimeoutError) {
      renderStatus = 'timeout';
    } else {
      renderStatus = 'nav_error';
    }
  }

  if (renderStatus === 'loaded' && waitAfterLoad > 0) {
    await page.waitForTimeout(waitAfterLoad);
  }

  if (renderStatus === 'loaded' && checkSelector) {
    try {
      await page.waitForSelector(checkSelector, { timeout });
    } catch (error) {
      renderStatus = 'nav_error';
    }
  }

  let headers = null, content = await page.content();
  let ct: string | undefined = undefined;
  if (response) {
    headers = await response.allHeaders();
    ct = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1];
    if (ct && (ct.toLowerCase().includes("application/json") || ct.toLowerCase().includes("text/plain"))) {
      content = (await response.body()).toString("utf8"); // TODO: determine real encoding
    }
  }

  const finalUrl = page.url();
  const title = await page.title();
  const contentSignals = detectContentStatus(content, response ? response.status() : null, finalUrl, title);

  return {
    content,
    status: response ? response.status() : null,
    headers,
    contentType: ct,
    renderStatus,
    finalUrl,
    title,
    contentStatus: contentSignals.content_status,
    evidence: {
      matched_signals: contentSignals.matched_signals,
      quality: contentSignals.quality,
    },
  };
};

app.get('/health', async (req: Request, res: Response) => {
  try {
    if (!browser) {
      await initializeBrowser();
    }
    
    const testContext = await createContext();
    const testPage = await testContext.newPage();
    await testPage.close();
    await testContext.close();
    
    res.status(200).json({ 
      status: 'healthy',
      maxConcurrentPages: MAX_CONCURRENT_PAGES,
      activePages: MAX_CONCURRENT_PAGES - pageSemaphore.getAvailablePermits()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

app.post('/scrape', async (req: Request, res: Response) => {
  const { url, wait_after_load = 0, timeout = 15000, headers, check_selector, skip_tls_verification = false }: UrlModel = req.body;

  console.log(`================= Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : 'None'}`);
  console.log(`Check Selector: ${check_selector ? check_selector : 'None'}`);
  console.log(`Skip TLS Verification: ${skip_tls_verification}`);
  console.log(`==================================================`);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!PROXY_SERVER) {
    console.warn('⚠️ WARNING: No proxy server provided. Your IP address may be blocked.');
  }

  if (!browser && !USE_STEALTH) {
    await initializeBrowser();
  }

  await pageSemaphore.acquire();
  
  let requestContext: BrowserContext | null = null;
  let page: Page | null = null;
  let stealthBrowser = null;

  try {
    let result: ScrapeResult;
    if (USE_STEALTH) {
      stealthBrowser = getStealthBrowser();
      if (!stealthBrowser) {
        const proxyConfig = PROXY_SERVER ? {
          server: PROXY_SERVER,
          username: PROXY_USERNAME || undefined,
          password: PROXY_PASSWORD || undefined,
        } : undefined;
        stealthBrowser = await initializeStealthBrowser({ proxy: proxyConfig });
      }
      const stealthResult = await scrapeWithStealth(stealthBrowser!, url, {
        waitAfterLoad: wait_after_load,
        timeout,
        headers,
        checkSelector: check_selector,
        skipTlsVerification: skip_tls_verification,
      });
      const signals = detectContentStatus(stealthResult.content, stealthResult.status, url, '');
      result = {
        content: stealthResult.content,
        status: stealthResult.status,
        headers: stealthResult.headers,
        contentType: stealthResult.contentType,
        renderStatus: 'loaded',
        finalUrl: url,
        title: '',
        contentStatus: signals.content_status,
        evidence: {
          matched_signals: signals.matched_signals,
          quality: signals.quality,
        },
      };
    } else {
      requestContext = await createContext(skip_tls_verification, false, url);
      page = await requestContext.newPage();

      if (headers) {
        await page.setExtraHTTPHeaders(headers);
      }

      result = await scrapePage(page, url, 'load', wait_after_load, timeout, check_selector);
    }
    
    const pageError = result.status !== 200 ? getError(result.status) : undefined;

    if (!pageError) {
      console.log(`✅ Scrape successful! (${USE_STEALTH ? 'Stealth' : 'Standard'})`);
    } else {
      console.log(`🚨 Scrape failed with status code: ${result.status} ${pageError}`);
    }

    res.json({
      content: result.content,
      pageStatusCode: result.status,
      contentType: result.contentType,
      render_status: result.renderStatus,
      content_status: result.contentStatus,
      evidence: result.evidence,
      ...(pageError && { pageError })
    });

  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the page.' });
  } finally {
    if (page) await page.close();
    if (requestContext) {
      await persistStorageState(requestContext, url);
      await requestContext.close();
    }
    pageSemaphore.release();
  }
});

// Stealth scraping endpoint using puppeteer-extra with stealth plugin
app.post('/scrape-stealth', async (req: Request, res: Response) => {
  const { url, wait_after_load = 0, timeout = 15000, headers, check_selector, skip_tls_verification = false }: UrlModel = req.body;

  console.log(`================= Stealth Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : 'None'}`);
  console.log(`Check Selector: ${check_selector ? check_selector : 'None'}`);
  console.log(`Skip TLS Verification: ${skip_tls_verification}`);
  console.log(`===========================================================`);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  await pageSemaphore.acquire();

  try {
    // Initialize stealth browser if not already done
    let stealthBrowser = getStealthBrowser();
    if (!stealthBrowser) {
      const proxyConfig = PROXY_SERVER ? {
        server: PROXY_SERVER,
        username: PROXY_USERNAME || undefined,
        password: PROXY_PASSWORD || undefined,
      } : undefined;
      
      stealthBrowser = await initializeStealthBrowser({ proxy: proxyConfig });
    }

    const result = await scrapeWithStealth(stealthBrowser!, url, {
      waitAfterLoad: wait_after_load,
      timeout,
      headers,
      checkSelector: check_selector,
      skipTlsVerification: skip_tls_verification,
    });

    const pageError = result.status !== 200 ? getError(result.status) : undefined;
    const contentSignals = detectContentStatus(result.content, result.status, url, '');

    if (!pageError) {
      console.log(`✅ Stealth scrape successful!`);
    } else {
      console.log(`🚨 Stealth scrape failed with status code: ${result.status} ${pageError}`);
    }

    res.json({
      content: result.content,
      pageStatusCode: result.status,
      contentType: result.contentType,
      render_status: 'loaded',
      content_status: contentSignals.content_status,
      evidence: {
        matched_signals: contentSignals.matched_signals,
        quality: contentSignals.quality,
      },
      ...(pageError && { pageError })
    });

  } catch (error) {
    console.error('Stealth scrape error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the page with stealth mode.' });
  } finally {
    pageSemaphore.release();
  }
});

// Enhanced scrape endpoint with optional stealth mode
app.post('/scrape-enhanced', async (req: Request, res: Response) => {
  const { 
    url, 
    wait_after_load = 0, 
    timeout = 15000, 
    headers, 
    check_selector, 
    skip_tls_verification = false,
    use_stealth = USE_STEALTH 
  }: UrlModel & { use_stealth?: boolean } = req.body;

  console.log(`================= Enhanced Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : 'None'}`);
  console.log(`Check Selector: ${check_selector ? check_selector : 'None'}`);
  console.log(`Skip TLS Verification: ${skip_tls_verification}`);
  console.log(`Use Stealth: ${use_stealth}`);
  console.log(`============================================================`);

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  await pageSemaphore.acquire();

  try {
    if (use_stealth) {
      // Use puppeteer-extra with stealth plugin
      let stealthBrowser = getStealthBrowser();
      if (!stealthBrowser) {
        const proxyConfig = PROXY_SERVER ? {
          server: PROXY_SERVER,
          username: PROXY_USERNAME || undefined,
          password: PROXY_PASSWORD || undefined,
        } : undefined;
        
        stealthBrowser = await initializeStealthBrowser({ proxy: proxyConfig });
      }

      const result = await scrapeWithStealth(stealthBrowser!, url, {
        waitAfterLoad: wait_after_load,
        timeout,
        headers,
        checkSelector: check_selector,
        skipTlsVerification: skip_tls_verification,
      });

      const pageError = result.status !== 200 ? getError(result.status) : undefined;
      const contentSignals = detectContentStatus(result.content, result.status, url, '');

      res.json({
        content: result.content,
        pageStatusCode: result.status,
        contentType: result.contentType,
        engine: 'stealth',
        render_status: 'loaded',
        content_status: contentSignals.content_status,
        evidence: {
          matched_signals: contentSignals.matched_signals,
          quality: contentSignals.quality,
        },
        ...(pageError && { pageError })
      });
    } else {
      // Use Playwright with enhanced stealth context
      if (!browser) {
        await initializeBrowser();
      }

      const requestContext = await createContext(skip_tls_verification, true, url);
      const page = await requestContext.newPage();

      try {
        if (headers) {
          await page.setExtraHTTPHeaders(headers);
        }

        const result = await scrapePage(page, url, 'load', wait_after_load, timeout, check_selector);
        const pageError = result.status !== 200 ? getError(result.status) : undefined;
        const contentSignals = detectContentStatus(result.content, result.status, result.finalUrl, result.title);

        res.json({
          content: result.content,
          pageStatusCode: result.status,
          contentType: result.contentType,
          engine: 'playwright-enhanced',
          render_status: result.renderStatus,
          content_status: result.contentStatus ?? contentSignals.content_status,
          evidence: result.evidence ?? {
            matched_signals: contentSignals.matched_signals,
            quality: contentSignals.quality,
          },
          ...(pageError && { pageError })
        });
      } finally {
        await page.close();
        await persistStorageState(requestContext, url);
        await requestContext.close();
      }
    }
  } catch (error) {
    console.error('Enhanced scrape error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the page.' });
  } finally {
    pageSemaphore.release();
  }
});

app.listen(port, async () => {
  if (USE_STEALTH) {
    const proxyConfig = PROXY_SERVER ? {
      server: PROXY_SERVER,
      username: PROXY_USERNAME || undefined,
      password: PROXY_PASSWORD || undefined,
    } : undefined;
    await initializeStealthBrowser({ proxy: proxyConfig });
  } else {
    await initializeBrowser();
  }
  
  console.log(`Server is running on port ${port}`);
  console.log(`Stealth mode default: ${USE_STEALTH ? 'enabled' : 'disabled'}`);
});

if (require.main === module) {
  process.on('SIGINT', async () => {
    await shutdownBrowser();
    await closeStealthBrowser();
    console.log('Browsers closed');
    process.exit(0);
  });
}
