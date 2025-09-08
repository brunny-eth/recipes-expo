import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { COLORS } from '@/constants/theme';
import { captionText, FONT } from '@/constants/typography';

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    height: 70, // Reduced from 80 to make border appear lower
    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
    paddingTop: 5, // Reduced to maintain button positioning with smaller height
  },
  tabBarLabel: {
    ...captionText,
    fontSize: 11,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabBarText: {
    ...captionText,
    fontSize: 15,
    textAlign: 'center',
    width: 64,
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 12,
    right: 12,
    height: 3, // Increased from 2 to make the underline thicker
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
});

// Helper function to create tab bar text only (no icons)
const createTabBarIcon = (iconName: string, label: string) => {
  const TabBarIcon = ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={styles.tabBarItem}>
      <Text style={[
        styles.tabBarText,
        {
          color: focused ? COLORS.textDark : COLORS.textMuted,
          fontWeight: focused ? '700' : '400', // Bold when active
          fontFamily: focused ? 'Inter-SemiBold' : 'Inter-Regular' // Ensure proper font family for bold
        }
      ]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <View style={styles.activeTabUnderline} />}
    </View>
  );
  TabBarIcon.displayName = `TabBarIcon_${label}`;
  return TabBarIcon;
};

/**
 * Stable, memoized tabs navigator component that prevents remounting when parent re-renders.
 * This is critical for maintaining individual tab screen state and preventing useFocusEffect remounts.
 */
const MemoizedTabsNavigator = React.memo(() => {
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.textDark,
        tabBarInactiveTintColor: COLORS.textMuted,
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
          title: 'Home',
          tabBarIcon: createTabBarIcon('home', 'Home'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="import"
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
          title: 'Library',
          tabBarIcon: createTabBarIcon('book-open-variant', 'Library'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />
      <Tabs.Screen
        name="mise"
        options={{
          title: 'Cook',
          tabBarIcon: createTabBarIcon('chef-hat', 'Cook'),
          tabBarLabel: () => null,
          unmountOnBlur: false,
        }}
      />

    </Tabs>
  );
});

MemoizedTabsNavigator.displayName = 'MemoizedTabsNavigator';

const TabLayout = () => {
  return <MemoizedTabsNavigator />;
};

TabLayout.displayName = 'TabLayout';

export default TabLayout;