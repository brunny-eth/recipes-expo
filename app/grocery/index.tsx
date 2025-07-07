import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { sectionHeaderText, bodyText, bodyStrongText } from '@/constants/typography';
import { useErrorModal } from '@/context/ErrorModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import IngredientList from '@/components/recipe/IngredientList';
import { IngredientGroup, StructuredIngredient } from '@/common/types';
import { formatIngredientsForGroceryList, categorizeIngredients } from '@/utils/groceryHelpers';
import { generateGroceryListSummary, generateGroceryListMarkdown, sortGroceryCategories, GroceryListItem } from '@/utils/groceryAggregation';

type GroceryListParams = {
  originalId?: string;
  recipeData?: string;
  editedIngredients?: string;
  newTitle?: string;
  appliedChanges?: string;
};

export default function GroceryListScreen() {
  const params = useLocalSearchParams<GroceryListParams>();
  const router = useRouter();
  const { showError } = useErrorModal();

  const [groceryItems, setGroceryItems] = useState<GroceryListItem[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<{[key: number]: boolean}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Convert grocery items to ingredient groups for the IngredientList component
  const groceryIngredientGroups = React.useMemo<IngredientGroup[]>(() => {
    if (groceryItems.length === 0) return [];

    // Group items by category
    const groupedByCategory = groceryItems.reduce((groups, item) => {
      const category = item.grocery_category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {} as Record<string, GroceryListItem[]>);

    // Sort categories
    const sortedCategories = sortGroceryCategories(Object.keys(groupedByCategory));

    // Convert to IngredientGroup format
    return sortedCategories.map((category) => ({
      name: category,
      ingredients: groupedByCategory[category].map((item): StructuredIngredient => ({
        name: item.item_name,
        amount: item.quantity_amount?.toString() || null,
        unit: item.quantity_unit,
        preparation: null,
        suggested_substitutions: null,
      })),
    }));
  }, [groceryItems]);

  useEffect(() => {
    initializeGroceryList();
  }, []);

  const initializeGroceryList = async () => {
    try {
      if (!params.editedIngredients) {
        throw new Error('No ingredients provided');
      }

      const ingredientGroups: IngredientGroup[] = JSON.parse(params.editedIngredients);
      const recipeData = params.recipeData ? JSON.parse(params.recipeData) : null;
      const recipeTitle = params.newTitle && params.newTitle !== 'null' ? params.newTitle : recipeData?.title || 'Recipe';

      setIsProcessing(true);

      // Generate shopping list ID
      const shoppingListId = `list_${Date.now()}`;

      // Format ingredients for grocery list
      const formattedItems = formatIngredientsForGroceryList(
        { ...recipeData, ingredientGroups },
        shoppingListId,
        undefined // userSavedRecipeId
      );

      // Apply basic categorization
      const categorizedItems = categorizeIngredients(formattedItems);

      // Get LLM categorization for better accuracy
      const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
      const response = await fetch(`${backendUrl}/api/grocery/categorize-ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: categorizedItems.map(item => item.original_ingredient_text).filter(Boolean)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to categorize ingredients');
      }

      const { categories: llmCategories } = await response.json();

      // Update items with LLM categories and add missing fields
      const finalItems = categorizedItems.map(item => ({
        ...item,
        id: `grocery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        shopping_list_id: shoppingListId,
        grocery_category: llmCategories[item.original_ingredient_text] || item.grocery_category || 'Other',
      }));

      setGroceryItems(finalItems);
      setCategories(sortGroceryCategories([...new Set(finalItems.map(item => item.grocery_category))]));

    } catch (error: any) {
      showError('Error Loading Grocery List', error.message);
    } finally {
      setIsProcessing(false);
      setIsLoading(false);
    }
  };

  const toggleCheckIngredient = (index: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleShareList = async () => {
    try {
      const summary = generateGroceryListSummary(groceryItems, 'Shopping List');
      const markdown = generateGroceryListMarkdown(summary);

      await Share.share({
        message: markdown,
        title: 'Shopping List',
      });
    } catch (error) {
      showError('Share Error', 'Failed to share grocery list');
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {isProcessing ? 'Processing ingredients...' : 'Loading grocery list...'}
        </Text>
      </SafeAreaView>
    );
  }

  if (groceryItems.length === 0) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <InlineErrorBanner message="No grocery items found." showGoBackButton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grocery List</Text>
        <TouchableOpacity onPress={handleShareList} style={styles.shareButton}>
          <MaterialCommunityIcons name="share-variant" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {groceryItems.length} items • {categories.length} categories
          </Text>
          
          <IngredientList
            ingredientGroups={groceryIngredientGroups}
            selectedScaleFactor={1}
            appliedChanges={[]}
            checkedIngredients={checkedIngredients}
            toggleCheckIngredient={toggleCheckIngredient}
            openSubstitutionModal={() => {}} // No substitutions on grocery list
            undoIngredientRemoval={() => {}} // No removal on grocery list
            undoSubstitution={() => {}} // No substitution on grocery list
            showCheckboxes={true}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.pageHorizontal,
  },
  loadingText: {
    ...bodyText,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  },
  shareButton: {
    padding: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.md,
  },
  subtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
}); 