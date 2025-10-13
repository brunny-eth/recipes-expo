import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { bodyStrongText, FONT } from '@/constants/typography';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import FolderPickerModal from '@/components/FolderPickerModal';
import { useAuth } from '@/context/AuthContext';

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
  recipeId?: number; // Add recipeId for sharing
  recipeTitle?: string; // Add title for share message
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
  recipeId,
  recipeTitle,
}) => {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { session } = useAuth();
  const router = useRouter();

  const handleFolderPickerSelect = (folderId: number) => {
    setShowFolderPicker(false);
    handleSaveToFolder(folderId);
  };

  const handleSaveForLaterPress = () => {
    // Check authentication first
    if (!session) {
      router.push('/login');
      return;
    }
    
    // Open folder picker - app is now free for all users
    setShowFolderPicker(true);
  };

  const handleShare = async () => {
    if (!recipeId) {
      console.error('[RecipeFooterButtons] Cannot share: recipeId is missing');
      return;
    }

    setIsSharing(true);
    
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      
      // Call the share API to get or create a share link
      const response = await fetch(`${backendUrl}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recipe',
          objectId: recipeId,
          userId: session?.user?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const { url } = await response.json();
      
      // Use React Native's Share API
      await Share.share({
        message: recipeTitle 
          ? `Check out this recipe: ${recipeTitle}\n\n${url}`
          : url,
        url: url, // iOS will use this for sharing
        title: recipeTitle || 'Share Recipe',
      });
      
    } catch (error) {
      console.error('[RecipeFooterButtons] Error sharing recipe:', error);
      // Silently fail - user may have cancelled the share
    } finally {
      setIsSharing(false);
    }
  };


  const getMainButtonText = () => {
    if (isRewriting || isSavingModifications) return ''; // Just show spinner, no text
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
            {isSavingForLater ? (
              <ActivityIndicator
                size="small"
                color="black"
              />
            ) : (
              <Text style={[
                styles.plainButtonText,
                isSavingForLater && styles.plainButtonTextDisabled
              ]}>
                Cook later
              </Text>
            )}
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
              {(isRewriting || isScalingInstructions || isSavingModifications) ? (
                <ActivityIndicator
                  size="small"
                  color="black"
                />
              ) : (
                <Text style={[
                  styles.miseButtonText,
                  buttonDisabled && styles.plainButtonTextDisabled
                ]}>
                  {getMainButtonText()}
                </Text>
              )}
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

        {/* Share Button - Only for 'saved' and 'new' entrypoints */}
        {(entryPoint === 'saved' || entryPoint === 'new') && recipeId && (
          <TouchableOpacity
            style={[
              styles.plainButton,
              (isRewriting || isScalingInstructions || isSavingModifications || isSharing) && styles.plainButtonDisabled
            ]}
            onPress={handleShare}
            disabled={isRewriting || isScalingInstructions || isSavingModifications || isSharing}
          >
            {isSharing && (
              <ActivityIndicator
                size="small"
                color="black"
                style={{ marginRight: SPACING.xs }}
              />
            )}
            <Text style={[
              styles.plainButtonText,
              (isRewriting || isScalingInstructions || isSavingModifications || isSharing) && styles.plainButtonTextDisabled
            ]}>
              {isSharing ? 'Sharing...' : 'Share'}
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