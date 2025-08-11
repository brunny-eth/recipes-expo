import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { COLORS } from '@/constants/theme';
import { captionText, FONT } from '@/constants/typography';

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    height: 72,
    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
    paddingTop: 6,
  },
  tabBarLabel: {
    ...captionText,
    fontSize: 11,
    fontWeight: '600',
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabBarText: {
    ...captionText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: 70,
  },
});

// Helper function to create tab bar icon with label above icon
const createTabBarIcon = (iconName: string, label: string) => {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={styles.tabBarItem}>
      <Text style={[styles.tabBarText, { color }]} numberOfLines={1}>
        {label}
      </Text>
      <MaterialCommunityIcons
        name={iconName as any}
        size={22}
        color={color}
      />
    </View>
  );
};

/**
 * Stable, memoized tabs navigator component that prevents remounting when parent re-renders.
 * This is critical for maintaining individual tab screen state and preventing useFocusEffect remounts.
 */
const MemoizedTabsNavigator = React.memo(() => {
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.darkGray,
        tabBarStyle: styles.tabBar,
        headerShown: false,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: {
          width: 'auto',
          minWidth: 85,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Import',
          tabBarIcon: createTabBarIcon('silverware-fork-knife', 'Import'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Cookbooks',
          tabBarIcon: createTabBarIcon('book-open-variant', 'Cookbooks'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="mise"
        options={{
          title: 'Prep',
          tabBarIcon: createTabBarIcon('chef-hat', 'Prep'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: createTabBarIcon('cog', 'Settings'),
          tabBarLabel: () => null,
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