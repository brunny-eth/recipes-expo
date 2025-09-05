import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';
import BottomTabBar from '@/components/BottomTabBar';

export default function ExploreLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      <BottomTabBar />
    </View>
  );
}
