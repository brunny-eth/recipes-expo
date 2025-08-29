import React, { useMemo, useState } from 'react';
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
  Image,
  TextInput,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CombinedParsedRecipe } from '@/common/types';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, titleText, sectionHeaderText, FONT } from '@/constants/typography';
import { isDescriptiveDishName } from '@/utils/ingredientHelpers';

interface RecipeMatchSelectionModalProps {
  visible: boolean;
  matches: { recipe: CombinedParsedRecipe; similarity: number; }[];
  onAction: (action: 'select' | 'createNew' | 'returnHome', extra?: string) => void; // extra: recipeId for 'select', inputText for 'createNew'
  debugSource?: string;
  initialInputText?: string; // Seed text when expanding to create-new input
}

const RecipeMatchSelectionModal: React.FC<RecipeMatchSelectionModalProps> = ({
  visible,
  matches,
  onAction,
  debugSource,
  initialInputText,
}) => {
  // State to track which images have failed to load
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [buttonsHeight, setButtonsHeight] = useState(0);

  console.log('[RecipeMatchSelectionModal] Modal rendered with', matches.length, 'matches.', { visible, debugSource });
  console.log('[RecipeMatchSelectionModal] Matches data:', matches);
  console.log('[RecipeMatchSelectionModal] First match sample:', matches[0]);

  React.useEffect(() => {
    // Seed input when modal becomes visible or initial text changes
    if (visible) {
      setInputText(initialInputText || '');
      setIsCreateExpanded(false);
      setShowValidation(false);
      setValidationError('');
    }
  }, [visible, initialInputText]);

  // Clear validation error when input changes significantly
  const [lastValidatedInput, setLastValidatedInput] = useState('');

  React.useEffect(() => {
    if (validationError && inputText !== lastValidatedInput && inputText.length > lastValidatedInput.length) {
      setValidationError('');
    }
  }, [inputText, validationError, lastValidatedInput]);

  const handleRecipeSelect = (recipeId: string | number) => {
    const selectedRecipeId = recipeId.toString();
    console.log('[RecipeMatchSelectionModal] User selected recipe ID:', selectedRecipeId);
    onAction('select', selectedRecipeId);
  };

  const handleCreateNew = () => {
    console.log('[RecipeMatchSelectionModal] User clicked "Create a new recipe". Expanding input.');
    setIsCreateExpanded(true);
  };

  const handleReturnHome = () => {
    console.log('[RecipeMatchSelectionModal] User clicked "Return to Home".');
    onAction('returnHome');
  };

  const handleImageError = (imageUrl: string) => {
    console.log('[RecipeMatchSelectionModal] Image failed to load:', imageUrl);
    setFailedImages(prev => new Set(prev).add(imageUrl));
  };

  // Helper function to determine if input looks like a dish name vs URL
  const looksLikeDishName = (text: string): boolean => {
    const trimmed = text.trim();
    // If it contains spaces or common dish words, it's likely a dish name
    if (trimmed.includes(' ') || /\b(recipe|dish|food|cook|bake|fry|grill)\b/i.test(trimmed)) {
      return true;
    }
    // If it doesn't look like a URL (no http/https, no domain-like pattern), treat as dish name
    return !trimmed.match(/^https?:\/\//i) && !trimmed.includes('.com') && !trimmed.includes('.org') && !trimmed.includes('www.');
  };

  const renderRecipeItem = ({ item }: { item: { recipe: CombinedParsedRecipe; similarity: number; } }) => {
    console.log('[RecipeMatchSelectionModal] Rendering item:', item);
    const recipe = item.recipe;
    const imageUrl = recipe.image || null;
    const hasImageFailed = imageUrl ? failedImages.has(imageUrl) : true;
    const shouldShowFallback = !imageUrl || hasImageFailed;
    
    console.log('[RecipeMatchSelectionModal] Recipe title:', recipe.title, 'Image URL:', imageUrl, 'Show fallback:', shouldShowFallback);
    
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => handleRecipeSelect(recipe.id || 0)}
      >
        {shouldShowFallback ? (
          <View style={styles.fallbackImageContainer}>
            <Image
              source={require('@/assets/images/meezblue_underline.png')}
              style={styles.fallbackImage}
              resizeMode="contain"
            />
          </View>
        ) : (
          <FastImage
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            resizeMode="cover"
            onError={() => handleImageError(imageUrl)}
          />
        )}
        <View style={styles.recipeTextContainer}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipe.title}
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
      onShow={() => {
        if (__DEV__) console.log('[RecipeMatchSelectionModal] onShow fired', { debugSource });
      }}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          {!isCreateExpanded ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>How about one of these?</Text>
                <Text style={styles.subtitle}>
                  We found {matches.length} similar recipe{matches.length > 1 ? 's' : ''}
                </Text>
              </View>

              <FlatList
                data={matches}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                renderItem={renderRecipeItem}
                keyExtractor={(item) => item.recipe.id?.toString() || Math.random().toString()}
                style={styles.recipeList}
                contentContainerStyle={[
                  styles.recipeListContent,
                  { paddingBottom: buttonsHeight + SPACING.md },
                ]}
                showsVerticalScrollIndicator={false}
              />

              <View style={styles.buttonContainer} onLayout={(e) => setButtonsHeight(e.nativeEvent.layout.height)}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleCreateNew}
                >
                  <Text style={styles.primaryButtonText}>Just make a new recipe for me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleReturnHome}
                >
                  <Text style={styles.secondaryButtonText}>Return to Home</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>OK! We&apos;ll make a new recipe</Text>
                <Text style={styles.subtitle}>Add more detail to help us create the best recipe for you.</Text>
              </View>

              <View style={styles.inputSection}>
                <TextInput
                  style={[styles.textArea, showValidation && inputText.trim().length === 0 && styles.textAreaError]}
                  placeholder="Add ingredients, style, or dietary needs (optional)"
                  placeholderTextColor="#8D8D8D"
                  value={inputText}
                  onChangeText={(t) => {
                    setInputText(t);
                    if (showValidation) setShowValidation(false);
                  }}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  autoFocus
                  returnKeyType="done"
                />
                {showValidation && inputText.trim().length === 0 && (
                  <Text style={styles.validationText}>You can continue without adding details, or type a few hints.</Text>
                )}
                {validationError ? (
                  <Text style={styles.validationErrorText}>{validationError}</Text>
                ) : null}
              </View>

              <View style={styles.buttonContainer} onLayout={(e) => setButtonsHeight(e.nativeEvent.layout.height)}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => {
                    const trimmedInput = inputText.trim();
                    console.log('[RecipeMatchSelectionModal] Confirm create with input text length:', trimmedInput.length);

                    // Validate dish name inputs
                    if (looksLikeDishName(trimmedInput) && !isDescriptiveDishName(trimmedInput)) {
                      setValidationError('Please be a bit more descriptive so we can make you the best recipe!');
                      setLastValidatedInput(trimmedInput);
                      return;
                    }

                    // Clear any previous validation error and proceed
                    setValidationError('');
                    setLastValidatedInput('');
                    onAction('createNew', trimmedInput);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Make my recipe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => onAction('returnHome')}
                >
                  <Text style={styles.secondaryButtonText}>Back to home</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    height: '80%', // Changed from maxHeight to height
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  } as TextStyle,
  subtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    alignSelf: 'center',
  } as TextStyle,
  recipeList: {
    flex: 1,
    paddingVertical: SPACING.md,
  } as ViewStyle,
  recipeListContent: {
    paddingBottom: SPACING.lg,
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
    width: SPACING.xxxl || 72, // Increase size, fallback if SPACING.xxxl undefined
    height: SPACING.xxxl || 72,
    borderRadius: 8, // Slightly more rounded for larger image
    marginRight: SPACING.md,
  },
  fallbackImageContainer: {
    width: SPACING.xxxl || 72,
    height: SPACING.xxxl || 72,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  fallbackImage: {
    width: '60%',
    height: '60%',
  } as ImageStyle,
  recipeTextContainer: {
    flex: 1,
    justifyContent: 'center', // Vertically center the title
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
  inputSection: {
    paddingTop: SPACING.sm,
  } as ViewStyle,
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textDark,
    ...bodyText,
  } as TextStyle,
  textAreaError: {
    borderColor: COLORS.error,
  } as TextStyle,
  validationText: {
    marginTop: SPACING.xs,
    color: COLORS.darkGray,
    ...bodyText,
  } as TextStyle,
  validationErrorText: {
    marginTop: SPACING.xs,
    color: COLORS.error || '#E74C3C',
    ...bodyText,
    fontSize: FONT.size.smBody,
  } as TextStyle,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  primaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  secondaryButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    textAlign: 'center',
  } as TextStyle,
});

export default RecipeMatchSelectionModal; 