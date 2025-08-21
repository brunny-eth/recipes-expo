import { getErrorMessage, getNetworkErrorMessage, getSubmissionErrorMessage } from './errorMessages';

export type AppErrorSeverity = 'info' | 'warn' | 'error' | 'critical';

export type AppErrorNormalized = {
  code: string; // Stable machine-readable code for analytics/i18n
  title: string; // Short, user-facing title (e.g., 'Network Error')
  message: string; // Clear, safe-to-show message
  severity: AppErrorSeverity;
  retryable?: boolean;
  requiresLogin?: boolean;
  requiresPermission?: 'camera' | 'photos' | 'notifications' | 'media' | 'documents';
};

export type NormalizeAppErrorOptions = {
  statusCode?: number;
  stage?: 'validation' | 'cache_check' | 'parsing' | 'navigation' | string; // reuse from submission
  context?: string; // e.g., 'url', 'image_upload', 'save_recipe'
};

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function extractMessageFromUnknown(error: unknown): string {
  if (!error) return 'An unknown error occurred.';
  if (isString(error)) {
    try {
      const parsed = JSON.parse(error);
      if (parsed && typeof parsed === 'object') {
        if ('error' in parsed) {
          const err = (parsed as any).error;
          if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            return err.message as string;
          }
          if (typeof err === 'string') return err;
        }
        if ('message' in parsed && typeof (parsed as any).message === 'string') {
          return (parsed as any).message as string;
        }
      }
      return error;
    } catch {
      return error;
    }
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message as string;
    }
  }
  return 'An unexpected error occurred.';
}

/**
 * Normalize arbitrary errors into a consistent, UI-friendly structure.
 * Uses existing helpers for copy mapping and augments with title/severity/codes.
 */
export function normalizeAppError(error: unknown, opts: NormalizeAppErrorOptions = {}): AppErrorNormalized {
  const rawMessage = extractMessageFromUnknown(error);
  const { statusCode, stage, context } = opts;

  // Context-first mapping for permissions (even if message doesn't include the word 'permission')
  if (context && /(camera|photo|photos|documents|media)/i.test(context)) {
    const requiresPermission: AppErrorNormalized['requiresPermission'] =
      /camera/i.test(context) ? 'camera'
      : /photo/i.test(context) ? 'photos'
      : /document/i.test(context) ? 'documents'
      : undefined;
    return {
      code: 'PERMISSION_REQUIRED',
      title: 'Permission Required',
      message: 'We need permission to continue. You can change this in Settings.',
      severity: 'warn',
      retryable: false,
      requiresPermission,
    };
  }

  // Permission errors
  if (/(permission|denied|PermissionsAndroid|User did not grant)/i.test(rawMessage)) {
    // Heuristic mapping to permission type by context
    const requiresPermission: AppErrorNormalized['requiresPermission'] =
      context?.includes('camera') ? 'camera'
      : context?.includes('photo') ? 'photos'
      : context?.includes('document') ? 'documents'
      : undefined;
    return {
      code: 'PERMISSION_REQUIRED',
      title: 'Permission Required',
      message: 'We need permission to continue. You can change this in Settings.',
      severity: 'warn',
      retryable: false,
      requiresPermission,
    };
  }

  // Auth-required errors
  if (/(auth|unauthorized|forbidden|login required|not logged in|session)/i.test(rawMessage)) {
    return {
      code: 'AUTH_REQUIRED',
      title: 'Authentication Required',
      message: 'You need to be logged in to continue.',
      severity: 'warn',
      retryable: false,
      requiresLogin: true,
    };
  }

  // Network and HTTP errors
  if (/network|Failed to fetch|Network request failed|ERR_NETWORK|timeout/i.test(rawMessage) || typeof statusCode === 'number') {
    const message = getNetworkErrorMessage(rawMessage, statusCode);
    return {
      code: statusCode ? `HTTP_${statusCode}` : 'NETWORK_ERROR',
      title: 'Network Error',
      message,
      severity: statusCode && statusCode >= 500 ? 'error' : 'warn',
      retryable: true,
    };
  }

  // Submission stages (reuse your helper)
  if (stage) {
    const message = getSubmissionErrorMessage(stage, rawMessage);
    return {
      code: `SUBMISSION_${String(stage).toUpperCase()}`,
      title: 'Submission Error',
      message,
      severity: 'error',
      retryable: true,
    };
  }

  // Parsing / input mapping using context
  if (context === 'url' || context === 'text') {
    // Use your parse error mapping if the message hints at parse/validation
    const parseMessage = getErrorMessage(
      // Fallback to default branch inside getErrorMessage
      // @ts-expect-error: allow passing unknown for default mapping
      undefined,
      context,
    );
    return {
      code: 'PARSING_ERROR',
      title: 'Invalid Input',
      message: parseMessage,
      severity: 'warn',
      retryable: true,
    };
  }

  // Mise recipe conflict
  if (/already in your mise en place|Recipe already in mise/i.test(rawMessage)) {
    return {
      code: 'MISE_RECIPE_EXISTS',
      title: 'Oops',
      message: rawMessage,
      severity: 'info',
      retryable: false,
    };
  }

  // Limits / validation cues
  if (/limit|too many|exceeded|only.*ingredients|validation/i.test(rawMessage)) {
    return {
      code: 'VALIDATION_ERROR',
      title: 'Validation Error',
      message: rawMessage,
      severity: 'warn',
      retryable: false,
    };
  }

  // Default generic
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Something Went Wrong',
    message: rawMessage,
    severity: 'error',
    retryable: true,
  };
}

