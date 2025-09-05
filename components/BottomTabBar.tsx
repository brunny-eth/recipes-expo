import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { captionText } from '@/constants/typography';

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    height: 80,
    paddingBottom: 26,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
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
    height: 2,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
});

// Helper function to create tab bar items
const createTabBarIcon = (label: string, route: string, router: any, isActive: boolean = false) => {
  return (
    <TouchableOpacity
      style={styles.tabBarItem}
      onPress={() => {
        if (route === '/') {
          // Navigate to home tab
          router.replace('/tabs');
        } else {
          router.replace(route);
        }
      }}
    >
      <Text style={[
        styles.tabBarText,
        {
          color: isActive ? COLORS.textDark : COLORS.textMuted,
          fontWeight: isActive ? '700' : '400'
        }
      ]} numberOfLines={1}>
        {label}
      </Text>
      {isActive && <View style={styles.activeTabUnderline} />}
    </TouchableOpacity>
  );
};

const BottomTabBar = () => {
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      {createTabBarIcon('Home', '/', router, false)}
      {createTabBarIcon('Import', '/tabs/import', router, false)}
      {createTabBarIcon('Library', '/tabs/library', router, false)}
      {createTabBarIcon('Cook', '/tabs/mise', router, false)}
    </View>
  );
};

export default BottomTabBar;
