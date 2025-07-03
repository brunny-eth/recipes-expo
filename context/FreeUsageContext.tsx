// context/FreeUsageContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  getHasUsedFreeRecipe,
  setHasUsedFreeRecipe as setFreeUsageInStorage,
  clearFreeRecipeFlag,
} from '@/server/lib/freeUsageTracker'; // Renamed import for clarity
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

interface FreeUsageContextType {
  hasUsedFreeRecipe: boolean | null; // null for initial loading, true/false after check
  isLoadingFreeUsage: boolean;
  markFreeRecipeUsed: () => Promise<void>;
  resetFreeRecipeUsage: () => Promise<void>; // For development/testing
  refetchFreeUsage: () => Promise<void>; // To manually trigger a re-read
}

const FreeUsageContext = createContext<FreeUsageContextType | undefined>(
  undefined,
);

export const FreeUsageProvider = ({ children }: PropsWithChildren) => {
  const [hasUsedFreeRecipe, setHasUsedFreeRecipeState] = useState<
    boolean | null
  >(null);
  const [isLoadingFreeUsage, setIsLoadingFreeUsage] = useState(true);

  const fetchFreeUsage = useCallback(async () => {
    // Add granular logging for useCallback recreation
    console.log('[FreeUsageContext] fetchFreeUsage useCallback recreated. Empty dependencies array - should be stable.');
    
    console.log('[FreeUsageContext] State update: setIsLoadingFreeUsage(true)');
    setIsLoadingFreeUsage(true);
    try {
      const used = await getHasUsedFreeRecipe();
      console.log(
        '[FreeUsageContext] IMMEDIATE FETCH: hasUsedFreeRecipe value is',
        used,
      );
      console.log('[FreeUsageContext] State update: setHasUsedFreeRecipeState(' + used + ')');
      setHasUsedFreeRecipeState(used);
    } catch (error) {
      console.error('[FreeUsageContext] Error fetching free usage:', error);
      console.log('[FreeUsageContext] State update: setHasUsedFreeRecipeState(false) - error fallback');
      setHasUsedFreeRecipeState(false); // Default to false on error to not block
    } finally {
      console.log('[FreeUsageContext] State update: setIsLoadingFreeUsage(false)');
      setIsLoadingFreeUsage(false);
    }
  }, []); // Empty dependency array - function is now truly stable

  useEffect(() => {
    fetchFreeUsage(); // Initial fetch on mount
  }, [fetchFreeUsage]);

  const markFreeRecipeUsed = useCallback(async () => {
    // Add granular logging for useCallback recreation
    console.log('[FreeUsageContext] markFreeRecipeUsed useCallback recreated. Empty dependencies array - should be stable.');
    
    await setFreeUsageInStorage(); // Update AsyncStorage
    console.log('[FreeUsageContext] State update: setHasUsedFreeRecipeState(true)');
    setHasUsedFreeRecipeState(true); // Update React state
    console.log(
      '[FreeUsageContext] Free recipe marked as used in state and storage.',
    );
  }, []); // Empty dependency array - function is now truly stable

  const resetFreeRecipeUsage = useCallback(async () => {
    // Add granular logging for useCallback recreation
    console.log('[FreeUsageContext] resetFreeRecipeUsage useCallback recreated. Empty dependencies array - should be stable.');
    
    console.log(
      '[FreeUsageContext] Attempting to reset free recipe usage locally and in Supabase.',
    );

    // Update Supabase metadata
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.auth.updateUser({
        data: { has_used_free_recipe: false },
      });
      if (error) {
        console.error(
          '[FreeUsageContext] Error updating user metadata on Supabase:',
          error.message,
        );
      } else {
        console.log(
          '[FreeUsageContext] Successfully reset has_used_free_recipe in Supabase user_metadata.',
        );
      }
    } else {
      console.warn(
        '[FreeUsageContext] No user session found. Skipping Supabase metadata update.',
      );
    }

    await clearFreeRecipeFlag(); // Clear in AsyncStorage
    console.log('[FreeUsageContext] State update: setHasUsedFreeRecipeState(false)');
    setHasUsedFreeRecipeState(false); // Update React state
    console.log(
      '[FreeUsageContext] Free recipe usage reset in state and storage.',
    );
  }, []); // Empty dependency array - function is now truly stable

  const refetchFreeUsage = useCallback(async () => {
    // Add granular logging for useCallback recreation
    console.log('[FreeUsageContext] refetchFreeUsage useCallback recreated. Dependencies:', {
      fetchFreeUsageDep: fetchFreeUsage,
    });
    
    await fetchFreeUsage();
  }, [fetchFreeUsage]); // Only depend on fetchFreeUsage, which is now stable

  const value = useMemo(() => {
    // Strategic logging: Track when useMemo recalculates
    console.log('[FreeUsageContext] 🔄 useMemo RECALCULATING. Dependencies changed:', {
      'hasUsedFreeRecipe': hasUsedFreeRecipe,
      'isLoadingFreeUsage': isLoadingFreeUsage,
      'markFreeRecipeUsed reference': markFreeRecipeUsed,
      'resetFreeRecipeUsage reference': resetFreeRecipeUsage,
      'refetchFreeUsage reference': refetchFreeUsage,
    });

    const contextValue = {
      hasUsedFreeRecipe,
      isLoadingFreeUsage,
      markFreeRecipeUsed,
      resetFreeRecipeUsage,
      refetchFreeUsage,
    };

    // Log the final value object reference
    console.log('[FreeUsageContext] 📦 Provider value object created:', {
      reference: contextValue,
      hasUsedFreeRecipe: contextValue.hasUsedFreeRecipe,
      isLoadingFreeUsage: contextValue.isLoadingFreeUsage,
    });

    return contextValue;
  }, [hasUsedFreeRecipe, isLoadingFreeUsage, markFreeRecipeUsed, resetFreeRecipeUsage, refetchFreeUsage]);

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
