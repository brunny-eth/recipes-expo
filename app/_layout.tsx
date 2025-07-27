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

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { CookingProvider } from '@/context/CookingContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '@/components/WelcomeScreen';
import AppNavigators from '@/components/AppNavigators';
import LoginScreen from '@/app/login';
import { COLORS } from '@/constants/theme';
import SplashScreenMeez from './SplashScreen';

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
  console.log('[RootLayoutNav] Rendered');
  
  const { session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Simplified readiness states
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null means not yet determined
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false); // True when custom splash animation is over

  // Add timeout mechanism to prevent getting stuck in loading states after inactivity
  const [forceReady, setForceReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Remove navigation ref since we're no longer using navigation for initial routing

  const [fontsLoaded] = useFonts({
    'Ubuntu-Regular': require('../assets/fonts/Ubuntu-Regular.ttf'),
    'Ubuntu-Bold': require('../assets/fonts/Ubuntu-Bold.ttf'),
    'Ubuntu-Medium': require('../assets/fonts/Ubuntu-Medium.ttf'),
    'Ubuntu-Light': require('../assets/fonts/Ubuntu-Light.ttf'),
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
      console.log('[RootLayoutNav] Timeout reached. Setting forceReady to true to prevent indefinite loading.');
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

  // === PREPARE APP RESOURCES ===
  useEffect(() => {
    let isMounted = true;
    
    if (!fontsLoaded) {
      console.log('[RootLayoutNav][Effect: prepareApp] Waiting for fonts to load before starting prepareApp.');
      return () => { isMounted = false; console.log('[RootLayoutNav][Effect: prepareApp] Cleanup - isMounted set to false.'); };
    }

    console.log('[RootLayoutNav][Effect: prepareApp] Running. fontsLoaded: true');

    const prepareApp = async () => {
      try {
        console.log('[RootLayoutNav][prepareApp] Starting asset load...');
        
        // Preload critical assets
        await Asset.loadAsync([
          require('../assets/images/meezblue_underline.png'),
        ]);
        
        if (!isMounted) return;
        
        setAssetsLoaded(true);
        console.log('[RootLayoutNav][prepareApp] Assets loaded. assetsLoaded set to true.');

        console.log('[RootLayoutNav][prepareApp] Checking AsyncStorage for \'hasLaunched\'...');
        const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunched');
        
        if (!isMounted) return;
        
        const isFirstLaunchValue = hasLaunchedBefore !== 'true';
        setIsFirstLaunch(isFirstLaunchValue);
        console.log(`[RootLayoutNav][prepareApp] isFirstLaunch determined: ${isFirstLaunchValue}.`);

      } catch (error) {
        console.error('[RootLayoutNav][prepareApp] Error during app preparation:', error);
        if (isMounted) {
          setAssetsLoaded(true); // Fail gracefully
          setIsFirstLaunch(false); // Default to returning user
        }
      }
    };

    prepareApp();
    return () => { isMounted = false; console.log('[RootLayoutNav][Effect: prepareApp] Cleanup - isMounted set to false.'); };
  }, [fontsLoaded]); // Rerun when fontsLoaded changes

  // === WELCOME SCREEN DISMISS HANDLER ===
  const handleWelcomeDismiss = useCallback(async () => {
    console.log('[RootLayoutNav][handleWelcomeDismiss] Welcome screen dismissed by user.');
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      console.log('[RootLayoutNav][handleWelcomeDismiss] AsyncStorage \'hasLaunched\' set to true.');
      setIsFirstLaunch(false); // Update state to prevent WelcomeScreen from showing again next time
      console.log('[RootLayoutNav][handleWelcomeDismiss] State updated, letting useEffect handle SplashScreen.hideAsync().');
      // Don't call SplashScreen.hideAsync() here - let the useEffect handle it
    } catch (error) {
      console.error('[RootLayoutNav][handleWelcomeDismiss] Failed to set hasLaunched flag:', error);
      setIsFirstLaunch(false);
      // Don't call SplashScreen.hideAsync() here either
    }
  }, []); // Empty dependencies to ensure stable reference

  // === SPLASH SCREEN HANDLERS ===
  const handleSplashFinish = useCallback(() => {
    console.log('[RootLayoutNav] Custom splash animation completed - setting splashAnimationComplete to true.');
    setSplashAnimationComplete(true);
  }, []);

  // === TRACK SPLASH ANIMATION COMPLETION ===
  useEffect(() => {
    console.log('[RootLayoutNav][Effect: splashAnimationComplete] State changed to:', splashAnimationComplete);
  }, [splashAnimationComplete]);

  // === CRITICAL EFFECT FOR HIDING NATIVE SPLASH ===
  useEffect(() => {
    // Only hide native splash if both custom splash animation is done
    // AND the app's initial data/state is fully resolved OR we've forced ready due to timeout.
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    const shouldHideSplash = splashAnimationComplete && (appReadyForContent || forceReady);

    if (shouldHideSplash) {
      console.log('[RootLayoutNav][Effect: hideNativeSplash] Conditions met: HIDING NATIVE SPLASH.', {
        appReadyForContent,
        forceReady,
        reason: forceReady && !appReadyForContent ? 'timeout_recovery' : 'normal_ready'
      });
      SplashScreen.hideAsync();
    } else {
      console.log('[RootLayoutNav][Effect: hideNativeSplash] Not yet ready to hide native splash. Current state:', {
        splashAnimationComplete,
        appReadyForContent,
        forceReady,
        fontsLoaded,
        assetsLoaded,
        isFirstLaunch,
        isAuthReady,
      });
    }
  }, [splashAnimationComplete, fontsLoaded, assetsLoaded, isFirstLaunch, isAuthReady, forceReady]);

  // === CONDITIONAL RENDERING LOGIC: WHAT TO SHOW ===
  const renderContent = useMemo(() => {
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    
    // Consider forced ready state for timeout scenarios
    const shouldRenderApp = appReadyForContent || forceReady;

    console.log('[RootLayoutNav][useMemo] Current state values for render decision:', {
      splashAnimationComplete,
      appReadyForContent,
      shouldRenderApp,
      forceReady,
      fontsLoaded,
      assetsLoaded,
      isFirstLaunch,
      isAuthReady,
      hasSession: !!session,
      segments: segments.join('/'),
    });

    // 1. **PRIORITY**: Always show the custom animated splash screen until it signals completion.
    if (!splashAnimationComplete) {
      console.log('[RootLayoutNav][useMemo] Rendering SplashScreenMeez - custom animation pending.');
      return <SplashScreenMeez onFinish={handleSplashFinish} />;
    }

    // 2. **NEXT**: Once custom splash animation is done, wait for app data readiness OR force ready timeout.
    if (!shouldRenderApp) {
      console.log('[RootLayoutNav][useMemo] Custom splash complete, but app is still preparing. Showing temporary loader.');
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    // 3. **HANDLE INITIAL ROUTING**: Redirect from +not-found or empty paths to appropriate screens
    const currentPath = segments.join('/');
    if (segments[0] === '+not-found' || currentPath === '') {
      console.log(`[RootLayoutNav][useMemo] Handling initial route. Current path: "${currentPath}"`);
      if (session) {
        console.log('[RootLayoutNav][useMemo] Authenticated user, redirecting to /tabs');
        return <Redirect href="/tabs" />;
      } else {
        console.log('[RootLayoutNav][useMemo] Unauthenticated user, redirecting to /login');  
        return <Redirect href="/login" />;
      }
    }

    // 4. **TIMEOUT RECOVERY**: If we're here because of forceReady (not normal app readiness),
    // handle based on auth state
    if (forceReady && !appReadyForContent) {
      console.log('[RootLayoutNav][useMemo] Force ready timeout triggered.');
      if (session) {
        console.log('[RootLayoutNav][useMemo] Timeout recovery: authenticated user, showing main app.');
        return (
          <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
            <AppNavigators />
            <StatusBar style="dark" />
          </Animated.View>
        );
      } else {
        console.log('[RootLayoutNav][useMemo] Timeout recovery: unauthenticated user, showing login.');
        return (
          <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
            <LoginScreen />
            <StatusBar style="dark" />
          </Animated.View>
        );
      }
    }

    // 5. **FIRST LAUNCH**: Show welcome screen
    if (isFirstLaunch === true) {
      console.log('[RootLayoutNav][useMemo] App fully ready. Rendering WelcomeScreen for first launch.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <WelcomeScreen onDismiss={handleWelcomeDismiss} />
        </Animated.View>
      );
    }

    // 6. **NORMAL FLOW**: App is fully ready - use conditional rendering based on auth state
    console.log('[RootLayoutNav][useMemo] App fully ready. Using conditional rendering based on auth state.');
    
    if (session) {
      console.log('[RootLayoutNav][useMemo] User authenticated, rendering main app.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <AppNavigators />
          <StatusBar style="dark" />
        </Animated.View>
      );
    } else {
      console.log('[RootLayoutNav][useMemo] User not authenticated, rendering login screen.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
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
  ]);

  return renderContent;
}

export default function RootLayout() {
  console.log('[RootLayout] Rendered');
  
  useFrameworkReady(); // Keep framework-level readiness in RootLayout

  // Add logging to track mount/unmount cycles
  useEffect(() => {
    console.log('[RootLayout] 🟢 MOUNTED');
    return () => {
      console.log('[RootLayout] 🔴 UNMOUNTED - Component is being destroyed');
    };
  }, []);

  // RootLayout now always renders context providers and RootLayoutNav
  // This ensures the root of the application tree remains stable
  console.log('[RootLayout] Rendering stable context providers and RootLayoutNav');
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorModalProvider>
        <AuthProvider>
          <CookingProvider>
            <RootLayoutNav />
          </CookingProvider>
        </AuthProvider>
      </ErrorModalProvider>
    </GestureHandlerRootView>
  );
}