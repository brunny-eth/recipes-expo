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
import { FONT, bodyStrongText, bodyText } from '../constants/typography';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean; // If true, confirm button will be red
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
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
      console.error('[ConfirmationModal] ERROR during effect:', err);
    }
  }, [visible]);

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
    <Pressable style={styles.container} onPress={onCancel}>
      <Animated.View
        style={[styles.modalContent, animatedStyle]}
        onStartShouldSetResponder={() => true}
        onResponderStart={e => e.stopPropagation()}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.buttonRow}>
          {cancelLabel && (
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>
          )}
          <Pressable 
            style={[
              styles.button, 
              styles.confirmButton,
              destructive && styles.destructiveButton,
              !cancelLabel && styles.singleButton
            ]} 
            onPress={onConfirm}
          >
            <Text style={[
              styles.confirmButtonText,
              destructive && styles.destructiveButtonText
            ]}>{confirmLabel}</Text>
          </Pressable>
        </View>
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
    width: '85%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    ...bodyStrongText,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    textAlign: 'center',
  } as TextStyle,
  message: {
    fontSize: FONT.size.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: SPACING.md,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg, // Keep horizontal padding for center alignment
    borderRadius: 8, // Match Choose image button radius
    alignItems: 'center', // Keep center alignment for modals
    justifyContent: 'center',
    minHeight: 46, // Match Choose image button height
  } as ViewStyle,
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  cancelButtonText: {
    ...bodyText, // Changed from bodyStrongText to match Choose image
    color: '#000000',
    fontSize: FONT.size.body,
    textAlign: 'center', // Keep center alignment for modals
  } as TextStyle,
  confirmButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  } as ViewStyle,
  confirmButtonText: {
    ...bodyText, // Changed from bodyStrongText to match Choose image
    color: '#000000',
    fontSize: FONT.size.body,
    textAlign: 'center', // Keep center alignment for modals
  } as TextStyle,
  destructiveButton: {
    backgroundColor: 'transparent',
    borderColor: COLORS.error,
  } as ViewStyle,
  destructiveButtonText: {
    color: COLORS.error,
  } as TextStyle,
  singleButton: {
    flex: 1,
  } as ViewStyle,
});

export default ConfirmationModal; 