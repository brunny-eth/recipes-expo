import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { bodyStrongText, bodyText, sectionHeaderText } from '@/constants/typography';

// Predefined list of common household staples
const HOUSEHOLD_STAPLES = [
  'salt',
  'black pepper',
  'ground pepper', 
  'all purpose flour',
  'nonstick cooking spray',
  'granulated sugar',
  'brown sugar',
  'olive oil',
  'vegetable oil',
  'butter',
  'eggs',
  'milk',
  'onion',
  'garlic',
  'baking soda',
  'baking powder',
  'vanilla extract',
];

interface HouseholdStaplesModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStaples: string[];
  onStaplesChange: (staples: string[]) => void;
}

export default function HouseholdStaplesModal({
  visible,
  onClose,
  selectedStaples,
  onStaplesChange,
}: HouseholdStaplesModalProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedStaples);

  // Sync with props when modal opens
  useEffect(() => {
    if (visible) {
      // If no staples are selected, default to salt and pepper
      if (selectedStaples.length === 0) {
        const defaultStaples = ['salt', 'black pepper', 'ground pepper'];
        setLocalSelected(defaultStaples);
        console.log('[HouseholdStaplesModal] 🏠 Setting default staples:', defaultStaples);
      } else {
        setLocalSelected(selectedStaples);
      }
    }
  }, [visible, selectedStaples]);

  const handleToggleStaple = (staple: string) => {
    setLocalSelected(prev => 
      prev.includes(staple)
        ? prev.filter(s => s !== staple)
        : [...prev, staple]
    );
  };

  const handleToggleAll = () => {
    if (localSelected.length === HOUSEHOLD_STAPLES.length) {
      setLocalSelected([]); // If all selected, select none
    } else {
      setLocalSelected(HOUSEHOLD_STAPLES); // Otherwise, select all
    }
  };

  const handleSave = () => {
    onStaplesChange(localSelected);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelected(selectedStaples); // Reset to original
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Household Staples</Text>
                <Text style={styles.subtitle}>
                  Select items you typically have at home to filter them from your grocery list
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleToggleAll} style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>
                    {localSelected.length === HOUSEHOLD_STAPLES.length ? 'Clear All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.scrollWrapper}>
                <Text style={styles.scrollHint}>Scroll to see all items</Text>
                <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
                  {HOUSEHOLD_STAPLES.map((staple) => (
                  <TouchableOpacity
                    key={staple}
                    style={styles.stapleItem}
                    onPress={() => handleToggleStaple(staple)}
                  >
                    <MaterialCommunityIcons
                      name={localSelected.includes(staple) ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={24}
                      color={localSelected.includes(staple) ? COLORS.primary : COLORS.secondary}
                    />
                    <Text style={styles.stapleText}>{staple}</Text>
                  </TouchableOpacity>
                                  ))}
                </ScrollView>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>
                    Save Staples
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: '90%',
    maxHeight: '80%',
  } as ViewStyle,
  header: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  } as TextStyle,
  subtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    lineHeight: 20,
  } as TextStyle,
  buttonRow: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  } as ViewStyle,
  selectButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.surface,
  } as ViewStyle,
  selectButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
  scrollWrapper: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  scrollHint: {
    ...bodyText,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  } as TextStyle,
  scrollContainer: {
    maxHeight: 300,
    borderWidth: BORDER_WIDTH.hairline,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
  } as ViewStyle,
  stapleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  stapleText: {
    ...bodyText,
    color: COLORS.textDark,
    marginLeft: SPACING.md,
    flex: 1,
  } as TextStyle,
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  } as ViewStyle,
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.md,
    alignItems: 'center',
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
  } as TextStyle,
  saveButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  } as ViewStyle,
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
}); 