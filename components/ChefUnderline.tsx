import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function ChefUnderline({ width = 330, height = 18, color = COLORS.primary }) {
  const path = `M10,${height - 8} Q${width * 0.25},${height} ${width / 2},${height - 4} Q${width * 0.75},${height - 8} ${width - 10},${height - 8}`;
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={path}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: -2, // Reduced from 6 to bring underline closer
    width: '100%',
  },
}); 