import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSegments, Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { SuccessModalProvider } from '@/context/SuccessModalContext';
import { CookingProvider } from '@/context/CookingContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '@/components/WelcomeScreen';
import AppNavigators from '@/components/AppNavigators';
import LoginScreen from '@/app/login';
import { COLORS } from '@/constants/theme';
import SplashScreenMeez from './SplashScreen';
import { AuthNavigationHandler } from '@/components/AuthNavigationHandler';
import OfflineBanner from '@/components/OfflineBanner';
import { getNetworkStatus } from '@/utils/networkUtils';
import { useRenderCounter } from '@/hooks/useRenderCounter';

SplashScreen.preventAutoHideAsync();
console.log('[GLOBAL] SplashScreen.preventAutoHideAsync called.');

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
  useRenderCounter('RootLayoutNav', {
    sessionUserId: session?.user?.id,
    isAuthLoading,
    firstSegment: segments[0],
  });

  // Simplified readiness states
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null means not yet determined
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false); // True when custom splash animation is over

  // Add timeout mechanism to prevent getting stuck in loading states after inactivity
  const [forceReady, setForceReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Offline detection
  const [isOffline, setIsOffline] = useState(false);
  
  // Remove navigation ref since we're no longer using navigation for initial routing

  const [fontsLoaded] = useFonts({
    'Ubuntu-Regular': require('../assets/fonts/Ubuntu-Regular.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // App readiness logic - separates concerns clearly
  const isFrameworkReady = fontsLoaded && assetsLoaded;
  const isAuthReady = !isAuthLoading;
  
  // Single source of truth for app hydration - when all initial data is loaded
  const isAppHydrated = isFrameworkReady && isFirstLaunch !== null && isAuthReady;
  
  // Routing logic - separate from app readiness
  const isOnLoginScreen = segments[0] === 'login' || segments[0] === 'auth';
  const isReadyToRender = isAppHydrated || forceReady || isOnLoginScreen;

  // Setup timeout for force ready
  useEffect(() => {
    const id = setTimeout(() => {
      setForceReady(true);
    }, 10000); // 10 second timeout

    timeoutRef.current = id;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      const isConnected = await getNetworkStatus();
      setIsOffline(!isConnected);
    };
    
    checkNetwork();
    
    // Check every 5 seconds
    const interval = setInterval(checkNetwork, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // === PREPARE APP RESOURCES ===
  useEffect(() => {
    let isMounted = true;
    
    if (!fontsLoaded) {
      return () => { isMounted = false; };
    }

    const prepareApp = async () => {
      try {
        // Preload critical assets (ensure these exist in the asset registry)
        await Asset.loadAsync([
          require('../assets/images/splash.png'),
        ]);
        
        if (!isMounted) return;
        
        setAssetsLoaded(true);

        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunched');
        
        if (!isMounted) return;
        
        const isFirstLaunchValue = hasLaunchedBefore !== 'true';
        setIsFirstLaunch(isFirstLaunchValue);

      } catch (error) {
        console.error('[RootLayoutNav][prepareApp] Error during app preparation:', error);
        if (isMounted) {
          setAssetsLoaded(true); // Fail gracefully
          setIsFirstLaunch(false); // Default to returning user
        }
      }
    };

    prepareApp();
    return () => { isMounted = false; };
  }, [fontsLoaded]); // Rerun when fontsLoaded changes

  // === WELCOME SCREEN DISMISS HANDLER ===
  const handleWelcomeDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsFirstLaunch(false); // Update state to prevent WelcomeScreen from showing again next time
      // Don't call SplashScreen.hideAsync() here - let the useEffect handle it
    } catch (error) {
      console.error('[RootLayoutNav][handleWelcomeDismiss] Failed to set hasLaunched flag:', error);
      setIsFirstLaunch(false);
      // Don't call SplashScreen.hideAsync() here either
    }
  }, []); // Empty dependencies to ensure stable reference

  // === SPLASH SCREEN HANDLERS ===
  const handleSplashFinish = useCallback(() => {
    setSplashAnimationComplete(true);
  }, []);

  // === CRITICAL EFFECT FOR HIDING NATIVE SPLASH ===
  useEffect(() => {
    // Only hide native splash if both custom splash animation is done
    // AND the app's initial data/state is fully resolved OR we've forced ready due to timeout.
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    const shouldHideSplash = splashAnimationComplete && (appReadyForContent || forceReady);

    if (shouldHideSplash) {
      SplashScreen.hideAsync();
    }
  }, [splashAnimationComplete, fontsLoaded, assetsLoaded, isFirstLaunch, isAuthReady, forceReady]);

  // === CONDITIONAL RENDERING LOGIC: WHAT TO SHOW ===
  const renderContent = useMemo(() => {
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    
    // Consider forced ready state for timeout scenarios
    const shouldRenderApp = appReadyForContent || forceReady;

    // 1. **PRIORITY**: Always show the custom animated splash screen until it signals completion.
    if (!splashAnimationComplete) {
      return <SplashScreenMeez onFinish={handleSplashFinish} />;
    }

    // 2. **NEXT**: Once custom splash animation is done, wait for app data readiness OR force ready timeout.
    if (!shouldRenderApp) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    // 3. **HANDLE INITIAL ROUTING**: Redirect from +not-found or empty paths to appropriate screens
    const currentPath = segments.join('/');
    if (segments[0] === '+not-found' || currentPath === '') {
      if (session) {
        return <Redirect href="/tabs" />;
      } else {
        return <Redirect href="/login" />;
      }
    }

    // 4. **TIMEOUT RECOVERY**: If we're here because of forceReady (not normal app readiness),
    // handle based on auth state
    if (forceReady && !appReadyForContent) {
      if (session) {
        return (
          <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
            <OfflineBanner visible={isOffline} />
            <AppNavigators />
            <StatusBar style="dark" />
          </Animated.View>
        );
      } else {
        return (
          <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
            <OfflineBanner visible={isOffline} />
            <LoginScreen />
            <StatusBar style="dark" />
          </Animated.View>
        );
      }
    }

    // 5. **FIRST LAUNCH**: Show welcome screen
    if (isFirstLaunch === true) {
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <WelcomeScreen onDismiss={handleWelcomeDismiss} />
        </Animated.View>
      );
    }

    // 6. **NORMAL FLOW**: App is fully ready - use conditional rendering based on auth state
    
    if (session) {
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <OfflineBanner visible={isOffline} />
          <AppNavigators />
          <StatusBar style="dark" />
        </Animated.View>
      );
    } else {
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <OfflineBanner visible={isOffline} />
          <LoginScreen />
          <StatusBar style="dark" />
        </Animated.View>
      );
    }

  }, [
    splashAnimationComplete,
    fontsLoaded, 
    assetsLoaded,
    isFirstLaunch,
    isAuthReady,
    forceReady,
    handleSplashFinish,
    handleWelcomeDismiss,
    session, // Now critical for conditional rendering
    segments, // Add segments to dependencies for initial routing
    isOffline, // Add offline state to dependencies
  ]);

  return renderContent;
}

export default function RootLayout() {
  // Log environment configuration
  console.log('[Meez] 🌐 ENV CONFIG', {
    API_URL: process.env.EXPO_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
  });

  useFrameworkReady(); // Keep framework-level readiness in RootLayout

  // RootLayout now always renders context providers and RootLayoutNav
  // This ensures the root of the application tree remains stable
  
  const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  
  return (
    <PostHogProvider
      apiKey={posthogApiKey || 'dummy-key'}
      options={{
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        enableSessionReplay: true,
        disabled: !posthogApiKey, // Disable PostHog if no API key is provided
      }}
      autocapture={!!posthogApiKey} // Only enable autocapture if API key is available
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorModalProvider>
          <SuccessModalProvider>
            <AuthProvider>
              <CookingProvider>
                <AuthNavigationHandler />
                <RootLayoutNav />
              </CookingProvider>
            </AuthProvider>
          </SuccessModalProvider>
        </ErrorModalProvider>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
}