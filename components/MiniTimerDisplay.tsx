import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { captionStrongText, FONT, metaText } from '@/constants/typography';
import { Timer } from './TimerTool';

interface MiniTimerDisplayProps {
  timers: Timer[];
  formatTime: (seconds: number) => string;
  onPress?: () => void;
}

export default function MiniTimerDisplay({
  timers,
  formatTime,
  onPress,
}: MiniTimerDisplayProps) {
  if (timers.length === 0) return null;

  // If only one timer, show compact single timer display
  if (timers.length === 1) {
    const timer = timers[0];
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="timer-outline"
          size={18}
          color={COLORS.white}
          style={styles.icon}
        />
        <Text style={styles.timerName}>{timer.name}</Text>
        <Text style={styles.timeText}>{formatTime(timer.timeRemaining)}</Text>
      </TouchableOpacity>
    );
  }

  // Multiple timers - show scrollable list
  return (
    <TouchableOpacity
      style={[styles.container, styles.multiTimerContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.multiTimerHeader}>
        <MaterialCommunityIcons
          name="timer-outline"
          size={16}
          color={COLORS.white}
          style={styles.multiTimerIcon}
        />
        <Text style={styles.multiTimerCount}>{timers.length} timers</Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timersList}
      >
        {timers.map((timer, index) => (
          <View key={timer.id} style={styles.miniTimer}>
            <Text style={styles.miniTimerName} numberOfLines={1}>
              {timer.name}
            </Text>
            <Text style={styles.miniTimeText}>
              {formatTime(timer.timeRemaining)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    maxWidth: 250,
  },
  multiTimerContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  icon: {
    marginRight: 6,
  },
  timerName: {
    ...metaText,
    color: COLORS.white,
    fontSize: 10,
    marginRight: 4,
    opacity: 0.8,
    maxWidth: 60,
  },
  timeText: {
    ...captionStrongText,
    color: COLORS.white,
    fontSize: FONT.size.caption,
    fontVariant: ['tabular-nums'],
  },
  
  // Multiple timer styles
  multiTimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  multiTimerIcon: {
    marginRight: 4,
  },
  multiTimerCount: {
    ...metaText,
    color: COLORS.white,
    fontSize: 10,
    opacity: 0.9,
  },
  timersList: {
    flexDirection: 'row',
    gap: 8,
  },
  miniTimer: {
    alignItems: 'center',
    minWidth: 50,
  },
  miniTimerName: {
    ...metaText,
    color: COLORS.white,
    fontSize: 8,
    opacity: 0.7,
    marginBottom: 1,
    maxWidth: 50,
    textAlign: 'center',
  },
  miniTimeText: {
    ...captionStrongText,
    color: COLORS.white,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
