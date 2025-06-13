import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';

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
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const safeTitle = title ?? 'Error';
  const safeMessage = typeof message === 'string' ? message : String(message ?? '');

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default GlobalErrorModal; 