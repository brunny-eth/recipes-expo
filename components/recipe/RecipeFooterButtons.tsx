import React, { useState } from 'react';
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
import FolderPickerModal from '@/components/FolderPickerModal';

type RecipeFooterButtonsProps = {
  handleGoToSteps: () => void;
  isRewriting: boolean;
  isScalingInstructions: boolean;
  handleSaveToFolder: (folderId: number) => void; // Updated to accept folderId
  handleRemoveFromSaved: () => void;
  handleSaveModifications: () => void;
  handleCookNow: () => void;
  isSavingForLater?: boolean;
  isSavingModifications?: boolean;
  isCookingNow?: boolean;
  entryPoint: string;
  hasModifications?: boolean;
  isAlreadyInMise?: boolean;
};

const RecipeFooterButtons: React.FC<RecipeFooterButtonsProps> = ({
  handleGoToSteps,
  isRewriting,
  isScalingInstructions,
  handleSaveToFolder, // Updated prop name
  handleRemoveFromSaved,
  handleSaveModifications,
  handleCookNow,
  isSavingForLater = false,
  isSavingModifications = false,
  isCookingNow = false,
  entryPoint,
  hasModifications = false,
  isAlreadyInMise = false,
}) => {
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const handleFolderPickerSelect = (folderId: number) => {
    setShowFolderPicker(false);
    handleSaveToFolder(folderId);
  };

  const handleSaveForLaterPress = () => {
    setShowFolderPicker(true);
  };


  const getMainButtonText = () => {
    if (isRewriting || isSavingModifications) return 'Processing modifications...';
    if (isScalingInstructions) return 'Making sure everything lines up...';
    
    if (isAlreadyInMise) return 'Already in prep station';
    
    switch (entryPoint) {
      case 'saved':
        return 'Cook now';
      case 'mise':
        return 'Update Recipe';
      default:
        return 'Cook now';
    }
  };

  const getMainButtonHandler = () => {
    switch (entryPoint) {
      case 'mise':
        return handleSaveModifications;
      default:
        return handleGoToSteps;
    }
  };

  const isMainButtonDisabled = () => {
    if (isRewriting || isScalingInstructions || isSavingModifications || isAlreadyInMise) return true;
    
    // For mise entry point, disable if no modifications
    if (entryPoint === 'mise' && !hasModifications) {
      return true;
    }
    
    return false;
  };

  const buttonDisabled = isMainButtonDisabled();

  const getSecondaryButton = () => {
    switch (entryPoint) {
      case 'saved':
        return null; // Only one primary button for saved entrypoint
      case 'mise':
        return null; // Don't show the modifications button for mise entrypoint
      default:
        return (
          <TouchableOpacity
            style={[
              styles.saveButton,
              isSavingForLater && styles.saveButtonDisabled
            ]}
            onPress={handleSaveForLaterPress} // Updated to show folder picker
            disabled={isSavingForLater}
          >
            {isSavingForLater && (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={[
              styles.saveButtonText,
              isSavingForLater && styles.saveButtonTextDisabled
            ]}>
              {isSavingForLater ? 'Processing modifications...' : 'Cook later'}
            </Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            buttonDisabled && styles.nextButtonDisabled,
          ]}
          onPress={getMainButtonHandler()}
          disabled={buttonDisabled}
        >
          {(isRewriting || isScalingInstructions || isSavingModifications) && (
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

      {/* Folder Picker Modal */}
      <FolderPickerModal
        visible={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelectFolder={handleFolderPickerSelect}
        isLoading={isSavingForLater}
      />
    </>
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