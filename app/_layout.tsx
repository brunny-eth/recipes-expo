import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  // New state to track the path we last redirected to
  const [lastRedirectedPath, setLastRedirectedPath] = useState<string | null>(null);

  // Helper to check if a segment is part of the auth flow
  const inAuthGroup = segments[0] === 'auth' || segments[0] === 'login';

  // Helper to check if a segment is part of the main tabs or the recipe flow allowed for free users
  const inAppGroup = segments[0] === '(tabs)';
  const inRecipeFlow = segments[0] === 'recipe' || segments[0] === 'loading';

  useEffect(() => {
    // Log current state for debugging
    const currentSegmentPath = segments.join('/');
    console.log(`[RootLayoutNav] useEffect triggered.\n      Session present: ${!!session},\n      isAuthLoading: ${isAuthLoading},\n      hasUsedFreeRecipe: ${hasUsedFreeRecipe},\n      isLoadingFreeUsage: ${isLoadingFreeUsage},\n      Current Segment: ${currentSegmentPath},\n      Last Redirected Path: ${lastRedirectedPath}`);


    // 1. Wait for loading states to resolve
    if (isAuthLoading || isLoadingFreeUsage || hasUsedFreeRecipe === null) {
      console.log('[RootLayoutNav] Still loading auth or free usage status, returning early.');
      return;
    }

    // 2. Determine target path based on authentication and free usage
    let targetPath: '/login' | '/(tabs)/explore' | null = null;
    let shouldReplace = false;

    if (!session) { // User is NOT authenticated
      console.log('[RootLayoutNav] No session present.');
      if (hasUsedFreeRecipe) { // Free recipe HAS been used, user MUST authenticate
        if (!inAuthGroup) {
          targetPath = '/login';
          shouldReplace = true;
          console.log('[RootLayoutNav] Free recipe used, redirecting to login.');
        } else {
          // Already in auth group (login or callback), no redirect needed
          console.log('[RootLayoutNav] Free recipe used, but already in auth flow. No redirect.');
        }
      } else { // Free recipe HAS NOT been used, allow free recipe flow
        console.log('[RootLayoutNav] Free recipe not used, allowing access.');
        if (!inAppGroup && !inRecipeFlow) { // Not in main app or recipe flow, redirect to explore
          targetPath = '/(tabs)/explore';
          shouldReplace = true;
          console.log('[RootLayoutNav] Not in app or recipe flow, redirecting to explore for free usage.');
        } else {
          // Already in app group or recipe flow (e.g., home, loading, summary), no redirect needed
          console.log('[RootLayoutNav] Already in allowed free usage path. No redirect.');
        }
      }
    } else { // User IS authenticated
      console.log('[RootLayoutNav] Session present.');
      if (inAuthGroup) { // Authenticated, but on login/auth page
        targetPath = '/(tabs)/explore'; // Redirect to main app
        shouldReplace = true;
        console.log('[RootLayoutNav] Authenticated and on login/auth page, redirecting to main app.');
      } else {
        // Authenticated and already in main app, no redirect needed
        console.log('[RootLayoutNav] Authenticated and already in main app. No redirect.');
      }
    }

    // 3. Perform redirect if necessary and not already at the target path
    if (targetPath && currentSegmentPath !== targetPath) {
        if (lastRedirectedPath === targetPath) {
            // Avoid redundant redirects if we've just redirected to this path
            console.log(`[RootLayoutNav] Already redirected to ${targetPath}, skipping current redirect attempt.`);
            // This is crucial: if a state change *later* would cause another redirect to the same path, prevent it
            // but if a *different* path is needed, allow it.
            return;
        }
        setLastRedirectedPath(targetPath); // Record the target of this redirect
        console.log(`[RootLayoutNav] Executing redirect to: ${targetPath} (replace: ${shouldReplace})`);
        if (shouldReplace) {
            router.replace(targetPath);
        } else {
            router.push(targetPath);
        }
    } else if (targetPath && currentSegmentPath === targetPath) {
        // If we determined a targetPath but are already there, clear the lastRedirectedPath
        // This allows future state changes to trigger a new redirect if needed
        if (lastRedirectedPath !== null) {
            console.log('[RootLayoutNav] Already at target path, resetting lastRedirectedPath.');
            setLastRedirectedPath(null);
        }
    } else {
        // No redirect needed, clear any previous redirect flag
        if (lastRedirectedPath !== null) {
            console.log('[RootLayoutNav] No redirect needed, resetting lastRedirectedPath.');
            setLastRedirectedPath(null);
        }
    }

  }, [session, isAuthLoading, hasUsedFreeRecipe, isLoadingFreeUsage, segments, router, lastRedirectedPath]);

  return (
    <Stack screenOptions={{ animation: 'fade' }}>
      <Stack.Screen name="loading" options={{ headerShown: false }} />
      <Stack.Screen name="recipe/summary" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: 'modal' }} />
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