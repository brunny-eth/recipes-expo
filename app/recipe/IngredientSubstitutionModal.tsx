import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
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
  captionText,
  FONT,
} from '@/constants/typography';
import { SubstitutionSuggestion } from '../../common/types';

interface SubstitutionOption {
  id: string;
  name: string;
  description: string;
}

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

  const handleCloseWithLog = () => {
    console.log('[DEBUG] triggering onClose from modal');
    onClose();
  };

  useEffect(() => {
    console.log('[Modal] substitutionModalVisible changed to:', visible);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      console.log('[Modal] substitution modal unmount requested');
    }
  }, [visible]);

  console.log('[Render] substitution modal is', visible ? 'visible' : 'hidden');

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
    if (!substitutions || substitutions.length === 0) {
      return [removalOption];
    }
    const hasRemoval = substitutions.some(
      (opt) => opt.name === removalOption.name,
    );
    return hasRemoval ? substitutions : [...substitutions, removalOption];
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
    return `(approx. ${amountStr}${unitStr ? ' ' + unitStr : ''})`.trim();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleCloseWithLog}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={handleCloseWithLog}>
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
            <Text style={styles.title}>Substitute {ingredientName}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseWithLog}
            >
              <MaterialCommunityIcons
                name="close"
                size={ICON_SIZE.md}
                color={COLORS.textDark}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.optionsList}>
            {options && options.length > 0 ? (
              options.map((option, index) => {
                const quantityText = formatQuantity(option.amount, option.unit); // Format quantity
                return (
                  <TouchableOpacity
                    key={`${option.name}-${index}`}
                    style={[
                      styles.optionItem,
                      option.name === 'Remove ingredient' &&
                        styles.optionItemRemove,
                      selectedOption?.name === option.name &&
                        styles.optionItemSelected,
                    ]}
                    onPress={() => setSelectedOption(option)}
                  >
                    <View
                      style={[
                        styles.radioButton,
                        option.name === 'Remove ingredient' &&
                          styles.radioButtonRemove,
                      ]}
                    >
                      {selectedOption?.name === option.name && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={styles.optionContent}>
                      <View style={styles.optionNameContainer}>
                        <Text
                          style={[
                            styles.optionName,
                            option.name === 'Remove ingredient' &&
                              styles.optionNameRemove,
                          ]}
                        >
                          {option.name}
                        </Text>
                        {/* Display Formatted Quantity */}
                        {quantityText && (
                          <Text style={styles.optionQuantity}>
                            {quantityText}
                          </Text>
                        )}
                      </View>
                      {option.description && (
                        <Text style={styles.optionDescription}>
                          {option.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noSuggestionsText}>
                No automatic substitutions found for this ingredient.
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.applyButton,
              !selectedOption && styles.applyButtonDisabled,
            ]}
            onPress={handleApply}
            disabled={!selectedOption}
          >
            <Text style={styles.applyButtonText}>Apply Substitution</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.pageHorizontal,
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  optionsList: {
    marginBottom: SPACING.pageHorizontal,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    marginBottom: 12, // TODO: No token for 12
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
  },
  optionItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionItemRemove: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  radioButton: {
    width: ICON_SIZE.md,
    height: ICON_SIZE.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thick,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  radioButtonRemove: {
    borderColor: COLORS.error,
  },
  radioButtonInner: {
    width: ICON_SIZE.xs,
    height: ICON_SIZE.xs,
    borderRadius: 6, // TODO: No token for 6
    backgroundColor: COLORS.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionNameContainer: {
    // New container for name + quantity
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align text top
    marginBottom: SPACING.xs,
  },
  optionName: {
    ...bodyStrongText,
    color: COLORS.textDark,
    flexShrink: 1, // Allow name to wrap
    marginRight: SPACING.sm, // Space between name and quantity
  },
  optionNameRemove: {
    color: COLORS.error,
  },
  optionQuantity: {
    // Style for the quantity text
    ...captionText,
    color: COLORS.darkGray,
    textAlign: 'right',
  },
  optionDescription: {
    ...captionText,
    color: COLORS.darkGray,
  },
  noSuggestionsText: {
    ...captionText,
    fontStyle: 'italic',
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingVertical: SPACING.pageHorizontal,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  applyButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
});
