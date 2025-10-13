import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';
import { createLogger } from '@/utils/logger';

const logger = createLogger('nav');

export function AuthNavigationHandler() {
  const router = useRouter();
  const segments = useSegments();
  const { onAuthNavigation, session } = useAuth();
  const { showSuccess } = useSuccessModal();
  const { showError } = useErrorModal();
  const handleError = useHandleError();
  const [navigationTimeout, setNavigationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Force navigation if user is stuck on login screen with valid session
  useEffect(() => {
    if (session && segments.join('/') === 'login') {
      const fallbackTimeout = setTimeout(() => {
        const currentPath = segments.join('/');
        logger.warn('🚨 FALLBACK NAVIGATION TRIGGERED - User stuck on login with valid session', {
          hasSession: !!session,
          currentPath,
          timestamp: new Date().toISOString()
        });
        console.warn('🚨 Forcing navigation from login to tabs');
        router.replace('/tabs');
      }, 3000); // 3 second fallback

      return () => clearTimeout(fallbackTimeout);
    }
  }, [session, segments, router]);

  useEffect(() => {
    const unsubscribe = onAuthNavigation((event) => {
      const userId = 'userId' in event ? event.userId : undefined;
      const userIdShort = userId ? `${userId.slice(0, 8)}...` : undefined;
      
      // Logging for debugging
      const debugState = {
        eventType: event.type,
        userId: userIdShort,
        hasSession: !!session,
        currentPath: segments.join('/'),
        timestamp: new Date().toISOString()
      };
      
      logger.info('[nav] Handling auth navigation event', debugState);

      switch (event.type) {
        case 'SIGNED_IN':
          logger.info('[nav] SIGNED_IN event fired - starting navigation flow', { 
            userId: userIdShort,
            timestamp: new Date().toISOString()
          });
          
          // Check if user is new based on first_login_at metadata
          const isNewUser = !event.userMetadata?.first_login_at;
          
          logger.info('[nav] User metadata check', {
            userId: userIdShort,
            isNewUser,
            hasFirstLoginAt: !!event.userMetadata?.first_login_at,
            timestamp: new Date().toISOString()
          });
          
          if (isNewUser) {
            logger.info('[nav] Showing welcome message for new user', {
              userId: userIdShort,
              timestamp: new Date().toISOString()
            });
            showSuccess(
              'Welcome to Olea.',
              'Turn any recipe into your recipe.',
              4000 // Show for 4 seconds
            );
          } else {
            logger.info('[nav] Showing welcome back message for returning user', {
              userId: userIdShort,
              timestamp: new Date().toISOString()
            });
            showSuccess(
              'Welcome back to Olea.',
              'Your recipes are ready for you.',
              4000 // Show for 4 seconds
            );
          }
          
          // Navigate directly to tabs after successful authentication
          const preNavigationState = {
            userId: userIdShort,
            currentPath: segments.join('/'),
            timestamp: new Date().toISOString()
          };
          
          logger.info('[nav] Navigating to /tabs after successful sign in', preNavigationState);
          
          // Set up a timeout to detect if navigation fails
          const timeout = setTimeout(() => {
            logger.error('[nav] Navigation timeout after auth - user may be stuck on login screen', {
              userId: userIdShort,
              timeoutMs: 5000,
              timestamp: new Date().toISOString()
            });
          }, 5000);
          
          setNavigationTimeout(timeout);
          router.replace('/tabs');
          
          // Log navigation completion attempt
          const postNavigationState = {
            userId: userIdShort,
            targetPath: '/tabs',
            fromPath: segments.join('/'),
            timestamp: new Date().toISOString()
          };
          
          logger.info('[nav] Navigation to /tabs triggered', postNavigationState);
          break;
        
        case 'SIGNED_OUT':
          logger.info('Auth:Navigation - User signed out, auth state change will trigger re-render', {
            userId: userIdShort,
            timestamp: new Date().toISOString()
          });
          // No need to navigate - the auth state change will trigger RootLayoutNav to re-render
          // and show the LoginScreen component directly
          break;
        
        case 'AUTH_ERROR':
          logger.warn('Auth:Navigation - Auth error occurred, staying on current screen', { 
            error: event.error,
            userId: userIdShort,
            timestamp: new Date().toISOString()
          });
          handleError('Authentication Error', event.error || 'An unexpected authentication error occurred. Please try again.');
          break;
        
        default:
          logger.warn('Auth:Navigation - Unknown auth navigation event', { 
            eventType: (event as any).type,
            userId: userIdShort,
            timestamp: new Date().toISOString()
          });
      }
    });

    return unsubscribe;
  }, [onAuthNavigation, router, showSuccess, showError, handleError]);

  // Cleanup navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        logger.info('[nav] Cleared navigation timeout on unmount');
      }
    };
  }, [navigationTimeout]);

  // Detect when navigation completes by monitoring session state
  useEffect(() => {
    if (session && navigationTimeout) {
      // Clear timeout when session is established (navigation likely completed)
      logger.info('[nav] Navigation completed - session established, clearing timeout', {
        userId: session.user.id ? `${session.user.id.slice(0, 8)}...` : null,
        timestamp: new Date().toISOString()
      });
      clearTimeout(navigationTimeout);
      setNavigationTimeout(null);
    }
  }, [session, navigationTimeout]);

  return null;
} 