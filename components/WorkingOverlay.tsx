import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING, RADIUS, OVERLAYS } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
};

/**
 * Full-screen "working…" card used while the recipe is being modified or saved.
 * One overlay for every long action, so footer buttons never need inline spinners.
 */
export default function WorkingOverlay({ visible, title, message }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.container} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.textDark} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAYS.medium,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  } as ViewStyle,
  card: {
    width: '80%',
    maxWidth: 350,
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
  } as ViewStyle,
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  } as TextStyle,
  message: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  } as TextStyle,
});
