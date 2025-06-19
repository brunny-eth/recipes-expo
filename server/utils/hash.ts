import { createHash } from 'crypto';

/**
 * Generates a SHA256 hash for the given input string.
 * Useful for creating consistent cache keys for raw text.
 * @param input The string to hash.
 * @returns A SHA256 hash string (hexadecimal).
 */
export function generateCacheKeyHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
} 