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
import { bodyStrongText, FONT } from '@/constants/typography';
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
  handleSaveChanges?: () => void; // New prop for saving changes on saved recipes
  isSavingForLater?: boolean;
  isSavingModifications?: boolean;
  isSavingChanges?: boolean; // New loading state for save changes
  entryPoint: string;
  hasModifications?: boolean;
  isAlreadyInMise?: boolean;
  onOpenVariations?: () => void; // New prop for opening variations modal
};

const RecipeFooterButtons: React.FC<RecipeFooterButtonsProps> = ({
  handleGoToSteps,
  isRewriting,
  isScalingInstructions,
  handleSaveToFolder, // Updated prop name
  handleRemoveFromSaved,
  handleSaveModifications,
  handleCookNow,
  handleSaveChanges, // New prop
  isSavingForLater = false,
  isSavingModifications = false,
  isSavingChanges = false, // New loading state
  entryPoint,
  hasModifications = false,
  isAlreadyInMise = false,
  onOpenVariations,
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
        return 'Cook';
      case 'mise':
        return 'Update Recipe';
      default:
        return 'Cook';
    }
  };

  const getMainButtonHandler = () => {
    switch (entryPoint) {
      case 'saved':
        return handleCookNow;
      case 'mise':
        return handleSaveModifications;
      default:
        return handleCookNow; // All entry points now use mise-based cooking
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
    // Debug logging to see what's happening
    console.log('[DEBUG] RecipeFooterButtons getSecondaryButton:', {
      entryPoint,
      hasModifications,
      handleSaveChanges: !!handleSaveChanges,
      shouldShowSaveChanges: entryPoint === 'saved' && hasModifications && !!handleSaveChanges,
    });

    switch (entryPoint) {
      case 'saved':
        // Show Save Changes button only when there are modifications
        if (hasModifications && handleSaveChanges) {
          console.log('[DEBUG] ✅ Showing Save Changes button for saved entrypoint');
          return (
            <TouchableOpacity
              style={[
                styles.plainButton,
                isSavingChanges && styles.plainButtonDisabled
              ]}
              onPress={handleSaveChanges}
              disabled={isSavingChanges}
            >
              {isSavingChanges && (
                <ActivityIndicator
                  size="small"
                  color="black"
                  style={{ marginRight: SPACING.xs }}
                />
              )}
              <Text style={[
                styles.plainButtonText,
                isSavingChanges && styles.plainButtonTextDisabled
              ]}>
                {isSavingChanges ? 'Saving changes...' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          );
        }
        console.log('[DEBUG] ❌ Not showing Save Changes button:', {
          hasModifications,
          handleSaveChanges: !!handleSaveChanges,
        });
        return null; // No secondary button for saved entrypoint without modifications
      case 'mise':
        return null; // Don't show the modifications button for mise entrypoint
      default:
        return (
          <TouchableOpacity
            style={[
              styles.plainButton,
              isSavingForLater && styles.plainButtonDisabled
            ]}
            onPress={handleSaveForLaterPress} // Updated to show folder picker
            disabled={isSavingForLater}
          >
            {isSavingForLater && (
              <ActivityIndicator
                size="small"
                color="black"
                style={{ marginRight: SPACING.xs }}
              />
            )}
            <Text style={[
              styles.plainButtonText,
              isSavingForLater && styles.plainButtonTextDisabled
            ]}>
              {isSavingForLater ? 'Processing modifications...' : 'Cook later'}
            </Text>
          </TouchableOpacity>
        );
    }
  };

  // Special layout for mise entry point - single centered button
  if (entryPoint === 'mise') {
    return (
      <>
        <View style={styles.footer}>
          <View style={styles.centeredButtonContainer}>
            <TouchableOpacity
              style={[
                styles.plainButton,
                buttonDisabled && styles.plainButtonDisabled,
              ]}
              onPress={getMainButtonHandler()}
              disabled={buttonDisabled}
            >
              {(isRewriting || isScalingInstructions || isSavingModifications) && (
                <ActivityIndicator
                  size="small"
                  color="black"
                  style={{ marginRight: SPACING.xs }}
                />
              )}
              <Text style={[
                styles.miseButtonText,
                buttonDisabled && styles.plainButtonTextDisabled
              ]}>
                {getMainButtonText()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {/* Cook Now/Update Recipe Button */}
        <TouchableOpacity
          style={styles.plainButton}
          onPress={getMainButtonHandler()}
          disabled={buttonDisabled}
        >
          {(isRewriting || isScalingInstructions || isSavingModifications) && (
            <ActivityIndicator
              size="small"
              color="black"
              style={{ marginRight: SPACING.xs }}
            />
          )}
          <Text style={[
            styles.plainButtonText,
            buttonDisabled && styles.plainButtonTextDisabled
          ]}>
            {getMainButtonText()}
          </Text>
        </TouchableOpacity>

        {/* Second Button - Either Save Changes (saved+modifications) or Cook Later */}
        {entryPoint === 'saved' && hasModifications && handleSaveChanges ? (
          <TouchableOpacity
            style={styles.plainButton}
            onPress={handleSaveChanges}
            disabled={isSavingChanges}
          >
            {isSavingChanges && (
              <ActivityIndicator
                size="small"
                color="black"
                style={{ marginRight: SPACING.xs }}
              />
            )}
            <Text style={[
              styles.plainButtonText,
              isSavingChanges && styles.plainButtonTextDisabled
            ]}>
              {isSavingChanges ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.plainButton}
            onPress={handleSaveForLaterPress}
            disabled={isSavingForLater}
          >
            {isSavingForLater && (
              <ActivityIndicator
                size="small"
                color="black"
                style={{ marginRight: SPACING.xs }}
              />
            )}
            <Text style={[
              styles.plainButtonText,
              isSavingForLater && styles.plainButtonTextDisabled
            ]}>
              {isSavingForLater ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Recipe Variations Button */}
        {onOpenVariations && (
          <TouchableOpacity
            style={[
              styles.plainButton,
              (isRewriting || isScalingInstructions || isSavingModifications) && styles.plainButtonDisabled
            ]}
            onPress={onOpenVariations}
            disabled={isRewriting || isScalingInstructions || isSavingModifications}
          >
            <Text style={[
              styles.plainButtonText,
              (isRewriting || isScalingInstructions || isSavingModifications) && styles.plainButtonTextDisabled
            ]}>
              Remix
            </Text>
          </TouchableOpacity>
        )}
        </View>
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
    backgroundColor: COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  } as ViewStyle,
  centeredButtonContainer: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flex: 1,
  } as ViewStyle,
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: SPACING.sm,
  } as ViewStyle,
  plainButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  } as ViewStyle,
  plainButtonDisabled: {
    opacity: 0.5,
  },
  plainButtonText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.bodyMedium + 6,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  plainButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  miseButtonText: {
    fontFamily: 'Inter',
    fontSize: FONT.size.bodyMedium + 6,
    fontWeight: '400',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  // Legacy styles - keeping for compatibility but not used
  mainButtonStyle: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
  } as ViewStyle,
  miseButtonStyle: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 200,
  } as ViewStyle,
  mainButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  mainButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  secondaryButtonStyle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
  } as ViewStyle,
  secondaryButtonDisabled: {
    borderColor: COLORS.lightGray,
  },
  secondaryButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
  secondaryButtonTextDisabled: {
    color: COLORS.lightGray,
  },
  variationsButtonStyle: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
  } as ViewStyle,
  variationsButtonDisabled: {
    borderColor: COLORS.lightGray,
  },
  variationsButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
});

export default RecipeFooterButtons; 