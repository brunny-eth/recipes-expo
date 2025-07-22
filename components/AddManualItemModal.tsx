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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT } from '@/constants/typography';

interface AddManualItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (itemText: string) => Promise<void>;
  categoryName: string;
}

export default function AddManualItemModal({
  visible,
  onClose,
  onAdd,
  categoryName,
}: AddManualItemModalProps) {
  const [itemText, setItemText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleAdd = async () => {
    if (!itemText.trim()) {
      return; // Don't add empty items
    }

    setIsLoading(true);
    try {
      await onAdd(itemText.trim());
      setItemText('');
      onClose();
    } catch (error) {
      console.error('Error adding manual item:', error);
      // Error handling is done in the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setItemText('');
    onClose();
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
          <Text style={styles.categoryLabel}>Adding to: {categoryName}</Text>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={itemText}
            onChangeText={setItemText}
            placeholder="'Peanut butter cups' or 'ice cream'"
            placeholderTextColor={COLORS.textMuted}
            multiline={false}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            editable={!isLoading}
            maxLength={200} // Reasonable limit
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
                styles.addButton,
                (!itemText.trim() || isLoading) && styles.addButtonDisabled
              ]}
              onPress={handleAdd}
              disabled={!itemText.trim() || isLoading}
            >
              <Text style={[
                styles.addButtonText,
                (!itemText.trim() || isLoading) && styles.addButtonTextDisabled
              ]}>
                {isLoading ? 'Adding...' : 'Add'}
              </Text>
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
    paddingHorizontal: SPACING.xl,
  } as ViewStyle,
  
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,

  categoryLabel: {
    ...bodyText,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    fontSize: FONT.size.caption,
  } as TextStyle,

  textInput: {
    ...bodyText,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.xl,
  } as TextStyle,

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  } as ViewStyle,

  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,

  cancelButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  } as ViewStyle,

  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
  } as TextStyle,

  addButton: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,

  addButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  } as ViewStyle,

  addButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,

  addButtonTextDisabled: {
    color: COLORS.darkGray,
  } as TextStyle,
}); 