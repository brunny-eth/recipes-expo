import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/theme';
import { screenTitleText } from '@/constants/typography';

type ScreenHeaderProps = {
  title: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  showBack?: boolean;
  onTitlePress?: () => void;
};

export default function ScreenHeader({ title, onLayout, showBack = true, onTitlePress }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header} onLayout={onLayout}>
      {showBack ? (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.side}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      ) : (
        <View style={styles.side} />
      )}
      {onTitlePress ? (
        <TouchableOpacity
          onPress={onTitlePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
          style={{ flex: 1 }}
        >
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
      )}
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.md,
    marginTop: SPACING.pageHorizontal,
    minHeight: 44 + SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
}); 