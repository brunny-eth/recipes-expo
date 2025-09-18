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
    onAction('select', selectedRecipeId);
  };

  const handleCreateNew = () => {
    setIsCreateExpanded(true);
  };

  const handleReturnHome = () => {
    onAction('returnHome');
  };

  const handleImageError = (imageUrl: string) => {
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
    const recipe = item.recipe;
    const imageUrl = recipe.image || null;
    const hasImageFailed = imageUrl ? failedImages.has(imageUrl) : true;
    const shouldShowFallback = !imageUrl || hasImageFailed;
    
    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => handleRecipeSelect(recipe.id || 0)}
      >
        <View style={styles.imageContainer}>
          {shouldShowFallback ? (
            <View style={styles.fallbackImageContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                resizeMode="contain"
                style={styles.fallbackImage}
              />
            </View>
          ) : (
            <FastImage
              source={{ uri: imageUrl }}
              style={styles.exploreCardImage as any}
              onError={() => handleImageError(imageUrl)}
            />
          )}
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.exploreCardTitle} numberOfLines={3}>
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
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleReturnHome}
      >
        <SafeAreaView style={styles.modalContent}>
          {!isCreateExpanded ? (
            <>
              <View style={styles.header}>
                <Text style={styles.mainTitle}>
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
                contentContainerStyle={styles.recipeListContent}
                showsVerticalScrollIndicator={false}
              />

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.textButtonContainer}
                  onPress={handleCreateNew}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.textButton}>Just make a new recipe for me</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.headerExpanded}>
                <View style={styles.headerExpandedContent}>
                  <Text style={styles.title}>OK! We&apos;ll make you a new one.</Text>
                  <Text style={styles.subtitleLeft}>Add more detail for the best recipe.</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButtonExpanded}
                  onPress={() => {
                    setIsCreateExpanded(false);
                    setInputText('');
                    setShowValidation(false);
                    setValidationError('');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputSectionExpanded}>
                <TextInput
                  style={[styles.textArea, showValidation && inputText.trim().length === 0 && styles.textAreaError]}
                  placeholder="Add ingredients, style, or dietary needs (optional)"
                  placeholderTextColor={COLORS.textMuted}
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

                {/* Text button positioned immediately below the input */}
                <TouchableOpacity
                  style={styles.textButtonContainer}
                  onPress={() => {
                    const trimmedInput = inputText.trim();

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
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.textButton}>Make my recipe</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </SafeAreaView>
      </TouchableOpacity>
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
    backgroundColor: COLORS.background, // Nice cream color like library.tsx
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#000000',
    height: '80%', // Changed from maxHeight to height
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center', // Center the title
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: SPACING.sm,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  } as ViewStyle,
  headerExpanded: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    flexDirection: 'row',
    justifyContent: 'space-between',
  } as ViewStyle,
  headerExpandedContent: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  } as ViewStyle,
  closeButtonExpanded: {
    padding: SPACING.xs,
    paddingRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  title: {
    ...bodyStrongText,
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
  } as TextStyle,
  mainTitle: {
    ...bodyStrongText, // Match other modals
    fontSize: FONT.size.lg, // Match other modals (18px)
    color: COLORS.textDark,
    textAlign: 'center', // Center align the title
  } as TextStyle,
  // Removed closeButton styles since no longer needed
  subtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    alignSelf: 'center',
  } as TextStyle,
  subtitleLeft: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'left',
    maxWidth: 280,
    alignSelf: 'flex-start',
    fontSize: FONT.size.body,
  } as TextStyle,
  recipeList: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 0, // Remove right padding to match folder rows
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  } as ViewStyle,
  recipeListContent: {
    paddingBottom: SPACING.lg,
    paddingLeft: 0, // Match other elements' left padding
    paddingRight: 18, // Match other elements' right padding
  } as ViewStyle,
  buttonContainer: {
    padding: SPACING.sm,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    marginTop: SPACING.sm,
  } as ViewStyle,
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 120,
    overflow: 'hidden',
    width: '100%', // Increased width to give more space for text
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: 0, // Start from absolute left edge
    paddingLeft: 0, // Ensure no internal left padding
  } as ViewStyle,
  imageContainer: {
    width: '40%', // Keep original image size
    height: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  fallbackImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  } as ViewStyle,
  fallbackImage: {
    width: '80%',
    height: '80%',
  } as ImageStyle,
  titleContainer: {
    flex: 1, // Use remaining space after image takes 40%
    height: '100%',
    paddingLeft: SPACING.md, // Add padding to separate from image
    paddingRight: SPACING.sm,
    justifyContent: 'center', // Center vertically like library.tsx
    alignItems: 'flex-start',
    paddingTop: 0,
    backgroundColor: 'transparent',
  } as ViewStyle,
  exploreCardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  } as ImageStyle,
  exploreCardTitle: {
    color: COLORS.textDark,
    ...bodyText,
    fontSize: FONT.size.body + 2, // Make text bigger
    lineHeight: FONT.lineHeight.normal + 2, // Adjust line height proportionally
    textAlign: 'left',
  } as TextStyle,
  similarityText: {
    ...bodyText,
    color: COLORS.primary,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  inputSection: {
    paddingTop: SPACING.sm,
  } as ViewStyle,
  inputSectionExpanded: {
    flex: 1,
    paddingTop: SPACING.sm,
  } as ViewStyle,
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    backgroundColor: 'transparent',
    color: COLORS.textDark,
    ...bodyText,
  } as TextStyle,
  textAreaError: {
    borderColor: '#000000',
  } as TextStyle,
  validationText: {
    marginTop: SPACING.xs,
    color: COLORS.darkGray,
    ...bodyText,
    fontSize: FONT.size.caption,
  } as TextStyle,
  validationErrorText: {
    marginTop: SPACING.xs,
    color: COLORS.error || '#E74C3C',
    ...bodyText,
    fontSize: FONT.size.caption,
  } as TextStyle,
  textButtonContainer: {
    height: 46, // Match button height consistency
    width: '100%',
    backgroundColor: 'transparent', // Match secondary button style
    borderWidth: 1,
    borderColor: '#000000', // Match secondary button border
    borderRadius: 8, // Match button consistency
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  } as ViewStyle,
  textButton: {
    ...bodyText, // Match modal button text style
    color: '#000000', // Match secondary button text color
    textAlign: 'center', // Center align like other modal buttons
    fontSize: FONT.size.body, // 16px consistency
  } as TextStyle,
});

export default RecipeMatchSelectionModal; 