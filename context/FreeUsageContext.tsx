// context/FreeUsageContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    PropsWithChildren,
    useCallback,
  } from 'react';
  import { getHasUsedFreeRecipe, setHasUsedFreeRecipe as setFreeUsageInStorage, clearFreeRecipeFlag } from '@/server/lib/freeUsageTracker'; // Renamed import for clarity
  
  interface FreeUsageContextType {
    hasUsedFreeRecipe: boolean | null; // null for initial loading, true/false after check
    isLoadingFreeUsage: boolean;
    markFreeRecipeUsed: () => Promise<void>;
    resetFreeRecipeUsage: () => Promise<void>; // For development/testing
    refetchFreeUsage: () => Promise<void>; // To manually trigger a re-read
  }
  
  const FreeUsageContext = createContext<FreeUsageContextType | undefined>(undefined);
  
  export const FreeUsageProvider = ({ children }: PropsWithChildren) => {
    const [hasUsedFreeRecipe, setHasUsedFreeRecipeState] = useState<boolean | null>(null);
    const [isLoadingFreeUsage, setIsLoadingFreeUsage] = useState(true);
  
    const fetchFreeUsage = useCallback(async () => {
      setIsLoadingFreeUsage(true);
      try {
        const used = await getHasUsedFreeRecipe();
        console.log('[FreeUsageContext] IMMEDIATE FETCH: hasUsedFreeRecipe value is', used);
        setHasUsedFreeRecipeState(used);
      } catch (error) {
        console.error('[FreeUsageContext] Error fetching free usage:', error);
        setHasUsedFreeRecipeState(false); // Default to false on error to not block
      } finally {
        setIsLoadingFreeUsage(false);
      }
    }, []);
  
    useEffect(() => {
      fetchFreeUsage(); // Initial fetch on mount
    }, [fetchFreeUsage]);
  
    const markFreeRecipeUsed = useCallback(async () => {
      await setFreeUsageInStorage(); // Update AsyncStorage
      setHasUsedFreeRecipeState(true); // Update React state
      console.log('[FreeUsageContext] Free recipe marked as used in state and storage.');
    }, []);
  
    const resetFreeRecipeUsage = useCallback(async () => {
      await clearFreeRecipeFlag(); // Clear in AsyncStorage
      setHasUsedFreeRecipeState(false); // Update React state
      console.log('[FreeUsageContext] Free recipe usage reset in state and storage.');
      // Optionally, re-check current status if needed
      fetchFreeUsage();
    }, [fetchFreeUsage]);
  
    const refetchFreeUsage = useCallback(async () => {
      await fetchFreeUsage();
    }, [fetchFreeUsage]);
  
    const value = {
      hasUsedFreeRecipe,
      isLoadingFreeUsage,
      markFreeRecipeUsed,
      resetFreeRecipeUsage,
      refetchFreeUsage,
    };
  
    return (
      <FreeUsageContext.Provider value={value}>
        {children}
      </FreeUsageContext.Provider>
    );
  };
  
  export const useFreeUsage = () => {
    const context = useContext(FreeUsageContext);
    if (context === undefined) {
      throw new Error('useFreeUsage must be used within a FreeUsageProvider');
    }
    return context;
  };