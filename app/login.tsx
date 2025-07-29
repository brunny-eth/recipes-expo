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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { COLORS, SPACING, RADIUS, ICON_SIZE } from '@/constants/theme';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { FONT, bodyText, bodyTextLoose, bodyStrongText } from '@/constants/typography';
import LogoHeader from '@/components/LogoHeader';
import Animated from 'react-native-reanimated';

type AuthProvider = 'google' | 'apple';

const LoginScreen = () => {
  const { signIn, isLoading: isAuthLoading } = useAuth();
  const { showSuccess } = useSuccessModal();
  const [isSigningIn, setIsSigningIn] = useState<AuthProvider | null>(null);

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
    
    // Add a timeout to prevent getting stuck on loading
    const timeoutId = setTimeout(() => {
      if (isSigningIn === provider) {
        console.warn(`[LoginScreen] Sign-in timeout for ${provider}`);
        setIsSigningIn(null);
        Alert.alert(
          'Sign-in Timeout',
          'The sign-in process is taking longer than expected. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }, 30000); // 30 second timeout
    
    try {
      const success = await signIn(provider); // Get the boolean result
      if (success) {
        console.log(`[LoginScreen] Sign-in successful with ${provider}.`);
        // Success message will be shown by AuthNavigationHandler
      } else {
        console.log(`[LoginScreen] Sign-in flow cancelled or failed for ${provider}.`);
        // No specific action needed here as AuthContext's error modal already showed
      }
    } catch (error) {
      console.error(`[LoginScreen] Unexpected error during sign-in initiation with ${provider}:`, error);
    } finally {
      clearTimeout(timeoutId);
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
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <LogoHeader animatedLogo={animatedLogo} />
        </View>
        <View style={styles.authSection}>
          <Text style={styles.subtitle}>
            Create an account or login to your account to use Meez.
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={() => handleSignIn('google')}
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
    fontSize: FONT.size.lg, // Make text bigger
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xxxl, // Increased spacing to push buttons further away
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
