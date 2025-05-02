import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Play, Pause, RotateCcw } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

// Props expected from the parent (StepsScreen)
interface TimerToolProps {
  timeRemaining: number;
  isActive: boolean;
  formatTime: (seconds: number) => string;
  addTime: (secondsToAdd: number) => void;
  handleStartPause: () => void;
  handleReset: () => void;
}

export default function TimerTool({
    timeRemaining,
    isActive,
    formatTime,
    addTime,
    handleStartPause,
    handleReset
}: TimerToolProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
      
      <View style={styles.presetButtons}>
        <TouchableOpacity style={styles.presetButton} onPress={() => addTime(60)} disabled={isActive}> 
            <Text style={styles.presetButtonText}>+1m</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetButton} onPress={() => addTime(300)} disabled={isActive}>
            <Text style={styles.presetButtonText}>+5m</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetButton} onPress={() => addTime(600)} disabled={isActive}>
            <Text style={styles.presetButtonText}>+10m</Text>
        </TouchableOpacity>
      </View>

      {/* Optional: Custom input - could be added later */}
      {/* <TextInput placeholder="Set custom time (seconds)" keyboardType="numeric" /> */}

      <View style={styles.controlButtons}>
        <TouchableOpacity style={styles.controlButton} onPress={handleStartPause} disabled={timeRemaining === 0}>
          {isActive ? <Pause size={24} color={timeRemaining === 0 ? COLORS.darkGray : COLORS.white} /> : <Play size={24} color={timeRemaining === 0 ? COLORS.darkGray : COLORS.white} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
          <RotateCcw size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  timerDisplay: {
    fontFamily: 'Poppins-Bold',
    fontSize: 48,
    color: COLORS.textDark,
    marginBottom: 20,
    minWidth: 150, // Ensure space for MM:SS
    textAlign: 'center',
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: COLORS.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  presetButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: 14,
      color: COLORS.primary,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '60%',
  },
  controlButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 30, // Make circular
    marginHorizontal: 15,
  },
}); 