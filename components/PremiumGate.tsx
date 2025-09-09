import React, { ReactNode, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRevenueCat } from '@/context/RevenueCatContext';
import PaywallModal from './PaywallModal';
import { COLORS, SPACING } from '@/constants/theme';
import { bodyText } from '@/constants/typography';

interface PremiumGateProps {
  children: ReactNode;
}

/**
 * PremiumGate component that wraps premium features and shows a paywall when user doesn't have access
 * @param children - The premium content to show when user has access
 */
export default React.memo(function PremiumGate({ children }: PremiumGateProps) {
  const { isPremium, isLoading } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);

  // Automatically show paywall when user doesn't have premium access
  useEffect(() => {
    if (!isLoading && !isPremium) {
      setShowPaywall(true);
    } else if (isPremium) {
      setShowPaywall(false);
    }
  }, [isPremium, isLoading]);

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
