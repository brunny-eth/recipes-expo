import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { sectionHeaderText, bodyText } from '@/constants/typography';

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
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
  },
  closeButton: {
    padding: 8,
  },
  messageContainer: {
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  message: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    ...bodyText,
    color: COLORS.white,
    fontWeight: 'bold',
  },
}); 