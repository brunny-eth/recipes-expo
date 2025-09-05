import React, { useState, useEffect } from 'react';
import { View, Text, TextStyle, Animated } from 'react-native';
import { sectionHeaderText, FONT } from '@/constants/typography';
import { COLORS } from '@/constants/theme';

type RecipeHeaderTitleProps = {
  title: string;
  baseStyle?: TextStyle;
};

const RecipeHeaderTitle: React.FC<RecipeHeaderTitleProps> = ({
  title,
  baseStyle
}) => {
  const [isReady, setIsReady] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Reserve space for 2 lines to prevent reflow
  const reservedHeight = FONT.lineHeight.normal * 2;

  useEffect(() => {
    // Quick fade-in once component is mounted and laid out
    const timer = setTimeout(() => {
      setIsReady(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150, // Quick 150ms fade
        useNativeDriver: true,
      }).start();
    }, 0);

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  // Helper function to split title into lines with character limits
  const formatTitleForDisplay = (title: string): string => {
    if (!title) return 'Recipe';

    // If title is short enough, return as-is
    if (title.length <= 18) {
      return title;
    }

    // Find the best place to break the first line (prefer breaking at spaces)
    let firstLineEnd = 18;
    if (title[18] !== ' ' && title.indexOf(' ', 10) !== -1) {
      // Find the last space within the first 18 characters
      const lastSpace = title.lastIndexOf(' ', 18);
      if (lastSpace > 10) { // Only break if we have at least 10 chars on first line
        firstLineEnd = lastSpace;
      }
    }

    const firstLine = title.substring(0, firstLineEnd).trim();
    let remainingText = title.substring(firstLineEnd).trim();

    // If there's remaining text, create second line
    if (remainingText.length > 0) {
      let secondLine = remainingText;

      // If second line is longer than 20 chars, truncate with ellipsis
      if (remainingText.length > 20) {
        // Find the best truncation point
        let secondLineEnd = 20;
        if (remainingText[20] !== ' ' && remainingText.indexOf(' ', 15) !== -1) {
          const lastSpace = remainingText.lastIndexOf(' ', 20);
          if (lastSpace > 15) {
            secondLineEnd = lastSpace;
          }
        }
        secondLine = remainingText.substring(0, secondLineEnd).trim() + '...';
      }

      return `${firstLine}\n${secondLine}`;
    }

    return firstLine;
  };

  const formattedTitle = formatTitleForDisplay(title);

  return (
    <View style={{ flexShrink: 1, height: reservedHeight, justifyContent: 'center' }}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text
          style={[
            {
              fontFamily: FONT.family.graphikMedium,
              fontSize: 28,
              fontWeight: '600',
              lineHeight: 32,
              color: COLORS.textDark,
              textAlign: 'center',
            },
            baseStyle
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
          allowFontScaling={false} // Disable font scaling
        >
          {formattedTitle}
        </Text>
      </Animated.View>
    </View>
  );
};

export default RecipeHeaderTitle;
