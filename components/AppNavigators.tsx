import React from 'react';
import { Stack } from 'expo-router';

/**
 * Stable, memoized navigator component that prevents remounting when parent re-renders.
 * This is critical for maintaining tab screen state and preventing unnecessary useFocusEffect triggers.
 */
const AppNavigators = React.memo(() => {
  console.log('[AppNavigators] Rendered - this should only happen once after initial load');
  
  return (
    <Stack>
      <Stack.Screen name="recipe/summary" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="loading"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipe/steps"
        options={{ presentation: 'card', headerShown: false }}
      />
    </Stack>
  );
});

AppNavigators.displayName = 'AppNavigators';

export default AppNavigators; 