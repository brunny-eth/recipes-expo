import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  COLORS,
  OVERLAYS,
  SPACING,
  RADIUS,
  ICON_SIZE,
} from '@/constants/theme';
import {
  sectionHeaderText,
  bodyText,
  FONT,
  bodyStrongText,
} from '@/constants/typography';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

export default function ConfirmationModal({
  visible,
  onClose,
  title,
  message,
}: ConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.backdrop}
          />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(150)}
          exiting={SlideOutDown.duration(150)}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={ICON_SIZE.md}
                color={COLORS.textDark}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.messageContainer}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAYS.medium,
  } as ViewStyle,
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.pageHorizontal,
    maxHeight: '80%',
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.pageHorizontal,
  } as ViewStyle,
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  } as TextStyle,
  closeButton: {
    padding: SPACING.sm,
  } as ViewStyle,
  messageContainer: {
    marginBottom: 30,
    paddingHorizontal: SPACING.smMd,
  } as ViewStyle,
  message: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  } as ViewStyle,
  doneButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
});
