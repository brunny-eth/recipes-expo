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
import { FONT } from '../constants/typography';

interface GlobalErrorModalProps {
  visible: boolean;
  title?: string | null;
  message: string;
  onClose: () => void;
}

const GlobalErrorModal: React.FC<GlobalErrorModalProps> = ({
  visible,
  title,
  message,
  onClose,
}) => {
  console.log('[GlobalErrorModal] Rendered. visible:', visible);
  const [isRendered, setIsRendered] = useState(visible);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    try {
      console.log('[GlobalErrorModal] useEffect triggered. visible:', visible);
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
      console.error('[GlobalErrorModal] ERROR during effect:', err);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const safeTitle = title ?? 'Error';
  const safeMessage =
    typeof message === 'string' ? message : String(message ?? '');

  if (!isRendered) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.modalContent, animatedStyle]}>
        <Text style={styles.title}>{safeTitle}</Text>
        <Text style={styles.message}>{safeMessage}</Text>
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>OK</Text>
        </Pressable>
      </Animated.View>
    </View>
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
    fontSize: FONT.size.body,
    marginBottom: SPACING.pageHorizontal,
    textAlign: 'center',
  } as TextStyle,
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.smMd,
    paddingHorizontal: SPACING.pageHorizontal,
    borderRadius: RADIUS.sm,
  } as ViewStyle,
  buttonText: {
    color: COLORS.white,
    fontWeight: FONT.weight.bold,
    fontSize: FONT.size.body,
  } as TextStyle,
});

export default GlobalErrorModal;
