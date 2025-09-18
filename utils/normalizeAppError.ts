import { getErrorMessage, getNetworkErrorMessage, getSubmissionErrorMessage } from './errorMessages';
import { ParseErrorCode } from '../common/types/errors';

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

  // Network and HTTP errors (but not backend parsing failures)
  if (/network|Failed to fetch|Network request failed|ERR_NETWORK|timeout/i.test(rawMessage) || typeof statusCode === 'number') {
    const message = getNetworkErrorMessage(rawMessage, statusCode);
    
    // Determine severity based on status code
    const severity: AppErrorSeverity = statusCode && statusCode >= 500 ? 'error' : 'warn';
    
    return {
      code: statusCode ? `HTTP_${statusCode}` : 'NETWORK_ERROR',
      title: 'Network Error',
      message,
      severity,
      retryable: true,
    };
  }

  // Submission stages (reuse your helper)
  if (stage) {
    const message = getSubmissionErrorMessage(stage, rawMessage, context);
    
    // Set severity based on stage
    let severity: AppErrorSeverity = 'error';
    let retryable = true;
    
    if (stage === 'validation' || stage === 'parsing') {
      severity = 'warn'; // Input validation issues are warnings
      retryable = false; // User needs to fix input first
    } else if (stage === 'cache_check' || stage === 'analytics_tracking') {
      severity = 'info'; // Non-critical issues
      retryable = true;
    }
    
    return {
      code: `SUBMISSION_${String(stage).toUpperCase()}`,
      title: 'Submission Error',
      message,
      severity,
      retryable,
    };
  }

  // Parsing / input mapping using context
  if (context === 'url' || context === 'text' || context === 'image' || context === 'images' || context === 'raw_text') {
    // Try to detect the specific error type from the message
    let errorCode: ParseErrorCode;
    
    if (rawMessage.includes('invalid') || rawMessage.includes('not a valid') || rawMessage.includes('doesn\'t look like') || rawMessage.includes('Invalid input provided')) {
      errorCode = ParseErrorCode.INVALID_INPUT;
    } else if (rawMessage.includes('couldn\'t process') || rawMessage.includes('generation failed') || rawMessage.includes('couldn\'t understand') || rawMessage.includes('Could not process the input provided')) {
      errorCode = ParseErrorCode.GENERATION_FAILED;
    } else if (rawMessage.includes('empty') || rawMessage.includes('not enough details') || rawMessage.includes('couldn\'t find enough')) {
      errorCode = ParseErrorCode.GENERATION_EMPTY;
    } else if (rawMessage.includes('incomplete') || rawMessage.includes('validation failed') || rawMessage.includes('seems incomplete')) {
      errorCode = ParseErrorCode.FINAL_VALIDATION_FAILED;
    } else {
      // Default to INVALID_INPUT for parsing errors
      errorCode = ParseErrorCode.INVALID_INPUT;
    }
    
    const parseMessage = getErrorMessage(errorCode, context);
    
    // Set severity and retryable based on error type
    let severity: AppErrorSeverity = 'warn';
    let retryable = false;
    
    switch (errorCode) {
      case ParseErrorCode.INVALID_INPUT:
        severity = 'warn';
        retryable = false; // User needs to fix input
        break;
      case ParseErrorCode.GENERATION_FAILED:
        severity = 'error';
        retryable = true; // Can retry, might be temporary issue
        break;
      case ParseErrorCode.GENERATION_EMPTY:
      case ParseErrorCode.FINAL_VALIDATION_FAILED:
        severity = 'warn';
        retryable = true; // User can provide more detail and retry
        break;
      default:
        severity = 'warn';
        retryable = false;
    }
    
    return {
      code: 'PARSING_ERROR',
      title: 'Invalid Input',
      message: parseMessage,
      severity,
      retryable,
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

