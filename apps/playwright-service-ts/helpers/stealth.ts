import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer-core';
import { chromium } from 'playwright';
import { getRealisticUserAgent, getRandomViewport } from './userAgent';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

export interface StealthBrowserOptions {
  headless?: boolean;
  executablePath?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  args?: string[];
}

export interface StealthPageOptions {
  userAgent?: string;
  viewport?: { width: number; height: number };
  skipTlsVerification?: boolean;
  headers?: Record<string, string>;
}

let stealthBrowser: Browser | null = null;

/**
 * Initialize the stealth browser with puppeteer-extra and stealth plugin
 */
export async function initializeStealthBrowser(options: StealthBrowserOptions = {}): Promise<Browser> {
  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1920,1080',
  ];

  const launchOptions: any = {
    headless: options.headless ?? true,
    args: [...defaultArgs, ...(options.args || [])],
    ignoreHTTPSErrors: true,
  };

  const resolvedExecutablePath =
    options.executablePath ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    chromium.executablePath();

  if (resolvedExecutablePath) {
    launchOptions.executablePath = resolvedExecutablePath;
  }

  if (options.proxy) {
    launchOptions.args.push(`--proxy-server=${options.proxy.server}`);
  }

  const browser = await puppeteer.launch(launchOptions) as unknown as Browser;
  stealthBrowser = browser;
  return browser;
}

/**
 * Get the stealth browser instance
 */
export function getStealthBrowser(): Browser | null {
  return stealthBrowser;
}

/**
 * Close the stealth browser
 */
export async function closeStealthBrowser(): Promise<void> {
  if (stealthBrowser) {
    await stealthBrowser.close();
    stealthBrowser = null;
  }
}

/**
 * Create a new stealth page with anti-detection measures
 */
export async function createStealthPage(
  browser: Browser,
  options: StealthPageOptions = {}
): Promise<Page> {
  const page = await browser.newPage();
  
  // Set realistic user agent
  const userAgent = options.userAgent || getRealisticUserAgent();
  await page.setUserAgent(userAgent);
  
  // Set viewport
  const viewport = options.viewport || getRandomViewport();
  await page.setViewport(viewport);
  
  // Set extra headers if provided
  if (options.headers) {
    await page.setExtraHTTPHeaders(options.headers);
  }

  // Override webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // Override plugins
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });
  });

  // Override languages
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'zh-CN', 'zh'],
    });
  });

  // Override platform
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });
  });

  // Mock permissions
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);
  });

  // Override hardware concurrency
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
  });

  // Override device memory
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
  });

  // Add WebGL vendor and renderer
  await page.evaluateOnNewDocument(() => {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.call(this, parameter);
    };
  });

  return page;
}

/**
 * Scrape a page with stealth mode
 */
export async function scrapeWithStealth(
  browser: Browser,
  url: string,
  options: {
    waitAfterLoad?: number;
    timeout?: number;
    headers?: Record<string, string>;
    checkSelector?: string;
    skipTlsVerification?: boolean;
  } = {}
): Promise<{
  content: string;
  status: number | null;
  headers: Record<string, string> | null;
  contentType?: string;
}> {
  const page = await createStealthPage(browser, {
    headers: options.headers,
    skipTlsVerification: options.skipTlsVerification,
  });

  try {
    const timeout = options.timeout || 30000;
    
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout,
    });

    if (options.waitAfterLoad && options.waitAfterLoad > 0) {
      await new Promise(resolve => setTimeout(resolve, options.waitAfterLoad));
    }

    if (options.checkSelector) {
      try {
        await page.waitForSelector(options.checkSelector, { timeout });
      } catch (error) {
        throw new Error('Required selector not found');
      }
    }

    const content = await page.content();
    const headers = response?.headers() || null;
    const contentType = headers?.['content-type'];

    return {
      content,
      status: response?.status() || null,
      headers,
      contentType,
    };
  } finally {
    await page.close();
  }
}
