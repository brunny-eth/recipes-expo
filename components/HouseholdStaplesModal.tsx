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
import { COLORS, SPACING, RADIUS, BORDER_WIDTH, OVERLAYS } from '@/constants/theme';
import { bodyStrongText, bodyText, sectionHeaderText, FONT } from '@/constants/typography';

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
  staplesEnabled: boolean;
  onStaplesToggle: (enabled: boolean) => void;
}

export default function HouseholdStaplesModal({
  visible,
  onClose,
  selectedStaples,
  onStaplesChange,
  staplesEnabled,
  onStaplesToggle,
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
      animationType="fade"
      transparent
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Pantry</Text>
                <Text style={styles.subtitle}>
                  Select items to leave out of your shopping list
                </Text>
              </View>

              {/* Toggle removed from modal; handled on main grocery list */}

              <View style={styles.scrollWrapper}>
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

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleToggleAll} style={styles.selectButton}>
                  <Text style={styles.selectButtonText}>
                    {localSelected.length === HOUSEHOLD_STAPLES.length ? 'Clear all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleCancel} style={[styles.button, styles.cancelButton]}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.button, styles.saveButton]}>
                  <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: OVERLAYS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  } as ViewStyle,
  header: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  title: {
    fontFamily: FONT.family.bold,
    fontSize: FONT.size.sectionHeader,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  } as TextStyle,
  toggleRow: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  } as ViewStyle,
  toggleButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  toggleButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 14,
  } as TextStyle,
  buttonRow: {
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,
  selectButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  } as ViewStyle,
  selectButtonText: {
    color: COLORS.textDark,
    fontSize: FONT.size.caption,
    textAlign: 'left',
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
    backgroundColor: COLORS.white,
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
    gap: SPACING.md,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
  } as TextStyle,
  saveButton: {
    backgroundColor: COLORS.primary,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
  } as ViewStyle,
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
}); 