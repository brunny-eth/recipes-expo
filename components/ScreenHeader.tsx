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
  titleStyle?: TextStyle;
};

export default function ScreenHeader({ title, onLayout, showBack = true, onTitlePress, titleStyle }: ScreenHeaderProps) {
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
      ) : null}
      {onTitlePress ? (
        <TouchableOpacity
          onPress={onTitlePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
          style={styles.titleContainer}
        >
          <Text style={[styles.title, titleStyle]} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.titleContainer}>
          <Text style={[styles.title, titleStyle]} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 0,
    paddingBottom: SPACING.md,
    marginTop: 0,
    minHeight: 44 + SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#D9D5CC',
  } as ViewStyle,
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  } as ViewStyle,
  titleContainer: {
    paddingLeft: 18, // Match the folder row padding
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'left',
    textTransform: 'uppercase' as const,
  } as TextStyle,
}); 