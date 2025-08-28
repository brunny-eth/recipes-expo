import React, { useState, useEffect } from 'react';
import { View, Text, TextStyle, Animated } from 'react-native';
import { screenTitleText, FONT } from '@/constants/typography';
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

  // Get the base font size from screenTitleText (should be around 24px)
  const baseFontSize = screenTitleText.fontSize || 24;
  const minFontSize = Math.floor(baseFontSize * 0.85); // ~85% of base size

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

  return (
    <View style={{ flexShrink: 1, height: reservedHeight, justifyContent: 'center' }}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text
          style={[
            {
              ...screenTitleText,
              color: COLORS.textDark,
              textAlign: 'center',
              // Ensure consistent line height to prevent jumping
              lineHeight: FONT.lineHeight.normal,
            },
            baseStyle
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
          adjustsFontSizeToFit={true}
          minimumFontScale={minFontSize / baseFontSize}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.2}
        >
          {title || 'Recipe'}
        </Text>
      </Animated.View>
    </View>
  );
};

export default RecipeHeaderTitle;
