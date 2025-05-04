import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { abbreviateUnit } from './ingredients'; // Import helper if needed

interface SubstitutionOption {
  id: string;
  name: string;
  description: string;
}

// Define the type for a single substitution suggestion (matching backend and ingredients screen)
interface SubstitutionSuggestion {
  name: string;
  description?: string | null;
  amount?: string | number | null; // Added
  unit?: string | null;       // Added
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
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.backdrop}
          />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify()}
          exiting={SlideOutDown.springify()}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Substitute {ingredientName}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.optionsList}>
            {substitutions && substitutions.length > 0 ? (
              substitutions.map((option, index) => {
                const quantityText = formatQuantity(option.amount, option.unit); // Format quantity
                return (
                  <TouchableOpacity
                    key={`${option.name}-${index}`}
                    style={[
                      styles.optionItem,
                      selectedOption?.name === option.name && styles.optionItemSelected,
                    ]}
                    onPress={() => setSelectedOption(option)}
                  >
                    <View style={styles.radioButton}>
                      {selectedOption?.name === option.name && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={styles.optionContent}>
                      <View style={styles.optionNameContainer}>
                        <Text style={styles.optionName}>{option.name}</Text>
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
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
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
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    flexShrink: 1, // Allow name to wrap
    marginRight: 8, // Space between name and quantity
  },
  optionQuantity: { // Style for the quantity text
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.darkGray,
    textAlign: 'right',
  },
  optionDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.darkGray,
  },
  noSuggestionsText: {
      fontFamily: 'Poppins-Italic',
      fontSize: 14,
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
    backgroundColor: COLORS.textGray,
  },
  applyButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
}); 