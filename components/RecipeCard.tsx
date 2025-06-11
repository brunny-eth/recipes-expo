import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { COLORS } from '@/constants/theme';

type RecipeCardProps = {
  recipe: {
    id: string;
    title: string;
    calories: number;
    protein: number;
    imageUrl: string;
  };
  onPress: () => void;
};

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image 
        source={{ uri: recipe.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{recipe.title}</Text>
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{recipe.calories}</Text>
            <Text style={styles.nutritionLabel}>calories</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{recipe.protein}g</Text>
            <Text style={styles.nutritionLabel}>protein</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 180,
  },
  content: {
    padding: 16,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutritionItem: {
    flex: 1,
  },
  nutritionValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: COLORS.textDark,
  },
  nutritionLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: COLORS.darkGray,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 16,
  },
});

export default RecipeCard;