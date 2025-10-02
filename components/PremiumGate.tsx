import React, { ReactNode, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRevenueCat } from '@/context/RevenueCatContext';
import PaywallModal from './PaywallModal';
import FriendlyPaywallModal from './FriendlyPaywallModal';
import { COLORS, SPACING } from '@/constants/theme';
import { bodyText } from '@/constants/typography';
import { createLogger } from '@/utils/logger';

const logger = createLogger('paywall');

interface PremiumGateProps {
  children: ReactNode;
}

/**
 * PremiumGate component that wraps premium features and shows a paywall when user doesn't have access
 * @param children - The premium content to show when user has access
 */
export default React.memo(function PremiumGate({ children }: PremiumGateProps) {
  const { isPremium, isLoading, offerings } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showFriendlyPaywall, setShowFriendlyPaywall] = useState(false);

  // SIMPLIFIED: forceEnablePaywall only for dev/testing to force show paywall even without offerings
  // In production builds, paywall logic is always enabled
  const forceEnablePaywall = process.env.NODE_ENV === 'development' && process.env.EXPO_PUBLIC_ENABLE_PAYWALL === "true";
  const isProductionBuild = process.env.NODE_ENV !== 'development';

  // CRITICAL: Only show paywall if BOTH conditions are met:
  // 1. User is not premium, AND
  // 2. Offerings exist (non-null)
  useEffect(() => {
    logger.info('[paywall] PremiumGate paywall logic check', {
      forceEnablePaywall,
      isLoading,
      isPremium,
      hasOfferings: !!offerings,
      timestamp: new Date().toISOString()
    });

    // In production builds, paywall logic is always enabled
    // In development, only show paywall if forceEnablePaywall is true OR user is not premium with valid offerings

    // Don't show paywall while loading
    if (isLoading) {
      logger.info('[paywall] Still loading, hiding paywall');
      setShowPaywall(false);
      return;
    }

    // Show paywall ONLY if user is not premium AND offerings exist
    if (!isPremium && offerings) {
      logger.info('[paywall] Paywall overlay shown - user not premium and offerings available', {
        hasOfferings: !!offerings,
        offeringsCount: offerings?.current?.availablePackages?.length || 0
      });
      setShowPaywall(true);
      setShowFriendlyPaywall(false);
    } else if (isPremium) {
      logger.info('[paywall] User is premium, hiding paywall');
      setShowPaywall(false);
      setShowFriendlyPaywall(false);
    } else if (!offerings) {
      logger.info('[paywall] Offerings unavailable, showing friendly paywall - continuing free mode', {
        reason: 'no_offerings'
      });
      setShowPaywall(false);
      setShowFriendlyPaywall(true);
    }
  }, [isPremium, isLoading, forceEnablePaywall, offerings]);

  // In production builds, always run paywall logic
  // In development, only run paywall logic if forceEnablePaywall is enabled
  if (!isProductionBuild && !forceEnablePaywall) {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show premium content if user has access
  if (isPremium) {
    return <>{children}</>;
  }

  // Show paywall if no premium access (blocks content until subscription)
  return (
    <>
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribed={() => setShowPaywall(false)}
      />
      <FriendlyPaywallModal
        visible={showFriendlyPaywall}
        onClose={() => setShowFriendlyPaywall(false)}
      />
      {/* Render children invisibly behind the paywall */}
      <View style={{ opacity: 0 }}>
        {children}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  loadingContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...bodyText,
    color: COLORS.textSubtle,
  },
});
