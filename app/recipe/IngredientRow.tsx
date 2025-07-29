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
  const { baseName, isRemoved, substitutedFor } = parseRecipeDisplayName(
    ingredient.name,
  );
  const originalNameForSub = getOriginalIngredientNameFromAppliedChanges(
    [...persistedChanges, ...appliedChanges], // Use combined changes for parsing
    ingredient.name,
  );

  // For substituted ingredients, we need to check the original ingredient name
  const ingredientToCheck = substitutedFor || baseName;

  // Determine if this specific ingredient has a persisted change (locked)
  const hasPersistedChange = persistedChanges.some(
    (change) => change.from === ingredientToCheck
  );

  // Determine if this specific ingredient has a current unsaved change (revertible)
  const hasUnsavedChange = appliedChanges.some(
    (change) => change.from === ingredientToCheck
  );

  // If an ingredient has a persisted change, it should not be modifiable or revertible
  const isLocked = hasPersistedChange;

  // Show revert button only if there's an unsaved change and it's not locked
  const showRevertButton = hasUnsavedChange && !isLocked;

  // Debug logging to help track the locking behavior - remove in production
  if (substitutedFor || hasPersistedChange || hasUnsavedChange) {
    console.log('[INGREDIENT_LOCKING]', {
      ingredientName: ingredient.name,
      baseName,
      substitutedFor,
      ingredientToCheck,
      hasPersistedChange,
      hasUnsavedChange,
      isLocked,
      showRevertButton,
      persistedChangesCount: persistedChanges.length,
      currentChangesCount: appliedChanges.length,
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <TouchableOpacity
      style={[styles.ingredientItemContainer]}
      onPress={() => !isRemoved && showCheckboxes && toggleCheckIngredient(index)}
      activeOpacity={showCheckboxes ? 0.7 : 1}
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
              color={COLORS.primary}
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
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}

        {/* Substitution Button */}
        {!substitutedFor &&
          !isRemoved &&
          !isLocked &&
          ingredient.suggested_substitutions &&
          ingredient.suggested_substitutions.length > 0 &&
          ingredient.suggested_substitutions.some(
            (sub) => sub && sub.name != null,
          ) && (
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => openSubstitutionModal(ingredient)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`substitution-button-${ingredient.name}`}
            >
              <MaterialCommunityIcons
                name="pencil"
                size={FONT.size.lg}
                color={COLORS.primary}
              />
            </TouchableOpacity>
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
    marginBottom: SPACING.smLg,
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
    minHeight: ICON_SIZE.xl, // Ensure consistent height for button or no button
  } as ViewStyle,
  ingredientName: {
    ...bodyStrongText,
    fontSize: FONT.size.smBody,
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
  } as TextStyle,
  ingredientQuantityParenthetical: {
    ...bodyTextLoose,
    fontSize: FONT.size.caption,
    color: COLORS.darkGray,
  } as TextStyle,
  revertButton: {
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  } as ViewStyle,
  infoButton: {
    width: ICON_SIZE.xl,
    height: ICON_SIZE.xl,
    borderRadius: RADIUS.lg,
    backgroundColor: 'transparent',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
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
    minWidth: ICON_SIZE.xl, // Reserve space for button even when not present
    justifyContent: 'flex-end', // Align button to the right
  } as ViewStyle,
});

export default React.memo(IngredientRow);
