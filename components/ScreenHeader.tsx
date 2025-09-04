import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/theme';
import { screenTitleText, FONT } from '@/constants/typography';

// Function to get appropriate font size based on title
const getTitleFontSize = (title: string): number => {
  if (title.toUpperCase() === 'OLEA') {
    return 36; // Larger size for OLEA
  }
  // Larger size for main section headings
  if (['IMPORT', 'LIBRARY', 'MISE', 'SETTINGS', 'EXPLORE', 'LOGIN', 'ONBOARDING'].includes(title.toUpperCase())) {
    return 28; // Medium size for other main headings
  }
  return FONT.size.screenTitle; // Default size
};

type ScreenHeaderProps = {
  title: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  showBack?: boolean;
  onTitlePress?: () => void;
  titleStyle?: TextStyle;
  backgroundColor?: string;
};

export default function ScreenHeader({ title, onLayout, showBack = true, onTitlePress, titleStyle, backgroundColor }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={[
      styles.header,
      {
        borderTopWidth: 1,
        borderTopColor: '#000000',
        borderBottomWidth: 1,
        borderBottomColor: '#000000'
      },
      backgroundColor && { backgroundColor }
    ]} onLayout={onLayout}>
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
          <Text
            style={[styles.title, { fontSize: getTitleFontSize(title) }, titleStyle]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { fontSize: getTitleFontSize(title) }, titleStyle]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    marginTop: 0,
    minHeight: 48, // Increased to accommodate larger font sizes (was 44)
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