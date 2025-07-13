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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { bodyStrongText } from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';

type RecipeFooterButtonsProps = {
  handleGoToSteps: () => void;
  isRewriting: boolean;
  isScalingInstructions: boolean;
  handleSaveForLater: () => void;
  isSavingForLater?: boolean;
};

const RecipeFooterButtons: React.FC<RecipeFooterButtonsProps> = ({
  handleGoToSteps,
  isRewriting,
  isScalingInstructions,
  handleSaveForLater,
  isSavingForLater = false,
}) => {
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[
          styles.nextButton,
          (isRewriting || isScalingInstructions) && styles.nextButtonDisabled,
        ]}
        onPress={handleGoToSteps}
        disabled={isRewriting || isScalingInstructions}
      >
        {(isRewriting || isScalingInstructions) && (
          <ActivityIndicator
            size="small"
            color={COLORS.white}
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.nextButtonText}>
          {isRewriting
            ? 'Customizing instructions...'
            : isScalingInstructions
            ? 'Making sure everything lines up...'
            : 'Add this recipe to your mise'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveForLater}
        disabled={isSavingForLater}
      >
        <Text style={styles.saveButtonText}>Save for later</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
    paddingBottom: 0,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
    marginBottom: SPACING.sm,
  } as ViewStyle,
  nextButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  nextButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    marginRight: SPACING.sm,
  } as TextStyle,
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.sm,
  } as ViewStyle,
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
});

export default RecipeFooterButtons; 