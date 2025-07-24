import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
import TimerTool from './TimerTool';
import UnitsTool from './UnitsTool';
import HelpTool from './HelpTool';
import { sectionHeaderText } from '@/constants/typography';

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
}: ToolsModalProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setActiveTool(initialTool || null);
    } else {
      setActiveTool(null);
    }
  }, [isVisible, initialTool]);

  // Handle keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

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
            onClose={onClose}
          />
        );
      case 'units':
        return <UnitsTool />;
      case 'help':
        return <HelpTool />;
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Image
              source={require('@/assets/images/meez_logo.webp')}
              style={[styles.chefIcon, { width: 80, height: 80 }]}
            />
            <Text style={styles.placeholderText}>
              Click on a Tool to use it
            </Text>
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
        <Pressable 
          style={[
            styles.centeredView,
            keyboardVisible && styles.centeredViewWithKeyboard
          ]} 
          onPress={onClose}
        >
                      <Pressable
              style={[
                styles.modalView,
                keyboardVisible && styles.modalViewWithKeyboard,
              ]}
              onPress={(e) => e.stopPropagation()}
            >
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.darkGray}
              />
            </TouchableOpacity>

                          <View
                style={[
                  styles.toolContentContainer,
                  activeTool === 'help' && styles.toolContentContainerHelpActive,
                ]}
              onLayout={(event) => {
                console.log('[ToolsModal] Tool content container layout:', {
                  width: event.nativeEvent.layout.width,
                  height: event.nativeEvent.layout.height,
                  activeTool,
                });
              }}
            >
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
    paddingTop: Platform.OS === 'ios' ? 40 : 20, // Add some top padding to prevent going off-screen
  },
  modalView: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '85%',
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
  keyboardAvoidingContainer: {
    flex: 1,
  },
  centeredViewWithKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 60, // Move modal down when keyboard is visible
  },
  modalViewWithKeyboard: {
    maxHeight: '70%', // Reduce height when keyboard is visible
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
    ...sectionHeaderText,
    fontSize: 18,
    color: COLORS.darkGray,
    textAlign: 'center',
  },
  toolPlaceholderText: {
    fontSize: 16,
    color: COLORS.darkGray,
    marginTop: 20,
  },
});
