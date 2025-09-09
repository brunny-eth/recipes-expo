import pino from 'pino';
import { Logtail } from '@logtail/node';

// Logger interface with flexible method signatures
export interface Logger {
  info: (msgOrObj: string | Record<string, unknown>, msg?: string) => void;
  warn: (msgOrObj: string | Record<string, unknown>, msg?: string) => void;
  error: (msgOrObj: string | Record<string, unknown>, msg?: string) => void;
  debug: (msgOrObj: string | Record<string, unknown>, msg?: string) => void;
}

const isDevelopment = process.env.NODE_ENV !== 'production';

// Initialize Logtail only in production and only if token is available
const logtail = isDevelopment || !process.env.LOGTAIL_TOKEN ? null : new Logtail(process.env.LOGTAIL_TOKEN);

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

// Export the base Pino logger for use with pino-http
export const baseLogger = logger;

// Simple logger factory that adds scope
export const createLogger = (scope: string): Logger => {
  return {
    info: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
      if (typeof msgOrObj === 'string') {
        logger.info({ scope, msg: msgOrObj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.info(`[${scope}] ${msgOrObj}`);
        }
      } else {
        logger.info({ scope, ...msgOrObj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.info(msg || 'Info log', { scope, ...msgOrObj });
        }
      }
    },

    warn: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
      if (typeof msgOrObj === 'string') {
        logger.warn({ scope, msg: msgOrObj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.warn(`[${scope}] ${msgOrObj}`);
        }
      } else {
        logger.warn({ scope, ...msgOrObj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.warn(msg || 'Warning log', { scope, ...msgOrObj });
        }
      }
    },

    error: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
      if (typeof msgOrObj === 'string') {
        logger.error({ scope, msg: msgOrObj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.error(`[${scope}] ${msgOrObj}`);
        }
      } else {
        logger.error({ scope, ...msgOrObj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.error(msg || 'Error log', { scope, ...msgOrObj });
        }
      }
    },

    debug: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
      if (typeof msgOrObj === 'string') {
        logger.debug({ scope, msg: msgOrObj });
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.debug(`[${scope}] ${msgOrObj}`);
        }
      } else {
        logger.debug({ scope, ...msgOrObj }, msg);
        // Also send to Logtail in production
        if (!isDevelopment && logtail) {
          logtail.debug(msg || 'Debug log', { scope, ...msgOrObj });
        }
      }
    },
  };
};

// Create a default logger instance that matches the Logger interface
const defaultLogger: Logger = {
  info: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
    if (typeof msgOrObj === 'string') {
      logger.info({ msg: msgOrObj });
      if (!isDevelopment && logtail) {
        logtail.info(msgOrObj);
      }
    } else {
      logger.info(msgOrObj, msg);
      if (!isDevelopment && logtail) {
        logtail.info(msg || 'Info log', msgOrObj);
      }
    }
  },

  warn: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
    if (typeof msgOrObj === 'string') {
      logger.warn({ msg: msgOrObj });
      if (!isDevelopment && logtail) {
        logtail.warn(msgOrObj);
      }
    } else {
      logger.warn(msgOrObj, msg);
      if (!isDevelopment && logtail) {
        logtail.warn(msg || 'Warning log', msgOrObj);
      }
    }
  },

  error: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
    if (typeof msgOrObj === 'string') {
      logger.error({ msg: msgOrObj });
      if (!isDevelopment && logtail) {
        logtail.error(msgOrObj);
      }
    } else {
      logger.error(msgOrObj, msg);
      if (!isDevelopment && logtail) {
        logtail.error(msg || 'Error log', msgOrObj);
      }
    }
  },

  debug: (msgOrObj: string | Record<string, unknown>, msg?: string) => {
    if (typeof msgOrObj === 'string') {
      logger.debug({ msg: msgOrObj });
      if (!isDevelopment && logtail) {
        logtail.debug(msgOrObj);
      }
    } else {
      logger.debug(msgOrObj, msg);
      if (!isDevelopment && logtail) {
        logtail.debug(msg || 'Debug log', msgOrObj);
      }
    }
  },
};

export default defaultLogger; 