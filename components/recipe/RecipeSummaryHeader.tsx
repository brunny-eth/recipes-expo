import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { CombinedParsedRecipe as ParsedRecipe } from '@/common/types';
import { sectionHeaderText, FONT } from '@/constants/typography';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import SaveButton from '@/components/SaveButton';

type RecipeSummaryHeaderProps = {
  recipe: ParsedRecipe;
  cleanTitle: string;
};

const RecipeSummaryHeader: React.FC<RecipeSummaryHeaderProps> = ({ recipe, cleanTitle }) => {
  return (
    <>
      <View style={styles.recipeInfoContainer}>
        {(recipe.image || recipe.thumbnailUrl) && (
          <FastImage
            source={{ uri: (recipe.image || recipe.thumbnailUrl) as string }}
            style={styles.recipeImage as any}
            resizeMode="cover"
          />
        )}
        <View style={styles.recipeTextContainer}>
          {cleanTitle && <Text style={styles.pageTitle} numberOfLines={2} ellipsizeMode="tail">{cleanTitle}</Text>}
          {recipe.shortDescription && (
            <Text style={styles.shortDescription}>{recipe.shortDescription}</Text>
          )}
        </View>
      </View>

      {recipe?.id && (
        <View style={styles.saveButtonContainer}>
          <SaveButton recipeId={recipe.id} />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  recipeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  } as ViewStyle,
  recipeTextContainer: {
    flex: 1,
  } as ViewStyle,
  recipeImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.md,
  } as ImageStyle,
  pageTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'left',
    lineHeight: FONT.lineHeight.compact,
  } as TextStyle,
  shortDescription: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.body,
    color: COLORS.darkGray,
    textAlign: 'left',
    marginTop: SPACING.xs,
    lineHeight: FONT.lineHeight.compact,
  } as TextStyle,
  saveButtonContainer: {
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
});

export default RecipeSummaryHeader; 