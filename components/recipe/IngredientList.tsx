import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ViewStyle, TextStyle } from 'react-native';
import { StructuredIngredient, IngredientGroup } from '@/common/types';
import IngredientRow from '@/app/recipe/IngredientRow';
import CollapsibleSection from '@/components/CollapsibleSection';
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
  // State to track which groups are expanded (default: all collapsed = false)
  const [expandedGroups, setExpandedGroups] = useState<{ [key: number]: boolean }>({});

  const toggleGroupExpanded = (groupIndex: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupIndex]: !prev[groupIndex]
    }));
  };

  // Determine if we should show group toggles (only if multiple groups)
  const shouldShowGroupToggles = ingredientGroups.length > 1;
  const renderIngredientGroup = ({ item: group, index: groupIndex }: { item: IngredientGroup; index: number }) => {
    if (!group.ingredients || group.ingredients.length === 0) {
      return null;
    }

    const renderIngredients = () => {
      return group.ingredients!.map((ingredient, ingredientIndex) => {
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
      });
    };

    // If there's only 1 group, don't show group headings - just show ingredients
    if (!shouldShowGroupToggles) {
      return (
        <View key={`group-${groupIndex}`} style={styles.groupContainer}>
          {renderIngredients()}
        </View>
      );
    }

    // If there are multiple groups, show each group with a toggle
    // Use group name or a default title
    const groupTitle = group.name === 'Main' ? 'Main Ingredients' : 
                      (group.name || `Group ${groupIndex + 1}`);
    const isExpanded = !!expandedGroups[groupIndex];

    return (
      <View key={`group-${groupIndex}`} style={styles.groupContainer}>
        <CollapsibleSection
          title={groupTitle}
          isExpanded={isExpanded}
          onToggle={() => toggleGroupExpanded(groupIndex)}
          titleStyle={styles.groupToggleTitle}
        >
          {renderIngredients()}
        </CollapsibleSection>
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
  groupToggleTitle: {
    fontSize: FONT.size.bodyMedium, // Smaller than main Ingredients heading (which uses sectionHeaderText)
  } as TextStyle,
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