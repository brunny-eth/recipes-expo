import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';
import { createLogger } from '@/utils/logger';
import PaywallModal from '@/components/PaywallModal';

const logger = createLogger('auth-navigation');

export function AuthNavigationHandler() {
  const router = useRouter();
  const { onAuthNavigation, session } = useAuth();
  const { isPremium, isLoading: isRevenueCatLoading, checkEntitlements } = useRevenueCat();
  const { showSuccess } = useSuccessModal();
  const { showError } = useErrorModal();
  const handleError = useHandleError();
  const [showPaywall, setShowPaywall] = useState(false);

  // Check if paywall is enabled (use same logic as RevenueCatContext)
  const enablePaywall = process.env.EXPO_PUBLIC_ENABLE_PAYWALL === "true";
  
  // Enable paywall when environment variable is set
  const forceEnablePaywall = enablePaywall;
  
  console.log('🔍 [AuthNavigationHandler] Paywall configuration:', {
    enablePaywall,
    forceEnablePaywall,
    envValue: process.env.EXPO_PUBLIC_ENABLE_PAYWALL,
    isPremium,
    isRevenueCatLoading,
    hasSession: !!session
  });
  
  // Force visible log for debugging
  console.warn('🚨 AUTH NAV DEBUG - Paywall enabled:', forceEnablePaywall, 'isPremium:', isPremium, 'isLoading:', isRevenueCatLoading, 'hasSession:', !!session);

  // Don't automatically show paywall - let individual screens handle premium gating
  // The paywall should only appear when users try to access premium features
  useEffect(() => {
    console.warn('🚨 AUTH NAV useEffect triggered:', {
      forceEnablePaywall,
      isRevenueCatLoading,
      isPremium,
      showPaywall,
      hasSession: !!session
    });
    
    // Always hide paywall in AuthNavigationHandler - let screens handle their own premium gating
    console.log('[AuthNavigationHandler] Hiding paywall - screens will handle their own premium gating');
    setShowPaywall(false);
  }, [isPremium, isRevenueCatLoading, forceEnablePaywall, session]);

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
              'Welcome to Olea.',
              'Turn any recipe into your recipe.',
              4000 // Show for 4 seconds
            );
          } else {
            showSuccess(
              'Welcome back to Olea.',
              'Your recipes are ready for you.',
              4000 // Show for 4 seconds
            );
          }
          
          // Navigate directly to tabs after successful authentication
          // Individual screens will handle their own premium gating
          logger.info('User signed in successfully, navigating to tabs', { userId: event.userId });
          router.replace('/tabs');
          break;
        
        case 'SIGNED_OUT':
          logger.info('User signed out, auth state change will trigger re-render');
          // No need to navigate - the auth state change will trigger RootLayoutNav to re-render
          // and show the LoginScreen component directly
          break;
        
        case 'AUTH_ERROR':
          logger.warn('Auth error occurred, staying on current screen', { error: event.error });
          handleError('Authentication Error', event.error || 'An unexpected authentication error occurred. Please try again.');
          break;
        
        default:
          logger.warn('Unknown auth navigation event', { eventType: (event as any).type });
      }
    });

    return unsubscribe;
  }, [onAuthNavigation, router, showSuccess, showError, handleError, isPremium, isRevenueCatLoading, checkEntitlements]);

  const handlePaywallClose = () => {
    setShowPaywall(false);
    // Navigate to tabs even if user dismisses paywall
    router.replace('/tabs');
  };

  const handleSubscribed = () => {
    setShowPaywall(false);
    router.replace('/tabs');
  };

  return (
    <PaywallModal
      visible={showPaywall}
      onClose={handlePaywallClose}
      onSubscribed={handleSubscribed}
    />
  );
} 