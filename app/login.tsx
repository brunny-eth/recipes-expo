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
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SPACING, RADIUS, ICON_SIZE } from '@/constants/theme';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { FONT, bodyText, bodyTextLoose, bodyStrongText } from '@/constants/typography';
import LogoHeader from '@/components/LogoHeader';
import Animated from 'react-native-reanimated';

type AuthProvider = 'google' | 'apple';

const LoginScreen = () => {
  const { signIn, isLoading: isAuthLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState<AuthProvider | null>(null);
  const insets = useSafeAreaInsets();

  // Create the same animated logo as the index page
  const animatedLogo = (
    <Animated.View>
      <Image
        source={require('@/assets/images/meezblue_underline.png')}
        resizeMode="contain"
        style={{
          width: 400,
          height: 200,
          alignSelf: 'center',
        }}
      />
    </Animated.View>
  );

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
        style={[styles.exitButton, { top: insets.top + SPACING.md }]}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons
          name="close"
          size={ICON_SIZE.md}
          color={COLORS.textDark}
        />
      </TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <LogoHeader animatedLogo={animatedLogo} />
        </View>
        <View style={styles.authSection}>
          <Text style={styles.subtitle}>
            Link an account to use, save, and find new recipes.
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={() => handleSignIn('google')}
            disabled={!!isSigningIn}
          >
            {isSigningIn === 'google' ? (
              <ActivityIndicator color={COLORS.white} />
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
        </View>
        {/* TOS/Privacy Policy agreement text */}
        <View style={styles.tosSection}>
          <Text style={styles.tosText}>
            By continuing, you agree to our{' '}
            <Text style={styles.tosLink} onPress={() => Linking.openURL('https://meez.app/tos.html')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.tosLink} onPress={() => Linking.openURL('https://meez.app/privacy.html')}>Privacy Policy</Text>.
          </Text>
        </View>
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,
  logoSection: {
    paddingTop: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,
  authSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  tosSection: {
    paddingBottom: SPACING.md,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    fontSize: FONT.size.xxl,
    fontWeight: FONT.weight.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
            fontFamily: FONT.family.ubuntu,
  } as TextStyle,
  subtitle: {
    ...bodyTextLoose,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg, // Reduced spacing to bring buttons closer
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
    right: SPACING.pageHorizontal,
    padding: SPACING.sm,
    zIndex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,
  tosText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  } as TextStyle,
  tosLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  } as TextStyle,
});

export default LoginScreen;
