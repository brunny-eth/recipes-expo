import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/theme';
import ChefHat from '@/assets/images/Chef.svg';
import TimerTool from './TimerTool';
import UnitsTool from './UnitsTool';
import HelpTool from './HelpTool';

export type ActiveTool = 'timer' | 'units' | 'help' | null;

interface ToolsModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialTool?: ActiveTool;
  timerTimeRemaining: number;
  isTimerActive: boolean;
  handleTimerAddSeconds: (seconds: number) => void;
  handleTimerStartPause: () => void;
  handleTimerReset: () => void;
  formatTime: (timeInSeconds: number) => string;
  recipeInstructions?: string[];
  recipeSubstitutions?: string | null;
}

export default function ToolsModal({
  isVisible,
  onClose,
  initialTool,
  timerTimeRemaining,
  isTimerActive,
  handleTimerAddSeconds,
  handleTimerStartPause,
  handleTimerReset,
  formatTime,
  recipeInstructions,
  recipeSubstitutions,
}: ToolsModalProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  useEffect(() => {
    if (isVisible) {
      setActiveTool(initialTool || null);
    } else {
      setActiveTool(null);
    }
  }, [isVisible, initialTool]);

  const renderToolContent = () => {
    switch (activeTool) {
      case 'timer':
        return (
          <TimerTool
            timeRemaining={timerTimeRemaining}
            isActive={isTimerActive}
            addSeconds={handleTimerAddSeconds}
            handleStartPause={handleTimerStartPause}
            handleReset={handleTimerReset}
            formatTime={formatTime}
          />
        );
      case 'units':
        return <UnitsTool />;
      case 'help':
        return <HelpTool recipeInstructions={recipeInstructions} />;
      default:
        return (
          <View style={styles.placeholderContainer}>
            <ChefHat width={80} height={80} style={styles.chefIcon} />
            <Text style={styles.placeholderText}>Click on a Tool to use it</Text>
          </View>
        );
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} tint="light" style={styles.absolute}>
        <Pressable style={styles.centeredView} onPress={onClose}>
          <Pressable style={styles.modalView} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.darkGray} />
            </TouchableOpacity>

            <View style={[
              styles.toolContentContainer,
              activeTool === 'help' && styles.toolContentContainerHelpActive
            ]}>
              {renderToolContent()}
            </View>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  absolute: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalView: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingTop: 45,
    paddingBottom: 25,
    paddingHorizontal: 25,
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
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10,
  },
  toolContentContainer: {
    width: '100%',
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
  },
  toolContentContainerHelpActive: {
    minHeight: 450,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  chefIcon: {
    marginBottom: 15,
    opacity: 0.8,
  },
  placeholderText: {
    fontSize: 18,
    color: COLORS.darkGray,
    textAlign: 'center',
    fontWeight: '600',
  },
  toolPlaceholderText: {
    fontSize: 16,
    color: COLORS.darkGray,
    marginTop: 20,
  },
}); 