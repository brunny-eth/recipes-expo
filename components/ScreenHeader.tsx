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
      {showBack && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      )}
      {onTitlePress ? (
        <TouchableOpacity
          onPress={onTitlePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingBottom: SPACING.md, // Use a consistent spacing token
    marginTop: SPACING.pageHorizontal, // Re-add your desired padding as a margin
    minHeight: 44 + SPACING.md,
    justifyContent: 'center',
    position: 'relative',
  } as ViewStyle,
  backButton: {
    position: 'absolute',
    left: SPACING.pageHorizontal,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    width: 44,
    zIndex: 2,
  } as ViewStyle,
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingHorizontal: 56, // Reserve space so long titles don't overlap the back button
  } as TextStyle,
}); 