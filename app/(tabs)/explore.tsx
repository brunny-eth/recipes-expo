import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';
import { useFreeUsage } from '@/context/FreeUsageContext'; // Import the FreeUsageContext

const DUMMY_RECIPES = [
  {
    id: '1',
    title: 'Grilled Salmon with Asparagus',
    calories: 450,
    protein: 35,
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Avocado Toast with Poached Egg',
    calories: 320,
    protein: 15,
    imageUrl: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop',
  },
  {
    id: '3',
    title: 'Quinoa Salad with Roasted Vegetables',
    calories: 380,
    protein: 12,
    imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: '4',
    title: 'Classic Beef Tacos',
    calories: 550,
    protein: 28,
    imageUrl: 'https://images.unsplash.com/photo-1599974538139-4b415a3e1443?q=80&w=1964&auto=format&fit=crop',
  },
];

const ExploreScreen = () => {
  const { hasUsedFreeRecipe, isLoadingFreeUsage, resetFreeRecipeUsage } = useFreeUsage(); // Destructure the function and state

  const handleResetFreeUsage = async () => {
    console.log('[Dev Tools] Attempting to reset free recipe usage...');
    await resetFreeRecipeUsage();
    console.log('[Dev Tools] Free recipe usage has been reset.');
    alert('Free recipe usage has been reset!'); // Provide a visual confirmation
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Recipes</Text>
      </View>

      {/* Dev-only button for resetting free usage */}
      <View style={styles.devToolsContainer}>
        <Text style={styles.devToolsText}>
          Free Recipe Used: {isLoadingFreeUsage ? 'Loading...' : hasUsedFreeRecipe ? 'Yes' : 'No'}
        </Text>
        <TouchableOpacity
          onPress={handleResetFreeUsage}
          style={styles.resetButton}
          disabled={isLoadingFreeUsage}
        >
          <Text style={styles.resetButtonText}>Reset Free Usage (DEV)</Text>
        </TouchableOpacity>
      </View>
      {/* End Dev-only button */}

      <FlatList
        data={DUMMY_RECIPES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => console.log('Tapped recipe:', item.title)}
          />
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
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Recoleta-Medium', // Ensure you have this font loaded
    fontSize: 28,
    color: COLORS.textDark,
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  devToolsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  devToolsText: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginBottom: 10,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  resetButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
});

export default ExploreScreen;