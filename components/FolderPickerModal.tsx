import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, captionText } from '@/constants/typography';
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
};

export default function FolderPickerModal({
  visible,
  onClose,
  onSelectFolder,
  isLoading = false,
}: FolderPickerModalProps) {
  const { session } = useAuth();
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(true);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error('[FolderPickerModal] Error fetching folders:', foldersError);
        setError('Could not load folders. Please try again.');
        return;
      }

      const formattedFolders = foldersData?.map(folder => ({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
        display_order: folder.display_order,
        recipe_count: (folder.user_saved_recipes as any)?.[0]?.count || 0,
      })) || [];

      setFolders(formattedFolders);
    } catch (err) {
      console.error('[FolderPickerModal] Unexpected error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsFetchingFolders(false);
    }
  };

  // Create new folder
  const createNewFolder = async () => {
    if (!session?.user || !newFolderName.trim()) return;

    setIsCreatingFolder(true);

    try {
      const { data: newFolder, error: createError } = await supabase
        .from('user_saved_folders')
        .insert({
          user_id: session.user.id,
          name: newFolderName.trim(),
          display_order: folders.length,
        })
        .select()
        .single();

      if (createError) {
        console.error('[FolderPickerModal] Error creating folder:', createError);
        
        if (createError.code === '23505') { // Unique constraint violation
          Alert.alert('Folder Exists', 'You already have a folder with this name.');
        } else {
          Alert.alert('Error', 'Could not create folder. Please try again.');
        }
        return;
      }

      // Add to local state
      const newFolderWithCount = {
        ...newFolder,
        recipe_count: 0,
      };
      setFolders(prev => [...prev, newFolderWithCount]);

      // Select the newly created folder
      onSelectFolder(newFolder.id);
      
      // Reset form
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      console.error('[FolderPickerModal] Unexpected error creating folder:', err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Load folders when modal opens
  useEffect(() => {
    if (visible) {
      fetchFolders();
    }
  }, [visible, session?.user?.id]);

  const renderFolderItem = ({ item }: { item: SavedFolder }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={() => onSelectFolder(item.id)}
      disabled={isLoading}
    >
      <View style={styles.folderIcon}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={20}
          color={item.color}
        />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderCount}>
          {item.recipe_count} recipe{item.recipe_count !== 1 ? 's' : ''}
        </Text>
      </View>
      {isLoading && (
        <ActivityIndicator size="small" color={COLORS.primary} />
      )}
    </TouchableOpacity>
  );

  const handleClose = () => {
    if (!isLoading && !isCreatingFolder) {
      setShowNewFolderInput(false);
      setNewFolderName('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isLoading || isCreatingFolder}
          >
            <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.title}>Save to folder</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isFetchingFolders ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading folders...</Text>
            </View>
          ) : (
            <>
              {/* Folders List */}
              <FlatList
                data={folders}
                renderItem={renderFolderItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.foldersList}
                showsVerticalScrollIndicator={false}
              />

              {/* Add New Folder Section */}
              {showNewFolderInput ? (
                <View style={styles.newFolderContainer}>
                  <TextInput
                    style={styles.newFolderInput}
                    placeholder="Enter folder name"
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    maxLength={50}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={createNewFolder}
                  />
                  <View style={styles.newFolderButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }}
                      disabled={isCreatingFolder}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.createButton,
                        (!newFolderName.trim() || isCreatingFolder) && styles.createButtonDisabled
                      ]}
                      onPress={createNewFolder}
                      disabled={!newFolderName.trim() || isCreatingFolder}
                    >
                      {isCreatingFolder ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.createButtonText}>Create</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addFolderButton}
                  onPress={() => setShowNewFolderInput(true)}
                  disabled={isLoading}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.addFolderText}>Add new folder</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  title: {
    ...bodyStrongText,
    fontSize: 18,
  },
  placeholder: {
    width: 32, // Same as close button
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  errorContainer: {
    backgroundColor: COLORS.errorBackground,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...bodyText,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  foldersList: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...bodyStrongText,
    color: COLORS.textDark,
  },
  folderCount: {
    ...captionText,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginVertical: SPACING.md,
  },
  addFolderText: {
    ...bodyStrongText,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  newFolderContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  newFolderInput: {
    ...bodyText,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  newFolderButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  cancelButtonText: {
    ...bodyText,
    color: COLORS.textMuted,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  createButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
}); 