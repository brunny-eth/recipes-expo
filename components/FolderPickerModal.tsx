import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ViewStyle,
  TextStyle,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { bodyStrongText, bodyText, captionText, FONT, screenTitleText } from '@/constants/typography';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

type SavedFolder = {
  id: number;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  recipe_count: number;
};

type FolderPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectFolder: (folderId: number) => void;
  isLoading?: boolean;
  showStartCookingOption?: boolean;
  onStartCooking?: () => void;
  selectedRecipeCount?: number;
};

type ModalMode = 'select' | 'create';

export default function FolderPickerModal({
  visible,
  onClose,
  onSelectFolder,
  isLoading = false,
  showStartCookingOption = false,
  onStartCooking,
  selectedRecipeCount = 0,
}: FolderPickerModalProps) {
  const { session } = useAuth();
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal mode state
  const [mode, setMode] = useState<ModalMode>('select');
  
  // Create folder state
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch user's folders
  const fetchFolders = async () => {
    if (!session?.user) return;

    setIsFetchingFolders(true);
    setError(null);

    try {
      // Get folders with recipe counts
      const { data: foldersData, error: foldersError } = await supabase
        .from('user_saved_folders')
        .select(`
          id,
          name,
          color,
          icon,
          display_order,
          user_saved_recipes!folder_id(count)
        `)
        .eq('user_id', session.user.id)
        .order('display_order', { ascending: true });

      if (foldersError) {
        // Error fetching folders
      setError("We couldn't load your folders. Please try again.");
        return;
      }

      const formattedFolders = foldersData?.map(folder => ({
        id: folder.id,
        name: folder.name,
        color: folder.color || '#3B82F6',
        icon: folder.icon || 'folder',
        display_order: folder.display_order,
        recipe_count: (folder.user_saved_recipes as any)?.[0]?.count || 0,
      })) || [];

      // Folders loaded successfully
      setFolders(formattedFolders);
    } catch (err) {
      // Unexpected error loading folders
      setError('An unexpected error occurred.');
    } finally {
      setIsFetchingFolders(false);
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !session?.user) {
      // Cannot create folder - missing name or session
      return;
    }

    // Starting folder creation
    setIsCreatingFolder(true);
    setCreateError(null);

    try {
      // Get current folder count to determine display order
      const { count: folderCount } = await supabase
        .from('user_saved_folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      const displayOrder = (folderCount || 0) + 1;
      // Using display order for new folder

      const { data: newFolder, error: createError } = await supabase
        .from('user_saved_folders')
        .insert({
          user_id: session.user.id,
          name: newFolderName.trim(),
          display_order: displayOrder,
          color: '#109DF0', // Default to primary blue
        })
        .select()
        .single();

      // Folder creation response received

      if (createError) {
        // Database error creating folder
        if (createError.code === '23505') { // Unique constraint violation
          setCreateError('You already have a folder with this name.');
        } else {
      setCreateError("We couldn't create the folder. Please try again.");
        }
        return;
      }

      // Success - auto-select the newly created folder and navigate
      // Folder created successfully
      
      // Reset state
      setNewFolderName('');
      setCreateError(null);
      
      // Call the onSelectFolder callback which should handle saving the recipe
      // Don't set mode back to 'select' since the modal will close
      onSelectFolder(newFolder.id);
    } catch (err) {
      // Unexpected error creating folder
      setCreateError('An unexpected error occurred.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Switch to create mode
  const handleShowCreateMode = () => {
    setMode('create');
    setCreateError(null);
    // Focus input after modal transition
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Switch back to select mode
  const handleBackToSelect = () => {
    setMode('select');
    setNewFolderName('');
    setCreateError(null);
    setIsCreatingFolder(false); // Reset creating state when going back
  };

  // Load folders when modal opens
  useEffect(() => {
    if (visible) {
      fetchFolders();
      setMode('select'); // Always start in select mode
    }
  }, [visible, session?.user?.id]);

  const renderFolderItem = ({ item, index }: { item: SavedFolder; index: number }) => (
    <TouchableOpacity
      style={[
        styles.folderRow,
        { backgroundColor: 'transparent' }
      ]}
      onPress={() => onSelectFolder(item.id)}
      disabled={isLoading}
    >
      <View style={styles.folderRowContent}>
        <Text
          style={styles.folderRowName}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.2}
        >
          {item.name.replace(/\b\w/g, (l) => l.toUpperCase())}
        </Text>
        <Text style={styles.chevronText}>›</Text>
      </View>
      {isLoading && (
        <ActivityIndicator size="small" color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );

  const handleClose = () => {
    if (!isLoading && !isCreatingFolder) {
      setError(null);
      setCreateError(null);
      setNewFolderName('');
      // Don't set mode back to 'select' since the modal will close
      onClose();
    }
  };

  const renderSelectMode = () => {
    if (isFetchingFolders) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading folders...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchFolders}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (folders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No folders yet</Text>
          <Text style={styles.emptySubtext}>
            Create your first folder to organize your recipes
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={folders}
        renderItem={({ item, index }) => renderFolderItem({ item, index })}
        keyExtractor={(item) => item.id.toString()}
        style={styles.foldersList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderCreateMode = () => {
    return (
      <View style={styles.createContainer}>
        {createError && (
          <View style={styles.createErrorContainer}>
            <Text style={styles.createErrorText}>{createError}</Text>
          </View>
        )}

        <TextInput
          ref={inputRef}
          style={[styles.createInput, createError && styles.createInputError]}
          value={newFolderName}
          onChangeText={setNewFolderName}
          placeholder="Enter folder name"
          placeholderTextColor={COLORS.textMuted}
          multiline={false}
          returnKeyType="done"
          onSubmitEditing={handleCreateFolder}
          editable={!isCreatingFolder}
          maxLength={50}
        />

        <View style={styles.createButtons}>
          {/* Create button moved to left */}
          <TouchableOpacity
            style={[
              styles.createButton, 
              styles.confirmButton,
              newFolderName.trim() && !isCreatingFolder && styles.confirmButtonActive, // Primary style when active
              (!newFolderName.trim() || isCreatingFolder) && styles.confirmButtonDisabled
            ]}
            onPress={handleCreateFolder}
            disabled={!newFolderName.trim() || isCreatingFolder}
          >
            {isCreatingFolder ? (
              <ActivityIndicator size="small" color={newFolderName.trim() ? "#000000" : COLORS.textMuted} />
            ) : (
              <Text style={[
                styles.confirmButtonText,
                newFolderName.trim() && !isCreatingFolder && styles.confirmButtonTextActive, // Primary text when active
                (!newFolderName.trim() || isCreatingFolder) && styles.confirmButtonTextDisabled
              ]}>
                Create
              </Text>
            )}
          </TouchableOpacity>

          {/* Cancel button moved to right */}
          <TouchableOpacity
            style={[styles.createButton, styles.cancelButton]}
            onPress={handleBackToSelect}
            disabled={isCreatingFolder}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'select' ? (showStartCookingOption ? 'Choose action' : 'Save To Folder') : 'Add New Folder'}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {mode === 'select' ? renderSelectMode() : renderCreateMode()}
          </View>

          {/* Add New Folder Button - only show in select mode */}
          {mode === 'select' && (
            <>
              <TouchableOpacity
                style={styles.addFolderRow}
                onPress={handleShowCreateMode}
                disabled={isLoading}
              >
                <View style={styles.searchToolbarContent}>
                  <Text style={styles.headerText}>Add New Folder</Text>
                </View>
              </TouchableOpacity>

              {/* Start Cooking Button - only show when option is enabled */}
              {showStartCookingOption && (
                <TouchableOpacity
                  style={styles.startCookingButton}
                  onPress={onStartCooking}
                  disabled={isLoading}
                >
                  <Text style={styles.startCookingText}>
                    Start cooking {selectedRecipeCount > 0 ? `(${selectedRecipeCount})` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  } as ViewStyle,
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, // Match AddNewFolderModal border radius
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    paddingBottom: 0, // Remove any bottom padding
  } as ViewStyle,
  header: {
    alignItems: 'center',
    justifyContent: 'center', // Center the title since no side buttons
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    // Removed border to match AddNewFolderModal
  } as ViewStyle,
  // Removed backButton styles since no longer needed
  title: {
    ...bodyStrongText, // Match other modals
    fontSize: FONT.size.lg, // Match other modals (18px)
    color: COLORS.textDark,
    textAlign: 'center', // Center aligned
  } as TextStyle,
  // Removed closeButton styles since no longer needed
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 0, // Remove bottom padding to match AddNewFolderModal
    minHeight: 200,
  } as ViewStyle,
  // Select mode styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  } as ViewStyle,
  loadingText: {
    ...bodyText,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  } as TextStyle,
  errorContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  } as ViewStyle,
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  } as TextStyle,
  retryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  retryButtonText: {
    ...bodyStrongText,
    color: '#000000',
  } as TextStyle,
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  } as ViewStyle,
  emptyText: {
    ...bodyStrongText,
    fontSize: FONT.size.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  } as TextStyle,
  emptySubtext: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
  } as TextStyle,
  foldersList: {
    flexGrow: 0,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#000000',
    borderRightWidth: 2, // Emphasize right border
  } as ViewStyle,
  // Folder row styles matching library.tsx
  folderRow: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },
  folderRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Right-align chevron
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 0, // Remove padding to push chevron to right edge
  },
  folderRowName: {
    fontFamily: 'GraphikMedium',
    fontSize: 24, // Reduced by 4px for smaller text
    fontWeight: '600',
    lineHeight: 28, // Adjusted lineHeight to match
    color: COLORS.textDark,
    position: 'absolute',
    left: 0,
    top: 18, // Position to balance spacing above and below text
    textAlign: 'left', // Ensure left alignment
    maxWidth: '85%', // Prevent overflow into chevron area
  },
  chevronText: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  // Add new folder styles matching library.tsx
  addFolderRow: {
    height: 46, // Match button height exactly
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    marginTop: SPACING.xxl, // Increased top margin for more space
    marginBottom: SPACING.xxl, // Increased bottom margin for more space
    paddingHorizontal: SPACING.lg, // Match modal button padding
    backgroundColor: 'transparent', // Match Cancel button style
    borderWidth: 1,
    borderColor: '#000000', // Match Cancel button border
    borderRadius: 8, // Match button consistency
    alignItems: 'center', // Center align like modal buttons
    justifyContent: 'center', // Center justify like modal buttons
  },
  searchToolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  headerText: {
    ...bodyText, // Match modal button text style
    fontSize: FONT.size.body, // 16px to match consistency
    color: '#000000', // Match button text color
    textAlign: 'center', // Center align like modal buttons
    fontWeight: '400', // Match button weight
  },
  startCookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  } as ViewStyle,
  startCookingText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  // Create mode styles
  createContainer: {
    // Remove padding to match AddNewFolderModal's tight layout
  } as ViewStyle,
  createErrorContainer: {
    backgroundColor: COLORS.errorBackground,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,
  createErrorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    fontSize: FONT.size.caption,
  } as TextStyle,
  createInput: {
    ...bodyText,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    fontSize: FONT.size.body,
    backgroundColor: COLORS.background,
  } as TextStyle,
  createInputError: {
    borderColor: COLORS.error,
  } as TextStyle,
  createButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.lg, // Match AddNewFolderModal spacing (20px instead of 48px)
  } as ViewStyle,
  createButton: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8, // Match Choose image button radius
    alignItems: 'center',
    justifyContent: 'center',
    height: 46, // Match exact button height consistency
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  cancelButtonText: {
    ...bodyText, // Changed from bodyStrongText to match consistency
    color: '#000000',
    fontSize: FONT.size.body,
    textAlign: 'center',
  } as TextStyle,
  confirmButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  confirmButtonActive: {
    backgroundColor: COLORS.primary, // Light blue background when active
    borderColor: '#000000',
  } as ViewStyle,
  confirmButtonDisabled: {
    backgroundColor: 'transparent', // Match AddNewFolderModal (transparent instead of gray)
    borderColor: COLORS.lightGray, // Light gray border when disabled
  } as ViewStyle,
  confirmButtonText: {
    ...bodyText, // Changed from bodyStrongText to match consistency
    color: '#000000',
    fontSize: FONT.size.body,
    textAlign: 'center',
  } as TextStyle,
  confirmButtonTextActive: {
    color: '#000000', // Keep black text on light blue background
  } as TextStyle,
  confirmButtonTextDisabled: {
    color: COLORS.textMuted,
  } as TextStyle,
}); 