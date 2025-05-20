import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import { Bookmark } from 'lucide-react-native';

export default function SavedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Recipes</Text>
      
      <View style={styles.emptyContainer}>
        <Bookmark size={48} color={COLORS.lightGray} />
        <Text style={styles.emptyText}>No saved recipes yet</Text>
        <Text style={styles.emptySubtext}>
          When you save a recipe, it will appear here for quick access
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 20,
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
    color: COLORS.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
});