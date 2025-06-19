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
  const [hasUsedFreeRecipe, setHasUsedFreeRecipe] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUsageAndRedirect = async () => {
      if (__DEV__) console.log('[Debug] Running checkUsageAndRedirect...');
      const freeUsage = await getHasUsedFreeRecipe();
      if (__DEV__) console.log(`[Debug] getHasUsedFreeRecipe returned: ${freeUsage}`);
      setHasUsedFreeRecipe(freeUsage);
      setIsLoading(false);
      if (__DEV__) console.log('[Debug] checkUsageAndRedirect finished. isLoading set to false.');
    };
    checkUsageAndRedirect();
  }, []);

  // Detailed state change logging
  if (__DEV__) {
    useEffect(() => {
      console.log(`[Debug] isLoading state changed: ${isLoading}`);
    }, [isLoading]);
  
    useEffect(() => {
      console.log(`[Debug] isAuthLoading state changed: ${isAuthLoading}`);
    }, [isAuthLoading]);
  
    useEffect(() => {
      console.log(`[Debug] session state changed: ${!!session}`);
    }, [session]);
  }

  useEffect(() => {
    if (__DEV__) {
      console.log('[Debug] Redirection useEffect triggered. State:', {
        isLoading,
        isAuthLoading,
        hasUsedFreeRecipe,
        session: !!session,
      });
    }

    // Wait for both auth state and free usage state to be loaded
    if (isLoading || isAuthLoading) {
      if (__DEV__) console.log('[Debug] Bailing out of redirection logic: still loading.');
      return;
    }

    if (__DEV__) {
      console.log(`[Routing] session: ${!!session}, usedFree: ${hasUsedFreeRecipe}`);
    }

    if (!session && hasUsedFreeRecipe) {
      if (__DEV__) console.log("[Debug] Condition met! Redirecting to /login...");
      router.replace('/login');
    }
  }, [session, hasUsedFreeRecipe, isAuthLoading, isLoading, router]);


  // Render a loading indicator while we check auth and storage
  if (isLoading || isAuthLoading) {
    if (__DEV__) {
      console.log('[Debug] Rendering loading indicator. State:', {
        isLoading,
        isAuthLoading,
      });
    }
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
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