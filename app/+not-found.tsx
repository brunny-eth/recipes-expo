import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { sectionHeaderText, bodyStrongText } from '@/constants/typography';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <View style={styles.linkContainer}>
          <Link href="/tabs" asChild>
            <Text style={styles.linkText}>Go to home screen!</Text>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.pageHorizontal,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  title: {
    ...sectionHeaderText,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  } as TextStyle,
  linkContainer: {
    marginTop: SPACING.smLg,
    paddingVertical: SPACING.smLg,
  } as ViewStyle,
  linkText: {
    ...bodyStrongText,
    color: COLORS.primary,
  } as TextStyle,
});
