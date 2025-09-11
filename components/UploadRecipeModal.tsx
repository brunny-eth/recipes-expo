import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, BORDER_WIDTH } from '@/constants/theme';
import { bodyStrongText, bodyText, FONT, screenTitleText } from '@/constants/typography';

interface UploadRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseImage: () => void;
  onBrowseFiles: () => void;
}

export default function UploadRecipeModal({
  visible,
  onClose,
  onTakePhoto,
  onChooseImage,
  onBrowseFiles,
}: UploadRecipeModalProps) {
  const handleClose = () => {
    onClose();
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
          onPress={(e) => e.stopPropagation()} // Prevent closing when tapping inside modal
        >
          <Text style={styles.title}>Upload Recipe</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={onBrowseFiles}
            >
              <View style={styles.optionIcon}>
                <MaterialCommunityIcons
                  name="file-document"
                  size={24}
                  color="#000000"
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Browse Files</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.textDark}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={onTakePhoto}
            >
              <View style={styles.optionIcon}>
                <MaterialCommunityIcons
                  name="camera"
                  size={24}
                  color="#000000"
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Take Photo</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.textDark}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={onChooseImage}
            >
              <View style={styles.optionIcon}>
                <MaterialCommunityIcons
                  name="image"
                  size={24}
                  color="#000000"
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Choose Images</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.textDark}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: COLORS.textMuted,
    textAlign: 'left',
    marginBottom: SPACING.lg,
  } as TextStyle,
  optionsContainer: {
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  } as ViewStyle,
  optionButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  } as ViewStyle,
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  optionContent: {
    flex: 1,
  } as ViewStyle,
  optionTitle: {
    ...bodyStrongText,
    color: '#000000',
    textAlign: 'left',
  } as TextStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: '#000000',
    fontSize: 14,
  } as TextStyle,
}); 