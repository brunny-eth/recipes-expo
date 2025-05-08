import { generateCacheKeyHash } from '../hash';
import { createHash } from 'crypto';

describe('generateCacheKeyHash', () => {
  test('should generate a consistent SHA256 hash for a given input', () => {
    const input = 'My test recipe text';
    const expectedHash = createHash('sha256').update(input).digest('hex'); // Calculate expected hash
    
    expect(generateCacheKeyHash(input)).toBe(expectedHash);
    // Verify it's consistent by calling again
    expect(generateCacheKeyHash(input)).toBe(expectedHash); 
  });

  test('should generate a different hash for different input', () => {
    const input1 = 'Recipe A';
    const input2 = 'Recipe B';
    expect(generateCacheKeyHash(input1)).not.toBe(generateCacheKeyHash(input2));
  });

  test('should generate a consistent hash for an empty string', () => {
    const input = '';
    const expectedHash = createHash('sha256').update(input).digest('hex');
    expect(generateCacheKeyHash(input)).toBe(expectedHash);
  });

  test('should generate a hash of the expected length (SHA256 hex = 64 chars)', () => {
    const input = 'Some random text';
    const hash = generateCacheKeyHash(input);
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true); // Check if it contains only hex characters
  });
}); 