// app/loading.tsx
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingExperienceScreen from '@/components/loading/LoadingExperienceScreen';
import { SafeAreaView, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
// import { setHasUsedFreeRecipe } from '@/server/lib/freeUsageTracker'; // <-- REMOVE THIS IMPORT
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext'; // <-- NEW IMPORT

export default function LoadingRoute() {
  const router = useRouter();
  const { recipeInput } = useLocalSearchParams<{ recipeInput?: string }>();
  const { isAuthenticated } = useAuth();
  const { markFreeRecipeUsed } = useFreeUsage(); // <-- USE NEW HOOK

  if (!recipeInput) {
    console.error('[LoadingRoute] No recipe input provided.');
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <LoadingExperienceScreen
        recipeInput={recipeInput}
        loadingMode="checklist"
        onComplete={() => {
          console.log('[LoadingRoute] Recipe parsing complete callback.');
          if (!isAuthenticated) { 
            console.log('[LoadingRoute] User is NOT authenticated. Marking free recipe used via FreeUsageContext.');
            markFreeRecipeUsed(); // <-- CALL NEW CONTEXT FUNCTION
          } else {
            console.log('[LoadingRoute] User IS authenticated. No need to mark free recipe used.');
          }
        }}
        onFailure={() => {
          console.log('[LoadingRoute] Recipe parsing failed, navigating back.');
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});