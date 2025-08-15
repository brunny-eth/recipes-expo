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
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Browse Files</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.gray}
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
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Take Photo</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.gray}
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
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Choose Images</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.gray}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
          >
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
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.medium,
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  } as TextStyle,
  subtitle: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  } as TextStyle,
  optionsContainer: {
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  } as ViewStyle,
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.divider,
    minHeight: 50,
  } as ViewStyle,
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  optionContent: {
    flex: 1,
  } as ViewStyle,
  optionTitle: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.body,
    letterSpacing: 0.2,
  } as TextStyle,
  cancelButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.divider,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
}); 