import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import TimerTool from './TimerTool'; // Import TimerTool

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ToolsModal({ visible, onClose }: ToolsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.backdrop}
          />
        </Pressable>

        {/* Modal Content */}
        <Animated.View
          entering={SlideInDown.springify().damping(15)}
          exiting={SlideOutDown}
          style={styles.modalContent}
        >
          {/* Use SafeAreaView for content inside modal */}
          <SafeAreaView style={styles.safeArea}> 
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Tools</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Tool Content Area */}
            <View style={styles.toolContent}>
              <TimerTool /> 
            </View>

          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Aligns modal to bottom
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly less dark backdrop
  },
  modalContent: {
    backgroundColor: COLORS.background, // Use theme background
    borderTopLeftRadius: 24, // More rounded corners
    borderTopRightRadius: 24,
    // Let content determine height, but set max
    maxHeight: '60%', // Adjust as needed
    minHeight: 200, // Ensure a minimum size
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  safeArea: {
     padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.textDark,
  },
  closeButton: {
    padding: 8,
  },
  toolContent: {
      // Styles for the area where tools will be placed
      // Add padding or other layout styles if needed
  },
}); 