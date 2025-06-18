import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { StructuredIngredient } from '@/api/types';
import { bodyStrongText, bodyText, captionText } from '@/constants/typography';
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
};

/**
 * Resolves the original ingredient name from appliedChanges instead of relying on parsed display names.
 */
function getOriginalIngredientNameFromAppliedChanges(
  appliedChanges: AppliedChange[],
  displayName: string
): string {
  const { substitutedFor, baseName } = parseIngredientDisplayName(displayName);
  const fallback = substitutedFor || baseName;
  const match = appliedChanges.find(change => change.to?.name === fallback);
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
}) => {
  console.log(`[Render] Rendering IngredientRow: ${ingredient.name}`);
  const { baseName, isRemoved, substitutedFor } = parseIngredientDisplayName(ingredient.name);
  const originalNameForSub = getOriginalIngredientNameFromAppliedChanges(appliedChanges, ingredient.name);

  return (
    <TouchableOpacity 
      style={[
        styles.ingredientItemContainer,
      ]}
      onPress={() => !isRemoved && toggleCheckIngredient(index)}
      activeOpacity={0.7} 
    >
      {/* Checkbox Visual */}
      {isRemoved ? (
        <View style={styles.checkboxPlaceholder} />
      ) : (
        <View 
          style={[styles.checkboxBase, isChecked && styles.checkboxChecked]}
          testID={`checkbox-${ingredient.name}`}
        >
          {isChecked && <View style={styles.checkboxInnerCheck} />}
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
          <Text style={[styles.ingredientName, isChecked && styles.ingredientTextChecked]} numberOfLines={0}> 
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
            <MaterialCommunityIcons name="arrow-u-left-top" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        
        {substitutedFor && !isRemoved && (
           <TouchableOpacity
            style={styles.revertButton}
            onPress={() => undoSubstitution(originalNameForSub)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-u-left-top" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Substitution Button */}
        {!substitutedFor && 
         !isRemoved &&
         ingredient.suggested_substitutions && 
         ingredient.suggested_substitutions.length > 0 && 
         ingredient.suggested_substitutions.some(sub => sub && sub.name != null) && (
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
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={COLORS.primary} />
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
      marginBottom: 15,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    checkboxPlaceholder: {
      width: 24,
      height: 24,
      marginRight: 15,
    },
    checkboxBase: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: COLORS.primary,
      marginRight: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    checkboxInnerCheck: {
        width: 12,
        height: 12,
        backgroundColor: COLORS.white,
    },
    ingredientNameContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    ingredientName: {
      ...bodyStrongText,
      color: COLORS.textDark,
      lineHeight: 24,
      flexShrink: 1,
      marginRight: 8,
    },
    ingredientTextRemoved: {
      color: COLORS.darkGray,
      textDecorationLine: 'line-through',
    },
    ingredientRemovedTag: {
      color: COLORS.darkGray,
      fontStyle: 'italic',
    },
    ingredientTextChecked: {
        color: COLORS.darkGray,
        textDecorationLine: 'line-through',
    },
    ingredientPreparation: {
      ...captionText,
      fontStyle: 'italic',
      color: COLORS.darkGray,
      marginTop: 2,
      marginLeft: 2,
    },
    ingredientQuantityParenthetical: {
      ...bodyText,
      fontSize: 15,
      color: COLORS.darkGray,
    },
    revertButton: {
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    infoButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
  });
  

export default React.memo(IngredientRow); 