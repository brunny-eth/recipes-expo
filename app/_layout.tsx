import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSegments, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { FreeUsageProvider, useFreeUsage } from '@/context/FreeUsageContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '@/components/WelcomeScreen';
import AppNavigators from '@/components/AppNavigators';
import { COLORS } from '@/constants/theme';

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
  console.log('[RootLayoutNav] Rendered');
  
  const { session, isLoading: isAuthLoading } = useAuth();
  const { hasUsedFreeRecipe, isLoadingFreeUsage } = useFreeUsage();
  const router = useRouter();
  const segments = useSegments();

  // === INITIALIZATION STATE (moved from RootLayout) ===
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    'Recoleta-Medium': require('../assets/fonts/Recoleta-Medium.otf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  // === NAVIGATION STATE ===
  const routerRef = useRef(router);
  const initialNavigationHandled = useRef(false);
  const stableSegments = useMemo(() => segments, [segments.join('/')]);

  // Update router ref when it changes
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // === INITIALIZATION LOGIC (moved from RootLayout) ===
  useEffect(() => {
    async function prepareInitialAppLoad() {
      console.log('[RootLayoutNav] Starting prepareInitialAppLoad function...');
      try {
        // Load assets
        await Asset.loadAsync(require('@/assets/images/meez_logo.webp'));
        console.log('[RootLayoutNav] Assets loaded successfully.');

        // Check first launch
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        console.log(`[RootLayoutNav] AsyncStorage 'hasLaunched' value: ${hasLaunched}`);

        if (hasLaunched === null) {
          console.log('[RootLayoutNav] First launch detected. Setting isFirstLaunch to true.');
          console.log('[RootLayoutNav] State update: setIsFirstLaunch(true)');
          setIsFirstLaunch(true);
        } else {
          console.log('[RootLayoutNav] Not first launch. Setting isFirstLaunch to false.');
          console.log('[RootLayoutNav] State update: setIsFirstLaunch(false)');
          setIsFirstLaunch(false);
        }
      } catch (e) {
        console.warn('[RootLayoutNav] Failed to load assets or check first launch', e);
        console.log('[RootLayoutNav] State update: setIsFirstLaunch(false) - error fallback');
        setIsFirstLaunch(false); // Default to not first launch on error
      } finally {
        console.log('[RootLayoutNav] prepareInitialAppLoad finished. Setting assetsLoaded to true.');
        console.log('[RootLayoutNav] State update: setAssetsLoaded(true)');
        setAssetsLoaded(true);
      }
    }

    console.log(`[RootLayoutNav] useFonts hook state: fontsLoaded = ${fontsLoaded}`);
    if (fontsLoaded) {
      console.log('[RootLayoutNav] Fonts are now loaded via useFonts.');
    }

    prepareInitialAppLoad();
  }, [fontsLoaded]);

  // === READY STATE CALCULATION ===
  const isReadyForNavigation = fontsLoaded && assetsLoaded && isFirstLaunch !== null && !isAuthLoading && !isLoadingFreeUsage;
  
  console.log('[RootLayoutNav] Ready state calculation:', {
    fontsLoaded,
    assetsLoaded,
    isFirstLaunch,
    isAuthLoading,
    isLoadingFreeUsage,
    isReadyForNavigation,
    // Detailed breakdown of each condition
    conditions: {
      'fontsLoaded': fontsLoaded ? '✅' : '❌',
      'assetsLoaded': assetsLoaded ? '✅' : '❌', 
      'isFirstLaunch !== null': isFirstLaunch !== null ? '✅' : '❌',
      '!isAuthLoading': !isAuthLoading ? '✅' : '❌',
      '!isLoadingFreeUsage': !isLoadingFreeUsage ? '✅' : '❌',
    }
  });

  // === SPLASH SCREEN MANAGEMENT ===
  // Splash screen is now hidden in the navigation logic once initial navigation is complete
  // This ensures it only hides after all redirects are settled

  // === WELCOME SCREEN DISMISS HANDLER ===
  const handleWelcomeDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      console.log('[RootLayoutNav] Welcome dismissed - navigating to home tab');
      console.log('[RootLayoutNav] State update: setIsFirstLaunch(false) - welcome dismissed');
      setIsFirstLaunch(false); // Hide the welcome screen immediately
      
      // Navigate to home tab after dismissing welcome screen
      router.replace('/tabs'); // Navigate to home tab (index)
      
      // Hide splash screen after welcome screen is dismissed
      console.log('[RootLayoutNav] Welcome dismissed - hiding splash screen');
      SplashScreen.hideAsync();
    } catch (error) {
      console.error('Failed to set hasLaunched flag', error);
      // Still proceed to app
      console.log('[RootLayoutNav] State update: setIsFirstLaunch(false) - welcome dismiss error fallback');
      setIsFirstLaunch(false);
      
      // Still try to navigate even if AsyncStorage failed
      router.replace('/tabs');
      
      // Still hide splash screen on error
      SplashScreen.hideAsync();
    }
  }, [router]);

  // === PUBLIC ROUTES CONFIGURATION ===
  const PUBLIC_ALLOWED_ROUTES_PREFIXES = [
    'tabs', // Covers /tabs (index), /explore, /settings, /saved
    'login',
    'auth', // Covers auth/callback
    '+not-found', // For the 404 page
  ];

  // === MAIN NAVIGATION LOGIC ===
  const handleNavigation = useCallback(() => {
    console.log('[RootLayoutNav] Main Navigation logic evaluating...');
    console.log('[RootLayoutNav] Dependencies for navigation logic:', { 
      session: !!session, 
      sessionUserId: session?.user?.id, 
      hasUsedFreeRecipe, 
      isAuthLoading, 
      isLoadingFreeUsage, 
      segments: stableSegments.join('/'),
      isFirstLaunch,
      isReadyForNavigation,
      initialNavigationHandled: initialNavigationHandled.current
    });
    
    // Only proceed if framework is ready and initial navigation hasn't been handled
    if (!isReadyForNavigation || initialNavigationHandled.current || isFirstLaunch === null) {
      console.log('[RootLayoutNav] Not ready for navigation yet, waiting...');
      return;
    }

    // If this is a first launch, don't run navigation logic - let WelcomeScreen handle it
    if (isFirstLaunch) {
      console.log('[RootLayoutNav] First launch detected - deferring navigation to WelcomeScreen');
      return;
    }

    const currentPathSegments = stableSegments.join('/');
    const inAuthFlow = stableSegments[0] === 'login' || stableSegments[0] === 'auth';
    const inRecipeContentFlow = stableSegments[0] === 'recipe';

    const isCurrentlyOnAllowedPublicRoute = PUBLIC_ALLOWED_ROUTES_PREFIXES.some(
      (prefix) => {
        if (prefix === 'tabs') {
          return stableSegments[0] === 'tabs';
        }
        return (
          currentPathSegments === prefix ||
          currentPathSegments.startsWith(prefix + '/')
        );
      },
    );

    // === CRITICAL FIX: Handle +not-found or empty segments FIRST ===
    // Always mark navigation as handled *before* attempting redirect to prevent re-entry
    if (stableSegments[0] === '+not-found' || currentPathSegments === '') {
      console.log(`[RootLayoutNav] Initial '+not-found' or empty segment detected, redirecting to /tabs`);
      initialNavigationHandled.current = true; // Mark handled IMMEDIATELY
      routerRef.current.replace('/tabs');
      return; // Exit to prevent further evaluation in this cycle
    }

    // === AUTHENTICATION LOGIC ===
    // Handle authenticated users
    if (session) {
      // If authenticated, prevent them from accessing login/auth pages directly
      if (inAuthFlow) {
        console.log(`[RootLayoutNav] Authenticated user on auth page: ${currentPathSegments}. Redirecting to main app.`);
        initialNavigationHandled.current = true; // Mark handled
        routerRef.current.replace('/tabs');
        return;
      } else {
        console.log(`[RootLayoutNav] Authenticated user on valid route: ${currentPathSegments}. No redirect needed.`);
      }
    } else {
      // Handle unauthenticated users
      if (hasUsedFreeRecipe) {
        // User has used their free recipe
        if (inAuthFlow || isCurrentlyOnAllowedPublicRoute) {
          console.log(`[RootLayoutNav] Unauthenticated, free recipe used, but on allowed route: ${currentPathSegments}. No redirect.`);
        } else if (inRecipeContentFlow) {
          console.log(`[RootLayoutNav] Unauthenticated, free recipe used, trying to access restricted recipe content: ${currentPathSegments}. Redirecting to login.`);
          initialNavigationHandled.current = true; // Mark handled
          routerRef.current.replace('/login');
          return;
        } else {
          console.warn(`[RootLayoutNav] Unauthenticated, free recipe used, accessing unexpected restricted route: ${currentPathSegments}. Redirecting to login.`);
          initialNavigationHandled.current = true; // Mark handled
          routerRef.current.replace('/login');
          return;
        }
      } else {
        // User has NOT used their free recipe - allow most access
        if (inAuthFlow) {
          console.log(`[RootLayoutNav] Unauthenticated, free recipe NOT used, attempting auth flow: ${currentPathSegments}. No redirect.`);
        } else {
          console.log(`[RootLayoutNav] Unauthenticated, free recipe NOT used, allowing access to: ${currentPathSegments}.`);
        }
      }
    }

    // If we've reached here, initial navigation has been processed for a stable state
    console.log(`[RootLayoutNav] User on valid route: ${currentPathSegments}. No redirect needed.`);
    initialNavigationHandled.current = true; // Mark as handled if no redirects were needed but conditions were met
    
    // Hide splash screen once all initial navigation logic is settled
    console.log('[RootLayoutNav] Initial navigation complete - hiding splash screen');
    SplashScreen.hideAsync();
  }, [session, hasUsedFreeRecipe, isReadyForNavigation, isFirstLaunch, stableSegments]);

  useEffect(() => {
    handleNavigation();
  }, [handleNavigation]);

  // === RENDER LOGIC ===
  
  // Show loading indicator while not ready for navigation
  if (!isReadyForNavigation) {
    console.log('[RootLayoutNav] Not ready for navigation - showing loading indicator');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show WelcomeScreen if first launch
  if (isFirstLaunch) {
    console.log('[RootLayoutNav] First launch - showing WelcomeScreen');
    return <WelcomeScreen onDismiss={handleWelcomeDismiss} />;
  }

  // Show main app
  console.log('[RootLayoutNav] Ready and not first launch - showing main app');
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigators />
    </>
  );
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
