import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { logger } from '@/utils/logger';

export interface DeepLinkParams {
  type: 'recipe' | 'folder';
  slug: string;
}

export function useDeepLinkHandler() {
  const router = useRouter();

  const parseDeepLink = useCallback((url: string): DeepLinkParams | null => {
    console.log('[DeepLinkHandler] Parsing URL:', url);
    
    try {
      // Handle both custom scheme (olea://) and universal links (https://cookolea.com)
      let pathname = '';
      
      if (url.startsWith('olea://')) {
        // Custom scheme: olea://r/abc123xyz or olea://f/abc123xyz
        pathname = url.replace('olea://', '');
      } else if (url.includes('cookolea.com')) {
        // Universal link: https://cookolea.com/r/abc123xyz or https://cookolea.com/f/abc123xyz
        const urlObj = new URL(url);
        pathname = urlObj.pathname;
      } else {
        console.log('[DeepLinkHandler] URL does not match expected patterns');
        return null;
      }

      // Parse pathname to extract type and slug
      const pathParts = pathname.split('/').filter(Boolean);
      
      if (pathParts.length !== 2) {
        console.log('[DeepLinkHandler] Invalid path format:', pathParts);
        return null;
      }

      const [type, slug] = pathParts;
      
      if (type === 'r' && slug) {
        console.log('[DeepLinkHandler] Parsed recipe deep link:', { slug });
        return { type: 'recipe', slug };
      } else if (type === 'f' && slug) {
        console.log('[DeepLinkHandler] Parsed folder deep link:', { slug });
        return { type: 'folder', slug };
      } else {
        console.log('[DeepLinkHandler] Invalid type or missing slug:', { type, slug });
        return null;
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error parsing URL:', error);
      logger.error('Deep link parsing error', {
        scope: 'deep-link',
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      return null;
    }
  }, []);

  const handleDeepLink = useCallback(async (url: string) => {
    const parsed = parseDeepLink(url);
    
    if (!parsed) {
      console.log('[DeepLinkHandler] Could not parse deep link, ignoring');
      return;
    }

    console.log('[DeepLinkHandler] Handling deep link:', parsed);

    try {
      if (parsed.type === 'recipe') {
        // Navigate to recipe summary with slug parameter
        router.push({
          pathname: '/recipe/summary',
          params: { 
            slug: parsed.slug,
            entryPoint: 'deep-link'
          }
        });
      } else if (parsed.type === 'folder') {
        // Navigate to library with slug parameter
        router.push({
          pathname: '/tabs/library',
          params: { 
            slug: parsed.slug,
            tab: 'saved'
          }
        });
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error handling deep link:', error);
      logger.error('Deep link handling error', {
        scope: 'deep-link',
        error: error instanceof Error ? error.message : String(error),
        parsed,
      });
    }
  }, [parseDeepLink, router]);

  useEffect(() => {
    // Handle initial URL (when app is opened via deep link)
    const getInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('[DeepLinkHandler] Initial URL detected:', initialUrl);
          await handleDeepLink(initialUrl);
        }
      } catch (error) {
        console.error('[DeepLinkHandler] Error getting initial URL:', error);
      }
    };

    getInitialURL();

    // Handle subsequent URLs (when app is already running)
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[DeepLinkHandler] URL event received:', event.url);
      handleDeepLink(event.url);
    });

    return () => {
      subscription?.remove();
    };
  }, [handleDeepLink]);

  return {
    parseDeepLink,
    handleDeepLink,
  };
}
