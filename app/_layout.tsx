import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSegments, Stack } from 'expo-router';
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
import { FreeUsageProvider, useFreeUsage } from '@/context/FreeUsageContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '@/components/WelcomeScreen';
import AppNavigators from '@/components/AppNavigators';
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
  const { hasUsedFreeRecipe, isLoadingFreeUsage } = useFreeUsage();
  const router = useRouter();
  const segments = useSegments();

  // Simplified readiness states
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null means not yet determined
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false); // True when custom splash animation is over
  
  // Ref to track if splash has already finished to prevent race conditions
  const splashFinishedRef = useRef(false);

  const [fontsLoaded] = useFonts({
    'LibreBaskerville-Regular': require('../assets/fonts/LibreBaskerville-Regular.ttf'),
    'LibreBaskerville-Bold': require('../assets/fonts/LibreBaskerville-Bold.ttf'),
    'LibreBaskerville-Italic': require('../assets/fonts/LibreBaskerville-Italic.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Simplified readiness logic
  const isFrameworkReady = fontsLoaded && assetsLoaded;
  const isAuthReady = !isAuthLoading && !isLoadingFreeUsage;
  const isReadyToRender = isFrameworkReady && isFirstLaunch !== null && isAuthReady;

  // === APP PREPARATION EFFECT ===
  // Loads assets and determines if it's the first launch
  useEffect(() => {
    let isMounted = true;
    console.log('[RootLayoutNav][Effect: prepareApp] Running. fontsLoaded:', fontsLoaded);
    async function prepareApp() {
      try {
        console.log('[RootLayoutNav][prepareApp] Starting asset load...');
        await Asset.loadAsync([
          require('@/assets/images/meez_logo.webp'),
        ]);
        if (!isMounted) {
          console.log('[RootLayoutNav][prepareApp] Component unmounted during asset load, skipping state update.');
          return;
        }
        setAssetsLoaded(true);
        console.log('[RootLayoutNav][prepareApp] Assets loaded. assetsLoaded set to true.');

        console.log('[RootLayoutNav][prepareApp] Checking AsyncStorage for \'hasLaunched\'...');
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        if (!isMounted) {
          console.log('[RootLayoutNav][prepareApp] Component unmounted during AsyncStorage check, skipping state update.');
          return;
        }
        setIsFirstLaunch(hasLaunched === null);
        console.log(`[RootLayoutNav][prepareApp] isFirstLaunch determined: ${hasLaunched === null}.`);

      } catch (e) {
        console.warn('[RootLayoutNav][prepareApp] Failed during preparation:', e);
        // Ensure state is set to allow app to proceed even on error
        if (isMounted) {
          setAssetsLoaded(true);
          setIsFirstLaunch(false); // Assume not first launch on error if something went wrong
        }
      }
    }

    if (fontsLoaded) {
      prepareApp();
    } else {
      console.log('[RootLayoutNav][Effect: prepareApp] Waiting for fonts to load before starting prepareApp.');
    }

    return () => { isMounted = false; console.log('[RootLayoutNav][Effect: prepareApp] Cleanup - isMounted set to false.'); };
  }, [fontsLoaded]); // Rerun when fontsLoaded changes

  // === CUSTOM SPLASH ANIMATION COMPLETE HANDLER ===
  const handleSplashFinish = useCallback(() => {
    console.log('[RootLayoutNav][handleSplashFinish] Custom splash animation reported complete.');
    
    // Prevent multiple calls
    if (splashFinishedRef.current) {
      console.log('[RootLayoutNav][handleSplashFinish] Splash already finished, ignoring duplicate call.');
      return;
    }
    
    splashFinishedRef.current = true;
    setSplashAnimationComplete(true);
    console.log('[RootLayoutNav][handleSplashFinish] setSplashAnimationComplete(true) called');
  }, []); // Empty dependencies to ensure stable reference

  // === TRACK SPLASH ANIMATION COMPLETION ===
  useEffect(() => {
    console.log('[RootLayoutNav][Effect: splashAnimationComplete] State changed to:', splashAnimationComplete);
  }, [splashAnimationComplete]);

  // === INITIAL NAVIGATION LOGIC ===
  // Handle initial navigation for non-first launch scenario after everything is ready
  // This logic runs once when initialContentReady is true AND isFirstLaunch is false
  useEffect(() => {
    // Only run this logic if it's not the first launch and initial content is ready
    if (isReadyToRender && isFirstLaunch === false) {
      const currentPathSegments = segments.join('/');
      const inAuthFlow = segments[0] === 'login' || segments[0] === 'auth';
      const inRecipeContentFlow = segments[0] === 'recipe';
      
      console.log(`[RootLayoutNav][Effect: InitialNav] Processing navigation. Segments: [${segments.join(', ')}], currentPathSegments: "${currentPathSegments}"`);

      const PUBLIC_ALLOWED_ROUTES_PREFIXES = [
        'tabs', 
        'login',
        'auth', 
        '+not-found', 
      ];

      const isCurrentlyOnAllowedPublicRoute = PUBLIC_ALLOWED_ROUTES_PREFIXES.some(
        (prefix) => {
          if (prefix === 'tabs') {
            return segments[0] === 'tabs';
          }
          return (
            currentPathSegments === prefix ||
            currentPathSegments.startsWith(prefix + '/')
          );
        },
      );
      
      // If on '+not-found' or root, redirect to tabs.
      if (segments[0] === '+not-found' || currentPathSegments === '') {
        console.log(`[RootLayoutNav][Effect: InitialNav] Redirecting '+not-found' or empty path to /tabs. Segments: [${segments.join(', ')}], currentPathSegments: "${currentPathSegments}"`);
        router.replace('/tabs');
        return;
      }

      // AUTHENTICATION LOGIC for non-first launch
      console.log(`[RootLayoutNav][Effect: InitialNav] Auth check - session: ${!!session}, hasUsedFreeRecipe: ${hasUsedFreeRecipe}, inAuthFlow: ${inAuthFlow}, inRecipeContentFlow: ${inRecipeContentFlow}`);
      
      if (session) {
        if (inAuthFlow) {
          console.log(`[RootLayoutNav][Effect: InitialNav] Authenticated user on auth page, redirecting to main app.`);
          router.replace('/tabs');
          return;
        }
      } else {
        // Unauthenticated user
        if (hasUsedFreeRecipe) {
          // User has used their free recipe, restrict access to recipe content
          if (inRecipeContentFlow && !isCurrentlyOnAllowedPublicRoute) {
            console.log(`[RootLayoutNav][Effect: InitialNav] Unauthenticated, free recipe used, trying to access restricted recipe content, redirecting to login.`);
            router.replace('/login');
            return;
          }
        }
      }
      console.log(`[RootLayoutNav][Effect: InitialNav] Initial navigation path settled for current segments: ${currentPathSegments}.`);
    }
  }, [isReadyToRender, isFirstLaunch, session, hasUsedFreeRecipe, segments, router]);

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

  // === FINAL SPLASH SCREEN HIDE LOGIC ===
  // Hide native splash only when everything is ready and we're showing the main app
  useEffect(() => {
    if (isReadyToRender && splashAnimationComplete && !isFirstLaunch) {
      console.log('[RootLayoutNav][Effect: hideNativeSplash] Hiding native splash (SplashScreen.hideAsync).');
      SplashScreen.hideAsync();
    }
  }, [isReadyToRender, splashAnimationComplete, isFirstLaunch]);

  // === MEMOIZED RENDER LOGIC ===
  // Use useMemo to prevent unnecessary re-renders of SplashScreenMeez
  const renderContent = useMemo(() => {
    console.log(`[RootLayoutNav][useMemo] Evaluating render: isReadyToRender=${isReadyToRender}, splashAnimationComplete=${splashAnimationComplete}, isFirstLaunch=${isFirstLaunch}`);
    
    // 1. Show custom splash screen while app is not fully ready for main content OR splash animation hasn't completed
    if (!isReadyToRender || !splashAnimationComplete) {
      console.log('[RootLayoutNav][useMemo] Returning SplashScreenMeez');
      return <SplashScreenMeez onFinish={handleSplashFinish} />;
    }
    
    // 2. If app is ready AND splash animation is complete AND it's the first launch, show Welcome Screen
    if (isFirstLaunch === true) {
      console.log('[RootLayoutNav][useMemo] Returning WelcomeScreen');
      return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
    }

    // 3. Otherwise, app is ready AND splash animation is complete AND it's not the first launch (or welcome dismissed), show main app
    console.log('[RootLayoutNav][useMemo] Returning AppNavigators');
    return (
      <Animated.View 
        style={{ 
          flex: 1,
          backgroundColor: COLORS.background,
        }}
        entering={FadeIn.duration(400).delay(100)}
      >
        <StatusBar style="dark" />
        <AppNavigators />
      </Animated.View>
    );
  }, [isReadyToRender, splashAnimationComplete, isFirstLaunch, handleSplashFinish, handleWelcomeDismiss]);

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
        <FreeUsageProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </FreeUsageProvider>
      </ErrorModalProvider>
    </GestureHandlerRootView>
  );
}