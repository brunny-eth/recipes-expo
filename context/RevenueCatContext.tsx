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

// Global flag to ensure SDK is only initialized once across the entire app
let globalSdkInitialized = false;

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  const { showError } = useErrorModal();

  // State
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<any>(null);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(globalSdkInitialized);

  // Keep stable reference to showError
  const showErrorRef = React.useRef(showError);
  React.useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  // Initialize RevenueCat SDK once globally
  React.useEffect(() => {
    if (!globalSdkInitialized) {
      const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
      logger.info('[RevenueCat] Initialization starting...', {
        hasApiKey: !!revenueCatApiKey,
        keyPrefix: revenueCatApiKey ? revenueCatApiKey.substring(0, 5) + '...' : 'none',
        keyStartsWithAppl: revenueCatApiKey?.startsWith('appl_')
      });
      
      if (revenueCatApiKey && revenueCatApiKey.startsWith('appl_')) {
        try {
          logger.info('[RevenueCat] Starting Purchases.configure()');
          Purchases.configure({ apiKey: revenueCatApiKey });
          logger.info('[RevenueCat] Purchases.configure() finished');
          globalSdkInitialized = true;
          setSdkInitialized(true);
          logger.info('[RevenueCat] SDK initialized successfully');
        } catch (error) {
          logger.error('[RevenueCat] Failed to initialize SDK:', error as any);
          setSdkInitialized(false);
        }
      } else {
        logger.error('[RevenueCat] Missing or invalid API key', {
          hasKey: !!revenueCatApiKey,
          keyValue: revenueCatApiKey || 'undefined'
        });
        setSdkInitialized(false);
      }
    } else {
      // SDK already initialized globally, just update local state
      setSdkInitialized(true);
    }
  }, []);

  // Check user entitlements with defensive error handling
  const checkEntitlements = useCallback(async () => {
    logger.info('[RevenueCat] checkEntitlements called', {
      isAuthenticated,
      sdkInitialized,
      timestamp: new Date().toISOString()
    });

    if (!isAuthenticated) {
      logger.info('[RevenueCat] User not authenticated, skipping entitlements check');
      setIsPremium(false);
      setIsLoading(false);
      return;
    }

    // Don't check entitlements until SDK is initialized
    if (!sdkInitialized) {
      logger.info('[RevenueCat] Waiting for RevenueCat SDK initialization before checking entitlements');
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

      logger.info('[RevenueCat] About to call Purchases.getCustomerInfo()');

      // Wrap the actual customer info call
      let customerInfo: CustomerInfo;
      try {
        customerInfo = await Purchases.getCustomerInfo();
        logger.info('[RevenueCat] Purchases.getCustomerInfo() succeeded');
        console.log('[RevenueCat] entitlements:', customerInfo.entitlements.active);
        console.log('[RevenueCat] raw entitlements', customerInfo.entitlements);
        console.log('[Paywall] shouldShow =', Object.keys(customerInfo.entitlements.active || {}).length === 0);
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
      const hasPremiumAccess = customerInfo.entitlements.active?.["premium_access"];
      console.log('[RevenueCat] hasPremiumAccess:', hasPremiumAccess);
      
      if (hasPremiumAccess) {
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
  }, [isAuthenticated, sdkInitialized]); // Remove showError from dependencies

  // Fetch available offerings/products with defensive error handling
  const fetchOfferings = useCallback(async () => {
    // Don't fetch offerings until SDK is initialized
    if (!sdkInitialized) {
      logger.info('Waiting for RevenueCat SDK initialization before fetching offerings');
      return;
    }

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
        console.log('[RevenueCat] offerings', offeringsData);
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
  }, [sdkInitialized]); // Remove showError from dependencies

  // Purchase a package with defensive error handling and debouncing
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    // Prevent concurrent purchases
    if (isPurchaseInProgress) {
      logger.warn('Purchase already in progress, ignoring duplicate request', { packageId: pkg?.identifier });
      return false;
    }

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
  }, [isPurchaseInProgress]); // Add isPurchaseInProgress to dependencies for debouncing

  // Restore purchases with defensive error handling and debouncing
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent restore operations
    if (isLoading) {
      logger.warn('Restore already in progress, ignoring duplicate request');
      return false;
    }

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
  }, [isLoading]); // Add isLoading to dependencies for debouncing

  // Unlock the app (grant premium access)
  const unlockApp = useCallback(() => {
    logger.info('Unlocking premium features');
    console.log('[RevenueCat] unlockApp() called - setting isPremium to true');
    setIsPremium(true);
  }, []);

  // Show paywall (revoke premium access)
  const showPaywall = useCallback(() => {
    logger.info('Showing paywall - premium access revoked');
    console.log('[RevenueCat] showPaywall() called - setting isPremium to false');
    setIsPremium(false);
  }, []);

  // Trigger checkEntitlements when SDK becomes ready
  useEffect(() => {
    if (sdkInitialized) {
      logger.info('[RevenueCat] SDK ready, now running checkEntitlements()');
      checkEntitlements();
    }
  }, [sdkInitialized, checkEntitlements]);

  // Check entitlements when auth state changes (but only if SDK is ready)
  useEffect(() => {
    if (sdkInitialized) {
      logger.info('[RevenueCat] Auth state changed, checking entitlements', {
        isAuthenticated,
        sdkInitialized
      });
      checkEntitlements();
    }
  }, [isAuthenticated, sdkInitialized, checkEntitlements]);

  // Fetch offerings when SDK is ready
  useEffect(() => {
    if (sdkInitialized) {
      logger.info('[RevenueCat] SDK ready, fetching offerings');
      fetchOfferings();
    }
  }, [sdkInitialized, fetchOfferings]);

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
