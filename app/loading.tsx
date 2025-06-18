import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingExperienceScreen from '@/components/loading/LoadingExperienceScreen';
import { SafeAreaView, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function LoadingRoute() {
  const router = useRouter();
  const { recipeInput, intent } = useLocalSearchParams<{ recipeInput?: string, intent?: 'fuzzy_match' | 'literal' }>();

  if (!recipeInput) {
    // This should ideally not happen if navigation is always correct
    console.error('[LoadingRoute] No recipe input provided.');
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <LoadingExperienceScreen
        recipeInput={recipeInput}
        intent={intent || 'literal'}
        loadingMode="checklist"
        onComplete={() => {
          // Navigation is handled internally by LoadingExperienceScreen
          // This callback is for any cleanup if needed in the future
        }}
        onFailure={() => {
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