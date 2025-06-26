import React from 'react';
import { View, Text, StyleSheet, FlatList, ViewStyle } from 'react-native';
import { StructuredIngredient } from '@/common/types';
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
  scaledIngredients: StructuredIngredient[];
  selectedScaleFactor: number;
  appliedChanges: AppliedChange[];
  checkedIngredients: { [key: number]: boolean };
  toggleCheckIngredient: (index: number) => void;
  openSubstitutionModal: (ingredient: StructuredIngredient) => void;
  undoIngredientRemoval: (fullName: string) => void;
  undoSubstitution: (originalName: string) => void;
};

const IngredientList: React.FC<IngredientListProps> = ({
  scaledIngredients,
  selectedScaleFactor,
  appliedChanges,
  checkedIngredients,
  toggleCheckIngredient,
  openSubstitutionModal,
  undoIngredientRemoval,
  undoSubstitution,
}) => {
  const memoizedRenderIngredientRow = React.useCallback(
    ({ item, index }: { item: StructuredIngredient; index: number }) => {
      return (
        <IngredientRow
          ingredient={item}
          index={index}
          isChecked={!!checkedIngredients[index]}
          appliedChanges={appliedChanges}
          toggleCheckIngredient={toggleCheckIngredient}
          openSubstitutionModal={openSubstitutionModal}
          undoIngredientRemoval={undoIngredientRemoval}
          undoSubstitution={undoSubstitution}
        />
      );
    },
    [
      checkedIngredients,
      appliedChanges,
      toggleCheckIngredient,
      openSubstitutionModal,
      undoIngredientRemoval,
      undoSubstitution,
    ],
  );

  return (
    <FlatList
      data={scaledIngredients}
      keyExtractor={(item: StructuredIngredient, index: number) =>
        `${item.name}-${index}`
      }
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
      ListHeaderComponent={
        selectedScaleFactor !== 1 ? (
          <View style={styles.scaleInfoBanner}>
            <Text
              style={styles.scaleInfoText}
            >{`Showing ${selectedScaleFactor}x scaled up ingredients`}</Text>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <Text style={styles.placeholderText}>No ingredients found.</Text>
      }
      extraData={
        appliedChanges.length + Object.keys(checkedIngredients).length
      }
      renderItem={memoizedRenderIngredientRow}
    />
  );
};

const styles = StyleSheet.create({
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