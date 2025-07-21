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
  onAIChatPress: () => void;
  hasRecipeTips?: boolean;
};

const StepsFooterButtons: React.FC<StepsFooterButtonsProps> = ({
  onTimersPress,
  onRecipeTipsPress,
  onAIChatPress,
  hasRecipeTips = false,
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
        
        <TouchableOpacity
          style={styles.aiChatButton}
          onPress={onAIChatPress}
        >
          <Text style={styles.aiChatButtonText}>Ask for help</Text>
        </TouchableOpacity>
      </View>
      
      {hasRecipeTips && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={onRecipeTipsPress}
          >
            <Text style={styles.buttonText}>Recipe Tips</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: BORDER_WIDTH.hairline,
    borderTopColor: COLORS.divider,
  } as ViewStyle,
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  buttonText: {
    ...bodyStrongText,
    color: COLORS.white,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  timerButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
  aiChatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  aiChatButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  } as TextStyle,
});

export default StepsFooterButtons; 