import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';

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

interface RootLayoutNavProps {
  isFirstLaunch: boolean | null;
}

function RootLayoutNav({ isFirstLaunch }: RootLayoutNavProps) {
  console.log('[RootLayoutNav] Rendered');
  
  const { session, isLoading: isAuthLoading } = useAuth();
  const { hasUsedFreeRecipe, isLoadingFreeUsage } = useFreeUsage();
  const router = useRouter();
  const segments = useSegments();

  // Track if initial navigation redirect has already occurred
  const initialRedirectDone = useRef(false);

  // Stabilize segments to prevent unnecessary re-renders
  const stableSegments = useMemo(() => segments, [segments.join('/')]);

  // NEW STATE: Control when the main AppNavigators should render
  const [shouldRenderNavigators, setShouldRenderNavigators] = useState(false);

  // Define routes that are always accessible to unauthenticated users,
  // even if they have used their free recipe.
  const PUBLIC_ALLOWED_ROUTES_PREFIXES = [
    'tabs', // Covers /tabs (index), /explore, /settings, /saved
    'login',
    'auth', // Covers auth/callback
    '+not-found', // For the 404 page
  ];

  useEffect(() => {
    console.log('[RootLayoutNav] Main Navigation useEffect evaluating...');
    console.log('[RootLayoutNav] Dependencies for navigation useEffect:', { 
      session: !!session, 
      sessionUserId: session?.user?.id, 
      hasUsedFreeRecipe, 
      isAuthLoading, 
      isLoadingFreeUsage, 
      segments: stableSegments.join('/'),
      isFirstLaunch
    });
    console.log('[RootLayoutNav] initialRedirectDone.current value:', initialRedirectDone.current);
    
    // Wait for authentication, free usage contexts, and first launch detection to finish loading
    if (isAuthLoading || isLoadingFreeUsage || isFirstLaunch === null) {
      console.log(
        `[RootLayoutNav] Waiting for contexts to load. isAuthLoading: ${isAuthLoading}, isLoadingFreeUsage: ${isLoadingFreeUsage}, isFirstLaunch: ${isFirstLaunch}`,
      );
      // Ensure navigators are not rendered until contexts are ready
      setShouldRenderNavigators(false); 
      return;
    }

    // If this is a first launch, don't run navigation logic - let WelcomeScreen handle it
    if (isFirstLaunch) {
      console.log('[RootLayoutNav] First launch detected - deferring navigation to WelcomeScreen');
      setShouldRenderNavigators(false);
      return;
    }

    // --- INITIAL REDIRECT LOGIC (runs only once, and when contexts are loaded) ---
    // This block should handle the very first navigation decision.

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

    // If initial redirect already happened, just allow rendering and potentially handle post-initial auth changes
    if (initialRedirectDone.current) {
        console.log(`[RootLayoutNav] Initial redirect already done - running simplified logic for: ${currentPathSegments}`);
        
        // Handle authenticated user on login/auth page (e.g., after successful sign-in)
        if (session && inAuthFlow) {
            console.log(
                `[RootLayoutNav] Post-initial: Authenticated user on auth page, redirecting to main app: ${currentPathSegments}`,
            );
            router.replace('/tabs');
            return; // Don't render navigators yet, let redirect happen
        }
        
        // Handle unauthenticated user needing login redirect
        if (!session && !inAuthFlow && !isCurrentlyOnAllowedPublicRoute && hasUsedFreeRecipe) {
            console.log(
                `[RootLayoutNav] Post-initial: User logged out and needs login redirect: ${currentPathSegments}`,
            );
            router.replace('/login');
            return; // Don't render navigators yet, let redirect happen
        }
        
        console.log(`[RootLayoutNav] Post-initial: No action needed for: ${currentPathSegments}`);
        // Always render navigators if initial redirect is done and no redirects needed
        setShouldRenderNavigators(true);
        return;
    }

    // Handle initial +not-found explicitly before other initial redirects
    if (stableSegments[0] === '+not-found') {
      const targetRoute = session ? '/tabs' : '/tabs/explore'; // Redirect to tabs index or explore if not authenticated
      console.log(`[RootLayoutNav] Initial '+not-found' detected, redirecting to: ${targetRoute}`);
      router.replace(targetRoute);
      initialRedirectDone.current = true;
      // Don't immediately render navigators - let the redirect settle first
      return;
    }

    
    console.log(`[RootLayoutNav] Running initial redirect logic for: ${currentPathSegments}`);
    if (!session) {
      // User is NOT authenticated
      if (hasUsedFreeRecipe) {
        // And has used their free recipe
        if (inAuthFlow || isCurrentlyOnAllowedPublicRoute) {
          // Allow navigation if already in the authentication flow,
          // or if on a route explicitly allowed for unauthenticated users
          // (e.g., home, explore, settings, or returning from a recipe page via 'X' button).
          console.log(
            `[RootLayoutNav] Unauthenticated, free recipe used, but on allowed route: ${currentPathSegments}. No redirect.`,
          );
        } else if (inRecipeContentFlow) {
          // If unauthenticated and free recipe used, and trying to access
          // recipe content (loading, summary, steps), redirect to login.
          console.log(
            `[RootLayoutNav] Unauthenticated, free recipe used, trying to access restricted recipe content: ${currentPathSegments}. Redirecting to login.`,
          );
          router.replace('/login');
        } else {
          // Fallback for any other unexpected restricted routes that aren't explicit public or auth routes.
          console.warn(
            `[RootLayoutNav] Unauthenticated, free recipe used, accessing unexpected restricted route: ${currentPathSegments}. Redirecting to login.`,
          );
          router.replace('/login');
        }
      } else {
        // User is NOT authenticated AND has NOT used their free recipe
        // They are allowed to browse most of the app freely, including starting a recipe,
        // but prevent direct bypass of login if they somehow land there.
        if (inAuthFlow) {
          console.log(
            `[RootLayoutNav] Unauthenticated, free recipe NOT used, attempting auth flow: ${currentPathSegments}. No redirect.`,
          );
        } else {
          console.log(
            `[RootLayoutNav] Unauthenticated, free recipe NOT used, allowing access to: ${currentPathSegments}.`,
          );
        }
      }
    } else {
      // User IS authenticated
      // If authenticated, prevent them from accessing login/auth pages directly
      if (inAuthFlow) {
        console.log(
          `[RootLayoutNav] Authenticated user on auth page: ${currentPathSegments}. Redirecting to main app.`,
        );
        router.replace('/tabs');
      }
    }

    // Mark initial redirect logic as complete and allow rendering AppNavigators
    console.log(`[RootLayoutNav] Marking initial redirect as complete for: ${currentPathSegments}`);
    initialRedirectDone.current = true;
    setShouldRenderNavigators(true);
  }, [
    session,
    hasUsedFreeRecipe,
    isAuthLoading,
    isLoadingFreeUsage,
    stableSegments,
    router,
    isFirstLaunch,
  ]);

  // Conditionally render AppNavigators only when shouldRenderNavigators is true
  if (!shouldRenderNavigators) {
    // You can return null, or a simple loading spinner here
    // return null; 
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        {/* <ActivityIndicator size="large" color={COLORS.primary} /> */}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigators />
    </>
  );
}

