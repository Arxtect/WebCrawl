import {Elysia} from 'elysia';
import {v7 as uuidv7} from 'uuid';

import {config} from './config';
import {scrapeURL} from './scraper/scrapeURL';
import {scrapeOptions} from './types';

const app =
    new Elysia()
        .get('/health', () => ({status: 'ok'}))
        .post(
            '/scrape',
            async ({body, set}) => {
              const url = (body as any)?.url;
              if (!url || typeof url !== 'string') {
                set.status = 400;
                return {success: false, error: 'Missing url'};
              }

              const {url: _url, ...options} = body as Record<string, unknown>;
              const parsed = scrapeOptions.safeParse(options);
              if (!parsed.success) {
                set.status = 400;
                return {
                  success: false,
                  error: 'Invalid request body',
                  details: parsed.error.flatten(),
                };
              }

              const result = await scrapeURL(uuidv7(), url, parsed.data, {
                teamId: 'self-hosted',
                teamFlags: {checkRobotsOnScrape: true},
              });

              if (!result.success) {
                set.status = 500;
              }

              return result;
            })
        .listen(config.PORT);

console.log(
    `WebCrawl listening at ${app.server?.hostname}:${app.server?.port}`,
);
