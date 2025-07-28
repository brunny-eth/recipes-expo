import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { bodyStrongText } from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';

type StepsFooterButtonsProps = {
  onTimersPress: () => void;
  onRecipeTipsPress: () => void;
  hasRecipeTips?: boolean;
  onEndCookingSessions?: () => void;
};

const StepsFooterButtons: React.FC<StepsFooterButtonsProps> = ({
  onTimersPress,
  onRecipeTipsPress,
  hasRecipeTips = false,
  onEndCookingSessions,
}) => {
  return (
    <View style={styles.footer}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.timerButton}
          onPress={onTimersPress}
        >
          <Text style={styles.timerButtonText}>Timer</Text>
        </TouchableOpacity>
      </View>
      
      {hasRecipeTips && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.recipeTipsButton}
            onPress={onRecipeTipsPress}
          >
            <Text style={styles.recipeTipsButtonText}>Recipe Tips</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {onEndCookingSessions && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.endSessionsButton}
            onPress={onEndCookingSessions}
          >
            <Text style={styles.endSessionsButtonText}>End Cooking Sessions</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.background,
    borderTopWidth: BORDER_WIDTH.hairline,
    borderTopColor: COLORS.divider,
  } as ViewStyle,
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,
  recipeTipsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  recipeTipsButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
  timerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  timerButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
  endSessionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.error || '#FF4444',
  } as ViewStyle,
  endSessionsButtonText: {
    ...bodyStrongText,
    color: COLORS.error || '#FF4444',
    fontSize: 14,
  } as TextStyle,
});

export default StepsFooterButtons; 