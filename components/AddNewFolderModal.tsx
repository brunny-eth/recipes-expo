import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT, screenTitleText } from '@/constants/typography';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

interface AddNewFolderModalProps {
  visible: boolean;
  onClose: () => void;
  onFolderCreated: () => void; // Callback to refresh the folders list
}

export default function AddNewFolderModal({
  visible,
  onClose,
  onFolderCreated,
}: AddNewFolderModalProps) {
  const { session } = useAuth();
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleCreate = async () => {
    console.log('AddNewFolderModal: handleCreate called', {
      folderName: folderName.trim(),
      hasSession: !!session?.user,
      userId: session?.user?.id
    });
    
    if (!folderName.trim() || !session?.user) {
      console.log('AddNewFolderModal: Early return - missing folderName or session');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current folder count to determine display order
      const { count: folderCount } = await supabase
        .from('user_saved_folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      const displayOrder = (folderCount || 0) + 1;
      console.log('AddNewFolderModal: Using display order:', displayOrder);

      const insertData = {
        user_id: session.user.id,
        name: folderName.trim(),
        display_order: displayOrder,
        color: '#109DF0', // Default to primary blue
      };

      console.log('AddNewFolderModal: Attempting to insert folder data:', insertData);

      const { error: createError } = await supabase
        .from('user_saved_folders')
        .insert(insertData);

      if (createError) {
        console.error('Supabase error creating folder:', createError);
        if (createError.code === '23505') { // Unique constraint violation
          setError('You already have a folder with this name.');
        } else {
          console.error('Folder creation failed with error:', {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint
          });
          setError('Could not create folder. Please try again.');
        }
        return;
      }

      // Success
      console.log('AddNewFolderModal: Folder created successfully');
      setFolderName('');
      setError(null);
      onFolderCreated(); // Refresh the parent component
      onClose();
    } catch (err) {
      console.error('Unexpected error creating folder:', err);
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFolderName('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      onShow={() => {
        // Focus input when modal opens
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()} // Prevent closing when tapping inside modal
        >
          <Text style={styles.title}>Add new folder</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            ref={inputRef}
            style={[styles.textInput, error && styles.textInputError]}
            value={folderName}
            onChangeText={setFolderName}
            placeholder="Enter folder name"
            placeholderTextColor={COLORS.textMuted}
            multiline={false}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            editable={!isLoading}
            maxLength={50}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button, 
                styles.createButton,
                (!folderName.trim() || isLoading) && styles.createButtonDisabled
              ]}
              onPress={handleCreate}
              disabled={!folderName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={[
                  styles.createButtonText,
                  (!folderName.trim() || isLoading) && styles.createButtonTextDisabled
                ]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    maxWidth: 400,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md,
  } as TextStyle,
  errorContainer: {
    backgroundColor: COLORS.errorBackground,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    fontSize: FONT.size.caption,
  } as TextStyle,
  textInput: {
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
  textInputError: {
    borderColor: COLORS.error,
  } as TextStyle,
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
  createButton: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  createButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  } as ViewStyle,
  createButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  createButtonTextDisabled: {
    color: COLORS.textMuted,
  } as TextStyle,
}); 