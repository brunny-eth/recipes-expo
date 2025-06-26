import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';
import { useFreeUsage } from '@/context/FreeUsageContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { bodyText, screenTitleText, FONT } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';

const DUMMY_RECIPES = [
  {
    id: '1',
    title: 'Grilled Salmon with Asparagus',
    calories: 450,
    protein: 35,
    imageUrl:
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Avocado Toast with Poached Egg',
    calories: 320,
    protein: 15,
    imageUrl:
      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop',
  },
  {
    id: '3',
    title: 'Quinoa Salad with Roasted Vegetables',
    calories: 380,
    protein: 12,
    imageUrl:
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: '4',
    title: 'Classic Beef Tacos',
    calories: 550,
    protein: 28,
    imageUrl:
      'https://images.unsplash.com/photo-1599974538139-4b415a3e1443?q=80&w=1964&auto=format&fit=crop',
  },
];

const DevTools = () => {
  if (!__DEV__) {
    return null;
  }

  const { resetFreeRecipeUsage, hasUsedFreeRecipe } = useFreeUsage();

  const handleFullReset = async () => {
    await supabase.auth.signOut();
    await resetFreeRecipeUsage();
    router.replace('/login');
  };

  return (
    <View style={styles.devToolsContainer}>
      <Text style={styles.devToolsTitle}>Dev Tools</Text>
      <Text>Has Used Free Recipe: {String(hasUsedFreeRecipe)}</Text>
      <TouchableOpacity style={styles.devButton} onPress={resetFreeRecipeUsage}>
        <Text style={styles.devButtonText}>Reset Free Usage</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.devButton} onPress={handleFullReset}>
        <Text style={styles.devButtonText}>Start Fresh (Sign Out & Reset)</Text>
      </TouchableOpacity>
    </View>
  );
};

const ExploreScreen = () => {
  const { hasUsedFreeRecipe, isLoadingFreeUsage, resetFreeRecipeUsage } =
    useFreeUsage();
  const { session, isAuthenticated } = useAuth();
  const { showError } = useErrorModal();

  const handleResetFreeUsage = async () => {
    console.log('[Dev Tools] Attempting to reset free recipe usage...');
    await resetFreeRecipeUsage();
    console.log('[Dev Tools] Free recipe usage has been reset.');
    alert('Free recipe usage has been reset!');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Recipes</Text>
      </View>

      <DevTools />

      <FlatList
        data={DUMMY_RECIPES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.recipeItem}>
            <Text style={styles.recipeTitle}>{item.title}</Text>
            <Text>Calories: {item.calories}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContentContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.pageHorizontal,
  } as ViewStyle,
  header: {
    paddingHorizontal: SPACING.pageHorizontal,
    marginBottom: SPACING.smMd,
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    paddingBottom: SPACING.pageHorizontal,
  } as TextStyle,
  listContentContainer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.pageHorizontal,
  } as ViewStyle,
  devToolsContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.smMd,
    marginHorizontal: SPACING.pageHorizontal,
    marginVertical: SPACING.smMd,
    borderRadius: 5,
    alignItems: 'center',
  } as ViewStyle,
  devToolsTitle: {
    fontWeight: FONT.weight.semiBold,
    fontSize: FONT.size.body,
    marginBottom: 5,
  } as TextStyle,
  devButton: {
    backgroundColor: COLORS.warning,
    padding: SPACING.smMd,
    borderRadius: 5,
    marginTop: 5,
  } as ViewStyle,
  devButtonText: {
    color: COLORS.black,
  } as TextStyle,
  recipeItem: {
    height: 120,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    padding: SPACING.smMd,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  recipeTitle: {
    fontWeight: FONT.weight.semiBold,
  } as TextStyle,
});

export default ExploreScreen;
