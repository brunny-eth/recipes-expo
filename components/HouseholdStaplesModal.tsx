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

      // Close all category toggles by default
      const allCategories = Object.keys(HOUSEHOLD_STAPLES_BY_CATEGORY);
      const collapsedState = new Set(allCategories);
      setCollapsedSections(collapsedState);
      console.log('[HouseholdStaplesModal] 🔽 All category toggles collapsed by default');
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
                  Leave items out of your groceries
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
                                name={localSelected.includes(staple) ? "circle" : "circle-outline"}
                                size={24}
                                color={localSelected.includes(staple) ? COLORS.textDark : COLORS.textMuted}
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

              {/* All Buttons Stacked */}
              <View style={styles.buttonStack}>
                <TouchableOpacity onPress={() => onStaplesToggle(!staplesEnabled)} style={styles.stackedButton}>
                  <Text style={[styles.stackedButtonText, !staplesEnabled && styles.stackedButtonTextInactive]}>
                    {staplesEnabled ? 'Hide Pantry Items' : 'Show Pantry Items'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancel} style={styles.stackedButton}>
                  <Text style={styles.stackedButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.stackedButton}>
                  <Text style={styles.stackedButtonText}>Save</Text>
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
    fontFamily: FONT.family.graphikMedium,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
    textAlign: 'left',
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: COLORS.textMuted,
    textAlign: 'left',
  } as TextStyle,

  scrollWrapper: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  scrollHint: {
    fontFamily: 'Inter',
    fontSize: FONT.size.meta,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.tight,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  } as TextStyle,

  buttonStack: {
    alignItems: 'flex-start',
    gap: SPACING.sm,
  } as ViewStyle,
  stackedButton: {
    height: 24,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
  } as ViewStyle,
  stackedButtonText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 22,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'left',
    textTransform: 'none' as const,
  } as TextStyle,
  stackedButtonTextInactive: {
    color: COLORS.textMuted,
  } as TextStyle,
  scrollContainerWrapper: {
    position: 'relative', // Needed for absolute positioning of gradient
  } as ViewStyle,
  scrollContainer: {
    maxHeight: 350, // Increased height to show more content
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  categorySection: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  categoryHeader: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: FONT.size.body,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontFamily: 'Inter',
    fontSize: FONT.size.body,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    marginLeft: SPACING.md,
    flex: 1,
  } as TextStyle,
}); 