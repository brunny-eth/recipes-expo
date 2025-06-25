import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/constants/theme';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

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
      <TouchableOpacity style={styles.exitButton} onPress={() => router.replace('/(tabs)')}>
        <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
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
              <FontAwesome name="google" size={20} color={COLORS.white} style={styles.icon} />
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
                <FontAwesome name="apple" size={20} color={COLORS.white} style={styles.icon} />
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 16,
    fontFamily: 'Recoleta-Medium',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 48,
    fontFamily: 'Inter-Regular',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 54,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: COLORS.black,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  icon: {
    marginRight: 12,
  },
  exitButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    zIndex: 1,
  },
});

export default LoginScreen; 