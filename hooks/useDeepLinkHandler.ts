import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { logger } from '@/utils/logger';

export interface DeepLinkParams {
  type: 'recipe' | 'folder';
  slug: string;
}

export function useDeepLinkHandler(canNavigate: boolean) {
  const router = useRouter();
  const pendingLink = useRef<DeepLinkParams | null>(null);

  // Ref so handleDeepLink can always read the latest value without
  // being re-created (which would re-subscribe the Linking listener)
  const canNavigateRef = useRef(canNavigate);
  canNavigateRef.current = canNavigate;

  const parseDeepLink = useCallback((url: string): DeepLinkParams | null => {
    console.log('[DeepLinkHandler] Parsing URL:', url);

    try {
      let pathname = '';

      if (url.startsWith('olea://')) {
        pathname = url.replace('olea://', '');
      } else if (url.includes('cookolea.com')) {
        const urlObj = new URL(url);
        pathname = urlObj.pathname;
      } else {
        console.log('[DeepLinkHandler] URL does not match expected patterns');
        return null;
      }

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

  const navigate = useCallback((parsed: DeepLinkParams) => {
    console.log('[DeepLinkHandler] Navigating:', parsed);
    try {
      if (parsed.type === 'recipe') {
        router.push({
          pathname: '/recipe/summary',
          params: {
            slug: parsed.slug,
            entryPoint: 'deep-link',
          },
        });
      } else if (parsed.type === 'folder') {
        router.push({
          pathname: '/tabs/library',
          params: {
            slug: parsed.slug,
            tab: 'saved',
          },
        });
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error navigating:', error);
      logger.error('Deep link navigation error', {
        scope: 'deep-link',
        error: error instanceof Error ? error.message : String(error),
        parsed,
      });
    }
  }, [router]);

  // Once the app signals it's ready to navigate, flush any buffered link
  useEffect(() => {
    if (canNavigate && pendingLink.current) {
      navigate(pendingLink.current);
      pendingLink.current = null;
    }
  }, [canNavigate, navigate]);

  const handleDeepLink = useCallback((url: string) => {
    const parsed = parseDeepLink(url);
    if (!parsed) {
      console.log('[DeepLinkHandler] Could not parse deep link, ignoring');
      return;
    }

    console.log('[DeepLinkHandler] Handling deep link:', parsed);

    if (!canNavigateRef.current) {
      // App not ready yet — buffer and navigate once canNavigate flips true
      console.log('[DeepLinkHandler] App not ready, buffering:', parsed);
      pendingLink.current = parsed;
      return;
    }

    navigate(parsed);
  }, [parseDeepLink, navigate]);

  useEffect(() => {
    // Cold launch: check if app was opened via deep link
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        console.log('[DeepLinkHandler] Initial URL detected:', initialUrl);
        handleDeepLink(initialUrl);
      }
    }).catch((error) => {
      console.error('[DeepLinkHandler] Error getting initial URL:', error);
    });

    // Warm launch: app already running when link is tapped
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
