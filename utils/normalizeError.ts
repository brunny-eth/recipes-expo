export function normalizeError(err: unknown): string {
  if (!err) {
    return "An unknown error occurred.";
  }

  // Handle strings (including stringified JSON)
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err);
      if (typeof parsed.error === 'object' && parsed.error !== null) {
        return parsed.error.message || JSON.stringify(parsed.error);
      }
      return parsed.error || parsed.message || err;
    } catch {
      // Not a JSON string, return as is
      return err;
    }
  }

  // Handle error objects
  if (err instanceof Error) {
    return err.message;
  }

  // Handle other objects
  if (typeof err === 'object' && err !== null) {
    if ('message' in err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
  }

  return "An unexpected error occurred.";
} 