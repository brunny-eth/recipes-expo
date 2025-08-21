import React from 'react';
import { Stack } from 'expo-router';

/**
 * Stable, memoized navigator component that prevents remounting when parent re-renders.
 * This is critical for maintaining tab screen state and preventing unnecessary useFocusEffect triggers.
 */
const AppNavigators = React.memo(() => {
  return (
    <Stack initialRouteName="tabs">
      <Stack.Screen name="recipe/summary" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="tabs" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="loading"
        options={{
          headerShown: false,
        }}
      />
      {/* Removed recipe/steps - all cooking now goes through mise */}
      <Stack.Screen
        name="mise/cook"
        options={{ presentation: 'card', headerShown: false }}
      />
      <Stack.Screen
        name="saved/folder-detail"
        options={{ headerShown: false }}
      />
    </Stack>
  );
});

AppNavigators.displayName = 'AppNavigators';

export default AppNavigators; 