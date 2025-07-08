import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, LayoutChangeEvent } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { screenTitleText } from '@/constants/typography';

type ScreenHeaderProps = {
  title: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export default function ScreenHeader({ title, onLayout }: ScreenHeaderProps) {
  return (
    <View style={styles.header} onLayout={onLayout}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.md, // Use a consistent spacing token
    marginTop: SPACING.pageHorizontal, // Re-add your desired padding as a margin
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
}); 