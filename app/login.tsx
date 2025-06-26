import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SPACING, RADIUS, ICON_SIZE } from '@/constants/theme';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FONT, bodyText, bodyStrongText } from '@/constants/typography';

type AuthProvider = 'google' | 'apple';

const LoginScreen = () => {
  const { signIn, isLoading: isAuthLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState<AuthProvider | null>(null);

  const handleSignIn = async (provider: AuthProvider) => {
    if (isSigningIn) return;
    setIsSigningIn(provider);
    try {
      await signIn(provider);
    } catch (error) {
      // Error is already handled by the AuthContext's error modal
      console.log('Redirecting to login after error or cancellation.');
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
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.exitButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <MaterialCommunityIcons
          name="close"
          size={ICON_SIZE.md}
          color={COLORS.textDark}
        />
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Meez</Text>
        <Text style={styles.subtitle}>
          Create an account to use, save, and find new recipes.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={() => handleSignIn('google')}
          disabled={!!isSigningIn}
          accessibilityLabel="Continue with Google"
          accessibilityHint="Logs you in using your Google account"
        >
          {isSigningIn === 'google' ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <FontAwesome
                name="google"
                size={ICON_SIZE.lg}
                color={COLORS.white}
                style={styles.icon}
              />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.button, styles.appleButton]}
            onPress={() => handleSignIn('apple')}
            disabled={!!isSigningIn}
            accessibilityLabel="Continue with Apple"
            accessibilityHint="Logs you in using your Apple ID"
          >
            {isSigningIn === 'apple' ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <FontAwesome
                  name="apple"
                  size={ICON_SIZE.lg}
                  color={COLORS.white}
                  style={styles.icon}
                />
                <Text style={styles.buttonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
  } as ViewStyle,
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  } as ViewStyle,
  content: {
    paddingHorizontal: SPACING.pageHorizontal,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    fontSize: FONT.size.xxl,
    fontWeight: FONT.weight.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    fontFamily: FONT.family.recoleta,
  } as TextStyle,
  subtitle: {
    ...bodyText,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
  } as TextStyle,
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    minHeight: 54, // TODO: Consider tokenizing if reused elsewhere
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
  exitButton: {
    position: 'absolute',
    top: SPACING.pageHorizontal,
    right: SPACING.pageHorizontal,
    padding: SPACING.sm,
    zIndex: 1,
  } as ViewStyle,
});

export default LoginScreen;
