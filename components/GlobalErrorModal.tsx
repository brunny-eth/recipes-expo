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
    withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS, OVERLAYS, SPACING, RADIUS } from '../constants/theme';
import { FONT } from '../constants/typography';

interface GlobalErrorModalProps {
  visible: boolean;
  title?: string | null;
  message: string;
  onClose: () => void; // overlay tap
  onButtonPress?: () => void; // button action (defaults to onClose)
  primaryButtonLabel?: string; // optional custom label for primary button
  secondButtonLabel?: string; // label for optional second button
  onSecondButtonPress?: () => void; // action for optional second button
}

const GlobalErrorModal: React.FC<GlobalErrorModalProps> = ({
  visible,
  title,
  message,
  onClose,
  onButtonPress,
  primaryButtonLabel,
  secondButtonLabel,
  onSecondButtonPress,
}) => {
  const [isRendered, setIsRendered] = useState(visible);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    try {
      if (visible) {
        setIsRendered(true);
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        contentOpacity.value = withDelay(50, withTiming(1, { duration: 150 }));
      } else {
        scale.value = withSpring(0.7, { damping: 15, stiffness: 200 });
        contentOpacity.value = withTiming(0, { duration: 120 });
        opacity.value = withTiming(0, { duration: 200 }, (isFinished) => {
          'worklet';
          if (isFinished) {
            runOnJS(setIsRendered)(false);
          }
        });
      }
    } catch (err) {
      console.error('[GlobalErrorModal] ERROR during effect:', err);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
    };
  });

  const safeTitle = title ?? 'Error';
  const safeMessage =
    typeof message === 'string' ? message : String(message ?? '');

  const isAccountRequired = safeTitle === 'Account Required';
  const primaryLabel = primaryButtonLabel || (isAccountRequired ? 'Go to Login' : 'OK');

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
        <Animated.View style={contentStyle}>
          <Text style={styles.message}>{safeMessage}</Text>
        </Animated.View>
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.button}
            onPress={() => {
              // First close (start fade-out), then invoke the callback after the fade to avoid visual flicker
              onClose();
              if (onButtonPress) {
                setTimeout(() => {
                  try { onButtonPress(); } catch {}
                }, 230);
              }
            }}
          >
            <Text style={styles.buttonText}>{primaryLabel}</Text>
          </Pressable>
          {secondButtonLabel && onSecondButtonPress && (
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  try { onSecondButtonPress(); } catch {}
                }, 230);
              }}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>{secondButtonLabel}</Text>
            </Pressable>
          )}
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
    width: '80%',
    backgroundColor: COLORS.white,
    padding: SPACING.pageHorizontal,
    borderRadius: RADIUS.smMd,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    fontSize: FONT.size.lg,
    fontWeight: FONT.weight.bold,
    marginBottom: SPACING.smMd,
  } as TextStyle,
  message: {
    fontSize: FONT.size.body, // Slightly smaller than before
    marginBottom: SPACING.pageHorizontal,
    textAlign: 'center',
    fontWeight: '500',
  } as TextStyle,
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.smMd,
    paddingHorizontal: 24,
    borderRadius: RADIUS.sm,
    width: 200, // Increased width for longer buttons
    alignItems: 'center',
  } as ViewStyle,
  buttonText: {
    color: COLORS.white,
    fontWeight: FONT.weight.bold,
    fontSize: FONT.size.body,
  } as TextStyle,
  buttonRow: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 12, // Add spacing between buttons
    // No extra styles needed, will inherit from .button
  },
  secondaryButtonText: {
    color: COLORS.white, // Match the primary button text color
  },
});

export default GlobalErrorModal;
