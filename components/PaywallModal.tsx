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
      case 'olea.month':
        return 'Monthly Subscription';
      case 'olea.annual':
        return 'Annual Subscription';
      case 'olea.lifetime':
        return 'Lifetime Pass';
      default:
        return identifier;
    }
  };

  const getPackageButtonLabel = (identifier: string) => {
    switch (identifier) {
      case 'olea.month':
        return 'Start Free Trial';
      case 'olea.annual':
        return 'Start Free Trial';
      case 'olea.lifetime':
        return 'Buy Lifetime – One-Time Payment';
      default:
        return 'Subscribe';
    }
  };

  const getPackageDescription = (identifier: string) => {
    switch (identifier) {
      case 'olea.month':
        return 'Perfect for trying out premium features';
      case 'olea.annual':
        return 'Best value - save compared to monthly';
      case 'olea.lifetime':
        return 'One-time payment, premium forever';
      default:
        return '';
    }
  };

  if (!offerings?.current) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Premium Features</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Subscription products are being configured.{'\n'}
              Please check back after products are set up in RevenueCat.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

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
                Start your free trial with Olea today to transform your home cooking experience.
              </Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Premium features include:</Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>• Cook and shop for multiple recipes</Text>
              <Text style={styles.featureItem}>• Save your recipes and variations</Text>
              <Text style={styles.featureItem}>• Unlimited recipe storage in your library</Text>
            </View>
          </View>

          <View style={styles.packagesContainer}>
            {offerings.current.availablePackages.map((pkg: PurchasesPackage) => (
              <TouchableOpacity
                key={pkg.identifier}
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

                {pkg.identifier === 'olea.annual' && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>Save 17%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {selectedPackage && (
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                isPurchaseInProgress && styles.purchaseButtonDisabled,
              ]}
              onPress={() => handlePurchase(selectedPackage)}
              disabled={isPurchaseInProgress}
            >
              <Text style={styles.purchaseButtonText}>
                {isPurchaseInProgress
                  ? 'Processing...'
                  : getPackageButtonLabel(selectedPackage.identifier)
                }
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.disclaimer}>
            Payment will be charged to your Apple/Google account at confirmation of purchase.
            Subscription automatically renews unless auto-renew is turned off at least 24 hours
            before the end of the current period. Account will be charged for renewal within 24
            hours prior to the end of the current period.
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
