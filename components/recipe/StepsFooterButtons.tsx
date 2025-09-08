import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { bodyStrongText, FONT } from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';

type StepsFooterButtonsProps = {
  onTimersPress: () => void;
  onRecipeTipsPress: () => void;
  onEndCookingSessions?: () => void;
  // Save button props
  hasChanges?: boolean;
  isSaving?: boolean;
  onSavePress?: () => void;
};

const StepsFooterButtons: React.FC<StepsFooterButtonsProps> = ({
  onTimersPress,
  onRecipeTipsPress,
  onEndCookingSessions,
  hasChanges = false,
  isSaving = false,
  onSavePress,
}) => {
  return (
    <View style={styles.footer}>
      {/* Save Button - Conditional */}
      {hasChanges && onSavePress && (
        <TouchableOpacity
          style={styles.saveButton}
          onPress={onSavePress}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Updated Recipe'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.timerButton}
        onPress={onTimersPress}
      >
        <Text style={styles.timerButtonText}>Timer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.recipeTipsButton}
        onPress={onRecipeTipsPress}
      >
        <Text style={styles.recipeTipsButtonText}>Recipe Info</Text>
      </TouchableOpacity>

      {onEndCookingSessions && (
        <TouchableOpacity
          style={styles.endSessionsButton}
          onPress={onEndCookingSessions}
        >
          <Text style={styles.endSessionsButtonText}>End Cooking Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
    paddingBottom: 20, // Reduced from SPACING.xxl (32px) to 20px
    backgroundColor: COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  } as ViewStyle,
  recipeTipsButton: {
    marginBottom: SPACING.sm,
  } as ViewStyle,
  recipeTipsButtonText: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  timerButton: {
    marginBottom: SPACING.sm,
  } as ViewStyle,
  timerButtonText: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  endSessionsButton: {
    marginBottom: 4, // Reduced from SPACING.sm (8px) to 4px for last button
  } as ViewStyle,
  endSessionsButtonText: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  // Save button styles
  saveButton: {
    marginBottom: SPACING.sm,
  } as ViewStyle,
  saveButtonText: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
});

export default StepsFooterButtons; 