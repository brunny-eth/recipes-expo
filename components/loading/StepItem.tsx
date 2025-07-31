import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { COLORS, SPACING } from '@/constants/theme';
import { FONT } from '@/constants/typography';

type StepState = 'complete' | 'active' | 'pending';

interface StepItemProps {
  label: string;
  subtext: string;
  state: StepState;
}

const stateConfig = {
  pending: {
    labelColor: COLORS.disabled,
    subtextColor: COLORS.textSubtle,
  },
  active: {
    labelColor: COLORS.textDark,
    subtextColor: COLORS.textSubtle,
  },
  complete: {
    labelColor: COLORS.primary,
    subtextColor: COLORS.textSubtle,
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
    <Animated.View
      entering={FadeIn.delay(200).duration(500)}
      style={styles.container}
    >
      <View style={styles.textContainer}>
        <Animated.Text style={[styles.label, animatedLabelStyle]}>
          {state === 'complete' ? '✓ ' : ''}
          {label}
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
    marginBottom: SPACING.lg, // Increased spacing between checklist items
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  textContainer: {
    marginLeft: 12,
  } as ViewStyle,
  label: {
    fontSize: FONT.size.lg,
    fontFamily: FONT.family.interSemiBold,
  } as TextStyle,
  subtext: {
    fontSize: FONT.size.smBody,
    fontFamily: FONT.family.inter,
    color: COLORS.textSubtle,
  } as TextStyle,
});

export default StepItem;
