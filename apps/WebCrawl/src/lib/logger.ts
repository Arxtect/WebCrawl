import * as winston from 'winston';

import {config} from '../config';

const logFormat = winston.format.printf(
    (info: any) =>
        `${info.timestamp} ${info.level} [${info.metadata.module ?? ''}:${
            info.metadata.method ?? ''}]: ${info.message} ${
            info.level.includes('error') || info.level.includes('warn') ?
                JSON.stringify(
                    info.metadata,
                    (_, value) => {
                      if (value instanceof Error) {
                        return {
                          ...value,
                          name: value.name,
                          message: value.message,
                          stack: value.stack,
                          cause: value.cause,
                        };
                      }
                      return value;
                    }) :
                ''}`,
);

export const logger = winston.createLogger({
  level: config.LOGGING_LEVEL?.toLowerCase() ?? 'info',
  transports: [
    new winston.transports.Console({
      stderrLevels: [],
      consoleWarnLevels: [],
      format: winston.format.combine(
          winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
          winston.format.metadata({
            fillExcept: ['message', 'level', 'timestamp'],
          }),
          winston.format.colorize(),
          logFormat,
          ),
    }),
  ],
});
