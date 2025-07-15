import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { bodyStrongText } from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';

type StepsFooterButtonsProps = {
  onTimersPress: () => void;
  onRecipeTipsPress: () => void;
  onSaveRecipePress: () => void;
  isSaving?: boolean;
  hasModifications?: boolean;
  hasRecipeTips?: boolean;
};

const StepsFooterButtons: React.FC<StepsFooterButtonsProps> = ({
  onTimersPress,
  onRecipeTipsPress,
  onSaveRecipePress,
  isSaving = false,
  hasModifications = false,
  hasRecipeTips = false,
}) => {
  return (
    <View style={styles.footer}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={onTimersPress}
        >
          <Text style={styles.buttonText}>Timers</Text>
        </TouchableOpacity>
        
        {hasRecipeTips && (
          <TouchableOpacity
            style={styles.button}
            onPress={onRecipeTipsPress}
          >
            <Text style={styles.buttonText}>Recipe Tips</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.button,
            isSaving && styles.buttonDisabled,
          ]}
          onPress={onSaveRecipePress}
          disabled={isSaving || !hasModifications}
        >
          {isSaving ? (
            <ActivityIndicator
              size="small"
              color={COLORS.white}
              style={{ marginRight: 4 }}
            />
          ) : null}
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </Text>
        </TouchableOpacity>
      </View>
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
  buttonDisabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.6,
  } as ViewStyle,
  buttonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 14,
  } as TextStyle,
});

export default StepsFooterButtons; 