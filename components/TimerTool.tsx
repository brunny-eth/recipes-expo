import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Play, Pause, RotateCcw } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

// Props expected from the parent (StepsScreen)
interface TimerToolProps {
  timeRemaining: number;
  isActive: boolean;
  addSeconds: (seconds: number) => void;
  handleStartPause: () => void;
  handleReset: () => void;
  formatTime: (timeInSeconds: number) => string;
}

export default function TimerTool({
  timeRemaining,
  isActive,
  addSeconds,
  handleStartPause,
  handleReset,
  formatTime,
}: TimerToolProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
      
      <View style={styles.quickAddContainer}>
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => addSeconds(30)}
          disabled={isActive}
        >
          <Text style={styles.quickAddButtonText}>+30s</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => addSeconds(60)}
          disabled={isActive}
        >
          <Text style={styles.quickAddButtonText}>+1m</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => addSeconds(300)}
          disabled={isActive}
        >
          <Text style={styles.quickAddButtonText}>+5m</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleStartPause}
          disabled={timeRemaining === 0 && !isActive}
        >
          {isActive ? (
            <Pause size={32} color={COLORS.textDark} />
          ) : (
            <Play size={32} color={timeRemaining === 0 ? COLORS.darkGray : COLORS.textDark} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
          <RotateCcw size={32} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginBottom: 25,
    fontVariant: ['tabular-nums'],
  },
  quickAddContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginBottom: 30,
  },
  quickAddButton: {
    backgroundColor: COLORS.lightGray,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    minWidth: 60,
    alignItems: 'center',
  },
  quickAddButtonText: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '70%',
  },
  controlButton: {
    backgroundColor: '#fbeded',
    padding: 15,
    borderRadius: 50,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
}); 