import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Dimensions,
} from 'react-native';
import {
  bodyText,
  captionStrongText,
  bodyStrongText,
  FONT,
} from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { getScaledYieldText, formatRecipeYield } from '@/utils/recipeUtils';

const screenWidth = Dimensions.get('window').width;
const contentHorizontalPadding = SPACING.pageHorizontal;
const servingsContainerGap = SPACING.sm;
const numButtons = 5;
const availableWidth = screenWidth - contentHorizontalPadding * 2;
const buttonTotalGap = servingsContainerGap * (numButtons - 1);
const buttonWidth = (availableWidth - buttonTotalGap) / numButtons;

const scaleFactorOptions = [
  { label: 'Half', value: 0.5 },
  { label: 'Original', value: 1.0 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
  { label: '4x', value: 4.0 },
];

type ServingScalerProps = {
  selectedScaleFactor: number;
  handleScaleFactorChange: (factor: number) => void;
  recipeYield: string | null | undefined;
  originalYieldValue: number | null;
  isViewingSavedRecipe?: boolean;
  appliedChanges?: any; // Add appliedChanges parameter
};

const ServingScaler: React.FC<ServingScalerProps> = ({
  selectedScaleFactor,
  handleScaleFactorChange,
  recipeYield,
  originalYieldValue,
  isViewingSavedRecipe = false,
  appliedChanges,
}) => {
  return (
    <>
      <Text style={styles.helperText}>
        {(() => {
          if (selectedScaleFactor === 1.0) {
            const formattedYield = formatRecipeYield(recipeYield);
            return formattedYield
              ? `This recipe makes ${formattedYield}. Scale it up or down here.`
              : `This recipe doesn't specify servings amount, but we can still scale amounts up or down if you'd like.`;
          }

          const direction = selectedScaleFactor < 1 ? 'down' : 'up';

          if (originalYieldValue && originalYieldValue > 0 && recipeYield) {
            let scaledYieldString;
            
            if (isViewingSavedRecipe) {
              // For saved recipes, calculate the relative scale factor
              const savedScaleFactor = (() => {
                if (appliedChanges) {
                  try {
                    const savedAppliedChanges = JSON.parse(appliedChanges);
                    return savedAppliedChanges.scalingFactor || 1.0;
                  } catch {
                    return 1.0;
                  }
                }
                return 1.0;
              })();
              
              // Calculate the relative scale factor and apply it
              const relativeScaleFactor = selectedScaleFactor / savedScaleFactor;
              scaledYieldString = getScaledYieldText(recipeYield, relativeScaleFactor);
            } else {
              // For new recipes, scale directly
              scaledYieldString = getScaledYieldText(recipeYield, selectedScaleFactor);
            }
            
            console.log('[DEBUG] ServingScaler yield:', {
              isViewingSavedRecipe,
              recipeYield,
              selectedScaleFactor,
              scaledYieldString,
            });
            return `Now scaled ${direction} to ${scaledYieldString}.`;
          }

          return `Now scaled ${direction} by ${selectedScaleFactor}x.`;
        })()}
      </Text>
      <View style={styles.servingsContainer}>
        {scaleFactorOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.servingButton,
              selectedScaleFactor === option.value &&
                styles.servingButtonSelected,
            ]}
            onPress={() => handleScaleFactorChange(option.value)}
          >
            <Text
              style={[
                styles.servingButtonText,
                selectedScaleFactor === option.value &&
                  styles.servingButtonTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  helperText: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm, // Use small spacing for consistency
    lineHeight: 18,
    textAlign: 'left',
  } as TextStyle,
  servingsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm, // Add top margin for consistent spacing from helper text
    marginBottom: 12,
    gap: servingsContainerGap,
  } as ViewStyle,
  servingButton: {
    width: buttonWidth,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  } as ViewStyle,
  servingButtonSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  } as ViewStyle,
  servingButtonText: {
    ...captionStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  servingButtonTextSelected: {
    color: COLORS.primary,
  } as TextStyle,
});

export default ServingScaler; 