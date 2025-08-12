import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useHandleError } from '@/hooks/useHandleError';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH, SHADOWS } from '@/constants/theme';
import { screenTitleText, captionStrongText, bodyStrongText, FONT, metaText } from '@/constants/typography';

// Props expected from the parent (StepsScreen)
interface TimerToolProps {
  timeRemaining: number;
  isActive: boolean;
  addSeconds: (seconds: number) => void;
  handleStartPause: () => void;
  handleReset: () => void;
  formatTime: (timeInSeconds: number) => string;
  onClose?: () => void;
}

export default function TimerTool({
  timeRemaining,
  isActive,
  addSeconds,
  handleStartPause,
  handleReset,
  formatTime,
  onClose,
}: TimerToolProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const handleError = useHandleError();

  const handleTimeInputPress = () => {
    if (isActive) {
      handleError('Timer Active', 'Please pause the timer before setting a new time.');
      return;
    }
    setTimeInput(''); // Start with empty input instead of current time
    setIsEditing(true);
  };

  const formatTimeInput = (input: string) => {
    // Remove any non-digit characters
    const digits = input.replace(/\D/g, '');
    
    if (digits.length === 0) return '';
    if (digits.length === 1) return digits;
    if (digits.length === 2) return `0:${digits}`;
    if (digits.length === 3) return `${digits[0]}:${digits.slice(1)}`;
    if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    if (digits.length === 5) return `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3)}`;
    if (digits.length === 6) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
    
    // For longer inputs, format as HH:MM:SS
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
  };

  const handleTimeInputChange = (text: string) => {
    const formatted = formatTimeInput(text);
    setTimeInput(formatted);
  };

  const handleTimeInputSubmit = () => {
    const input = timeInput.trim();
    if (!input) {
      setIsEditing(false);
      return;
    }

    // Parse time input (supports formats like "2:30", "150", "2m30s", etc.)
    let totalSeconds = 0;
    
    if (input.includes(':')) {
      // Format: "2:30" or "1:30:45"
      const parts = input.split(':').map(Number);
      if (parts.length === 2) {
        totalSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    } else if (input.includes('m') || input.includes('s')) {
      // Format: "2m30s" or "90s" or "2m"
      const minutes = input.match(/(\d+)m/);
      const seconds = input.match(/(\d+)s/);
      if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
      if (seconds) totalSeconds += parseInt(seconds[1]);
    } else {
      // Format: just seconds "150"
      totalSeconds = parseInt(input);
    }

    if (totalSeconds > 0 && totalSeconds <= 36000) { // Max 10 hours
      // Reset current timer and set new time
      handleReset();
      addSeconds(totalSeconds);
      setIsEditing(false);
    } else {
      handleError('Invalid Time', 'Please enter a valid time (e.g., "2:30", "150", "2m30s"). Maximum 10 hours.');
    }
  };

  const handleTimeInputBlur = () => {
    setIsEditing(false);
  };

  const handlePlayButtonPress = () => {
    handleStartPause();
    if (onClose) {
      onClose();
    }
  };

  const formatTimeForInput = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeDisplay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.timerDisplayContainer}>
        {isEditing ? (
          <TextInput
            style={styles.timerDisplayInput}
            value={timeInput}
            onChangeText={handleTimeInputChange}
            onBlur={handleTimeInputBlur}
            onSubmitEditing={handleTimeInputSubmit}
            keyboardType="numeric"
            autoFocus={true}
            selectTextOnFocus={true}
            returnKeyType="done"
            placeholder="0:00"
            placeholderTextColor={COLORS.textMuted}
          />
        ) : (
          <TouchableOpacity
            onPress={handleTimeInputPress}
            disabled={isActive}
          >
            <Text style={styles.timerDisplay}>{formatTimeDisplay(timeRemaining)}</Text>
            {!isActive && (
              <Text style={styles.tapToEdit}>Tap to edit</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

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
          style={[styles.controlButton, isActive && styles.controlButtonActive]}
          onPress={handlePlayButtonPress}
          disabled={timeRemaining === 0 && !isActive}
        >
          {isActive ? (
            <MaterialCommunityIcons
              name="pause"
              size={28}
              color={COLORS.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name="play"
              size={28}
              color={COLORS.white}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={handleReset}
        >
          <MaterialCommunityIcons
            name="replay"
            size={28}
            color={COLORS.white}
          />
        </TouchableOpacity>
      </View>
      

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    width: '100%',
  },
  timerDisplayContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  timerDisplay: {
    ...screenTitleText,
    fontSize: 64,
    color: COLORS.textDark,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  timerDisplayInput: {
    ...screenTitleText,
    fontSize: 64,
    color: COLORS.textDark,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  tapToEdit: {
    ...metaText,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  quickAddContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  quickAddButton: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
    minWidth: 70,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  quickAddButtonText: {
    ...captionStrongText,
    fontSize: FONT.size.caption,
    color: COLORS.textDark,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '60%',
  },
  controlButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.pill,
    marginHorizontal: SPACING.sm,
    ...SHADOWS.medium,
  },
  controlButtonActive: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
  },

});
