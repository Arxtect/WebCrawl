import type {Elysia} from 'elysia';
import crypto from 'node:crypto';

import {logger} from '../lib/logger';
import {serializeError} from '../lib/serializeError';

export const requestLogger = (app: Elysia) =>
    app
        .derive(({request}) => {
          const requestId =
              request.headers.get('x-request-id') ?? crypto.randomUUID();
          return {requestId, requestStartMs: Date.now()};
        })
        .onAfterHandle(({request, set, requestId, requestStartMs}) => {
          const url = new URL(request.url);
          const status = Number(set.status ?? 200);
          const start = requestStartMs ?? Date.now();
          const payload = {
            requestId,
            method: request.method,
            path: url.pathname,
            status,
            durationMs: Date.now() - start,
          };

          if (status >= 500) {
            logger.error('request', payload);
            console.error('request', payload);
          } else if (status >= 400) {
            logger.warn('request', payload);
            console.warn('request', payload);
          } else {
            logger.info('request', payload);
            console.log('request', payload);
          }
        })
        .onError(({request, set, error, requestId, requestStartMs}) => {
          const url = new URL(request.url);
          const start = requestStartMs ?? Date.now();
          const payload = {
            requestId,
            method: request.method,
            path: url.pathname,
            status: Number(set.status ?? 500),
            durationMs: Date.now() - start,
            error: serializeError(error, {includeStack: true}),
          };
          logger.error('request_error', payload);
          console.error('request_error', payload);
        });
