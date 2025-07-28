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
import { FONT, bodyStrongText } from '../constants/typography';

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
            <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
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
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  } as ViewStyle,
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  cancelButtonText: {
    ...bodyStrongText,
    color: COLORS.textMuted,
    fontSize: FONT.size.body,
  } as TextStyle,
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  confirmButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.body,
  } as TextStyle,
  destructiveButton: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  } as ViewStyle,
  singleButton: {
    flex: 1,
  } as ViewStyle,
});

export default ConfirmationModal; 