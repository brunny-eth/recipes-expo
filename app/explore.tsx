import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';

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
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Recipes</Text>
      </View>
      <FlatList
        data={DUMMY_RECIPES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => console.log('Tapped recipe:', item.title)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    color: COLORS.textDark,
    fontFamily: 'Recoleta-Medium',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});

export default ExploreScreen; 