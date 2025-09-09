import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  COLORS,
  OVERLAYS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
} from '@/constants/theme';
import { abbreviateUnit } from '@/utils/format';
import {
  sectionHeaderText,
  bodyStrongText,
  bodyText,
  metaText,
  captionText,
  FONT,
} from '@/constants/typography';
import { SubstitutionSuggestion } from '../../common/types';

interface IngredientSubstitutionModalProps {
  visible: boolean;
  onClose: () => void;
  ingredientName: string;
  substitutions: SubstitutionSuggestion[] | null; // Use updated type
  onApply: (selectedOption: SubstitutionSuggestion) => void; // Use updated type
}

export default function IngredientSubstitutionModal({
  visible,
  onClose,
  ingredientName,
  substitutions,
  onApply,
}: IngredientSubstitutionModalProps) {
  const [selectedOption, setSelectedOption] =
    useState<SubstitutionSuggestion | null>(null);

  const handleClose = () => {
    onClose();
  };



  /* ----------------------------------------------------
   * Ensure a "Remove ingredient" option is always present
   * ---------------------------------------------------- */
  const removalOption: SubstitutionSuggestion = {
    name: 'Remove ingredient',
    description: 'Omit this ingredient from the recipe.',
    amount: null,
    unit: null,
  };

  const options = useMemo<SubstitutionSuggestion[]>(() => {
    // Filter out invalid substitutions (empty names, null, undefined)
    const validSubstitutions = substitutions?.filter(
      (sub) => sub && sub.name && sub.name.trim() !== ''
    ) || [];
    
    if (validSubstitutions.length === 0) {
      return [removalOption];
    }
    
    const hasRemoval = validSubstitutions.some(
      (opt) => opt.name === removalOption.name,
    );
    return hasRemoval ? validSubstitutions : [...validSubstitutions, removalOption];
  }, [substitutions]);

  const handleApply = () => {
    if (selectedOption) {
      onApply(selectedOption);
      setSelectedOption(null); // Reset after applying
    }
  };

  // Helper to format the quantity display
  const formatQuantity = (
    amount: string | number | null | undefined,
    unit: string | null | undefined,
  ): string | null => {
    if (amount == null && unit == null) return null;
    const amountStr = amount != null ? String(amount) : '';
    // Use the same abbreviateUnit function from ingredients.tsx if available, otherwise fallback
    const unitStr = unit
      ? typeof abbreviateUnit === 'function'
        ? abbreviateUnit(unit)
        : unit
      : '';
    return `(${amountStr}${unitStr ? ' ' + unitStr : ''})`;
  };

  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
        />
      </Pressable>

      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(150)}
        exiting={SlideOutDown.duration(150)}
        style={styles.modalContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Substitute</Text>
          <Text style={styles.ingredientTitle} numberOfLines={2}>
            {ingredientName}
          </Text>
        </View>

        <ScrollView style={styles.optionsList}>
          {options && options.length > 0 ? (
            options.map((option, index) => {
              const quantityText = formatQuantity(option.amount, option.unit);
              return (
                <TouchableOpacity
                  key={`${option.name}-${index}`}
                  style={[
                    styles.optionItem,
                    index === 0 ? styles.optionItemFirst : null,
                    option.name === 'Remove ingredient'
                      ? styles.optionItemRemove
                      : selectedOption?.name === option.name
                        ? styles.optionItemSelected
                        : null,
                  ]}
                  onPress={() => setSelectedOption(option)}
                >
                  <View
                    style={[
                      styles.radioButton,
                      option.name === 'Remove ingredient' ? styles.radioButtonRemove : null,
                    ]}
                  >
                    {selectedOption?.name === option.name && (
                      <View style={[styles.radioButtonInner, option.name === 'Remove ingredient' && styles.radioButtonInnerRemove]} />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionName,
                        option.name === 'Remove ingredient' && styles.optionNameRemove,
                      ]}
                      numberOfLines={2}
                    >
                      {option.name}
                      {quantityText && (
                        <Text style={styles.optionQuantity}>
                          {` ${quantityText}`}
                        </Text>
                      )}
                    </Text>
                    {option.description && (
                      <Text style={styles.optionDescription} numberOfLines={2}>
                        {option.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noSuggestionsText}>No automatic substitutions found for this ingredient.</Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.applyButton, !selectedOption && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={!selectedOption}
        >
          <Text style={[
            styles.applyButtonText,
            !selectedOption && styles.applyButtonTextDisabled
          ]}>
            Apply Changes
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 2000,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAYS.medium,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.pageHorizontal,
    maxHeight: '80%',
    width: '100%',
    zIndex: 2001,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: SPACING.pageHorizontal,
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  ingredientTitle: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    textAlign: 'left',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  optionsList: {
    marginBottom: SPACING.pageHorizontal,
  },
  optionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  optionItemFirst: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  optionItemSelected: {
    backgroundColor: 'transparent',
  },
  optionItemRemove: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  radioButton: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  radioButtonRemove: {
    // No special styling needed
  },
  radioButtonInner: {
    width: ICON_SIZE.xs,
    height: ICON_SIZE.xs,
    borderRadius: RADIUS.smAlt,
    backgroundColor: '#000000',
  },
  radioButtonInnerRemove: {
    backgroundColor: COLORS.error,
  },
  optionContent: {
    flex: 1,
  },
  optionNameContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xxs,
  },
  optionName: {
    ...bodyText,
    color: COLORS.textDark,
    flexShrink: 1, // Allow name to wrap
    marginRight: SPACING.sm, // Space between name and quantity
  },
  optionNameRemove: {
    color: COLORS.error,
  },
  optionQuantity: {
    // Style for the quantity text
    ...metaText,
    color: COLORS.textMuted,
  },
  optionDescription: {
    ...captionText,
    color: COLORS.textMuted,
    marginTop: SPACING.xxs,
  },
  noSuggestionsText: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingVertical: SPACING.pageHorizontal,
  },
  applyButton: {
    marginBottom: SPACING.sm,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  applyButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});
