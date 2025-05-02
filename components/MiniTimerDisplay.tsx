import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Timer } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

interface MiniTimerDisplayProps {
  timeRemaining: number;
  formatTime: (seconds: number) => string;
}

export default function MiniTimerDisplay({ timeRemaining, formatTime }: MiniTimerDisplayProps) {
  return (
    <View style={styles.container}>
      <Timer size={18} color={COLORS.white} style={styles.icon}/>
      <Text style={styles.timeText}>{formatTime(timeRemaining)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // Adjust position as needed
    right: 20,  // Adjust position as needed
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent background
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    marginRight: 6,
  },
  timeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
}); 