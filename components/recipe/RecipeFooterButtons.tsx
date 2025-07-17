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
  handleRemoveFromSaved: () => void;
  handleSaveModifications: () => void;
  isSavingForLater?: boolean;
  entryPoint: string;
  hasModifications?: boolean;
  isAlreadyInMise?: boolean;
};

const RecipeFooterButtons: React.FC<RecipeFooterButtonsProps> = ({
  handleGoToSteps,
  isRewriting,
  isScalingInstructions,
  handleSaveForLater,
  handleRemoveFromSaved,
  handleSaveModifications,
  isSavingForLater = false,
  entryPoint,
  hasModifications = false,
  isAlreadyInMise = false,
}) => {
  const getMainButtonText = () => {
    if (isRewriting) return 'Customizing instructions...';
    if (isScalingInstructions) return 'Making sure everything lines up...';
    
    if (isAlreadyInMise) return 'Already in mise';
    
    switch (entryPoint) {
      case 'saved':
        return 'Add to your mise';
      case 'mise':
        return 'Go to steps';
      default:
        return 'Add to your mise';
    }
  };

  const getSecondaryButton = () => {
    switch (entryPoint) {
      case 'saved':
        return (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleRemoveFromSaved}
            disabled={isSavingForLater}
          >
            <Text style={styles.saveButtonText}>Remove from saved</Text>
          </TouchableOpacity>
        );
      case 'mise':
        return null; // Don't show the modifications button for mise entrypoint
      default:
        return (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveForLater}
            disabled={isSavingForLater}
          >
            {isSavingForLater && (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={styles.saveButtonText}>Save for later</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[
          styles.nextButton,
          (isRewriting || isScalingInstructions || isAlreadyInMise) && styles.nextButtonDisabled,
        ]}
        onPress={handleGoToSteps}
        disabled={isRewriting || isScalingInstructions || isAlreadyInMise}
      >
        {(isRewriting || isScalingInstructions) && !isAlreadyInMise && (
          <ActivityIndicator
            size="small"
            color={COLORS.white}
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.nextButtonText}>
          {getMainButtonText()}
        </Text>
      </TouchableOpacity>
      {getSecondaryButton()}
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
  saveButtonDisabled: {
    borderColor: COLORS.lightGray,
  },
  saveButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
  saveButtonTextDisabled: {
    color: COLORS.lightGray,
  },
});

export default RecipeFooterButtons; 