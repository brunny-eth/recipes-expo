import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('auth-navigation');

export function AuthNavigationHandler() {
  const router = useRouter();
  const { onAuthNavigation } = useAuth();
  const { showSuccess } = useSuccessModal();
  const { showError } = useErrorModal();

  useEffect(() => {
    const unsubscribe = onAuthNavigation((event) => {
      logger.info('Handling auth navigation event', { 
        eventType: event.type, 
        userId: 'userId' in event ? event.userId : undefined 
      });

      switch (event.type) {
        case 'SIGNED_IN':
          logger.info('Navigating to main app after sign in', { userId: event.userId });
          
          // Check if user is new based on first_login_at metadata
          const isNewUser = !event.userMetadata?.first_login_at;
          
          if (isNewUser) {
            showSuccess(
              'Welcome to Meez!',
              'This is your first time here. Start exploring recipes and save your favorites!',
              4000 // Show for 4 seconds
            );
          } else {
            showSuccess(
              'Welcome back to Meez!',
              'Great to see you again. Your saved recipes are ready for you!',
              4000 // Show for 4 seconds
            );
          }
          
          // Delay navigation to allow modal to show
          setTimeout(() => {
            router.replace('/tabs');
          }, 500);
          break;
        
        case 'SIGNED_OUT':
          logger.info('User signed out, auth state change will trigger re-render');
          // No need to navigate - the auth state change will trigger RootLayoutNav to re-render
          // and show the LoginScreen component directly
          break;
        
        case 'AUTH_ERROR':
          logger.warn('Auth error occurred, staying on current screen', { error: event.error });
          showError(
            'Authentication Error',
            event.error || 'An unexpected authentication error occurred. Please try again.'
          );
          break;
        
        default:
          logger.warn('Unknown auth navigation event', { eventType: (event as any).type });
      }
    });

    return unsubscribe;
  }, [onAuthNavigation, router, showSuccess, showError]);

  // This component doesn't render anything
  return null;
} 