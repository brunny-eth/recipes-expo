import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CombinedParsedRecipe } from '@/common/types';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, titleText, FONT } from '@/constants/typography';

interface RecipeMatchSelectionModalProps {
  visible: boolean;
  matches: { recipe: CombinedParsedRecipe; similarity: number; }[];
  onAction: (action: 'select' | 'createNew' | 'returnHome', selectedRecipeId?: string) => void;
}

const RecipeMatchSelectionModal: React.FC<RecipeMatchSelectionModalProps> = ({
  visible,
  matches,
  onAction,
}) => {
  console.log('[RecipeMatchSelectionModal] Modal rendered with', matches.length, 'matches.');

  const handleRecipeSelect = (recipeId: string | number) => {
    const selectedRecipeId = recipeId.toString();
    console.log('[RecipeMatchSelectionModal] User selected recipe ID:', selectedRecipeId);
    onAction('select', selectedRecipeId);
  };

  const handleCreateNew = () => {
    console.log('[RecipeMatchSelectionModal] User clicked "Create a new recipe".');
    onAction('createNew');
  };

  const handleReturnHome = () => {
    console.log('[RecipeMatchSelectionModal] User clicked "Return to Home".');
    onAction('returnHome');
  };

  const renderRecipeItem = ({ item }: { item: { recipe: CombinedParsedRecipe; similarity: number; } }) => {
    const recipe = item.recipe;
    const imageUrl = recipe.image || null;
    
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => handleRecipeSelect(recipe.id || 0)}
      >
        {imageUrl && (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.recipeTextContainer}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          <Text style={styles.similarityText}>
            {Math.round(item.similarity * 100)}% match
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleReturnHome}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Did you mean one of these?</Text>
            <Text style={styles.subtitle}>
              We found {matches.length} similar recipe{matches.length > 1 ? 's' : ''}
            </Text>
          </View>

          <FlatList
            data={matches}
            renderItem={renderRecipeItem}
            keyExtractor={(item) => item.recipe.id?.toString() || Math.random().toString()}
            style={styles.recipeList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleCreateNew}
            >
              <Text style={styles.secondaryButtonText}>Create a new recipe for me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleReturnHome}
            >
              <Text style={styles.primaryButtonText}>Return to Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  } as ViewStyle,
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '80%',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    ...titleText,
    fontSize: FONT.size.xl,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  } as TextStyle,
  subtitle: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
  } as TextStyle,
  recipeList: {
    flex: 1,
    paddingVertical: SPACING.md,
  } as ViewStyle,
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  recipeImage: {
    width: SPACING.xxl,
    height: SPACING.xxl,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  recipeTextContainer: {
    flex: 1,
  } as ViewStyle,
  recipeTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  } as TextStyle,
  similarityText: {
    ...bodyText,
    color: COLORS.primary,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  buttonContainer: {
    paddingTop: SPACING.md,
    gap: SPACING.md,
  } as ViewStyle,
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  primaryButton: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  primaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  secondaryButtonText: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
});

export default RecipeMatchSelectionModal; 