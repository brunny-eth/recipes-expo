import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { FreeUsageProvider, useFreeUsage } from '@/context/FreeUsageContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

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
  const { hasUsedFreeRecipe, isLoadingFreeUsage } = useFreeUsage();
  const router = useRouter();
  const segments = useSegments();

  // Define routes that are always accessible to unauthenticated users,
  // even if they have used their free recipe.
  const PUBLIC_ALLOWED_ROUTES_PREFIXES = [
    '(tabs)', // Covers / (index), /explore, /settings, /saved
    'login',
    'auth', // Covers auth/callback
    '+not-found', // For the 404 page
  ];

  useEffect(() => {
    // Wait for authentication and free usage contexts to finish loading
    if (isAuthLoading || isLoadingFreeUsage) {
      console.log(`[RootLayoutNav] Waiting for contexts to load. isAuthLoading: ${isAuthLoading}, isLoadingFreeUsage: ${isLoadingFreeUsage}`);
      return;
    }

    const currentPathSegments = segments.join('/'); // e.g., "login", "(tabs)/explore", "recipe/summary"
    const inAuthFlow = segments[0] === 'login' || segments[0] === 'auth';
    const inRecipeContentFlow = segments[0] === 'loading' || segments[0] === 'recipe';

    // Check if the current route is one of the explicitly allowed public routes
    const isCurrentlyOnAllowedPublicRoute = PUBLIC_ALLOWED_ROUTES_PREFIXES.some(prefix => {
      // For '(tabs)', we check if the first segment is '(tabs)' to cover all tab routes
      if (prefix === '(tabs)') {
        return segments[0] === '(tabs)';
      }
      // For other specific routes like 'login' or '+not-found', we check for exact match or startWith
      return currentPathSegments === prefix || currentPathSegments.startsWith(prefix + '/');
    });

    if (!session) { // User is NOT authenticated
      if (hasUsedFreeRecipe) { // And has used their free recipe
        if (inAuthFlow || isCurrentlyOnAllowedPublicRoute) {
          // Allow navigation if already in the authentication flow,
          // or if on a route explicitly allowed for unauthenticated users
          // (e.g., home, explore, settings, or returning from a recipe page via 'X' button).
          console.log(`[RootLayoutNav] Unauthenticated, free recipe used, but on allowed route: ${currentPathSegments}. No redirect.`);
        } else if (inRecipeContentFlow) {
          // If unauthenticated and free recipe used, and trying to access
          // recipe content (loading, summary, steps), redirect to login.
          console.log(`[RootLayoutNav] Unauthenticated, free recipe used, trying to access restricted recipe content: ${currentPathSegments}. Redirecting to login.`);
          router.replace('/login');
        } else {
          // Fallback for any other unexpected restricted routes that aren't explicit public or auth routes.
          console.warn(`[RootLayoutNav] Unauthenticated, free recipe used, accessing unexpected restricted route: ${currentPathSegments}. Redirecting to login.`);
          router.replace('/login');
        }
      } else { // User is NOT authenticated AND has NOT used their free recipe
        // They are allowed to browse most of the app freely, including starting a recipe,
        // but prevent direct bypass of login if they somehow land there.
        if (inAuthFlow) {
          console.log(`[RootLayoutNav] Unauthenticated, free recipe NOT used, attempting auth flow: ${currentPathSegments}. No redirect.`);
          return; // Stay on login/auth page if they are already there
        }
        // Implicitly allows navigation to (tabs) and initial recipe flow if not in auth group
        console.log(`[RootLayoutNav] Unauthenticated, free recipe NOT used, allowing access to: ${currentPathSegments}.`);
      }
    } else { // User IS authenticated
      // If authenticated, prevent them from accessing login/auth pages directly
      if (inAuthFlow) {
        console.log(`[RootLayoutNav] Authenticated user on auth page: ${currentPathSegments}. Redirecting to main app.`);
        router.replace('/(tabs)');
      }
    }
  }, [session, hasUsedFreeRecipe, isAuthLoading, isLoadingFreeUsage, segments, router]);

  return (
    <Stack screenOptions={{ animation: 'fade' }}>
      <Stack.Screen name="loading" options={{ headerShown: false }} />
      <Stack.Screen name="recipe/summary" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="recipe/ingredients" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="recipe/steps" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    'Recoleta-Medium': require('../assets/fonts/Recoleta-Medium.otf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        await Asset.loadAsync(require('@/assets/images/meez_logo.png'));
      } catch (e) {
        console.warn('Failed to preload logo', e);
      } finally {
        setAssetsLoaded(true);
      }
    }

    prepare();
  }, []);

  const ready = fontsLoaded && assetsLoaded;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ErrorModalProvider>
      {/* Corrected order: FreeUsageProvider wraps AuthProvider */}
      <FreeUsageProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </FreeUsageProvider>
    </ErrorModalProvider>
  );
}