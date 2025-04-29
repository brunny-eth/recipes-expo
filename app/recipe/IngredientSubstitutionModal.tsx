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

interface SubstitutionOption {
  id: string;
  name: string;
  description: string;
}

interface IngredientSubstitutionModalProps {
  visible: boolean;
  onClose: () => void;
  ingredientName: string;
  onApply: (selectedOption: SubstitutionOption) => void;
}

const SAMPLE_SUBSTITUTIONS: SubstitutionOption[] = [
  {
    id: '1',
    name: 'Almond Milk',
    description: 'A dairy-free alternative with a nutty flavor',
  },
  {
    id: '2',
    name: 'Oat Milk',
    description: 'Creamy and naturally sweet, great for baking',
  },
  {
    id: '3',
    name: 'Soy Milk',
    description: 'High in protein and closest to dairy milk in texture',
  },
  {
    id: '4',
    name: 'Coconut Milk',
    description: 'Rich and creamy, adds a tropical flavor',
  },
];

export default function IngredientSubstitutionModal({
  visible,
  onClose,
  ingredientName,
  onApply,
}: IngredientSubstitutionModalProps) {
  const [selectedOption, setSelectedOption] = useState<SubstitutionOption | null>(null);

  const handleApply = () => {
    if (selectedOption) {
      onApply(selectedOption);
      setSelectedOption(null);
    }
  };

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
            {SAMPLE_SUBSTITUTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  selectedOption?.id === option.id && styles.optionItemSelected,
                ]}
                onPress={() => setSelectedOption(option)}
              >
                <View style={styles.radioButton}>
                  {selectedOption?.id === option.id && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
    borderColor: COLORS.border,
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
  optionName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  optionDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.textLight,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  applyButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
}); 