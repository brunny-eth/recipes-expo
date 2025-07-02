import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { COLORS } from '@/constants/theme';
import { captionText } from '@/constants/typography';

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    height: 60,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 4,
  },
  tabBarLabel: {
    ...captionText,
    fontSize: 11,
  },
});

/**
 * Stable, memoized tabs navigator component that prevents remounting when parent re-renders.
 * This is critical for maintaining individual tab screen state and preventing useFocusEffect remounts.
 */
const MemoizedTabsNavigator = React.memo(() => {
  console.log('[MemoizedTabsNavigator] Rendered - this should only happen once after initial load');
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.darkGray,
        tabBarStyle: styles.tabBar,
        headerShown: false,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="compass-outline"
              size={size}
              color={color}
            />
          ),
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="heart-outline"
              size={size}
              color={color}
            />
          ),
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="cog-outline"
              size={size}
              color={color}
            />
          ),
          unmountOnBlur: false,
        }}
      />
    </Tabs>
  );
});

MemoizedTabsNavigator.displayName = 'MemoizedTabsNavigator';

export default function TabLayout() {
  return <MemoizedTabsNavigator />;
}
