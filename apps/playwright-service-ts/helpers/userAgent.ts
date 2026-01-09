/**
 * Real User-Agent module
 * Provides realistic browser fingerprints for web scraping
 */

// Common desktop user agents - updated for 2024/2025
const DESKTOP_USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

// Mobile user agents
const MOBILE_USER_AGENTS = [
  // Chrome on Android
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  
  // Safari on iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
];

// Common viewport sizes
const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
];

const MOBILE_VIEWPORTS = [
  { width: 375, height: 812 },  // iPhone X/XS/11 Pro
  { width: 414, height: 896 },  // iPhone XR/XS Max/11/11 Pro Max
  { width: 390, height: 844 },  // iPhone 12/13
  { width: 393, height: 852 },  // iPhone 14/15
  { width: 360, height: 800 },  // Common Android
  { width: 412, height: 915 },  // Pixel 6
];

/**
 * Get a random element from an array
 */
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a realistic desktop user agent
 */
export function getRealisticUserAgent(): string {
  return getRandomElement(DESKTOP_USER_AGENTS);
}

/**
 * Get a realistic mobile user agent
 */
export function getMobileUserAgent(): string {
  return getRandomElement(MOBILE_USER_AGENTS);
}

/**
 * Get a user agent based on device type
 */
export function getUserAgent(deviceType: 'desktop' | 'mobile' = 'desktop'): string {
  return deviceType === 'mobile' ? getMobileUserAgent() : getRealisticUserAgent();
}

/**
 * Get a random desktop viewport
 */
export function getRandomViewport(): { width: number; height: number } {
  return { ...getRandomElement(DESKTOP_VIEWPORTS) };
}

/**
 * Get a random mobile viewport
 */
export function getMobileViewport(): { width: number; height: number } {
  return { ...getRandomElement(MOBILE_VIEWPORTS) };
}

/**
 * Get viewport based on device type
 */
export function getViewport(deviceType: 'desktop' | 'mobile' = 'desktop'): { width: number; height: number } {
  return deviceType === 'mobile' ? getMobileViewport() : getRandomViewport();
}

/**
 * Get a complete browser profile with matching user agent and viewport
 */
export interface BrowserProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  platform: string;
  languages: string[];
  deviceType: 'desktop' | 'mobile';
}

export function getBrowserProfile(deviceType: 'desktop' | 'mobile' = 'desktop'): BrowserProfile {
  const userAgent = getUserAgent(deviceType);
  const viewport = getViewport(deviceType);
  
  let platform = 'Win32';
  if (userAgent.includes('Macintosh')) {
    platform = 'MacIntel';
  } else if (userAgent.includes('Linux')) {
    platform = 'Linux x86_64';
  } else if (userAgent.includes('iPhone')) {
    platform = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    platform = 'iPad';
  } else if (userAgent.includes('Android')) {
    platform = 'Linux armv8l';
  }
  
  return {
    userAgent,
    viewport,
    platform,
    languages: ['en-US', 'en', 'zh-CN', 'zh'],
    deviceType,
  };
}

/**
 * Get common HTTP headers that mimic a real browser
 */
export function getRealisticHeaders(userAgent?: string): Record<string, string> {
  return {
    'User-Agent': userAgent || getRealisticUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
}

/**
 * Rotate user agent to avoid detection
 */
export class UserAgentRotator {
  private agents: string[];
  private currentIndex: number = 0;
  private usageCount: number = 0;
  private rotateAfter: number;

  constructor(deviceType: 'desktop' | 'mobile' = 'desktop', rotateAfter: number = 10) {
    this.agents = deviceType === 'mobile' ? [...MOBILE_USER_AGENTS] : [...DESKTOP_USER_AGENTS];
    this.rotateAfter = rotateAfter;
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.agents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.agents[i], this.agents[j]] = [this.agents[j], this.agents[i]];
    }
  }

  getNext(): string {
    this.usageCount++;
    if (this.usageCount >= this.rotateAfter) {
      this.currentIndex = (this.currentIndex + 1) % this.agents.length;
      this.usageCount = 0;
    }
    return this.agents[this.currentIndex];
  }

  reset(): void {
    this.currentIndex = 0;
    this.usageCount = 0;
    this.shuffle();
  }
}
