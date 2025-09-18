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
      setError("We couldn't create the folder. Please try again.");
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
          <Text style={styles.title}>Add New Folder</Text>

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
            // Ensure consistent rendering behavior
            autoCorrect={false}
            autoCapitalize="words"
            // Prevent layout shifts by maintaining consistent font metrics
            textAlign="left"
          />

          <View style={styles.buttonContainer}>
            {/* Create button moved to left */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                folderName.trim() && !isLoading && styles.createButtonActive, // Primary style when active
                (!folderName.trim() || isLoading) && styles.createButtonDisabled
              ]}
              onPress={handleCreate}
              disabled={!folderName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={folderName.trim() ? "#000000" : COLORS.textMuted} />
              ) : (
                <Text style={[
                  styles.createButtonText,
                  folderName.trim() && !isLoading && styles.createButtonTextActive, // Primary text style when active
                  (!folderName.trim() || isLoading) && styles.createButtonTextDisabled
                ]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel button moved to right */}
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 350,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  } as ViewStyle,
  title: {
    ...bodyStrongText,
    fontSize: FONT.size.lg, // Match ConfirmationModal (18px)
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md, // Match ConfirmationModal (16px)
  } as TextStyle,
  errorContainer: {
    backgroundColor: COLORS.errorBackground,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.lg,
  } as ViewStyle,
  errorText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'center',
    fontSize: FONT.size.caption,
  } as TextStyle,
  textInput: {
    fontFamily: FONT.family.body, // Explicit font family
    fontSize: FONT.size.body, // Explicit font size
    fontWeight: '400', // Explicit font weight to match placeholder
    lineHeight: FONT.size.body + 6, // Explicit line height for consistent baseline
    color: COLORS.textDark, // Explicit text color
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    // Fix layout stability: ensure consistent sizing
    minHeight: 44, // Match button minHeight for visual consistency
    textAlignVertical: 'center', // Center text vertically
    // Prevent intrinsic sizing from affecting container
    alignSelf: 'stretch',
    // Ensure consistent font metrics between placeholder and typed text
    includeFontPadding: false, // Remove extra padding that can cause alignment issues
  } as TextStyle,
  textInputError: {
    borderColor: COLORS.error,
  } as TextStyle,
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.lg,
  } as ViewStyle,
  button: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8, // Match Choose image button radius
    alignItems: 'center',
    justifyContent: 'center',
    height: 46, // Match exact button height consistency
    // Fix layout stability: ensure buttons don't resize
    minWidth: 80, // Ensure consistent width for "Create" text
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  cancelButtonText: {
    ...bodyText, // Changed from bodyStrongText to match consistency
    color: '#000000',
    fontSize: FONT.size.body, // Use consistent font size
    textAlign: 'center',
  } as TextStyle,
  createButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  createButtonActive: {
    backgroundColor: COLORS.primary, // Light blue background when active
    borderColor: '#000000',
  } as ViewStyle,
  createButtonDisabled: {
    backgroundColor: 'transparent',
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  createButtonText: {
    ...bodyText, // Changed from bodyStrongText to match consistency
    color: '#000000',
    fontSize: FONT.size.body, // Use consistent font size
    textAlign: 'center',
  } as TextStyle,
  createButtonTextActive: {
    color: '#000000', // Keep black text on light blue background
  } as TextStyle,
  createButtonTextDisabled: {
    color: COLORS.textMuted,
  } as TextStyle,
}); 