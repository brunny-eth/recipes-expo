import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, FadeIn } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

type StepState = 'complete' | 'active' | 'pending';

interface StepItemProps {
  label: string;
  subtext: string;
  state: StepState;
}

const stateConfig = {
  pending: {
    labelColor: '#cccccc',
    subtextColor: '#a8a29e',
  },
  active: {
    labelColor: '#000000',
    subtextColor: '#a8a29e',
  },
  complete: {
    labelColor: '#E1572A',
    subtextColor: '#a8a29e',
  },
};

const StepItem: React.FC<StepItemProps> = ({ label, subtext, state }) => {
  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(stateConfig[state].labelColor, { duration: 300 }),
    };
  });

  const animatedSubtextStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(stateConfig[state].subtextColor, { duration: 300 }),
    };
  });

  return (
    <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.container}>
      <View style={styles.textContainer}>
        <Animated.Text style={[styles.label, animatedLabelStyle]}>
          {state === 'complete' ? '✓ ' : ''}{label}
        </Animated.Text>
        {state === 'active' && (
          <Animated.Text style={[styles.subtext, animatedSubtextStyle]}>
            {subtext}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  textContainer: {
    marginLeft: 12,
  },
  label: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
  },
  subtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#a8a29e',
  },
});

export default StepItem; 