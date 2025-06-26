import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// import { Timer } from 'lucide-react-native'; // Removed import
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Added import
import { COLORS } from '@/constants/theme';
import { captionStrongText } from '@/constants/typography';

interface MiniTimerDisplayProps {
  timeRemaining: number;
  formatTime: (seconds: number) => string;
  onPress?: () => void;
}

export default function MiniTimerDisplay({
  timeRemaining,
  formatTime,
  onPress,
}: MiniTimerDisplayProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* <Timer size={18} color={COLORS.white} style={styles.icon}/> */}
      <MaterialCommunityIcons
        name="timer-outline"
        size={18}
        color={COLORS.white}
        style={styles.icon}
      />
      <Text style={styles.timeText}>{formatTime(timeRemaining)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30, // Adjust position as needed
    right: 20, // Adjust position as needed
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent background
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    marginRight: 6,
  },
  timeText: {
    ...captionStrongText,
    color: COLORS.white,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
