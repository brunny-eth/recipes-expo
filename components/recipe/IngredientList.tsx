import React from 'react';
import { View, Text, StyleSheet, FlatList, ViewStyle } from 'react-native';
import { StructuredIngredient, IngredientGroup } from '@/common/types';
import IngredientRow from '@/app/recipe/IngredientRow';
import {
  captionText,
  bodyStrongText,
  FONT,
} from '@/constants/typography';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';

// Type for a change (substitution or removal)
type AppliedChange = {
  from: string;
  to: StructuredIngredient | null;
};

type IngredientListProps = {
  ingredientGroups: IngredientGroup[];
  selectedScaleFactor: number;
  appliedChanges: AppliedChange[];
  checkedIngredients: { [key: number]: boolean };
  toggleCheckIngredient: (index: number) => void;
  openSubstitutionModal: (ingredient: StructuredIngredient) => void;
  undoIngredientRemoval: (fullName: string) => void;
  undoSubstitution: (originalName: string) => void;
};

const IngredientList: React.FC<IngredientListProps> = ({
  ingredientGroups,
  selectedScaleFactor,
  appliedChanges,
  checkedIngredients,
  toggleCheckIngredient,
  openSubstitutionModal,
  undoIngredientRemoval,
  undoSubstitution,
}) => {
  const renderIngredientGroup = ({ item: group, index: groupIndex }: { item: IngredientGroup; index: number }) => {
    if (!group.ingredients || group.ingredients.length === 0) {
      return null;
    }

    return (
      <View key={`group-${groupIndex}`} style={styles.groupContainer}>
        {/* Only show group name if it exists and it's not "Main" (default group) */}
        {group.name && group.name !== 'Main' && (
          <Text style={styles.groupHeader}>{group.name}</Text>
        )}
        
        {group.ingredients.map((ingredient, ingredientIndex) => {
          // Calculate global index for ingredient checking
          let globalIndex = 0;
          for (let i = 0; i < groupIndex; i++) {
            globalIndex += ingredientGroups[i].ingredients?.length || 0;
          }
          globalIndex += ingredientIndex;

          return (
            <IngredientRow
              key={`${ingredient.name}-${globalIndex}`}
              ingredient={ingredient}
              index={globalIndex}
              isChecked={!!checkedIngredients[globalIndex]}
              appliedChanges={appliedChanges}
              toggleCheckIngredient={toggleCheckIngredient}
              openSubstitutionModal={openSubstitutionModal}
              undoIngredientRemoval={undoIngredientRemoval}
              undoSubstitution={undoSubstitution}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {selectedScaleFactor !== 1 && (
        <View style={styles.scaleInfoBanner}>
          <Text style={styles.scaleInfoText}>
            {`Showing ${selectedScaleFactor}x scaled up ingredients`}
          </Text>
        </View>
      )}
      
      {ingredientGroups.length === 0 ? (
        <Text style={styles.placeholderText}>No ingredients found.</Text>
      ) : (
        <FlatList
          data={ingredientGroups}
          keyExtractor={(item: IngredientGroup, index: number) => `group-${index}-${item.name || 'unnamed'}`}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          extraData={appliedChanges.length + Object.keys(checkedIngredients).length}
          renderItem={renderIngredientGroup}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  groupContainer: {
    marginBottom: SPACING.base,
  },
  groupHeader: {
    ...bodyStrongText,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    marginTop: SPACING.base,
    paddingLeft: SPACING.xs,
  },
  placeholderText: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    marginTop: 5,
    textAlign: 'center',
    paddingVertical: SPACING.pageHorizontal,
  },
  scaleInfoBanner: {
    backgroundColor: COLORS.darkGray,
    padding: SPACING.base,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.smLg,
  } as ViewStyle,
  scaleInfoText: {
    ...bodyStrongText,
    fontSize: FONT.size.bodyMedium,
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default IngredientList; 