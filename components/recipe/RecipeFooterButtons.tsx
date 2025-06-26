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
};

const RecipeFooterButtons: React.FC<RecipeFooterButtonsProps> = ({
  handleGoToSteps,
  isRewriting,
  isScalingInstructions,
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
            : 'Go to Steps'}
        </Text>
        {!(isRewriting || isScalingInstructions) && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={COLORS.white}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    padding: SPACING.pageHorizontal,
    borderTopWidth: BORDER_WIDTH.default,
    borderTopColor: COLORS.lightGray,
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
  } as ViewStyle,
  nextButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  nextButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    marginRight: SPACING.sm,
  } as TextStyle,
});

export default RecipeFooterButtons; 