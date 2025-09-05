import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS, OVERLAYS, SPACING, RADIUS } from '../constants/theme';
import { FONT, sectionHeaderText, bodyText } from '../constants/typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoCloseDelay?: number; // Auto close after this many milliseconds
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  title,
  message,
  onClose,
  autoCloseDelay = 3000, // Default 3 seconds
}) => {
  const [isRendered, setIsRendered] = useState(visible);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    try {
      if (visible) {
        setIsRendered(true);
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        
        // Auto close after delay
        if (autoCloseDelay > 0) {
          const timer = setTimeout(() => {
            onClose();
          }, autoCloseDelay);
          
          return () => clearTimeout(timer);
        }
      } else {
        scale.value = withSpring(0.7, { damping: 15, stiffness: 200 });
        opacity.value = withTiming(0, { duration: 200 }, (isFinished) => {
          'worklet';
          if (isFinished) {
            runOnJS(setIsRendered)(false);
          }
        });
      }
    } catch (err) {
      console.error('[SuccessModal] ERROR during effect:', err);
    }
  }, [visible, autoCloseDelay, onClose]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  if (!isRendered) {
    return null;
  }

  return (
    <Pressable style={styles.container} onPress={onClose}>
      <Animated.View
        style={[styles.modalContent, animatedStyle]}
        onStartShouldSetResponder={() => true}
        onResponderStart={e => e.stopPropagation()}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={48}
            color="#000000"
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAYS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  } as ViewStyle,
  modalContent: {
    width: '80%',
    maxWidth: 350,
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
  } as ViewStyle,
  iconContainer: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  title: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  } as TextStyle,
  message: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
  } as TextStyle,
});

export default SuccessModal; 