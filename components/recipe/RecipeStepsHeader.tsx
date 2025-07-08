import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { sectionHeaderText } from '@/constants/typography';

type RecipeStepsHeaderProps = {
  title?: string | null;
  imageUrl?: string | null;
};

const RecipeStepsHeader: React.FC<RecipeStepsHeaderProps> = ({
  title,
  imageUrl,
}) => {
  return (
    <View style={styles.recipeHeader}>
      {imageUrl && (
        <FastImage source={{ uri: imageUrl }} style={styles.recipeImage} />
      )}
      <Text style={[styles.recipeTitle, !imageUrl && styles.recipeTitleNoImage]}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  recipeImage: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  recipeTitle: {
    ...sectionHeaderText,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.xs,
  },
  recipeTitleNoImage: {
    marginHorizontal: 0,
  },
});

export default RecipeStepsHeader; 