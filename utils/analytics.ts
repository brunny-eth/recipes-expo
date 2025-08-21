import { usePostHog } from 'posthog-react-native';
import { User } from '@supabase/supabase-js';

// Note: This function should be used within React components that have PostHog context
export const useAnalytics = () => {
  const posthog = usePostHog();
  
  const track = async (
    event: string,
    props: Record<string, any> = {}
  ) => {
    if (!posthog) {
      console.log('[POSTHOG] PostHog not available, skipping event:', { event, props });
      return;
    }
    console.log('[POSTHOG] capture called with:', { event, props });
    posthog.capture(event, props);
  };

  const maybeIdentifyUser = (user: User | null) => {
    if (!posthog) {
      console.log('[POSTHOG] PostHog not initialized, skipping user identification');
      return;
    }

    if (!user?.id) {
      console.log('[POSTHOG] No user ID provided, skipping user identification');
      return;
    }

    // Check if user is already identified by comparing with current user
    const currentUser = posthog.getDistinctId();
    if (currentUser === user.id) {
      console.log('[POSTHOG] User already identified:', user.id);
      return;
    }

    console.log('[POSTHOG] Identifying user:', user.id);
    const identifyProps: Record<string, any> = {
      user_metadata: user.user_metadata,
    };
    
    if (user.email) {
      identifyProps.email = user.email;
    }
    
    posthog.identify(user.id, identifyProps);
  };

  const resetUser = () => {
    if (!posthog) {
      console.log('[POSTHOG] PostHog not initialized, skipping user reset');
      return;
    }

    console.log('[POSTHOG] Resetting user');
    posthog.reset();
  };

  return { track, maybeIdentifyUser, resetUser };
};

// Standalone helper function for use outside of React components
// This can be used in places where useAnalytics hook is not available
export const identifyUserIfNeeded = (posthog: any, user: User | null) => {
  if (!posthog) {
    console.log('[POSTHOG] PostHog not initialized, skipping user identification');
    return;
  }

  if (!user?.id) {
    console.log('[POSTHOG] No user ID provided, skipping user identification');
    return;
  }

  // Check if user is already identified by comparing with current user
  const currentUser = posthog.getDistinctId();
  if (currentUser === user.id) {
    console.log('[POSTHOG] User already identified:', user.id);
    return;
  }

  console.log('[POSTHOG] Identifying user:', user.id);
  const identifyProps: Record<string, any> = {
    user_metadata: user.user_metadata,
  };
  
  if (user.email) {
    identifyProps.email = user.email;
  }
  
  posthog.identify(user.id, identifyProps);
}; 