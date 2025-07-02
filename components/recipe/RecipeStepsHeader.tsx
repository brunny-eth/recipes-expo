import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { sectionHeaderText } from '@/constants/typography';

type RecipeStepsHeaderProps = {
  title?: string | null;
  imageUrl?: string | null;
};

const RecipeStepsHeader: React.FC<RecipeStepsHeaderProps> = ({
  title,
  imageUrl,
}) => {
  const router = useRouter();

  const handleExitPress = () => {
    router.replace('/tabs');
  };

  return (
    <View>
      {/* Top navigation bar */}
      <View style={styles.mainHeader}>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={COLORS.textDark}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleExitPress}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={COLORS.textDark}
          />
        </TouchableOpacity>
      </View>

      {/* Recipe-specific header */}
      <View style={styles.recipeHeader}>
        {imageUrl ? (
          <FastImage source={{ uri: imageUrl }} style={styles.recipeImage} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <Text style={styles.recipeTitle}>
          {title}
        </Text>
        {/* Spacer to balance the layout */}
        <View style={styles.imagePlaceholder} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  button: {
    padding: SPACING.sm,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  },
  recipeImage: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
  },
  recipeTitle: {
    ...sectionHeaderText,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
});

export default RecipeStepsHeader; 