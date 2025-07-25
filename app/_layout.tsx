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
import { CookingProvider } from '@/context/CookingContext';
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

  // Add timeout mechanism to prevent getting stuck in loading states after inactivity
  const [forceReady, setForceReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const isAuthReady = !isAuthLoading && !isLoadingFreeUsage;
  
  // Single source of truth for app hydration - when all initial data is loaded
  const isAppHydrated = isFrameworkReady && isFirstLaunch !== null && isAuthReady;
  
  // Routing logic - separate from app readiness
  const isOnLoginScreen = segments[0] === 'login';
  const isReadyToRender = isAppHydrated || forceReady || isOnLoginScreen;

  // Add timeout to force readiness if stuck in loading state
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only start timeout if we're NOT on the login screen and auth is not ready
    if (isFrameworkReady && isFirstLaunch !== null && !isAuthReady && !forceReady && !isOnLoginScreen) {
      console.log('[RootLayoutNav] Starting timeout - auth not ready, will force ready in 8 seconds');
      timeoutRef.current = setTimeout(() => {
        console.warn('[RootLayoutNav] 🚨 TIMEOUT: Auth loading taking too long, forcing ready state');
        setForceReady(true);
      }, 8000); // 8 seconds timeout
    }

    // Clean up timeout if we become ready naturally
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isFrameworkReady, isFirstLaunch, isAuthReady, forceReady, isOnLoginScreen]);

  // === APP PREPARATION EFFECT ===
  // Loads assets and determines if it's the first launch
  useEffect(() => {
    let isMounted = true;
    console.log('[RootLayoutNav][Effect: prepareApp] Running. fontsLoaded:', fontsLoaded);
    async function prepareApp() {
      try {
        console.log('[RootLayoutNav][prepareApp] Starting asset load...');
        await Asset.loadAsync([
          require('@/assets/images/meezblue_underline.webp'),
          require('@/assets/gifs/FirstScreen.gif'),
          require('@/assets/gifs/SecondScreen.gif'),
          require('@/assets/gifs/ThirdScreen.gif'),
          require('@/assets/gifs/FourthScreen.gif'),
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
    console.log('[SplashScreenMeez] Logo animation completed - setting splashAnimationComplete to true.');
    setSplashAnimationComplete(true);
  }, []);

  // === TRACK SPLASH ANIMATION COMPLETION ===
  useEffect(() => {
    console.log('[RootLayoutNav][Effect: splashAnimationComplete] State changed to:', splashAnimationComplete);
  }, [splashAnimationComplete]);





  // === INITIAL NAVIGATION LOGIC ===
  // Handle initial navigation for non-first launch scenario after everything is ready
  // This effect should only run when appReadyForContent is true AND isFirstLaunch has been determined.
  useEffect(() => {
    // Only run this logic if it's not the first launch and app is fully hydrated
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    if (appReadyForContent && isFirstLaunch === false) {
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
  }, [fontsLoaded, assetsLoaded, isFirstLaunch, isAuthReady, session, hasUsedFreeRecipe, segments, router]);

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

  // === CRITICAL EFFECT FOR HIDING NATIVE SPLASH ===
  useEffect(() => {
    // Only hide native splash if both custom splash animation is done
    // AND the app's initial data/state is fully resolved.
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;

    if (splashAnimationComplete && appReadyForContent) {
      console.log('[RootLayoutNav][Effect: hideNativeSplash] Conditions met: HIDING NATIVE SPLASH.');
      SplashScreen.hideAsync();
    } else {
      console.log('[RootLayoutNav][Effect: hideNativeSplash] Not yet ready to hide native splash. Current state:', {
        splashAnimationComplete,
        appReadyForContent,
        fontsLoaded,
        assetsLoaded,
        isFirstLaunch,
        isAuthReady,
        // Add more granular checks here if needed for debugging
      });
    }
  }, [splashAnimationComplete, fontsLoaded, assetsLoaded, isFirstLaunch, isAuthReady]);

  // === CORE RENDERING LOGIC: WHAT TO SHOW ===
  const renderContent = useMemo(() => {
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;

    console.log('[RootLayoutNav][useMemo] Current state values for render decision:', {
      splashAnimationComplete,
      appReadyForContent,
      fontsLoaded,
      assetsLoaded,
      isFirstLaunch,
      isAuthReady,
      isOnLoginScreen,
      hasSession: !!session,
    });

    // 1. **PRIORITY**: Always show the custom animated splash screen until it signals completion.
    if (!splashAnimationComplete) {
      console.log('[RootLayoutNav][useMemo] Rendering SplashScreenMeez - custom animation pending.');
      return <SplashScreenMeez onFinish={handleSplashFinish} />;
    }

    // 2. **NEXT**: Once custom splash animation is done, wait for app data readiness.
    // During this phase, the native splash is still likely visible *on top*
    // because hideNativeSplash needs both conditions.
    if (!appReadyForContent) {
      console.log('[RootLayoutNav][useMemo] Custom splash complete, but app is still preparing. Showing temporary loader.');
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    // 3. **FINALLY**: App is fully ready and custom splash is complete.
    // The native splash *should* have hidden by now.
    if (isFirstLaunch === true) {
      console.log('[RootLayoutNav][useMemo] App fully ready. Rendering WelcomeScreen for first launch.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <WelcomeScreen onDismiss={handleWelcomeDismiss} />
        </Animated.View>
      );
    }

    // 4. **DEFAULT**: For returning users, render AppNavigators and let the useEffect handle routing.
    console.log('[RootLayoutNav][useMemo] App fully ready. Handling initial navigation.');
    // The useEffect for initial navigation handles routing decisions.
    // So, if appReadyForContent is true, we just render AppNavigators, and the
    // useEffect handles the redirect if necessary.
    return (
      <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
        <StatusBar style="dark" />
        <AppNavigators />
      </Animated.View>
    );

  }, [
    splashAnimationComplete,
    fontsLoaded,
    assetsLoaded,
    isFirstLaunch,
    isAuthReady, // Depend on this instead of `isLoading` from context directly
    handleSplashFinish,
    handleWelcomeDismiss,
    session, // Keep for logging purposes
    isOnLoginScreen, // Keep for logging purposes
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
        <FreeUsageProvider>
          <AuthProvider>
            <CookingProvider>
              <RootLayoutNav />
            </CookingProvider>
          </AuthProvider>
        </FreeUsageProvider>
      </ErrorModalProvider>
    </GestureHandlerRootView>
  );
}