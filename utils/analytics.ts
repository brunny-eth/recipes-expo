import { usePostHog } from 'posthog-react-native';

// Note: This function should be used within React components that have PostHog context
export const useAnalytics = () => {
  const posthog = usePostHog();
  
  const track = async (
    event: string,
    props: Record<string, any> = {}
  ) => {
    posthog?.capture(event, props);
  };

  return { track };
}; 