// app/loading.tsx
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingExperienceScreen from '@/components/loading/LoadingExperienceScreen';
import { SafeAreaView, StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoadingRoute() {
  const router = useRouter();
  const { recipeInput } = useLocalSearchParams<{ recipeInput?: string }>();
  const { isAuthenticated } = useAuth();
  const { markFreeRecipeUsed } = useFreeUsage();

  if (!recipeInput) {
    console.error('[LoadingRoute] No recipe input provided.');
    router.back();
    return null;
  }

  const handleClose = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={28} color={COLORS.darkGray} />
        </TouchableOpacity>
      </View>

      <LoadingExperienceScreen
        recipeInput={recipeInput}
        loadingMode="checklist"
        onComplete={() => {
          console.log('[LoadingRoute] Recipe parsing complete callback.');
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
  },
});