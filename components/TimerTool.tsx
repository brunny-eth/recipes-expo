import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH, SHADOWS } from '@/constants/theme';
import { screenTitleText, captionStrongText, bodyStrongText, FONT, metaText, bodyText } from '@/constants/typography';

// Timer data structure
export interface Timer {
  id: string;
  name: string;
  timeRemaining: number;
  isActive: boolean;
  startTimestamp: number | null;
}

// Props expected from the parent
interface TimerToolProps {
  isVisible: boolean;
  onClose: () => void;
  timers: Timer[];
  onAddTimer: (name: string, initialTime?: number, startActive?: boolean) => void;
  onUpdateTimer: (id: string, updates: Partial<Timer>) => void;
  onDeleteTimer: (id: string) => void;
  formatTime: (timeInSeconds: number) => string;
}

export default function TimerTool({
  isVisible,
  onClose,
  timers,
  onAddTimer,
  onUpdateTimer,
  onDeleteTimer,
  formatTime,
}: TimerToolProps) {
  const [showWheelPicker, setShowWheelPicker] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [selectedSeconds, setSelectedSeconds] = useState(0);

  // Show wheel picker if no timers exist, otherwise show summary
  useEffect(() => {
    if (isVisible) {
      setShowWheelPicker(timers.length === 0);
    }
  }, [isVisible, timers.length]);

  // Auto-remove timers that reach 0
  useEffect(() => {
    timers.forEach(timer => {
      if (timer.timeRemaining <= 0 && !timer.isActive) {
        onDeleteTimer(timer.id);
      }
    });
  }, [timers, onDeleteTimer]);

  const handleStartTimer = () => {
    const totalSeconds = selectedMinutes * 60 + selectedSeconds;
    if (totalSeconds > 0) {
      // Create the timer with the selected time and start it immediately
      onAddTimer('Timer', totalSeconds, true);
      // Close modal immediately to avoid visual jank
      onClose();
    }
  };

  const handleAddNewTimer = () => {
    setShowWheelPicker(true);
  };

  const handleStartPause = (timerId: string) => {
    const timer = timers.find(t => t.id === timerId);
    if (!timer) return;

    if (timer.isActive) {
      // Pause timer
      onUpdateTimer(timerId, { 
        isActive: false,
        startTimestamp: null
      });
    } else if (timer.timeRemaining > 0) {
      // Start timer
      onUpdateTimer(timerId, { 
        isActive: true,
        startTimestamp: Date.now()
      });
    }
  };

  const handleReset = (timerId: string) => {
    onUpdateTimer(timerId, { 
      timeRemaining: 0,
      isActive: false,
      startTimestamp: null
    });
  };

  const handleDeleteTimer = (timerId: string) => {
    onDeleteTimer(timerId);
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

  // Wheel Picker Component
  const renderWheelPicker = () => (
    <View style={styles.wheelPickerContainer}>
      <Text style={styles.wheelPickerTitle}>Set Timer</Text>
      
      <View style={styles.wheelsContainer}>
        {/* Minutes Wheel */}
        <View style={styles.wheelColumn}>
          <Text style={styles.wheelLabel}>Minutes</Text>
          <ScrollView 
            style={styles.wheel}
            showsVerticalScrollIndicator={false}
            snapToInterval={40}
            decelerationRate="fast"
            contentContainerStyle={styles.wheelContent}
          >
            {Array.from({ length: 61 }, (_, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.wheelItem,
                  selectedMinutes === i && styles.wheelItemSelected
                ]}
                onPress={() => setSelectedMinutes(i)}
              >
                <Text style={[
                  styles.wheelItemText,
                  selectedMinutes === i && styles.wheelItemTextSelected
                ]}>
                  {i.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Seconds Wheel */}
        <View style={styles.wheelColumn}>
          <Text style={styles.wheelLabel}>Seconds</Text>
          <ScrollView 
            style={styles.wheel}
            showsVerticalScrollIndicator={false}
            snapToInterval={40}
            decelerationRate="fast"
            contentContainerStyle={styles.wheelContent}
          >
            {Array.from({ length: 60 }, (_, i) => (
              <TouchableOpacity
                key={i}
                                 style={[
                   styles.wheelItem,
                   selectedSeconds === i && styles.wheelItemSelected
                 ]}
                onPress={() => setSelectedSeconds(i)}
              >
                <Text style={[
                  styles.wheelItemText,
                  selectedSeconds === i && styles.wheelItemTextSelected
                ]}>
                  {i.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.startButton,
          (selectedMinutes === 0 && selectedSeconds === 0) && styles.startButtonDisabled
        ]}
        onPress={handleStartTimer}
        disabled={selectedMinutes === 0 && selectedSeconds === 0}
      >
        <Text style={styles.startButtonText}>Start</Text>
      </TouchableOpacity>
    </View>
  );

  // Timer Summary Component
  const renderTimerSummary = () => (
    <View style={styles.timerSummaryContainer}>
      <Text style={styles.timerSummaryTitle}>Timers</Text>
      
      <ScrollView style={styles.timersList} showsVerticalScrollIndicator={false}>
        {timers.map((timer) => (
          <View key={timer.id} style={styles.timerRow}>
            <View style={styles.timerInfo}>
              <Text style={styles.timerName}>{timer.name}</Text>
              <Text style={styles.timerTime}>
                {formatTimeDisplay(timer.timeRemaining)}
              </Text>
            </View>
            <View style={styles.timerControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => handleStartPause(timer.id)}
              >
                <MaterialCommunityIcons
                  name={timer.isActive ? "pause" : "play"}
                  size={20}
                  color={COLORS.textMuted}
                  style={{ opacity: 0.6 }}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => handleDeleteTimer(timer.id)}
              >
                <Text style={[styles.deleteIcon, { opacity: 0.6 }]}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        {/* Add New Timer Button - show if under limit */}
        {timers.length < 4 && (
          <TouchableOpacity
            style={styles.addTimerButton}
            onPress={handleAddNewTimer}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={COLORS.textMuted}
              style={{ opacity: 0.6 }}
            />
            <Text style={styles.addTimerButtonText}>Add New Timer</Text>
          </TouchableOpacity>
        )}
        
        {/* Show limit message when at 4 timers */}
        {timers.length >= 4 && (
          <View style={styles.limitReachedContainer}>
            <Text style={styles.limitReachedTitle}>Timer Limit Reached</Text>
            <Text style={styles.limitReachedText}>
              You can only have a maximum of 4 timers. Delete a timer to create a new one.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={COLORS.darkGray}
            />
          </TouchableOpacity>

          {/* Content */}
          {showWheelPicker ? renderWheelPicker() : renderTimerSummary()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 5,
    zIndex: 10,
  },

  // Wheel Picker Styles
  wheelPickerContainer: {
    alignItems: 'center',
    width: '100%',
  },
  wheelPickerTitle: {
    ...bodyStrongText,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: SPACING.xl,
  },
  wheelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: SPACING.xl,
  },
  wheelColumn: {
    alignItems: 'center',
    flex: 1,
  },
  wheelLabel: {
    ...metaText,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  wheel: {
    height: 120,
    width: 80,
  },
  wheelContent: {
    paddingVertical: 40,
  },
  wheelItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  wheelItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  wheelItemText: {
    ...bodyText,
    fontSize: 18,
    color: COLORS.textMuted,
  },
  wheelItemTextSelected: {
    color: COLORS.textDark,
    fontWeight: '600',
  },
  startButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    minWidth: 120,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    textAlign: 'center',
    fontSize: 16,
  },

  // Timer Summary Styles
  timerSummaryContainer: {
    alignItems: 'center',
    width: '100%',
  },
  timerSummaryTitle: {
    ...bodyStrongText,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  timersList: {
    width: '100%',
    maxHeight: 300,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#000000',
    ...SHADOWS.small,
  },
  timerInfo: {
    flex: 1,
  },
  timerName: {
    ...metaText,
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  timerTime: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  timerControls: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  controlButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  deleteIcon: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: FONT.size.body,
    fontWeight: '600',
    lineHeight: FONT.lineHeight.normal,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Add Timer Button
  addTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  addTimerButtonText: {
    ...bodyText,
    color: COLORS.textDark,
  },

  // Limit Reached Styles
  limitReachedContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  limitReachedTitle: {
    ...bodyStrongText,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  limitReachedText: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
