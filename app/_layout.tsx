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
  const router = useRouter();
  const segments = useSegments();

  // Simplified readiness states
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null); // null means not yet determined
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false); // True when custom splash animation is over

  // Add timeout mechanism to prevent getting stuck in loading states after inactivity
  const [forceReady, setForceReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add navigation ref to prevent multiple rapid redirects
  const navigationProcessedRef = useRef(false);

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
    // Only run this logic if it's not the first launch and app is fully hydrated OR forced ready
    const appReadyForContent = fontsLoaded && assetsLoaded && isFirstLaunch !== null && isAuthReady;
    const shouldRunNavigation = (appReadyForContent && isFirstLaunch === false) || 
                               (forceReady && isFirstLaunch !== true); // Run for forceReady unless it's explicitly first launch
    
    // Prevent multiple rapid navigation attempts
    if (shouldRunNavigation && !navigationProcessedRef.current) {
      navigationProcessedRef.current = true;
      
      const currentPathSegments = segments.join('/');
      const inAuthFlow = segments[0] === 'login' || segments[0] === 'auth';
      
      console.log(`[RootLayoutNav][Effect: InitialNav] Processing navigation. Segments: [${segments.join(', ')}], currentPathSegments: "${currentPathSegments}", forceReady: ${forceReady}, appReadyForContent: ${appReadyForContent}, isFirstLaunch: ${isFirstLaunch}`);

      const PUBLIC_ALLOWED_ROUTES_PREFIXES = [
        'login',
        'auth', 
        '+not-found', 
      ];

      const isCurrentlyOnAllowedPublicRoute = PUBLIC_ALLOWED_ROUTES_PREFIXES.some(
        (prefix) => {
          return (
            currentPathSegments === prefix ||
            currentPathSegments.startsWith(prefix + '/')
          );
        },
      );
      
      // If on '+not-found' or root, redirect based on auth status
      if (segments[0] === '+not-found' || currentPathSegments === '') {
        console.log(`[RootLayoutNav][Effect: InitialNav] Redirecting '+not-found' or empty path. Segments: [${segments.join(', ')}], currentPathSegments: "${currentPathSegments}"`);
        // Add small delay to ensure auth state is stable
        setTimeout(() => {
          if (session) {
            router.replace('/tabs');
          } else {
            router.replace('/login');
          }
        }, 100);
        return;
      }

      // TIMEOUT RECOVERY: If we're here due to forceReady but not normal readiness,
      // use conservative navigation - go to main tabs if authenticated, login if not
      if (forceReady && !appReadyForContent) {
        console.log(`[RootLayoutNav][Effect: InitialNav] Force ready timeout - using conservative navigation (isFirstLaunch: ${isFirstLaunch})`);
        if (session) {
          if (segments[0] !== 'tabs') {
            console.log(`[RootLayoutNav][Effect: InitialNav] Timeout recovery: authenticated user, redirecting to /tabs`);
            router.replace('/tabs');
          }
        } else {
          if (!isCurrentlyOnAllowedPublicRoute) {
            console.log(`[RootLayoutNav][Effect: InitialNav] Timeout recovery: unauthenticated user, redirecting to /login`);
            router.replace('/login');
          }
        }
        return;
      }

      // SIMPLIFIED AUTHENTICATION LOGIC: Users must be authenticated to access the app
      console.log(`[RootLayoutNav][Effect: InitialNav] Auth check - session: ${!!session}, inAuthFlow: ${inAuthFlow}`);
      
      if (session) {
        // Authenticated user
        if (inAuthFlow) {
          console.log(`[RootLayoutNav][Effect: InitialNav] Authenticated user on auth page, redirecting to main app.`);
          router.replace('/tabs');
          return;
        }
        // For authenticated users not in auth flow, let them continue to their intended route
        console.log(`[RootLayoutNav][Effect: InitialNav] Authenticated user accessing protected content, allowing navigation.`);
      } else {
        // Unauthenticated user - must login to access any protected content
        if (!isCurrentlyOnAllowedPublicRoute) {
          console.log(`[RootLayoutNav][Effect: InitialNav] Unauthenticated user trying to access protected content, redirecting to login.`);
          router.replace('/login');
          return;
        }
      }
      console.log(`[RootLayoutNav][Effect: InitialNav] Initial navigation path settled for current segments: ${currentPathSegments}.`);
    }
    
    // Reset navigation flag when dependencies change significantly
    return () => {
      if (shouldRunNavigation) {
        setTimeout(() => {
          navigationProcessedRef.current = false;
        }, 1000);
      }
    };
  }, [fontsLoaded, assetsLoaded, isFirstLaunch, isAuthReady, forceReady, session, segments, router]);

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

  // === CORE RENDERING LOGIC: WHAT TO SHOW ===
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
      isOnLoginScreen,
      hasSession: !!session,
    });

    // 1. **PRIORITY**: Always show the custom animated splash screen until it signals completion.
    if (!splashAnimationComplete) {
      console.log('[RootLayoutNav][useMemo] Rendering SplashScreenMeez - custom animation pending.');
      return <SplashScreenMeez onFinish={handleSplashFinish} />;
    }

    // 2. **NEXT**: Once custom splash animation is done, wait for app data readiness OR force ready timeout.
    // During this phase, the native splash is still likely visible *on top*
    // because hideNativeSplash needs both conditions.
    if (!shouldRenderApp) {
      console.log('[RootLayoutNav][useMemo] Custom splash complete, but app is still preparing. Showing temporary loader.');
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    // 3. **TIMEOUT RECOVERY**: If we're here because of forceReady (not normal app readiness),
    // assume it's a returning user and go straight to the main app
    if (forceReady && !appReadyForContent) {
      console.log('[RootLayoutNav][useMemo] Force ready timeout triggered, redirecting to main app.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <AppNavigators />
          <StatusBar style="dark" />
        </Animated.View>
      );
    }

    // 4. **NORMAL FLOW**: App is fully ready and custom splash is complete.
    // The native splash *should* have hidden by now.
    if (isFirstLaunch === true) {
      console.log('[RootLayoutNav][useMemo] App fully ready. Rendering WelcomeScreen for first launch.');
      return (
        <Animated.View style={{ flex: 1, backgroundColor: COLORS.background }} entering={FadeIn.duration(400)}>
          <WelcomeScreen onDismiss={handleWelcomeDismiss} />
        </Animated.View>
      );
    }

    // 5. **DEFAULT**: For returning users, render AppNavigators and let the useEffect handle routing.
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
    forceReady,   // Add forceReady to dependencies
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
        <AuthProvider>
          <CookingProvider>
            <RootLayoutNav />
          </CookingProvider>
        </AuthProvider>
      </ErrorModalProvider>
    </GestureHandlerRootView>
  );
}