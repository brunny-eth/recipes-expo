import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT } from '@/constants/typography';

export type VariationType = 'low_fat' | 'higher_protein' | 'dairy_free' | 'vegetarian' | 'easier_recipe';

interface VariationOption {
  type: VariationType;
  label: string;
  description: string;
}

const VARIATION_OPTIONS: VariationOption[] = [
  {
    type: 'low_fat',
    label: 'Healthier Version',
    description: 'Reduce fat, sugar & calories'
  },
  {
    type: 'higher_protein',
    label: 'High Protein',
    description: 'Boost protein with lean sources'
  },
  {
    type: 'dairy_free',
    label: 'Dairy-Free',
    description: 'Replace dairy products'
  },
  {
    type: 'vegetarian',
    label: 'Vegetarian',
    description: 'Remove meat ingredients'
  },
  {
    type: 'easier_recipe',
    label: 'Easier Recipe',
    description: 'Simpler, faster, less cleanup'
  }
];

interface RecipeVariationsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectVariation: (variationType: VariationType) => void;
}

const RecipeVariationsModal: React.FC<RecipeVariationsModalProps> = ({
  visible,
  onClose,
  onSelectVariation,
}) => {
  const [selectedVariation, setSelectedVariation] = useState<VariationType | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setSelectedVariation(null);
    }
  }, [visible]);

  const handleSelectVariation = (variationType: VariationType) => {
    setSelectedVariation(variationType);
  };

  const handleConfirm = () => {
    if (selectedVariation) {
      onSelectVariation(selectedVariation);
    }
  };

  const handleClose = () => {
    setSelectedVariation(null);
    onClose();
  };

  if (!visible) return null;

  return (
          <TouchableOpacity style={styles.overlay} onPress={handleClose} activeOpacity={1}>
        <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Recipe Remix</Text>
        </View>

        <View style={styles.optionsContainer}>
          {VARIATION_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.optionItem,
                selectedVariation === option.type && styles.optionItemSelected
              ]}
              onPress={() => handleSelectVariation(option.type)}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  selectedVariation === option.type && styles.optionLabelSelected
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.optionDescription,
                  selectedVariation === option.type && styles.optionDescriptionSelected
                ]}>
                  {option.description}
                </Text>
              </View>
              {selectedVariation === option.type && (
                <Text style={styles.checkMark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Button container with consistent styling */}
        <View style={styles.buttonContainer}>
          {/* Start Remixing button moved to left (primary) */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              selectedVariation && styles.confirmButtonActive, // Primary style when active
              !selectedVariation && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedVariation}
          >
            <Text style={[
              styles.confirmButtonText,
              selectedVariation && styles.confirmButtonTextActive, // Primary text when active
              !selectedVariation && styles.confirmButtonTextDisabled
            ]}>
              Remix
            </Text>
          </TouchableOpacity>

          {/* Cancel button moved to right (secondary) */}
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        </View>


      </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: SPACING.lg,
  } as ViewStyle,
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    width: '90%',
    maxWidth: 350,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  } as ViewStyle,
  header: {
    alignItems: 'center',
    justifyContent: 'center', // Center the title
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md, // Reduced margin
  } as ViewStyle,
  title: {
    ...bodyStrongText, // Match other modals
    fontSize: FONT.size.lg, // Match other modals (18px)
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  closeButton: {
    padding: SPACING.xs,
  } as ViewStyle,
  closeButtonText: {
    fontSize: 24,
    color: COLORS.textMuted,
    fontWeight: 'bold',
  } as TextStyle,

  optionsContainer: {
    marginBottom: SPACING.xl,
  } as ViewStyle,
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  optionItemSelected: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.textDark,
  } as ViewStyle,

  optionContent: {
    flex: 1,
  } as ViewStyle,
  optionLabel: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginBottom: 2,
  } as TextStyle,
  optionLabelSelected: {
    color: COLORS.textDark,
  } as TextStyle,
  optionDescription: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.tight,
    color: COLORS.textMuted,
  } as TextStyle,
  optionDescriptionSelected: {
    color: COLORS.textMuted,
  } as TextStyle,
  checkMark: {
    fontSize: 20,
    color: COLORS.textDark,
    fontWeight: 'bold',
  } as TextStyle,
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.lg,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8, // Match button consistency
    alignItems: 'center',
    justifyContent: 'center',
    height: 46, // Match exact button height consistency
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  cancelButtonText: {
    ...bodyText, // Match modal button text style
    fontSize: FONT.size.body,
    color: '#000000',
    textAlign: 'center',
  } as TextStyle,
  confirmButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  confirmButtonActive: {
    backgroundColor: COLORS.primary, // Light blue background when active
    borderColor: '#000000',
  } as ViewStyle,
  confirmButtonDisabled: {
    backgroundColor: 'transparent',
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  confirmButtonText: {
    ...bodyText, // Match modal button text style
    fontSize: FONT.size.body,
    color: '#000000',
    textAlign: 'center',
  } as TextStyle,
  confirmButtonTextActive: {
    color: '#000000', // Keep black text on light blue background
  } as TextStyle,
  confirmButtonTextDisabled: {
    color: COLORS.textMuted,
  } as TextStyle,

});

export default RecipeVariationsModal;
