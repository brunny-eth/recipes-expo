import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import {
  COLORS,
  RADIUS,
  SPACING,
  SHADOWS,
  BORDER_WIDTH,
  ICON_SIZE,
} from '@/constants/theme';
import { FONT, bodyStrongText } from '@/constants/typography';

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
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
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
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.medium,
  } as ViewStyle,
  image: {
    width: '100%',
    height: 180, // TODO: Consider tokenizing if reused elsewhere
  } as ImageStyle,
  content: {
    padding: SPACING.md,
  } as ViewStyle,
  title: {
    fontFamily: FONT.family.interSemiBold,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    marginBottom: SPACING.smMd,
  } as TextStyle,
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  nutritionItem: {
    flex: 1,
  } as ViewStyle,
  nutritionValue: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  nutritionLabel: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.xs,
    color: COLORS.darkGray,
  } as TextStyle,
  divider: {
    width: BORDER_WIDTH.default,
    height: ICON_SIZE.md,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: SPACING.md,
  } as ViewStyle,
});

export default RecipeCard;
