import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { useErrorModal } from '@/context/ErrorModalContext';
import { COLORS } from '@/constants/theme';

const LoginCallbackScreen = () => {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const { showError } = useErrorModal();

  useEffect(() => {
    // Set a timeout to handle cases where authentication takes too long.
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        showError(
          'Login Timed Out',
          'The sign-in process is taking longer than expected. Please try again.'
        );
        router.replace('/login' as any);
      }
    }, 10000); // 10-second timeout

    // If the session is loaded and exists, the user is authenticated.
    if (!isLoading && session) {
      clearTimeout(timeoutId);
      router.replace('/explore' as any);
      return;
    }

    // If the auth provider is done loading and there's still no session,
    // it means the login failed or was cancelled.
    if (!isLoading && !session) {
      clearTimeout(timeoutId);
      showError(
        'Login Failed',
        'Could not complete the sign-in process. Please try again.'
      );
      router.replace('/login' as any);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [session, isLoading, router, showError]);

  // The view that shows while the app is verifying the session
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>Completing sign-in...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.secondary,
    fontFamily: 'Inter-Regular',
  },
});

export default LoginCallbackScreen; 