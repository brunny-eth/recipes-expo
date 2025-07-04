/**
 * Normalizes a URL string to ensure consistent caching behavior.
 * Different URLs pointing to the same content should resolve to the same normalized form.
 * 
 * @param url The URL string to normalize
 * @returns The normalized URL string
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  let normalizedUrl = url.trim();
  
  // Handle protocol-relative URLs (starting with //)
  if (normalizedUrl.startsWith('//')) {
    normalizedUrl = 'https:' + normalizedUrl;
  }
  
  // Add https:// if no protocol is present
  if (!normalizedUrl.match(/^https?:\/\//i)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    
    // 1. Force lowercase for the hostname (domain part)
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // 2. Normalize protocol - prefer https over http when possible
    // Note: We keep the original protocol but ensure consistency
    urlObj.protocol = urlObj.protocol.toLowerCase();
    
    // 3. Remove fragment identifiers (hash)
    urlObj.hash = '';
    
    // 4. Remove common tracking/marketing query parameters
    const trackingParams = new Set([
      // UTM parameters
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
      // Google
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
      // General tracking
      'ref', 'referrer', 'source', 'campaign', 'medium',
      // Social media
      'igshid', 'twclid', 'li_fat_id',
      // Analytics
      '_ga', '_gl', '_ke', 'mc_cid', 'mc_eid',
      // Affiliate tracking
      'aff_id', 'affiliate_id', 'aff', 'tag',
      // Email tracking
      'email_id', 'email_campaign', 'email_source',
      // Other common tracking
      'pk_campaign', 'pk_kwd', 'pk_medium', 'pk_source',
      'hsCtaTracking', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver'
    ]);
    
    // Remove tracking parameters
    const searchParams = new URLSearchParams(urlObj.search);
    for (const param of Array.from(trackingParams)) {
      searchParams.delete(param);
    }
    
    // Sort remaining query parameters for consistency
    const sortedParams = new URLSearchParams();
    const paramKeys = Array.from(searchParams.keys()).sort();
    for (const key of paramKeys) {
      const values = searchParams.getAll(key);
      for (const value of values) {
        sortedParams.append(key, value);
      }
    }
    
    urlObj.search = sortedParams.toString();
    
    // 5. Strip trailing slashes from pathname (except for root)
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // 6. Remove default ports
    if ((urlObj.protocol === 'https:' && urlObj.port === '443') ||
        (urlObj.protocol === 'http:' && urlObj.port === '80')) {
      urlObj.port = '';
    }
    
    // 7. Remove 'www.' prefix for consistency (debatable choice, but helps with cache hits)
    if (urlObj.hostname.startsWith('www.')) {
      urlObj.hostname = urlObj.hostname.slice(4);
    }
    
    return urlObj.toString();
    
  } catch (error) {
    // If URL parsing fails, return the original URL with basic cleanup
    console.warn('URL normalization failed, returning cleaned input:', error);
    return normalizedUrl
      .replace(/#.*$/, '') // Remove fragment
      .replace(/\/$/, '') // Remove trailing slash
      .toLowerCase(); // Basic case normalization
  }
}

/**
 * Checks if two URLs are equivalent after normalization.
 * 
 * @param url1 First URL to compare
 * @param url2 Second URL to compare
 * @returns True if the URLs are equivalent after normalization
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  try {
    return normalizeUrl(url1) === normalizeUrl(url2);
  } catch {
    return false;
  }
}

/**
 * Creates a cache key from a URL by normalizing it.
 * This is a convenience function for cache key generation.
 * 
 * @param url The URL to create a cache key from
 * @returns The normalized URL suitable for use as a cache key
 */
export function createUrlCacheKey(url: string): string {
  return normalizeUrl(url);
} 