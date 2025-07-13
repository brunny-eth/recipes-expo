import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Dimensions,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { sectionHeaderText, FONT } from '@/constants/typography';

type RecipeStepsHeaderProps = {
  title?: string | null;
  imageUrl?: string | null;
  recipe?: {
    shortDescription?: string | null;
  } | null;
};

const { height: screenHeight } = Dimensions.get('window');
const imageHeight = Math.min(screenHeight * 0.15, 150); // 15% of screen height, max 150px

const RecipeStepsHeader: React.FC<RecipeStepsHeaderProps> = ({
  title,
  imageUrl, // keep prop for compatibility, but don't use
  recipe,
}) => {
  // Debug log for shortDescription
  console.log('RecipeStepsHeader shortDescription:', recipe?.shortDescription);
  return (
    <View style={styles.recipeHeader}>
      <Text style={styles.recipeTitle}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  recipeHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  recipeImage: {
    width: '100%',
    height: imageHeight,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  recipeTitle: {
    ...sectionHeaderText,
    fontSize: FONT.size.xl,
    lineHeight: FONT.size.xl * 1.3,
    textAlign: 'center',
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  shortDescription: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.body,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    lineHeight: FONT.lineHeight.compact,
  },
});

export default RecipeStepsHeader; 