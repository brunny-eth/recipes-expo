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
import { COLORS } from '@/constants/theme';
import { abbreviateUnit } from '@/utils/format';
import { sectionHeaderText, bodyStrongText, captionText } from '@/constants/typography';
import { SubstitutionSuggestion } from '@/api/types';

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
  const [selectedOption, setSelectedOption] = useState<SubstitutionSuggestion | null>(null);

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
    const hasRemoval = substitutions.some(opt => opt.name === removalOption.name);
    return hasRemoval ? substitutions : [...substitutions, removalOption];
  }, [substitutions]);

  const handleApply = () => {
    if (selectedOption) {
      onApply(selectedOption);
      setSelectedOption(null); // Reset after applying
    }
  };

  // Helper to format the quantity display
  const formatQuantity = (amount: string | number | null | undefined, unit: string | null | undefined): string | null => {
    if (amount == null && unit == null) return null;
    const amountStr = amount != null ? String(amount) : '';
    // Use the same abbreviateUnit function from ingredients.tsx if available, otherwise fallback
    const unitStr = unit ? (typeof abbreviateUnit === 'function' ? abbreviateUnit(unit) : unit) : '';
    return `(approx. ${amountStr}${unitStr ? ' ' + unitStr : ''})`.trim();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.backdrop}
          />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify()}
          exiting={SlideOutDown.duration(150)}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Substitute {ingredientName}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
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
                      option.name === 'Remove ingredient' && styles.optionItemRemove,
                      selectedOption?.name === option.name && styles.optionItemSelected,
                    ]}
                    onPress={() => setSelectedOption(option)}
                  >
                    <View style={[styles.radioButton, option.name === 'Remove ingredient' && styles.radioButtonRemove]}>
                      {selectedOption?.name === option.name && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={styles.optionContent}>
                      <View style={styles.optionNameContainer}>
                        <Text style={[styles.optionName, option.name === 'Remove ingredient' && styles.optionNameRemove]}>{option.name}</Text>
                        {/* Display Formatted Quantity */}
                        {quantityText && (
                           <Text style={styles.optionQuantity}>{quantityText}</Text>
                        )}
                      </View>
                      {option.description && (
                         <Text style={styles.optionDescription}>{option.description}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  },
  closeButton: {
    padding: 8,
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  optionItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionItemRemove: {
    borderColor: COLORS.error || '#e53935',
    backgroundColor: '#fdecea',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  radioButtonRemove: {
    borderColor: COLORS.error || '#e53935',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionNameContainer: { // New container for name + quantity
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align text top
    marginBottom: 4,
  },
  optionName: {
    ...bodyStrongText,
    color: COLORS.textDark,
    flexShrink: 1, // Allow name to wrap
    marginRight: 8, // Space between name and quantity
  },
  optionNameRemove: {
    color: COLORS.error || '#e53935',
  },
  optionQuantity: { // Style for the quantity text
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
      paddingVertical: 20,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
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