export default function RootLayout() {
  console.log('[RootLayout] Rendered');
  
  useFrameworkReady();
  const router = useRouter();

  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    'Recoleta-Medium': require('../assets/fonts/Recoleta-Medium.otf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    async function prepare() {
      console.log('[RootLayout] Starting prepare function...');
      try {
        // You have a duplicated loadAsync call. Let's make sure it's not causing issues.
        // It's already handled by useFonts. You can remove this or keep it for pre-loading,
        // but it's redundant.
        // await Font.loadAsync({ ... });

        await Asset.loadAsync(require('@/assets/images/meez_logo.webp'));
        console.log('[RootLayout] Assets loaded successfully.');

        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        console.log(
          `[RootLayout] AsyncStorage 'hasLaunched' value: ${hasLaunched}`,
        );

        if (hasLaunched === null) {
          console.log(
            '[RootLayout] First launch detected. Setting isFirstLaunch to true.',
          );
          console.log('[RootLayout] isFirstLaunch state change:', true);
          setIsFirstLaunch(true);
        } else {
          console.log(
            '[RootLayout] Not first launch. Setting isFirstLaunch to false.',
          );
          console.log('[RootLayout] isFirstLaunch state change:', false);
          setIsFirstLaunch(false);
        }
      } catch (e) {
        console.warn(
          '[RootLayout] Failed to load assets or check first launch',
          e,
        );
        setIsFirstLaunch(false); // Default to not first launch on error
      } finally {
        console.log(
          '[RootLayout] Prepare function finished. Setting assetsLoaded to true.',
        );
        setAssetsLoaded(true);
      }
    }
    // Let's log the fontsLoaded status when it changes
    console.log(`[RootLayout] useFonts hook state: fontsLoaded = ${fontsLoaded}`);
    if (fontsLoaded) {
        console.log('[RootLayout] Fonts are now loaded via useFonts.');
    }

    // Call prepare only once
    prepare();
  }, [fontsLoaded]); // Add fontsLoaded to the dependency array to see when it changes
  
  const ready = fontsLoaded && assetsLoaded && isFirstLaunch !== null;
  console.log(
    `[RootLayout] ready state: ${ready} (fontsLoaded: ${fontsLoaded}, assetsLoaded: ${assetsLoaded}, isFirstLaunch: ${isFirstLaunch})`,
  );

  useEffect(() => {
    console.log('[RootLayout] Dependencies for useEffect (ready state):', { fontsLoaded, assetsLoaded, isFirstLaunch, ready });
    if (ready) {
      console.log('[RootLayout] Ready state achieved - hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [ready]);

  const handleWelcomeDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      console.log('[RootLayout] Welcome dismissed - navigating to home tab');
      console.log('[RootLayout] isFirstLaunch state change:', false);
      setIsFirstLaunch(false); // Hide the welcome screen immediately
      
      // Navigate to home tab after dismissing welcome screen
      router.replace('/tabs'); // Navigate to home tab (index)
    } catch (error) {
      console.error('Failed to set hasLaunched flag', error);
      // Still proceed to app
      console.log('[RootLayout] isFirstLaunch state change (error fallback):', false);
      setIsFirstLaunch(false);
      
      // Still try to navigate even if AsyncStorage failed
      router.replace('/tabs');
    }
  }, [router]);

  // 1. Show nothing (splash screen) while loading fonts/assets/state
  if (!ready) {
    return null;
  }

  // 2. Always render the main app structure first
  return (
    <ErrorModalProvider>
      <FreeUsageProvider>
        <AuthProvider>
          <RootLayoutNav isFirstLaunch={isFirstLaunch} />
        </AuthProvider>
      </FreeUsageProvider>

      {/* 3. Conditionally render the WelcomeScreen as an overlay on top */}
      {isFirstLaunch && <WelcomeScreen onDismiss={handleWelcomeDismiss} />}
    </ErrorModalProvider>
  );
}
