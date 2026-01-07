import robotsParser, {Robot} from 'robots-parser';
import {Logger} from 'winston';

import {getSecureDispatcher} from '../scraper/scrapeURL/engines/utils/safeFetch';

interface RobotsTxtChecker {
  robotsTxtUrl: string;
  robotsTxt: string;
  robots: Robot;
}

export async function fetchRobotsTxt(
    {
      url,
      zeroDataRetention,
    }: {url: string; zeroDataRetention: boolean;},
    scrapeId: string,
    logger: Logger,
    abort?: AbortSignal,
    ): Promise<{content: string; url: string}> {
  const urlObj = new URL(url);
  const robotsTxtUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  try {
    const response = await fetch(robotsTxtUrl, {
      dispatcher: getSecureDispatcher(false),
      signal: abort,
    } as any);
    if (response.status === 404) {
      logger.warn('Robots.txt not found', {robotsTxtUrl});
      return {content: '', url: robotsTxtUrl};
    }
    const content = await response.text();
    return {
      content,
      url: response.url || robotsTxtUrl,
    };
  } catch (error) {
    logger.warn('Failed to fetch robots.txt, allowing scrape', {
      error,
      robotsTxtUrl,
      scrapeId,
      zeroDataRetention,
    });
    return {content: '', url: robotsTxtUrl};
  }
}

export function createRobotsChecker(
    url: string,
    robotsTxt: string,
    ): RobotsTxtChecker {
  const urlObj = new URL(url);
  const robotsTxtUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  const robots = robotsParser(robotsTxtUrl, robotsTxt);
  return {
    robotsTxtUrl,
    robotsTxt,
    robots,
  };
}

export function isUrlAllowedByRobots(
    url: string,
    robots: Robot|null,
    userAgents: string[] = ['FireCrawlAgent', 'FirecrawlAgent'],
    ): boolean {
  if (!robots) return true;

  for (const userAgent of userAgents) {
    let isAllowed = robots.isAllowed(url, userAgent);

    // Handle null/undefined responses - default to true (allowed)
    if (isAllowed === null || isAllowed === undefined) {
      isAllowed = true;
    }

    if (isAllowed == null) {
      isAllowed = true;
    }

    // Also check with trailing slash if URL doesn't have one
    // This catches cases like "Disallow: /path/" when user requests "/path"
    if (isAllowed && !url.endsWith('/')) {
      const urlWithSlash = url + '/';
      let isAllowedWithSlash = robots.isAllowed(urlWithSlash, userAgent);

      if (isAllowedWithSlash == null) {
        isAllowedWithSlash = true;
      }

      // If the trailing slash version is explicitly disallowed, block it
      if (isAllowedWithSlash === false) {
        isAllowed = false;
      }
    }

    if (isAllowed) {
      //   console.log("isAllowed: true, " + userAgent);
      return true;
    }
  }

  return false;
}
