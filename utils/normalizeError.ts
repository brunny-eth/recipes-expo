export function normalizeError(err: unknown): string {
  if (!err) return "An unknown error occurred.";

  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err);
      return parsed?.error || err;
    } catch {
      return err;
    }
  }

  if (typeof err === 'object') {
    if ('error' in err && typeof err.error === 'string') return err.error;
    if ('message' in err && typeof err.message === 'string') return err.message;
  }

  return "An unexpected error occurred.";
} 