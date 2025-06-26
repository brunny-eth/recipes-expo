import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/theme';
import { sectionHeaderText } from '@/constants/typography';

type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  isExpanded,
  onToggle,
}) => {
  return (
    <View>
      <TouchableOpacity onPress={onToggle} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={COLORS.darkGray}
        />
      </TouchableOpacity>
      {isExpanded && <Animated.View entering={FadeIn}>{children}</Animated.View>}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: 12, // Maintained from original summary styles
  } as ViewStyle,
  sectionTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
});

export default CollapsibleSection; 