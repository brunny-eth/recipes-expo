import React, { useMemo } from 'react';
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
import { parseIngredientDisplayName } from '@/utils/ingredientHelpers';

type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

type IngredientRowProps = {
  ingredient: StructuredIngredient;
  index: number;
  isChecked: boolean;
  appliedChanges: AppliedChange[];
  toggleCheckIngredient: (idx: number) => void;
  openSubstitutionModal: (ing: StructuredIngredient) => void;
  undoIngredientRemoval: (name: string) => void;
  undoSubstitution: (originalName: string) => void;
  showCheckboxes?: boolean;
};

/**
 * Resolves the original ingredient name from appliedChanges instead of relying on parsed display names.
 */
function getOriginalIngredientNameFromAppliedChanges(
  appliedChanges: AppliedChange[],
  displayName: string,
): string {
  const { substitutedFor, baseName } = parseIngredientDisplayName(displayName);
  const fallback = substitutedFor || baseName;
  const match = appliedChanges.find((change) => change.to?.name === fallback);
  return match?.from || fallback;
}

const IngredientRow: React.FC<IngredientRowProps> = ({
  ingredient,
  index,
  isChecked,
  appliedChanges,
  toggleCheckIngredient,
  openSubstitutionModal,
  undoIngredientRemoval,
  undoSubstitution,
  showCheckboxes = true,
}) => {
  console.log(`[Render] Rendering IngredientRow: ${ingredient.name}`);
  const { baseName, isRemoved, substitutedFor } = parseIngredientDisplayName(
    ingredient.name,
  );
  console.log(`IngredientRow - Parsed baseName: ${baseName}`);
  const originalNameForSub = getOriginalIngredientNameFromAppliedChanges(
    appliedChanges,
    ingredient.name,
  );

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
        <View style={styles.bulletContainer}>
          <View style={styles.bullet} />
        </View>
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

        {isRemoved && (
          <TouchableOpacity
            style={styles.revertButton}
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

        {substitutedFor && !isRemoved && (
          <TouchableOpacity
            style={styles.revertButton}
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
          ingredient.suggested_substitutions &&
          ingredient.suggested_substitutions.length > 0 &&
          ingredient.suggested_substitutions.some(
            (sub) => sub && sub.name != null,
          ) && (
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => {
                /* removed verbose button press log */
                requestAnimationFrame(() => {
                  openSubstitutionModal(ingredient);
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`substitution-button-${ingredient.name}`}
            >
              <MaterialCommunityIcons
                name="swap-horizontal"
                size={FONT.size.lg}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
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
    paddingHorizontal: SPACING.smMd,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  } as ViewStyle,
  ingredientName: {
    ...bodyStrongText,
    color: COLORS.textDark,
    lineHeight: 24,
    flexShrink: 1,
    marginRight: SPACING.sm,
  } as TextStyle,
  ingredientTextRemoved: {
    color: COLORS.darkGray,
    textDecorationLine: 'line-through',
  } as TextStyle,
  ingredientRemovedTag: {
    color: COLORS.darkGray,
    fontStyle: 'italic',
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
    fontSize: FONT.size.bodyMedium,
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
  bulletContainer: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    marginRight: SPACING.smLg,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  } as ViewStyle,
});

export default React.memo(IngredientRow);
