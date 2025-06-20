import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { COLORS } from '@/constants/theme';
import { ErrorModalProvider } from '@/context/ErrorModalContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { getHasUsedFreeRecipe } from '@/server/lib/freeUsageTracker';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';

SplashScreen.preventAutoHideAsync();

if (__DEV__) {
  // @ts-expect-error - ErrorUtils is a global internal to react-native
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  // @ts-expect-error - ErrorUtils is a global internal to react-native
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('[GLOBAL ERROR CAUGHT]', error.message);
  
    // 🛑 Don't re-call the originalHandler
    // originalHandler(error, isFatal);
  });
}

function RootLayoutNav() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthLoading) {
      return; // Wait until auth status is known
    }

    const checkUsageAndRedirect = async () => {
      // Only check for free usage if we are NOT authenticated.
      if (!session) {
        console.log('[UsageLimit] No session, checking free recipe usage.');
        const hasUsedFreeRecipe = await getHasUsedFreeRecipe();
        if (hasUsedFreeRecipe) {
          console.log('[UsageLimit] Free recipe used, redirecting to login.');
          router.replace('/login');
        }
      }
    };

    checkUsageAndRedirect();
  }, [session, isAuthLoading, router]);

  // Render a loading indicator while we check auth.
  // The splash screen is still visible at this point.
  if (isAuthLoading) {
    return null;
  }
  
  return (
    <>
      <Stack screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background }
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/ingredients" options={{ presentation: 'card' }} />
        <Stack.Screen name="recipe/steps" options={{ presentation: 'card' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
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
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ErrorModalProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});