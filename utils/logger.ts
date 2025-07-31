// Simple structured logger for client-side
const isDevelopment = process.env.NODE_ENV === 'development';

class ClientLogger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(message: string, context: Record<string, any> = {}) {
    if (isDevelopment) {
      console.log(`[INFO][${this.scope}]`, message, { scope: this.scope, ...context });
    }
  }

  warn(message: string, context: Record<string, any> = {}) {
    if (isDevelopment) {
      console.warn(`[WARN][${this.scope}]`, message, { scope: this.scope, ...context });
    }
  }

  error(message: string, context: Record<string, any> = {}) {
    // Always log errors, even in production
    console.error(`[ERROR][${this.scope}]`, message, { scope: this.scope, ...context });
  }

  debug(message: string, context: Record<string, any> = {}) {
    if (isDevelopment) {
      console.debug(`[DEBUG][${this.scope}]`, message, { scope: this.scope, ...context });
    }
  }
}

// Factory function to create loggers
export const createLogger = (scope: string): ClientLogger => {
  return new ClientLogger(scope);
};

// Default logger for backward compatibility
export const logger = createLogger('client'); 