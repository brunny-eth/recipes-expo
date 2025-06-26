import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { captionStrongText, FONT } from '@/constants/typography';

const ShareButton = () => {
  return (
    <TouchableOpacity style={styles.button}>
      <MaterialCommunityIcons
        name="share-variant-outline"
        size={16}
        color={COLORS.primary}
        style={{ marginRight: SPACING.sm }}
      />
      <Text style={styles.text}>Share</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  text: {
    ...captionStrongText,
    fontSize: FONT.size.smBody,
    color: COLORS.primary,
  },
});

export default ShareButton; 