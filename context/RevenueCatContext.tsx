import React, { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren } from 'react';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { useErrorModal } from './ErrorModalContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('paywall');

interface RevenueCatContextType {
  // State
  isPremium: boolean;
  isLoading: boolean;
  offerings: any;
  isPurchaseInProgress: boolean;
  subscriptionStatus: string;
  customerInfo: CustomerInfo | null;

  // Actions
  checkEntitlements: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  unlockApp: () => void;
  showPaywall: () => void;
  
  // TESTING: Manual toggle for testing (remove this in production)
  togglePremiumStatus: () => void;
  manualPremiumToggle: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

// Global flag to ensure SDK is only initialized once across the entire app
let globalSdkInitialized = false;

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  const { showError } = useErrorModal();

  // APPLE REVIEW BYPASS: Skip RevenueCat entirely for App Store review builds
  const bypassRevenueCat = process.env.EXPO_PUBLIC_BYPASS_REVENUECAT === 'true';
  
  // SIMPLIFIED: forceEnablePaywall only for dev/testing to force show paywall even without offerings
  // In production builds, Purchases.configure() always runs and paywall logic is always enabled
  const forceEnablePaywall = process.env.NODE_ENV === 'development' && process.env.EXPO_PUBLIC_ENABLE_PAYWALL === "true";
  const isProductionBuild = process.env.NODE_ENV !== 'development';
  
  // Manual premium toggle for testing (starts as false for real paywall testing)
  const [manualPremiumToggle, setManualPremiumToggle] = useState(false);
  
  console.log('🔍 [RevenueCat] Paywall configuration:', {
    forceEnablePaywall,
    envValue: process.env.EXPO_PUBLIC_ENABLE_PAYWALL,
    nodeEnv: process.env.NODE_ENV,
    isProductionBuild,
    bypassRevenueCat
  });
  
  // Force visible log for debugging
  console.warn('🚨 REVENUECAT DEBUG - Force paywall (dev only):', forceEnablePaywall, 'isPremium:', !forceEnablePaywall, 'isProductionBuild:', isProductionBuild, 'bypassRevenueCat:', bypassRevenueCat);

  // State
  const [isPremium, setIsPremium] = useState(bypassRevenueCat ? true : manualPremiumToggle); // Grant premium if bypassing
  const [isLoading, setIsLoading] = useState<boolean>(bypassRevenueCat ? false : true); // Skip loading if bypassing
  const [offerings, setOfferings] = useState<any>(null);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState<boolean>(bypassRevenueCat ? true : globalSdkInitialized);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>(bypassRevenueCat ? 'Apple Review Bypass' : 'Free');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Keep stable reference to showError
  const showErrorRef = React.useRef(showError);
  React.useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  // Helper function to determine subscription status from CustomerInfo
  const getSubscriptionStatus = useCallback((customerInfo: CustomerInfo | null): string => {
    if (!customerInfo || !forceEnablePaywall) {
      return 'Free';
    }

    // Check if user has premium access
    const hasPremiumAccess = customerInfo.entitlements.active?.["premium_access"];
    
    if (!hasPremiumAccess) {
      return 'Free';
    }

    // Get the premium access entitlement
    const premiumEntitlement = customerInfo.entitlements.all?.["premium_access"];
    
    if (!premiumEntitlement) {
      return 'Premium';
    }

    // Check if it's a trial period
    if (premiumEntitlement.periodType === 'trial') {
      return 'Free Trial';
    }

    // Check if it's an introductory period
    if (premiumEntitlement.periodType === 'intro') {
      return 'Introductory Period';
    }

    // Check if it's in grace period (billing issue)
    if (premiumEntitlement.willRenew === false && premiumEntitlement.expirationDate) {
      const expirationDate = new Date(premiumEntitlement.expirationDate);
      const now = new Date();
      if (expirationDate > now) {
        return 'Set to Cancel';
      }
    }

    // Check if subscription is cancelled but still active
    if (premiumEntitlement.willRenew === false) {
      return 'Cancelled';
    }

    // Check if it's expired
    if (premiumEntitlement.expirationDate) {
      const expirationDate = new Date(premiumEntitlement.expirationDate);
      const now = new Date();
      if (expirationDate <= now) {
        return 'Expired';
      }
    }

    // Default to active subscription
    return 'Subscribed';
  }, [forceEnablePaywall]);

