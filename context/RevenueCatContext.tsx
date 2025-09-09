import React, { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren } from 'react';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { useErrorModal } from './ErrorModalContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('RevenueCat');

interface RevenueCatContextType {
  // State
  isPremium: boolean;
  isLoading: boolean;
  offerings: any;
  isPurchaseInProgress: boolean;

  // Actions
  checkEntitlements: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  unlockApp: () => void;
  showPaywall: () => void;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const renderCount = React.useRef(0);
  renderCount.current += 1;

  React.useEffect(() => {
    console.log(`🔄 RevenueCatProvider rendered (count: ${renderCount.current})`);
  });

  const { isAuthenticated } = useAuth();
  const { showError } = useErrorModal();

  // State
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<any>(null);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);

  // Keep stable reference to showError
  const showErrorRef = React.useRef(showError);
  React.useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  // Track if SDK has been initialized to prevent multiple initializations
  const sdkInitializedRef = React.useRef(false);

  // Initialize RevenueCat SDK once
  React.useEffect(() => {
    if (!sdkInitializedRef.current) {
      const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
      if (revenueCatApiKey && revenueCatApiKey.startsWith('appl_')) {
        try {
          Purchases.configure({ apiKey: revenueCatApiKey });
          sdkInitializedRef.current = true;
          logger.info('[RevenueCat] SDK initialized successfully');
        } catch (error) {
          logger.error('[RevenueCat] Failed to initialize SDK:', error as any);
        }
      } else {
        logger.warn('[RevenueCat] No valid API key found, SDK not initialized');
      }
    }
  }, []);

  // Check user entitlements with defensive error handling
  const checkEntitlements = useCallback(async () => {
    if (!isAuthenticated) {
      setIsPremium(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Defensive check: Ensure Purchases is available
      if (!Purchases || typeof Purchases.getCustomerInfo !== 'function') {
        logger.error('Purchases SDK not available for entitlement check');
        setIsPremium(false);
        setIsLoading(false);
        return;
      }

      logger.info('Checking user entitlements');

      // Wrap the actual customer info call
      let customerInfo: CustomerInfo;
      try {
        customerInfo = await Purchases.getCustomerInfo();
      } catch (entitlementError: any) {
        logger.error('Purchases.getCustomerInfo() failed', {
          error: entitlementError?.message || 'Unknown entitlement error',
          code: entitlementError?.code
        });

        // Don't show error modal for network/setup issues during initial load
        const isSetupError = entitlementError?.message?.includes('Invalid API Key') ||
                            entitlementError?.message?.includes('credentials issue') ||
                            entitlementError?.message?.includes('network') ||
                            entitlementError?.code === 0;

        if (!isSetupError) {
          showErrorRef.current('Subscription Error', 'Failed to verify your subscription status. Please try again.');
        }

        // Assume no premium access on error
        setIsPremium(false);
        setIsLoading(false);
        return;
      }

      // Validate customer info structure
      if (!customerInfo || !customerInfo.entitlements) {
        logger.error('Invalid customer info structure', { customerInfo });
        setIsPremium(false);
        setIsLoading(false);
        return;
      }

      // Check if user has premium access
      if (customerInfo.entitlements.active?.["premium_access"]) {
        logger.info('User has premium access - unlocking app');
        unlockApp();
      } else {
        logger.info('User does not have premium access - showing paywall');
        showPaywall();
      }

    } catch (unexpectedError: any) {
      // Catch any completely unexpected errors
      logger.error('Unexpected error in checkEntitlements', {
        error: unexpectedError?.message || 'Unknown error',
        stack: unexpectedError?.stack
      });

      // Assume no premium access on unexpected errors
      setIsPremium(false);

      showErrorRef.current(
        'Connection Error',
        'Unable to verify subscription status. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]); // Remove showError from dependencies

  // Fetch available offerings/products with defensive error handling
  const fetchOfferings = useCallback(async () => {
    let offeringsData;

    try {
      logger.info('Fetching offerings');

      // Defensive check: Ensure Purchases is available
      if (!Purchases || typeof Purchases.getOfferings !== 'function') {
        logger.error('Purchases SDK not available');
        setOfferings(null);
        return;
      }

      // Wrap the actual API call with try/catch
      try {
        offeringsData = await Purchases.getOfferings();
      } catch (apiError: any) {
        logger.error('Purchases.getOfferings() failed', {
          error: apiError?.message || 'Unknown API error',
          code: apiError?.code,
          userInfo: apiError?.userInfo
        });

        // Don't show error modal for known setup issues
        const isSetupError = apiError?.message?.includes('no products registered') ||
                            apiError?.message?.includes('Invalid API Key') ||
                            apiError?.message?.includes('credentials issue') ||
                            apiError?.code === 0; // Network/configuration issues

        if (!isSetupError) {
          showErrorRef.current(
            'Subscription Error',
            'Unable to load subscription options. Please check your connection and try again.'
          );
        }

        setOfferings(null);
        return;
      }

      // Validate the response structure
      if (!offeringsData || typeof offeringsData !== 'object') {
        logger.error('Invalid offerings response structure', { offeringsData });
        setOfferings(null);
        return;
      }

      if (offeringsData.current) {
        logger.info('Offerings loaded successfully', {
          availablePackages: offeringsData.current.availablePackages?.length || 0
        });
        setOfferings(offeringsData);
      } else {
        logger.warn('No current offerings available - this is normal during setup');
        setOfferings(null);
      }

    } catch (unexpectedError: any) {
      // Catch any completely unexpected errors
      logger.error('Unexpected error in fetchOfferings', {
        error: unexpectedError?.message || 'Unknown error',
        stack: unexpectedError?.stack
      });

      // Don't crash the app - just set offerings to null
      setOfferings(null);

      // Only show error modal for truly unexpected errors (not setup issues)
      if (!unexpectedError?.message?.includes('no products') &&
          !unexpectedError?.message?.includes('Invalid API') &&
          !unexpectedError?.message?.includes('credentials')) {
        showErrorRef.current(
          'Unexpected Error',
          'An unexpected error occurred while loading subscriptions. The app will continue to work normally.'
        );
      }
    }
  }, []); // Remove showError from dependencies

  // Purchase a package with defensive error handling
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsPurchaseInProgress(true);

      // Defensive validation
      if (!pkg || !pkg.identifier) {
        logger.error('Invalid package provided to purchasePackage', { pkg });
        showErrorRef.current('Purchase Error', 'Invalid subscription package. Please try again.');
        return false;
      }

      if (!Purchases || typeof Purchases.purchasePackage !== 'function') {
        logger.error('Purchases SDK not available for purchase');
        showErrorRef.current('Purchase Error', 'Subscription service is unavailable. Please try again later.');
        return false;
      }

      logger.info('Starting purchase', { packageId: pkg.identifier });

      // Wrap the actual purchase call
      let purchaseResult;
      try {
        purchaseResult = await Purchases.purchasePackage(pkg);
      } catch (purchaseError: any) {
        logger.error('Purchases.purchasePackage() failed', {
          error: purchaseError?.message || 'Unknown purchase error',
          code: purchaseError?.code,
          packageId: pkg.identifier
        });

        // Don't show error for user cancellations
        if (!purchaseError?.userCancelled) {
          const errorMessage = purchaseError?.message || 'Purchase failed. Please try again.';
          showErrorRef.current('Purchase Failed', errorMessage);
        }
        return false;
      }

      // Validate purchase result
      if (!purchaseResult || !purchaseResult.customerInfo) {
        logger.error('Invalid purchase result', { purchaseResult, packageId: pkg.identifier });
        showErrorRef.current('Purchase Error', 'Purchase completed but verification failed. Please contact support.');
        return false;
      }

      // Check if premium access was granted
      if (purchaseResult.customerInfo.entitlements?.active?.["premium_access"]) {
        logger.info('Purchase successful - unlocking app');
        unlockApp();
        return true;
      } else {
        logger.warn('Purchase completed but premium access not granted', {
          entitlements: purchaseResult.customerInfo.entitlements,
          packageId: pkg.identifier
        });
        showErrorRef.current('Purchase Issue', 'Purchase completed but premium access was not granted. Please contact support.');
        return false;
      }

    } catch (unexpectedError: any) {
      // Catch any completely unexpected errors
      logger.error('Unexpected error in purchasePackage', {
        error: unexpectedError?.message || 'Unknown error',
        stack: unexpectedError?.stack,
        packageId: pkg?.identifier
      });

      showErrorRef.current(
        'Unexpected Error',
        'An unexpected error occurred during purchase. Please try again or contact support.'
      );
      return false;
    } finally {
      setIsPurchaseInProgress(false);
    }
  }, []); // Remove showError from dependencies

  // Restore purchases with defensive error handling
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Defensive check: Ensure Purchases is available
      if (!Purchases || typeof Purchases.restorePurchases !== 'function') {
        logger.error('Purchases SDK not available for restore');
        showErrorRef.current('Restore Error', 'Subscription service is unavailable. Please try again later.');
        return false;
      }

      logger.info('Restoring purchases');

      // Wrap the actual restore call
      let customerInfo: CustomerInfo;
      try {
        customerInfo = await Purchases.restorePurchases();
      } catch (restoreError: any) {
        logger.error('Purchases.restorePurchases() failed', {
          error: restoreError?.message || 'Unknown restore error',
          code: restoreError?.code
        });

        const errorMessage = restoreError?.message || 'Failed to restore purchases. Please try again.';
        showErrorRef.current('Restore Failed', errorMessage);
        return false;
      }

      // Validate customer info structure
      if (!customerInfo || !customerInfo.entitlements) {
        logger.error('Invalid customer info returned from restore', { customerInfo });
        showErrorRef.current('Restore Error', 'Unable to verify restored purchases. Please try again.');
        return false;
      }

      // Check if premium access was restored
      if (customerInfo.entitlements.active?.["premium_access"]) {
        logger.info('Purchases restored successfully - unlocking app');
        unlockApp();
        return true;
      } else {
        logger.info('No active purchases found to restore');
        showErrorRef.current(
          'No Purchases Found',
          'No previous purchases were found to restore. If you believe this is an error, please contact support.'
        );
        return false;
      }

    } catch (unexpectedError: any) {
      // Catch any completely unexpected errors
      logger.error('Unexpected error in restorePurchases', {
        error: unexpectedError?.message || 'Unknown error',
        stack: unexpectedError?.stack
      });

      showErrorRef.current(
        'Unexpected Error',
        'An unexpected error occurred while restoring purchases. Please try again or contact support.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove showError from dependencies

  // Unlock the app (grant premium access)
  const unlockApp = useCallback(() => {
    logger.info('Unlocking premium features');
    setIsPremium(true);
  }, []);

  // Show paywall (revoke premium access)
  const showPaywall = useCallback(() => {
    logger.info('Showing paywall - premium access revoked');
    setIsPremium(false);
  }, []);

  // Check entitlements when auth state changes
  useEffect(() => {
    checkEntitlements();
  }, [checkEntitlements]);

  // Fetch offerings on mount
  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const value = {
    isPremium,
    isLoading,
    offerings,
    isPurchaseInProgress,
    checkEntitlements,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    unlockApp,
    showPaywall,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
};

export const useRevenueCat = () => {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
};
