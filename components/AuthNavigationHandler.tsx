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
          showSuccess(
            'Welcome to Meez!',
            'You have successfully signed in. Start exploring recipes!',
            4000 // Show for 4 seconds
          );
          router.replace('/tabs');
          break;
        
        case 'SIGNED_OUT':
          logger.info('Navigating to login after sign out');
          showSuccess(
            'Signed Out',
            'You have been successfully signed out.',
            3000 // Show for 3 seconds
          );
          router.replace('/login');
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
  }, [onAuthNavigation, router]);

  // This component doesn't render anything
  return null;
} 