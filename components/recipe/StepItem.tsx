import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { bodyText, bodyTextLoose, FONT } from '@/constants/typography';
import { StructuredIngredient } from '@/common/types';
import { 
  generateIngredientSearchTerms, 
  getUniqueSearchTermItems, 
  escapeRegex,
  debugIngredientSearchTerms
} from '@/utils/stepUtils';

interface StepItemProps {
  step: string;
  stepIndex: number;
  isCompleted: boolean;
  isActive: boolean;
  onStepPress: (stepIndex: number) => void;
  ingredients?: StructuredIngredient[];
  onIngredientPress?: (ingredient: StructuredIngredient) => void;
  showAnimation?: boolean;
}

export default function StepItem({
  step,
  stepIndex,
  isCompleted,
  isActive,
  onStepPress,
  ingredients = [],
  onIngredientPress,
  showAnimation = false,
}: StepItemProps) {
  
  const renderHighlightedInstruction = () => {
    if (!ingredients || ingredients.length === 0) {
      return (
        <Text style={[
          styles.stepText,
          isCompleted && styles.stepTextCompleted,
          isActive && styles.activeStepText,
        ]}>
          {step}
        </Text>
      );
    }

    // Debug: Log the search terms being generated
    if (__DEV__) {
      debugIngredientSearchTerms(ingredients);
    }

    const searchTermsWithIng = generateIngredientSearchTerms(ingredients);
    const uniqueSearchTermItems = getUniqueSearchTermItems(searchTermsWithIng);

    if (__DEV__) {
      console.log(`[StepItem] 📝 Step: "${step}"`);
      console.log(`[StepItem] 🎯 Unique search terms: [${uniqueSearchTermItems.map(item => `"${item.searchTerm}"`).join(', ')}]`);
    }

    if (uniqueSearchTermItems.length === 0) {
      return (
        <Text style={[
          styles.stepText,
          isCompleted && styles.stepTextCompleted,
          isActive && styles.activeStepText,
        ]}>
          {step}
        </Text>
      );
    }

    const regex = new RegExp(
      `(${uniqueSearchTermItems.map((item) => item.searchTerm).join('|')})`,
      'gi',
    );
    const parts = step.split(regex);

    if (__DEV__) {
      console.log(`[StepItem] ✂️ Split parts: [${parts.map(part => `"${part}"`).join(', ')}]`);
    }

    return (
      <Text style={[
        styles.stepText,
        isCompleted && styles.stepTextCompleted,
        isActive && styles.activeStepText,
      ]}>
        {parts
          .filter((part) => part)
          .map((part, index) => {
            const matchedItem = uniqueSearchTermItems.find(
              (item) => new RegExp(item.searchTerm, 'i').test(part),
            );
            if (matchedItem && onIngredientPress) {
              if (__DEV__) {
                console.log(`[StepItem] ✅ Matched: "${part}" → "${matchedItem.ingredient.name}"`);
              }
              return (
                <Text
                  key={index}
                  style={[
                    styles.highlightedText,
                    isCompleted && styles.stepTextCompleted,
                  ]}
                  onPress={
                    !isCompleted
                      ? () => onIngredientPress(matchedItem.ingredient)
                      : undefined
                  }
                >
                  {part}
                </Text>
              );
            }
            return <Text key={index}>{part}</Text>;
          })}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      onPress={() => onStepPress(stepIndex)}
      activeOpacity={0.6}
    >
      <View style={[
        styles.stepItem,
        isActive && styles.activeStep,
      ]}>
        <View style={styles.stepNumberContainer}>
          {isCompleted ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={COLORS.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name="circle-outline"
              size={24}
              color={isActive ? COLORS.primary : COLORS.lightGray}
            />
          )}
        </View>

        <View style={styles.stepContent}>
          {renderHighlightedInstruction()}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stepItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  activeStep: {
    transform: [{ scale: 1.02 }],
    backgroundColor: '#FFF9EF',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepContent: {
    flex: 1,
    paddingBottom: SPACING.sm,
  },
  stepText: {
    ...bodyText,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  stepTextCompleted: {
    color: COLORS.textDark,
    opacity: 0.5,
  },
  activeStepText: {
    ...bodyText,
    fontSize: 17,
    lineHeight: 24,
  },
  highlightedText: {
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.primary,
    fontSize: 16,
    lineHeight: 22,
  },
}); 