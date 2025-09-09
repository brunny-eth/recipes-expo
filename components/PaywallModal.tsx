import React, { useState } from 'react';
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

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}

export default function PaywallModal({ visible, onClose, onSubscribed }: PaywallModalProps) {
  const { offerings, purchasePackage, isPurchaseInProgress } = useRevenueCat();
  const { showSuccess } = useSuccessModal();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  const handlePurchase = async (pkg: PurchasesPackage) => {
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
        return 'Monthly';
      case 'olea.annual':
        return 'Annual';
      case 'olea.lifetime':
        return 'Lifetime';
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
          <Text style={styles.title}>Unlock Premium</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Welcome to Olea Premium</Text>
            <Text style={styles.heroSubtitle}>
              Transform your cooking with AI-powered recipes, smart timers, and unlimited access to premium features.
              Join thousands of home cooks who have discovered their perfect recipes with Olea's intelligent cooking assistant.
              Start your free trial today and experience the future of cooking.
            </Text>
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
                  <Text style={styles.packageName}>
                    {getPackageDisplayName(pkg.identifier)}
                  </Text>
                  <Text style={styles.packagePrice}>
                    {formatPrice(pkg.product.priceString)}
                  </Text>
                </View>

                <Text style={styles.packageDescription}>
                  {getPackageDescription(pkg.identifier)}
                </Text>

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

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Premium Features Include:</Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>• Unlimited recipe storage</Text>
              <Text style={styles.featureItem}>• Advanced cooking timers</Text>
              <Text style={styles.featureItem}>• Ingredient substitutions</Text>
              <Text style={styles.featureItem}>• Recipe variations</Text>
              <Text style={styles.featureItem}>• Priority support</Text>
            </View>
          </View>

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
    ...bodyText,
    color: COLORS.textSubtle,
    textAlign: 'center',
    lineHeight: 24,
  },
  packagesContainer: {
    marginBottom: SPACING.xl,
  },
  packageCard: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: COLORS.primary,
  },
  packageCardDisabled: {
    opacity: 0.6,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  packageName: {
    ...bodyStrongText,
    color: COLORS.textDark,
  },
  packagePrice: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 18,
  },
  packageDescription: {
    ...bodyText,
    color: COLORS.textSubtle,
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
    color: 'white',
    fontSize: 16,
  },
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  featuresTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
  },
  featuresList: {
    paddingLeft: SPACING.md,
  },
  featureItem: {
    ...bodyText,
    color: COLORS.textDark,
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
