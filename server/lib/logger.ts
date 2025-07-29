import pino from 'pino';
import { Logtail } from '@logtail/node';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Initialize Logtail only in production
const logtail = isDevelopment ? null : new Logtail(process.env.LOGTAIL_TOKEN!);

const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Simple logger factory that adds scope
export const createLogger = (scope: string) => {
  return {
    info: (obj: any, msg?: string) => {
      if (typeof obj === 'string') {
        logger.info({ scope, msg: obj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.info(`[${scope}] ${obj}`);
        }
      } else {
        logger.info({ scope, ...obj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.info(msg || 'Info log', { scope, ...obj });
        }
      }
    },

    warn: (obj: any, msg?: string) => {
      if (typeof obj === 'string') {
        logger.warn({ scope, msg: obj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.warn(`[${scope}] ${obj}`);
        }
      } else {
        logger.warn({ scope, ...obj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.warn(msg || 'Warning log', { scope, ...obj });
        }
      }
    },

    error: (obj: any, msg?: string) => {
      if (typeof obj === 'string') {
        logger.error({ scope, msg: obj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.error(`[${scope}] ${obj}`);
        }
      } else {
        logger.error({ scope, ...obj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.error(msg || 'Error log', { scope, ...obj });
        }
      }
    },

    debug: (obj: any, msg?: string) => {
      if (typeof obj === 'string') {
        logger.debug({ scope, msg: obj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.debug(`[${scope}] ${obj}`);
        }
      } else {
        logger.debug({ scope, ...obj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.debug(msg || 'Debug log', { scope, ...obj });
        }
      }
    },
  };
};

export default logger; 