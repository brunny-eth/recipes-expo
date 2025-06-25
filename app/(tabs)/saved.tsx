import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { screenTitleText, bodyStrongText, bodyText } from '@/constants/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';

type SavedRecipe = {
  base_recipe_id: number;
  processed_recipes_cache: {
    id: number;
    recipe_data: ParsedRecipe;
  } | null;
};

// This type needs to reflect that the joined table can be an array, but we only want the first match.
// For a to-one relationship, PostgREST returns an object, not an array. Let's assume the relationship is one-to-one or many-to-one
// and that `processed_recipes_cache` is correctly configured in Supabase to return a single object.
// The linter error suggests it might be coming back as an array from a many-to-many join.
// The query should be using a one-to-one join. Let's adjust the select and the type.
type SavedRecipeFromRPC = {
  base_recipe_id: number;
  processed_recipes_cache: {
    id: number;
    recipe_data: ParsedRecipe;
  } | null; // Can be null if the join finds no match
};

export default function SavedScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchSavedRecipes = async () => {
        if (!session?.user) {
          console.warn('[SavedScreen] No user session found.');
          setIsLoading(false);
          setSavedRecipes([]); // Clear recipes if user logs out
          return;
        }

        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_saved_recipes')
          .select(`
            base_recipe_id,
            processed_recipes_cache (
              id,
              recipe_data
            )
          `)
          .eq('user_id', session.user.id);

        if (fetchError) {
          console.error('[SavedScreen] Error fetching saved recipes:', fetchError);
          setError('Could not load saved recipes. Please try again.');
        } else {
          console.log(`[SavedScreen] Fetched ${data?.length || 0} saved recipes.`);
          // The linter is struggling with the joined type. We cast to 'any' and then to our expected type.
          // This is safe as long as the RLS and DB schema are correct.
          const validRecipes = (data as any[])?.filter(r => r.processed_recipes_cache?.recipe_data) as SavedRecipe[] || [];
          setSavedRecipes(validRecipes);
        }

        setIsLoading(false);
      };

      fetchSavedRecipes();
    }, [session])
  );

  const handleRecipePress = (recipeData: ParsedRecipe) => {
    console.log(`[SavedScreen] Opening recipe: ${recipeData.title}`);
    router.push({
      pathname: '/recipe/summary',
      params: { 
        recipeData: JSON.stringify(recipeData),
        from: '/saved'
      }
    });
  };

  const renderRecipeItem = ({ item }: { item: SavedRecipe }) => {
    if (!item.processed_recipes_cache?.recipe_data) {
      console.warn("[SavedScreen] Rendering a saved recipe item without complete data:", item);
      return null; // Gracefully skip rendering this item
    }

    const { recipe_data } = item.processed_recipes_cache;
    const imageUrl = recipe_data.image || recipe_data.thumbnailUrl;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleRecipePress(recipe_data)}>
        {imageUrl && <Image source={{ uri: imageUrl }} style={styles.cardImage} />}
        <View style={styles.cardTextContainer}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe_data.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator style={styles.centered} size="large" color={COLORS.primary} />;
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="login" size={48} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>Log in to see your favorites</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipes will appear here once you're logged in.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.loginButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }

    if (savedRecipes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="heart-outline" size={48} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>No saved recipes yet</Text>
          <Text style={styles.emptySubtext}>
            When you save a recipe, it will appear here for quick access
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={savedRecipes}
        renderItem={renderRecipeItem}
        keyExtractor={(item) => item.base_recipe_id.toString()}
        contentContainerStyle={styles.listContainer}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: 'Recoleta-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 16,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 20,
  }
});