  // Initialize RevenueCat SDK once globally
  // CRITICAL: Always initialize in App Store builds to prevent IAP rejection
  React.useEffect(() => {
    // APPLE REVIEW BYPASS: Skip RevenueCat initialization entirely
    if (bypassRevenueCat) {
      logger.info('[RevenueCat] BYPASSING RevenueCat for Apple Review - granting premium access');
      console.warn('🚨 APPLE REVIEW BYPASS ACTIVE - RevenueCat disabled, premium granted');
      return;
    }
    
    if (!globalSdkInitialized) {
      const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_KEY;
      console.log(`[RevenueCat] SDK configured with API key: ${revenueCatApiKey?.substring(0, 5) || 'none'}...`);
      logger.info('[RevenueCat] Initialization starting...', {
        hasApiKey: !!revenueCatApiKey,
        keyPrefix: revenueCatApiKey ? revenueCatApiKey.substring(0, 5) + '...' : 'none',
        keyStartsWithAppl: revenueCatApiKey?.startsWith('appl_'),
        forceEnablePaywall,
        isProductionBuild
      });
      
      if (revenueCatApiKey && revenueCatApiKey.startsWith('appl_')) {
        try {
          logger.info('[RevenueCat] Purchases.configure() called');
          Purchases.configure({ apiKey: revenueCatApiKey });
          logger.info('[RevenueCat] Purchases.configure() finished');
          
          // Enable debug logging for RevenueCat
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          logger.info('[RevenueCat] Debug logging enabled');
          
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
  }, [bypassRevenueCat]); // Add bypassRevenueCat dependency

  // Check user entitlements with defensive error handling
  const checkEntitlements = useCallback(async () => {
    logger.info('[RevenueCat] checkEntitlements called', {
      isAuthenticated,
      sdkInitialized,
      forceEnablePaywall,
      bypassRevenueCat,
      timestamp: new Date().toISOString()
    });

    // APPLE REVIEW BYPASS: Skip entitlements check entirely
    if (bypassRevenueCat) {
      logger.info('[RevenueCat] BYPASSING entitlements check for Apple Review');
      setIsPremium(true);
      setIsLoading(false);
      return;
    }

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

      // Get customer info from RevenueCat
      let customerInfo: CustomerInfo;
      try {
        customerInfo = await Purchases.getCustomerInfo();
        logger.info('[RevenueCat] Purchases.getCustomerInfo() succeeded');
        console.log('[RevenueCat] entitlements:', customerInfo.entitlements.active);
        console.log('[RevenueCat] raw entitlements', customerInfo.entitlements);
        console.log('[Paywall] shouldShow =', Object.keys(customerInfo.entitlements.active || {}).length === 0);

        // Store customer info and update subscription status
        setCustomerInfo(customerInfo);
        const status = getSubscriptionStatus(customerInfo);
        setSubscriptionStatus(status);
        logger.info('[RevenueCat] Subscription status updated:', { status });
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
      const hasActiveEntitlements = customerInfo.entitlements.active && Object.keys(customerInfo.entitlements.active).length > 0;
      
      console.warn('🚨 REVENUECAT ENTITLEMENTS CHECK:', {
        hasPremiumAccess,
        hasActiveEntitlements,
        activeEntitlements: customerInfo.entitlements.active,
        allEntitlements: customerInfo.entitlements
      });
      
      if (hasPremiumAccess) {
        console.log('[RevenueCat] entitlements updated');
        console.log('[paywall] user has premium');
        logger.info('[paywall] User has premium access - unlocking app');
        console.warn('🚨 CALLING UNLOCK APP');
        unlockApp();
      } else if (!hasActiveEntitlements) {
        logger.info('[paywall] No active entitlements - user will see friendly paywall', {
          reason: 'no_entitlements_available'
        });
        // Don't call showPaywall() - let PremiumGate handle friendly paywall
        setIsPremium(false);
      } else {
        logger.info('[paywall] User does not have premium access - showing paywall');
        console.warn('🚨 CALLING SHOW PAYWALL');
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
  }, [isAuthenticated, sdkInitialized, forceEnablePaywall, bypassRevenueCat, getSubscriptionStatus]); // Add bypassRevenueCat dependency

  // Fetch available offerings/products with defensive error handling
  const fetchOfferings = useCallback(async () => {

    // Don't fetch offerings until SDK is initialized
    if (!sdkInitialized) {
      logger.info('[paywall] Waiting for RevenueCat SDK initialization before fetching offerings');
      return;
    }

    let offeringsData;

    try {
      logger.info('[paywall] Fetching offerings');

      // Defensive check: Ensure Purchases is available
      if (!Purchases || typeof Purchases.getOfferings !== 'function') {
        logger.error('[paywall] Purchases SDK not available');
        setOfferings(null);
        return;
      }

      // Get offerings from RevenueCat
      try {
        offeringsData = await Purchases.getOfferings();
        console.log('[paywall] offerings result', offeringsData);
      } catch (apiError: any) {
        logger.error('[paywall] offerings fetch failed, continuing free mode', {
          error: apiError?.message || 'Unknown API error',
          code: apiError?.code,
          userInfo: apiError?.userInfo
        });

        // Don't show error modal for known setup issues - just log and continue
        const isSetupError = apiError?.message?.includes('no products registered') ||
                            apiError?.message?.includes('Invalid API Key') ||
                            apiError?.message?.includes('credentials issue') ||
                            apiError?.message?.includes('OfferingsManager.Error 1') ||
                            apiError?.code === 0; // Network/configuration issues

        if (isSetupError) {
          logger.info('[paywall] Offerings unavailable, skipping paywall - continuing free mode', {
            errorType: 'setup_error',
            error: apiError?.message
          });
        } else {
          logger.warn('[paywall] Offerings fetch failed with unexpected error, continuing free mode', {
            error: apiError?.message
          });
        }

        setOfferings(null);
        return;
      }

      // Validate the response structure
      if (!offeringsData || typeof offeringsData !== 'object') {
        logger.error('[paywall] Invalid offerings response structure', { offeringsData });
        setOfferings(null);
        return;
      }

      if (offeringsData.current) {
        logger.info('[paywall] Offerings loaded successfully', {
          availablePackages: offeringsData.current.availablePackages?.length || 0
        });
        setOfferings(offeringsData);
      } else {
        logger.info('[paywall] Offerings unavailable, skipping paywall - continuing free mode', {
          reason: 'no_current_offerings'
        });
        setOfferings(null);
      }

    } catch (unexpectedError: any) {
      // Catch any completely unexpected errors
      logger.error('[paywall] Unexpected error in fetchOfferings, continuing free mode', {
        error: unexpectedError?.message || 'Unknown error',
        stack: unexpectedError?.stack
      });

      // Don't crash the app - just set offerings to null and continue
      setOfferings(null);
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

      // Purchase the package
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
        console.log('[RevenueCat] entitlements updated');
        console.log('[paywall] user has premium');
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

      // Restore purchases
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
        console.log('[RevenueCat] entitlements updated');
        console.log('[paywall] user has premium');
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
    console.warn('🚨 UNLOCK APP CALLED - setting isPremium to true');
    setIsPremium(true);
    setManualPremiumToggle(true);
  }, []);

  // Show paywall (revoke premium access)
  const showPaywall = useCallback(() => {
    logger.info('[RevenueCat] showPaywall called - premium access revoked', {
      timestamp: new Date().toISOString()
    });
    console.warn('🚨 SHOW PAYWALL CALLED - setting isPremium to false');
    setIsPremium(false);
    setManualPremiumToggle(false);
    
    // Note: This function only sets the premium status to false
    // The actual paywall modal is controlled by individual components
    // and should only show as an overlay, never blocking navigation
  }, []);

  // TESTING: Manual toggle for testing selective paywall (remove this in production)
  const togglePremiumStatus = useCallback(() => {
    const newStatus = !manualPremiumToggle;
    setManualPremiumToggle(newStatus);
    setIsPremium(newStatus);
    console.warn('🚨 MANUAL TOGGLE - Premium status changed to:', newStatus);
  }, [manualPremiumToggle]);

  // Trigger checkEntitlements when SDK becomes ready
  useEffect(() => {
    if (sdkInitialized) {
      logger.info('[RevenueCat] SDK ready, now running checkEntitlements()');
      checkEntitlements();
    }
  }, [sdkInitialized, checkEntitlements]);

  // Check entitlements when auth state changes (but only if SDK is ready)
  // Add a small delay to ensure navigation happens first
  useEffect(() => {
    if (sdkInitialized && isAuthenticated) {
      logger.info('[paywall] Auth state changed, scheduling entitlements check', {
        isAuthenticated,
        sdkInitialized,
        timestamp: new Date().toISOString()
      });
      
      // Delay entitlements check to ensure navigation happens first
      const timeout = setTimeout(() => {
        logger.info('[paywall] Running delayed entitlements check after navigation', {
          timestamp: new Date().toISOString()
        });
        checkEntitlements();
      }, 1000); // 1 second delay to allow navigation to complete
      
      return () => clearTimeout(timeout);
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
    subscriptionStatus,
    customerInfo,
    checkEntitlements,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    unlockApp,
    showPaywall,
    // TESTING: Manual toggle for testing (remove this in production)
    togglePremiumStatus,
    manualPremiumToggle,
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
