import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ViewStyle, TextStyle, Image, InteractionManager } from 'react-native';
import { useHandleError } from '@/hooks/useHandleError';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { signInWithGoogleManualPkce } from '@/context/AuthContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { COLORS, SPACING, RADIUS, ICON_SIZE } from '@/constants/theme';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { FONT, bodyText, bodyTextLoose, bodyStrongText } from '@/constants/typography';
import ScreenHeader from '@/components/ScreenHeader';

type AuthProvider = 'google' | 'apple';

const LoginScreen = () => {
  const { signIn, isLoading: isAuthLoading } = useAuth();
  const handleError = useHandleError();
  const { showSuccess } = useSuccessModal();
  const [isSigningIn, setIsSigningIn] = useState<AuthProvider | null>(null);
  const inFlightRef = useRef(false);
  const insets = useSafeAreaInsets();

  // Log component render state for debugging
  console.log('[ui] LoginScreen render, isSigningIn:', isSigningIn, 'isAuthLoading:', isAuthLoading);


  const onGooglePress = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSigningIn('google');
    try {
      await signInWithGoogleManualPkce();  // MUST be awaited
    } finally {
      inFlightRef.current = false;
      setIsSigningIn(null);
    }
  }, [signInWithGoogleManualPkce]);

  const handleSignIn = async (provider: AuthProvider) => {
    if (provider === 'google') {
      await onGooglePress();
      return;
    }

    // Handle Apple sign-in (existing logic)
    if (isSigningIn) return;
    setIsSigningIn(provider);

    try {
      const success = await signIn(provider);
      if (success) {
        console.log(`[LoginScreen] Sign-in successful with ${provider}.`);
      } else {
        console.log(`[LoginScreen] Sign-in flow cancelled or failed for ${provider}.`);
      }
    } catch (error: any) {
      console.error(`[LoginScreen] Unexpected error during sign-in initiation with ${provider}:`, error);
      handleError('Sign In Error', error?.message || 'Sign-in failed');
    } finally {
      setIsSigningIn(null);
    }
  };

  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="OLEA"
        showBack={false}
        titleStyle={{ fontSize: 32, fontWeight: '800' }}
        backgroundColor="#DEF6FF"
      />
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Text style={styles.title}>Before we get started...</Text>
        </View>
        <View style={styles.authSection}>
          <Text style={styles.subtitle}>
          Sign in. Start cooking.
          </Text>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={() => handleSignIn('apple')}
              disabled={!!isSigningIn}
              accessibilityLabel="Continue with Apple"
              accessibilityHint="Logs you in using your Apple ID"
            >
              {isSigningIn === 'apple' ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color={COLORS.white} size="small" />
                  <Text style={styles.buttonText}>Signing in...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <FontAwesome
                    name="apple"
                    size={ICON_SIZE.lg}
                    color={COLORS.white}
                    style={styles.icon}
                  />
                  <Text style={styles.buttonText}>Continue with Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={onGooglePress}
            disabled={!!isSigningIn}
          >
            {isSigningIn === 'google' ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color={COLORS.white} size="small" />
                <Text style={styles.buttonText}>Signing in...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <FontAwesome
                  name="google"
                  size={ICON_SIZE.lg}
                  color={COLORS.white}
                  style={styles.icon}
                />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
        {/* TOS/Privacy Policy agreement text */}
        <View style={styles.tosSection}>
          <Text style={styles.tosText}>
            By logging in, you agree to the{' '}
            <Text style={styles.tosLink} onPress={() => Linking.openURL('https://cookolea.com/tos.html')}>TOS</Text>
            {' '}and{' '}
            <Text style={styles.tosLink} onPress={() => Linking.openURL('https://cookolea.com/privacy.html')}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  } as ViewStyle,
  content: {
    paddingHorizontal: SPACING.pageHorizontal,
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  } as ViewStyle,
  logoSection: {
    paddingTop: SPACING.sm,
    alignItems: 'flex-start',
    width: '100%',
  } as ViewStyle,
  authSection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
  } as ViewStyle,
  tosSection: {
    paddingBottom: SPACING.md,
    alignItems: 'flex-start',
    width: '100%',
  } as ViewStyle,
  title: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
    marginTop: SPACING.xs,
    marginBottom: 36 + SPACING.xl,
  } as TextStyle,
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    minHeight: 54,
  } as ViewStyle,
  googleButton: {
    backgroundColor: COLORS.googleBlue,
  } as ViewStyle,
  appleButton: {
    backgroundColor: COLORS.black,
  } as ViewStyle,
  buttonText: {
    ...bodyStrongText,
    color: COLORS.white,
  } as TextStyle,
  icon: {
    marginRight: SPACING.smMd,
  } as TextStyle,
  tosText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'left',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  } as TextStyle,
  tosLink: {
    color: COLORS.textDark,
    textDecorationLine: 'underline',
  } as TextStyle,
});

export default LoginScreen;
