import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, sectionHeaderText, bodyText } from '@/constants/typography';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useAnalytics } from '@/utils/analytics';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}

export default function PaywallModal({ visible, onClose, onSubscribed }: PaywallModalProps) {
  const { offerings, purchasePackage, isPurchaseInProgress } = useRevenueCat();
  const { showSuccess } = useSuccessModal();
  const { track } = useAnalytics();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  // Track paywall_viewed when modal becomes visible
  useEffect(() => {
    if (visible) {
      track('paywall_viewed', { context: 'premium_gate' });
    }
  }, [visible, track]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    // Prevent multiple rapid button presses
    if (isPurchaseInProgress) {
      return;
    }

    setSelectedPackage(pkg);

    const success = await purchasePackage(pkg);

    if (success) {
      showSuccess('Welcome to Premium!', 'Enjoy all premium features with your subscription.');
      onSubscribed();
      onClose();
    }

    setSelectedPackage(null);
  };


  const formatPrice = (priceString: string) => {
    return priceString;
  };

  const getPackageDisplayName = (identifier: string) => {
    switch (identifier) {
      case 'olea.monthly3':
      case 'olea.month':
      case '$rc_monthly':
        return 'Monthly Subscription';
      case 'olea.lifetime15':
      case 'olea.lifetime':
      case '$rc_lifetime':
        return 'Lifetime Purchase';
      default:
        return identifier;
    }
  };

  const getPackageButtonLabel = (identifier: string) => {
    switch (identifier) {
      case 'olea.monthly3':
      case 'olea.month':
      case '$rc_monthly':
        return 'Start Free Trial';
      case 'olea.lifetime15':
      case 'olea.lifetime':
      case '$rc_lifetime':
        return 'Buy Lifetime';
      default:
        return 'Subscribe';
    }
  };

  const getPackageDescription = (identifier: string) => {
    switch (identifier) {
      case 'olea.monthly3':
      case 'olea.month':
      case '$rc_monthly':
        return 'Prefer a small, monthly payment? Pay $3 per month for access to Olea Premium.';
      case 'olea.lifetime15':
      case 'olea.lifetime':
      case '$rc_lifetime':
        return 'Hate subscriptions? Pay $15 today for lifetime access to Olea Premium.';
      default:
        return '';
    }
  };

  // TEMPORARY: Show custom paywall even without offerings for testing
  const mockOfferings = {
    current: {
      availablePackages: [
        {
          identifier: 'olea.lifetime15',
          product: { priceString: '$15.00' }
        },
        {
          identifier: 'olea.monthly3', 
          product: { priceString: '$3.00' }
        }
      ]
    }
  };

  // Use real offerings if available, otherwise use mock for testing
  const displayOfferings = offerings?.current ? offerings : mockOfferings;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Olea Premium</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <Text style={styles.heroSubtitle}>
              Sign up for Olea Premium to get your 1 month free trial started today. You will not be charged for either subscription option until your 1 month free trial is complete. You can always cancel before the free trial is complete.
            </Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Premium features include:</Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>• Cook and shop for multiple recipes</Text>
              <Text style={styles.featureItem}>• Save recipes into your library</Text>
              <Text style={styles.featureItem}>• Unlimited recipe storage</Text>
            </View>
          </View>

          <View style={styles.packagesContainer}>
            {displayOfferings.current.availablePackages
              .sort((a: PurchasesPackage, b: PurchasesPackage) => {
                // Sort lifetime first, then monthly
                if (a.identifier.includes('lifetime')) return -1;
                if (b.identifier.includes('lifetime')) return 1;
                return 0;
              })
              .map((pkg: PurchasesPackage) => (
                <View key={pkg.identifier}>
                  <TouchableOpacity
                    style={[
                      styles.packageCard,
                      selectedPackage?.identifier === pkg.identifier && styles.packageCardSelected,
                      isPurchaseInProgress && styles.packageCardDisabled,
                    ]}
                    onPress={() => setSelectedPackage(pkg)}
                    disabled={isPurchaseInProgress}
                  >
                    <View style={styles.packageHeader}>
                      <Text style={[
                        styles.packageName,
                        selectedPackage?.identifier === pkg.identifier && styles.packageTextSelected
                      ]}>
                        {getPackageDisplayName(pkg.identifier)}
                      </Text>
                      <Text style={[
                        styles.packagePrice,
                        selectedPackage?.identifier === pkg.identifier && styles.packageTextSelected
                      ]}>
                        {formatPrice(pkg.product.priceString)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  {selectedPackage?.identifier === pkg.identifier && (
                    <View style={styles.packageDescriptionContainer}>
                      <Text style={styles.packageDescriptionText}>
                        {getPackageDescription(pkg.identifier)}
                      </Text>
                      {/* Debug info - remove this later */}
                      {__DEV__ && (
                        <Text style={[styles.packageDescriptionText, { fontSize: 10, color: 'gray', marginTop: 5 }]}>
                          Debug: {pkg.identifier}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
          </View>

          {selectedPackage && (
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                isPurchaseInProgress && styles.purchaseButtonDisabled,
                !offerings?.current && styles.mockPurchaseButton, // Style for mock mode
              ]}
              onPress={() => {
                if (!offerings?.current) {
                  // Mock purchase for testing - just show success
                  showSuccess('Mock Purchase!', 'This is a demo of the paywall. RevenueCat products are not live yet.');
                  onSubscribed();
                  onClose();
                } else {
                  handlePurchase(selectedPackage);
                }
              }}
              disabled={isPurchaseInProgress}
            >
              <Text style={styles.purchaseButtonText}>
                {isPurchaseInProgress
                  ? 'Processing...'
                  : !offerings?.current 
                    ? 'Subscribe (Demo)'
                    : 'Subscribe'
                }
              </Text>
            </TouchableOpacity>
          )}


          <Text style={styles.disclaimer}>
            Payment will be charged to your account after your 1 month free trial is complete. Subscription automatically renews unless your plan is cancelled before the end of the current period. Lifetime subscriptions will be active for the entirety of the application's lifetime.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: COLORS.textDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...bodyText,
    color: COLORS.textDark,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  heroTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  heroSubtitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    textAlign: 'left',
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  italicText: {
    fontStyle: 'italic',
  },
  packagesContainer: {
    marginBottom: SPACING.xl,
  },
  packageCard: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    position: 'relative',
    minHeight: 48,
    justifyContent: 'center',
  },
  packageCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: '#000000',
    borderWidth: 1,
  },
  packageCardDisabled: {
    opacity: 0.6,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageName: {
    ...bodyStrongText,
    color: COLORS.textDark,
  },
  packagePrice: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 18,
  },
  packageDescription: {
    ...bodyText,
    color: COLORS.textSubtle,
  },
  packageDescriptionContainer: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.xs,
  },
  packageDescriptionText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 20,
  },
  packageTextSelected: {
    color: COLORS.textDark,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: SPACING.lg,
    backgroundColor: '#FF6B35',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  savingsText: {
    ...bodyStrongText,
    color: 'white',
    fontSize: 12,
  },
  purchaseButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  mockPurchaseButton: {
    backgroundColor: '#FF9500', // Orange color to indicate demo mode
    borderColor: '#FF7A00',
  },
  purchaseButtonText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 16,
  },
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  featuresTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.md,
  },
  featuresList: {
    paddingLeft: 0,
  },
  featureItem: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
  },
  disclaimer: {
    ...bodyText,
    color: COLORS.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
