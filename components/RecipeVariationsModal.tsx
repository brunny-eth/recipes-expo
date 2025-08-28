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
import { bodyStrongText } from '@/constants/typography';

export type VariationType = 'low_fat' | 'higher_protein' | 'gluten_free' | 'dairy_free' | 'vegetarian' | 'easier_recipe';

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
    type: 'gluten_free',
    label: 'Gluten-Free',
    description: 'Remove gluten ingredients'
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

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              !selectedVariation && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedVariation}
          >
            <Text style={[
              styles.confirmButtonText,
              !selectedVariation && styles.confirmButtonTextDisabled
            ]}>
              Apply
            </Text>
          </TouchableOpacity>
        </View>
        </View>


      </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  } as ViewStyle,
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  } as ViewStyle,
  title: {
    ...bodyStrongText,
    fontSize: 20,
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
    borderColor: COLORS.lightGray,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  optionItemSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  } as ViewStyle,

  optionContent: {
    flex: 1,
  } as ViewStyle,
  optionLabel: {
    ...bodyStrongText,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 2,
  } as TextStyle,
  optionLabelSelected: {
    color: COLORS.white,
  } as TextStyle,
  optionDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
  } as TextStyle,
  optionDescriptionSelected: {
    color: COLORS.white,
  } as TextStyle,
  checkMark: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: 'bold',
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    fontSize: 14,
  } as TextStyle,
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  confirmButtonDisabled: {
    backgroundColor: COLORS.lightGray,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  confirmButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 14,
  } as TextStyle,
  confirmButtonTextDisabled: {
    color: COLORS.textMuted,
  } as TextStyle,

});

export default RecipeVariationsModal;
