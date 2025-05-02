import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  SafeAreaView,
  Modal,
} from 'react-native';
import { X, SlidersHorizontal } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  SlideInDown,
  SlideOutDown,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import TimerTool from './TimerTool';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.8; // Panel takes 80% of screen width

interface ToolsSidePanelProps {
  isVisible: boolean;
  onClose: () => void;
  timeRemaining: number;
  isActive: boolean;
  formatTime: (seconds: number) => string;
  addTime: (secondsToAdd: number) => void;
  handleStartPause: () => void;
  handleReset: () => void;
}

export default function ToolsModal({
    isVisible,
    onClose,
    timeRemaining,
    isActive,
    formatTime,
    addTime,
    handleStartPause,
    handleReset
}: ToolsSidePanelProps) {
  return (
    <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View 
                style={styles.backdrop} 
                entering={FadeIn.duration(200)} 
                exiting={FadeOut.duration(200)} 
            />
        </Pressable>

        {/* Panel Content - Animated within the Modal */}
        <Animated.View 
            style={styles.panelContainer} 
            entering={SlideInDown.springify().damping(15)} 
            exiting={SlideOutDown}
        >
          <SafeAreaView style={styles.safeArea}> 
            {/* Header */}
            <View style={styles.header}>
               {/* <SlidersHorizontal size={22} color={COLORS.textDark} /> */}
              <Text style={styles.title}>Tools</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Tool Content Area */}
            <View style={styles.toolContent}>
              <TimerTool 
                timeRemaining={timeRemaining}
                isActive={isActive}
                formatTime={formatTime}
                addTime={addTime}
                handleStartPause={handleStartPause}
                handleReset={handleReset}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
  },
  backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panelContainer: {
    backgroundColor: COLORS.background, 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    minHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 15,
    overflow: 'hidden',
  },
  safeArea: {
    padding: 15, 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: COLORS.textDark,
    marginLeft: 10, 
    flex: 1, 
  },
  closeButton: {
    // padding: 5,
  },
  toolContent: {
  },
}); 