import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
  TextStyle,
  Linking,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  bodyText,
  bodyStrongText,
  screenTitleText,
  sectionHeaderText,
  FONT,
} from '@/constants/typography';
import ScreenHeader from '@/components/ScreenHeader';

function AuthStatus() {
  const { session } = useAuth();

  return (
    <View style={styles.authStatusContainer}>
      <Text style={styles.authStatusText}>
        {`Logged in as ${session?.user?.email}`}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut, isAuthenticated, session } = useAuth();
  const insets = useSafeAreaInsets();

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[SettingsScreen] Component DID MOUNT');
    return () => {
      console.log('[SettingsScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      console.log('[SettingsScreen] 🎯 useFocusEffect triggered');
      console.log('[SettingsScreen] 👁️ Screen focused');

      return () => {
        console.log('[SettingsScreen] 🌀 useFocusEffect cleanup');
        console.log('[SettingsScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Settings" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://meez.app/tos.html')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://meez.app/privacy.html')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/debug' as any)}
            >
              <Text style={styles.linkText}>Open Debug Menu</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      {/* Bottom section with auth status and sign out button */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + SPACING.md }]}>
        {isAuthenticated ? (
          <>
            <View style={styles.authStatusContainer}>
              <Text style={styles.authStatusText}>
                {`Logged in as ${session?.user?.email}`}
              </Text>
            </View>
            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/login')}
            style={styles.loginButton}
          >
            <Text style={styles.loginButtonText}>Log In or Sign Up</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  authContainer: {
    minHeight: 70, // TODO: Tokenize component heights?
    marginBottom: SPACING.pageHorizontal,
  } as ViewStyle,
  authStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12, // TODO: No SPACING token for 12
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
  } as ViewStyle,
  authStatusText: {
    ...bodyStrongText,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  } as TextStyle,
  section: {
    marginBottom: SPACING.pageHorizontal,
  } as ViewStyle,
  sectionTitle: {
    ...sectionHeaderText,
    marginBottom: SPACING.sm,
  } as TextStyle,
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.default,
    borderBottomColor: COLORS.lightGray,
  } as ViewStyle,
  linkText: {
    ...bodyText,
    fontSize: FONT.size.body,
  } as TextStyle,
  versionText: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.pageHorizontal,
  } as TextStyle,
  signOutButton: {
    marginTop: SPACING.pageHorizontal,
    backgroundColor: COLORS.primary,
    padding: 15, // TODO: No SPACING token for 15. md is 16.
    borderRadius: 10, // TODO: No RADIUS token for 10. sm is 8, md is 12.
    alignItems: 'center',
  } as ViewStyle,
  signOutButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.body,
  } as TextStyle,
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12, // TODO: No SPACING token for 12.
    paddingHorizontal: 25, // TODO: No SPACING token for 25. lg is 24.
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.body,
  } as TextStyle,
  scrollContent: {
    paddingBottom: SPACING.xl,
  } as ViewStyle,
  bottomSection: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.lg,
    borderTopWidth: BORDER_WIDTH.default,
    borderTopColor: COLORS.lightGray,
  } as ViewStyle,
});
