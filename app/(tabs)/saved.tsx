import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import RecipeCard from '@/components/RecipeCard';

// Sample data for saved recipes
const SAVED_RECIPES = [
  {
    id: 'recipe-1',
    title: 'Chicken Avocado Sandwich',
    calories: 425,
    protein: 27,
    imageUrl: 'https://images.pexels.com/photos/1647163/pexels-photo-1647163.jpeg',
  },
  {
    id: 'recipe-2',
    title: 'Greek Yogurt Parfait',
    calories: 310,
    protein: 18,
    imageUrl: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg',
  },
  {
    id: 'recipe-3',
    title: 'Spinach Mushroom Omelette',
    calories: 285,
    protein: 22,
    imageUrl: 'https://images.pexels.com/photos/803963/pexels-photo-803963.jpeg',
  },
];

export default function SavedScreen() {
  const router = useRouter();
  
  const handleRecipePress = (id: string) => {
    router.push(`/recipe/${id}`);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Recipes</Text>
      
      {SAVED_RECIPES.length > 0 ? (
        <FlatList
          data={SAVED_RECIPES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard 
              recipe={item} 
              onPress={() => handleRecipePress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No saved recipes yet</Text>
          <Text style={styles.emptySubtext}>
            Recipes you save will appear here
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textGray,
    textAlign: 'center',
  },
});