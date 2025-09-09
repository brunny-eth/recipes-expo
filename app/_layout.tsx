import React, { useEffect, useCallback, useState } from 'react';
import { useRouter, useSegments, Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { SuccessModalProvider } from '@/context/SuccessModalContext';
import { CookingProvider } from '@/context/CookingContext';
import { RevenueCatProvider } from '@/context/RevenueCatContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import WelcomeScreen from '@/components/WelcomeScreen';
import AppNavigators from '@/components/AppNavigators';
import { COLORS } from '@/constants/theme';
import { AuthNavigationHandler } from '@/components/AuthNavigationHandler';
import OfflineBanner from '@/components/OfflineBanner';
import { getNetworkStatus } from '@/utils/networkUtils';

// Keep native splash visible until React tree is ready
SplashScreen.preventAutoHideAsync();

if (__DEV__) {
  // @ts-expect-error - ErrorUtils is a global internal to react-native
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  // @ts-expect-error - ErrorUtils is a global internal to react-native
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('[GLOBAL ERROR CAUGHT]', error.message);
  });
}

function RootLayoutNav() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // App readiness states
  const [ready, setReady] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'Ubuntu-Regular': require('../assets/fonts/Ubuntu-Regular.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });

  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      const isConnected = await getNetworkStatus();
      setIsOffline(!isConnected);
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load everything needed for first frame
  useEffect(() => {
    (async () => {
      try {
        // Wait for fonts to load
        if (!fontsLoaded) return;

        // Preload critical assets
        await Asset.loadAsync([
          require('../assets/images/splash.png'),
        ]);

        // Check if this is first launch
        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunched');
        setIsFirstLaunch(hasLaunchedBefore !== 'true');

      } catch (error) {
        console.error('[RootLayoutNav] Error during app preparation:', error);
        // Fail gracefully
        setIsFirstLaunch(false);
      } finally {
        setReady(true);
      }
    })();
  }, [fontsLoaded]);

  // Hide native splash only after root view paints
  const onLayoutRootView = useCallback(async () => {
    if (ready && !isAuthLoading) {
      await SplashScreen.hideAsync();
    }
  }, [ready, isAuthLoading]);

  // Handle welcome screen dismiss
  const handleWelcomeDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsFirstLaunch(false);
    } catch (error) {
      console.error('[RootLayoutNav] Failed to set hasLaunched flag:', error);
      setIsFirstLaunch(false);
    }
  }, []);

  // Don't render anything until ready
  if (!ready || isAuthLoading) {
    return null; // Native splash stays visible
  }

  // Handle initial routing
  const currentPath = segments.join('/');
  if (segments[0] === '+not-found' || currentPath === '') {
    if (session) {
      return <Redirect href="/tabs" />;
    } else {
      return <Redirect href="/login" />;
    }
  }

  // Show welcome screen for first launch
  if (isFirstLaunch === true) {
    return (
      <View style={{ flex: 1, backgroundColor: '#DEF6FF' }} onLayout={onLayoutRootView}>
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <WelcomeScreen onDismiss={handleWelcomeDismiss} />
        </Animated.View>
      </View>
    );
  }

  // Normal app flow
  return (
    <View style={{ flex: 1, backgroundColor: '#DEF6FF' }} onLayout={onLayoutRootView}>
      <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
        <OfflineBanner visible={isOffline} />
        <AppNavigators />
        <StatusBar style="dark" />
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  
  const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  
  return (
    <PostHogProvider
      apiKey={posthogApiKey || 'dummy-key'}
      options={{
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        enableSessionReplay: true,
        disabled: !posthogApiKey,
      }}
      autocapture={!!posthogApiKey}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorModalProvider>
          <SuccessModalProvider>
            <AuthProvider>
              <RevenueCatProvider>
                <CookingProvider>
                  <AuthNavigationHandler />
                  <RootLayoutNav />
                </CookingProvider>
              </RevenueCatProvider>
            </AuthProvider>
          </SuccessModalProvider>
        </ErrorModalProvider>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
}