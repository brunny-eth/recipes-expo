import React, { createContext, useContext, PropsWithChildren } from 'react';

// Stub interface - app is now completely free, all users have full access
interface RevenueCatContextType {
  // State - always premium for everyone
  isPremium: boolean;
  isLoading: boolean;
  offerings: null;
  isPurchaseInProgress: boolean;
  subscriptionStatus: string;
  customerInfo: null;

  // No-op actions
  checkEntitlements: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  unlockApp: () => void;
  showPaywall: () => void;
  togglePremiumStatus: () => void;
  manualPremiumToggle: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

/**
 * RevenueCat Provider - STUBBED OUT
 * App is now completely free. This provider only exists to prevent breaking changes
 * during the transition. All users are granted full access.
 */
export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  // Always grant full access - app is completely free
  const value: RevenueCatContextType = {
    isPremium: true,           // Everyone is premium
    isLoading: false,          // Never loading
    offerings: null,           // No offerings
    isPurchaseInProgress: false,
    subscriptionStatus: 'Free', // Everyone is on free tier with full access
    customerInfo: null,
    
    // All no-op functions
    checkEntitlements: async () => {},
    fetchOfferings: async () => {},
    purchasePackage: async () => false,
    restorePurchases: async () => false,
    unlockApp: () => {},
    showPaywall: () => {},
    togglePremiumStatus: () => {},
    manualPremiumToggle: false,
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
