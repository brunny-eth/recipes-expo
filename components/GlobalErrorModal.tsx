import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { COLORS } from '../constants/theme'; // Import COLORS

interface GlobalErrorModalProps {
  visible: boolean;
  title?: string | null;
  message: string;
  onClose: () => void;
  primaryColor?: string; // Added for button color customization
}

const GlobalErrorModal: React.FC<GlobalErrorModalProps> = ({
  visible,
  title = "Something went wrong", // Default title
  message,
  onClose,
  primaryColor = COLORS.primary, // Use COLORS.primary as default
}) => {
  const scale = useSharedValue(visible ? 1 : 0.7); // Initial scale based on visibility
  const opacity = useSharedValue(visible ? 1 : 0);   // Initial opacity based on visibility

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      // Only run exit animation if it was previously scaled up (i.e., actually visible)
      // This prevents running animation on initial mount if visible is false.
      if (scale.value === 1) { 
        scale.value = withTiming(0.7, { duration: 150 });
        opacity.value = withTiming(0, { duration: 150 });
      }
    }
  }, [visible, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  // Ensure message is always a string
  const messageText = message || '';

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none" // Reanimated handles the content animation
      onRequestClose={onClose} // For Android back button
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.modalContainer, animatedStyle]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={title === null ? undefined : title} // Changed: Convert null to undefined
          aria-modal={true} // Indicate it's a modal dialog
        >
          <Text style={styles.titleText}>{title === null ? '' : title}</Text> {/* Changed: Render empty string for null title */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageText} accessibilityLiveRegion="polite">
              {messageText}
            </Text>
          </View>
          <Pressable style={[styles.button, { backgroundColor: primaryColor }]} onPress={onClose}>
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 15, // iOS-style rounded corners
    padding: 20,
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 2 : 4, // Adjusted shadow for more pop
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0.3, // Adjusted shadow for more pop
    shadowRadius: Platform.OS === 'ios' ? 3.84 : 5, // Adjusted shadow for more pop
    // Elevation for Android
    elevation: Platform.OS === 'ios' ? 5 : 8, // Adjusted elevation for more pop
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold', // Added Poppins
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.textDark, // Ensuring title text color is set
  },
  messageContainer: {
    width: '100%',
    marginBottom: 20,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular', // Added Poppins
    textAlign: 'center',
    color: COLORS.textDark, // Ensuring message text color is set
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold', // Added Poppins
    fontSize: 16,
  },
});

export default GlobalErrorModal; 