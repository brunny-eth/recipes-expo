import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
} from '@/constants/theme';
import { StructuredIngredient } from '../../common/types';
import {
  bodyStrongText,
  bodyText,
  bodyTextLoose,
  captionText,
  metaText,
  FONT,
} from '@/constants/typography';
import { abbreviateUnit } from '@/utils/format';
import { parseRecipeDisplayName } from '@/utils/ingredientHelpers';

type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

type IngredientRowProps = {
  ingredient: StructuredIngredient;
  index: number;
  isChecked: boolean;
  appliedChanges: AppliedChange[]; // Current unsaved changes (revertible)
  persistedChanges?: AppliedChange[]; // Changes loaded from DB (locked)
  toggleCheckIngredient: (idx: number) => void;
  openSubstitutionModal: (ing: StructuredIngredient) => void;
  undoIngredientRemoval: (name: string) => void;
  undoSubstitution: (originalName: string) => void;
  showCheckboxes?: boolean;
  isViewingSavedRecipe?: boolean; // Keep for backward compatibility
};

/**
 * Resolves the original ingredient name from appliedChanges instead of relying on parsed display names.
 */
function getOriginalIngredientNameFromAppliedChanges(
  appliedChanges: AppliedChange[],
  displayName: string,
): string {
  const { substitutedFor, baseName } = parseRecipeDisplayName(displayName);
  const fallback = substitutedFor || baseName;
  const match = appliedChanges.find((change) => change.to?.name === fallback);
  return match?.from || fallback;
}

