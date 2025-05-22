import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
// import { Bookmark as BookmarkIcon } from 'lucide-react-native'; // Removed import
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Added import
import { COLORS } from '@/constants/theme';
import ChefIcon from '@/assets/images/Chef.svg';

export default function TabLayout() {
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
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <ChefIcon width={size} height={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          // tabBarIcon: ({ color, size }) => <BookmarkIcon size={size} color={color} />,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="bookmark-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    height: 60,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
});