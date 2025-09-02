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

// Predefined list of common household staples organized by category
const HOUSEHOLD_STAPLES_BY_CATEGORY = {
  'Baking': [
    'all purpose flour',
    'baking soda',
    'baking powder',
    'granulated sugar',
    'brown sugar',
    'powdered sugar',
    'sugar',
    'vanilla extract',
    'cocoa powder',
    'chocolate chips',
    'yeast',
    'cornstarch',
  ],
  'Oils & Fats': [
    'olive oil',
    'vegetable oil',
    'canola oil',
    'butter',
    'coconut oil',
    'sesame oil',
    'nonstick cooking spray',
  ],
  'Spices & Seasonings': [
    'salt',
    'black pepper',
    'ground pepper',
    'garlic powder',
    'onion powder',
    'paprika',
    'cinnamon',
    'oregano',
    'basil',
    'thyme',
    'cumin',
    'chili powder',
    'cayenne',
    'coriander',
    'cardamom',
    'turmeric',
  ],
  'Dairy & Eggs': [
    'milk',
    'eggs',
    'heavy cream',
    'sour cream',
    'cream cheese',
    'parmesan cheese',
  ],
  'Pantry Basics': [
    'onion',
    'garlic',
    'potatoes',
    'rice',
    'pasta',
    'beans',
    'tomato paste',
    'chicken broth',
    'soy sauce',
    'vinegar',
    'mayo',
    'honey',
    'maple syrup',
  ],
};

// Flatten the categorized staples for reference
const ALL_STAPLES = Object.values(HOUSEHOLD_STAPLES_BY_CATEGORY).flat();

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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Sync with props when modal opens
  useEffect(() => {
    if (visible) {
      // If no staples are selected, default to some common basics
      if (selectedStaples.length === 0) {
        const defaultStaples = ['salt', 'black pepper', 'all purpose flour', 'olive oil', 'eggs'];
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

  const handleToggleSection = (category: string) => {
    setCollapsedSections(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(category)) {
        newCollapsed.delete(category);
      } else {
        newCollapsed.add(category);
      }
      return newCollapsed;
    });
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
                <View style={styles.scrollContainerWrapper}>
                  <ScrollView 
                    style={styles.scrollContainer} 
                    showsVerticalScrollIndicator={true}
                    indicatorStyle="black"
                  >
                    {Object.entries(HOUSEHOLD_STAPLES_BY_CATEGORY).map(([category, staples]) => {
                      const isCollapsed = collapsedSections.has(category);
                      return (
                        <View key={category} style={styles.categorySection}>
                          <TouchableOpacity
                            style={styles.categoryHeaderContainer}
                            onPress={() => handleToggleSection(category)}
                          >
                            <Text style={styles.categoryHeader}>{category}</Text>
                            <MaterialCommunityIcons
                              name={isCollapsed ? "chevron-down" : "chevron-up"}
                              size={20}
                              color={COLORS.textMuted}
                            />
                          </TouchableOpacity>
                          {!isCollapsed && staples.map((staple) => (
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
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
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
    maxHeight: '85%', // Increased height to accommodate more content
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
  scrollContainerWrapper: {
    position: 'relative', // Needed for absolute positioning of gradient
  } as ViewStyle,
  scrollContainer: {
    maxHeight: 350, // Increased height to show more content
    borderWidth: 2, // Thicker border to make it more obvious
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    // Add shadow to make the container stand out
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,
  categorySection: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  categoryHeader: {
    ...bodyStrongText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.primaryLight,
  } as TextStyle,
  categoryHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
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