const IngredientRow: React.FC<IngredientRowProps> = ({
  ingredient,
  index,
  isChecked,
  appliedChanges, // Current unsaved changes (revertible)
  persistedChanges = [], // Changes loaded from DB (locked)
  toggleCheckIngredient,
  openSubstitutionModal,
  undoIngredientRemoval,
  undoSubstitution,
  showCheckboxes = true,
  isViewingSavedRecipe = false, // Keep for backward compatibility
}) => {
  // Only parse ingredient names if they contain UI-generated markers
  const isUIGeneratedSubstitution = ingredient.name.includes('(substituted for ') || ingredient.name.includes('(removed)');
  
  // Check if ingredient contains natural language substitutions (disable modification for these)
  const hasNaturalLanguageSubstitutions = !isUIGeneratedSubstitution && (
    ingredient.name.includes(' or ') ||
    ingredient.name.includes(' / ') ||
    ingredient.name.includes('/') ||
    ingredient.name.includes(' OR ') ||
    ingredient.name.includes(' (or ')
  );
  
  let baseName: string;
  let isRemoved: boolean;
  let substitutedFor: string | null = null;
  let ingredientToCheck: string;
  
  if (isUIGeneratedSubstitution) {
    // This is a UI-generated change, parse it properly
    const parsed = parseRecipeDisplayName(ingredient.name);
    baseName = parsed.baseName;
    isRemoved = parsed.isRemoved || false;
    substitutedFor = parsed.substitutedFor || null;
    ingredientToCheck = substitutedFor || baseName;
  } else {
    // This is original recipe text, treat the full name as the base name
    baseName = ingredient.name;
    isRemoved = false;
    substitutedFor = null;
    ingredientToCheck = baseName;
  }

  const originalNameForSub = getOriginalIngredientNameFromAppliedChanges(
    [...persistedChanges, ...appliedChanges], // Use combined changes for parsing
    ingredient.name,
  );

  // Determine if this specific ingredient has a persisted change (locked)
  const hasPersistedChange = persistedChanges.some(
    (change) => change.from === ingredientToCheck
  );

  // Determine if this specific ingredient has a current unsaved change (revertible)
  const hasUnsavedChange = appliedChanges.some(
    (change) => change.from === ingredientToCheck
  );

  // If an ingredient has a persisted change OR natural language substitutions AND no structured substitutions, it should not be modifiable
  const isLocked = hasPersistedChange || (hasNaturalLanguageSubstitutions && (!ingredient.suggested_substitutions || ingredient.suggested_substitutions.length === 0));

  // Show revert button only if there's an actual unsaved change and it's not locked
  const showRevertButton = hasUnsavedChange && !isLocked;

  // Debug logging to help track the locking behavior and substitutions
  const shouldShowSubstitutionOnTap =
    !substitutedFor &&
    !isRemoved &&
    !isLocked &&
    ingredient.suggested_substitutions &&
    ingredient.suggested_substitutions.length > 0 &&
    ingredient.suggested_substitutions.some((sub) => sub && sub.name != null);

  if (substitutedFor || hasPersistedChange || hasUnsavedChange || showRevertButton || isUIGeneratedSubstitution || hasNaturalLanguageSubstitutions || shouldShowSubstitutionOnTap || (ingredient.suggested_substitutions && ingredient.suggested_substitutions.length > 0)) {
    console.log('[INGREDIENT_DEBUG]', {
      ingredientName: ingredient.name,
      hasSuggestedSubstitutions: !!ingredient.suggested_substitutions,
      substitutionsCount: ingredient.suggested_substitutions?.length || 0,
      substitutionsSample: ingredient.suggested_substitutions?.slice(0, 2),
      isUIGeneratedSubstitution,
      hasNaturalLanguageSubstitutions,
      baseName,
      substitutedFor,
      ingredientToCheck,
      hasPersistedChange,
      hasUnsavedChange,
      isLocked,
      shouldShowSubstitutionOnTap,
      showRevertButton,
      timestamp: new Date().toISOString(),
    });
  }



  const handleRowPress = () => {
    if (shouldShowSubstitutionOnTap) {
      // If substitution is available, open substitution modal
      openSubstitutionModal(ingredient);
    } else if (!isRemoved && showCheckboxes) {
      // Otherwise, toggle checkbox if applicable
      toggleCheckIngredient(index);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.ingredientItemContainer]}
      onPress={handleRowPress}
      activeOpacity={shouldShowSubstitutionOnTap || (!isRemoved && showCheckboxes) ? 0.7 : 1}
    >
      {/* Checkbox Visual or Bullet */}
      {showCheckboxes ? (
        isRemoved ? (
          <View style={styles.checkboxPlaceholder} />
        ) : (
          <View
            style={[styles.checkboxBase, isChecked && styles.checkboxChecked]}
            testID={`checkbox-${ingredient.name}`}
          >
            {isChecked && <View style={styles.checkboxInnerCheck} />}
          </View>
        )
      ) : (
        // No bullet - cleaner look
        <View style={styles.noBulletSpacer} />
      )}

      {/* Ingredient Text Container */}
      <View style={styles.ingredientNameContainer}>
        {isRemoved ? (
          <Text style={styles.ingredientName} numberOfLines={0}>
            <Text style={styles.ingredientTextRemoved}>{baseName}</Text>
            <Text style={styles.ingredientRemovedTag}> (removed)</Text>
          </Text>
        ) : (
          <Text
            style={[
              styles.ingredientName,
              isChecked && styles.ingredientTextChecked,
            ]}
            numberOfLines={0}
          >
            {baseName}
            {ingredient.preparation && (
              <Text style={styles.ingredientPreparation}>
                {` ${ingredient.preparation}`}
              </Text>
            )}
            {(ingredient.amount || ingredient.unit) && (
              <Text style={styles.ingredientQuantityParenthetical}>
                {` (${ingredient.amount || ''}${ingredient.unit ? ` ${abbreviateUnit(ingredient.unit)}` : ''})`}
              </Text>
            )}
          </Text>
        )}

        {/* Button area - maintains consistent spacing whether buttons are present or not */}
        <View style={styles.buttonArea}>
          {isRemoved && showRevertButton && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => undoIngredientRemoval(ingredient.name)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="arrow-u-left-top"
              size={FONT.size.lg}
              color={COLORS.darkGray}
            />
          </TouchableOpacity>
        )}

          {substitutedFor && !isRemoved && !isLocked && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => undoSubstitution(originalNameForSub)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="arrow-u-left-top"
              size={FONT.size.lg}
              color={COLORS.darkGray}
            />
          </TouchableOpacity>
        )}

          {/* Chevron for tappable rows */}
          {(shouldShowSubstitutionOnTap || (!isRemoved && showCheckboxes)) && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={FONT.size.lg}
              color={COLORS.darkGray}
              style={styles.chevronIcon}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ingredientItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs, // Reduced horizontal padding
  } as ViewStyle,
  checkboxPlaceholder: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    marginRight: SPACING.smLg,
  } as ViewStyle,
  checkboxBase: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    borderRadius: RADIUS.xs,
    borderWidth: BORDER_WIDTH.thick,
    borderColor: COLORS.primary,
    marginRight: SPACING.smLg,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  } as ViewStyle,
  checkboxInnerCheck: {
    width: ICON_SIZE.xs,
    height: ICON_SIZE.xs,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  ingredientNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: ICON_SIZE.md, // Ensure consistent height for button or no button
  } as ViewStyle,
  ingredientName: {
    ...bodyText,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    lineHeight: 20,
    flex: 1,
    marginRight: SPACING.sm, // Consistent spacing from text to button area
  } as TextStyle,
  ingredientTextRemoved: {
    color: COLORS.darkGray,
    textDecorationLine: 'line-through',
    opacity: 0.325, // More transparent for removed ingredients
  } as TextStyle,
  ingredientRemovedTag: {
    color: COLORS.darkGray,
    fontStyle: 'italic',
    opacity: 0.325, // More transparent for removed tag
  } as TextStyle,
  ingredientTextChecked: {
    color: COLORS.darkGray,
    textDecorationLine: 'line-through',
  } as TextStyle,
  ingredientPreparation: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    marginTop: SPACING.xxs,
    marginLeft: SPACING.xxs,
    opacity: 0.7, // Make preparation text more subtle
  } as TextStyle,
  ingredientQuantityParenthetical: {
    ...metaText,
    color: COLORS.textMuted,
    marginTop: 4,
  } as TextStyle,
  revertButton: {
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  } as ViewStyle,
  infoButton: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  } as ViewStyle,
  noBulletSpacer: {
    width: 0, // No space needed
    marginRight: 0,
  } as ViewStyle,
  buttonArea: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: ICON_SIZE.md, // Reserve space for button even when not present
    justifyContent: 'flex-end', // Align button to the right
  } as ViewStyle,
  chevronIcon: {
    marginLeft: SPACING.sm,
  } as TextStyle,
});

export default React.memo(IngredientRow);
