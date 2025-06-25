import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { screenTitleText } from '@/constants/typography';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SavedScreen() {
  return (
    <SafeAreaView style={[styles.container, { paddingTop: 20 }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
      </View>

      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="heart-outline" size={48} color={COLORS.lightGray} />
        <Text style={styles.emptyText}>No saved recipes yet</Text>
        <Text style={styles.emptySubtext}>
          When you save a recipe, it will appear here for quick access
        </Text>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.darkGray,
    textAlign: 'center',
    lineHeight: 24,
  },
});