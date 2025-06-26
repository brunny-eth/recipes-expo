import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  screenTitleText,
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  FONT,
} from '@/constants/typography';
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
          .select(
            `
            base_recipe_id,
            processed_recipes_cache (
              id,
              recipe_data
            )
          `,
          )
          .eq('user_id', session.user.id);

        if (fetchError) {
          console.error(
            '[SavedScreen] Error fetching saved recipes:',
            fetchError,
          );
          setError('Could not load saved recipes. Please try again.');
        } else {
          console.log(
            `[SavedScreen] Fetched ${data?.length || 0} saved recipes.`,
          );
          // The linter is struggling with the joined type. We cast to 'any' and then to our expected type.
          // This is safe as long as the RLS and DB schema are correct.
          const validRecipes =
            ((data as any[])?.filter(
              (r) => r.processed_recipes_cache?.recipe_data,
            ) as SavedRecipe[]) || [];
          setSavedRecipes(validRecipes);
        }

        setIsLoading(false);
      };

      fetchSavedRecipes();
    }, [session]),
  );

  const handleRecipePress = (recipeData: ParsedRecipe) => {
    console.log(`[SavedScreen] Opening recipe: ${recipeData.title}`);
    router.push({
      pathname: '/recipe/summary',
      params: {
        recipeData: JSON.stringify(recipeData),
        from: '/saved',
      },
    });
  };

  const renderRecipeItem = ({ item }: { item: SavedRecipe }) => {
    if (!item.processed_recipes_cache?.recipe_data) {
      console.warn(
        '[SavedScreen] Rendering a saved recipe item without complete data:',
        item,
      );
      return null; // Gracefully skip rendering this item
    }

    const { recipe_data } = item.processed_recipes_cache;
    const imageUrl = recipe_data.image || recipe_data.thumbnailUrl;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleRecipePress(recipe_data)}
      >
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
        )}
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
      return (
        <ActivityIndicator
          style={styles.centered}
          size="large"
          color={COLORS.primary}
        />
      );
    }

    if (!session) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="login"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={styles.emptyText}>Log in to see your favorites</Text>
          <Text style={styles.emptySubtext}>
            Your saved recipes will appear here once you're logged in.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
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
          <MaterialCommunityIcons
            name="heart-outline"
            size={48}
            color={COLORS.lightGray}
          />
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
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.pageHorizontal,
  },
  header: {
    paddingBottom: SPACING.md,
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontFamily: FONT.family.recoleta,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...bodyTextLoose,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
  },
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  listContainer: {
    paddingTop: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  cardImage: {
    width: SPACING.xxl,
    height: SPACING.xxl,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
