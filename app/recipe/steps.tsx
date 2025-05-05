import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleCheck as CheckCircle2, Hammer as ToolsIcon } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import ToolsModal from '@/components/ToolsModal';
import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import { ActiveTool } from '@/components/ToolsModal';

export default function StepsScreen() {
  const params = useLocalSearchParams<{ instructionsData?: string, substitutionsText?: string }>();
  const router = useRouter();
  
  const [instructions, setInstructions] = useState<string[]>([]);
  const [substitutions, setSubstitutions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<{[key: number]: boolean}>({});
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState(false);
  const [initialToolToShow, setInitialToolToShow] = useState<ActiveTool>(null);
  
  // --- Lifted Timer State --- 
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(0); // Time in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // --- End Lifted Timer State ---
  
  useEffect(() => {
    try {
      if (params.instructionsData) {
        const parsedInstructions = JSON.parse(params.instructionsData);
        if (Array.isArray(parsedInstructions)) {
            setInstructions(parsedInstructions);
        } else {
            throw new Error("Instructions data is not an array.");
        }
      } else {
        // Allow empty instructions, maybe show placeholder later
        setInstructions([]); 
      }
      
      // Set substitutions text (it's already a string or empty/null)
      setSubstitutions(params.substitutionsText || null);

    } catch (e) {
        console.error("Failed to parse instructions data:", e);
        setError("Could not load recipe instructions.");
    }
    setIsLoading(false);
  }, [params.instructionsData, params.substitutionsText]);

  // --- Lifted Timer Logic --- 
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleTimerAddSeconds = (secondsToAdd: number) => {
    if (!isTimerActive) {
        setTimerTimeRemaining(prev => Math.max(0, prev + secondsToAdd));
    }
  };

  useEffect(() => {
    if (isTimerActive && timerTimeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timerTimeRemaining === 0 && isTimerActive) {
      setIsTimerActive(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      // Optional: Add sound/vibration feedback here
      Alert.alert("Timer Finished!"); 
    }

    // Cleanup interval
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timerTimeRemaining]);

  const handleTimerStartPause = () => {
    if (timerTimeRemaining > 0) {
      setIsTimerActive(prev => !prev);
      // Clear interval when pausing explicitly
      if (isTimerActive && timerIntervalRef.current) {
           clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleTimerReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerActive(false);
    setTimerTimeRemaining(0);
  };
  // --- End Lifted Timer Logic ---

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const toggleStepCompleted = (index: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const openToolsModal = (initialTool: ActiveTool = null) => {
      console.log(`Opening tools modal${initialTool ? ` to ${initialTool}` : ''}`);
      setInitialToolToShow(initialTool);
      setIsToolsPanelVisible(true);
  };

  const closeToolsModal = () => {
      setIsToolsPanelVisible(false);
      setInitialToolToShow(null);
  };

  const handleMiniTimerPress = () => {
    openToolsModal('timer');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Instructions</Text>
        <TouchableOpacity style={styles.toolsButton} onPress={() => openToolsModal()}>
            <ToolsIcon size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
      </Animated.View>
      
      <ScrollView 
        style={styles.stepsContainer}
        showsVerticalScrollIndicator={false}
      >
        {instructions.length > 0 ? (
            instructions.map((step, index) => (
              <Animated.View
                key={`step-${index}`}
                entering={FadeInUp.delay(index * 50).duration(300)}
                style={styles.stepItem}
              >
                <View style={styles.stepNumberContainer}>
                  <View style={[
                    styles.stepNumber,
                    completedSteps[index] && styles.stepNumberCompleted,
                  ]}>
                    {completedSteps[index] ? (
                      <CheckCircle2 size={24} color={COLORS.white} />
                    ) : (
                      <Text style={styles.stepNumberText}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {index < instructions.length - 1 && (
                    <View style={[
                      styles.stepConnector,
                      completedSteps[index] && styles.stepConnectorCompleted
                    ]} />
                  )}
                </View>
                
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepText,
                    completedSteps[index] && styles.stepTextCompleted
                  ]}>
                    {step}
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.markCompleteButton,
                      completedSteps[index] && styles.markCompleteButtonActive
                    ]}
                    onPress={() => toggleStepCompleted(index)}
                  >
                    <Text style={[
                      styles.markCompleteText,
                      completedSteps[index] && styles.markCompleteTextActive
                    ]}>
                      {completedSteps[index] ? 'Completed' : 'Mark as Complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))
          ) : (
            <Text style={styles.placeholderText}>No instructions found.</Text>
          )}
        
        {substitutions && (
            <View style={styles.substitutionsContainer}>
                <Text style={styles.sectionTitle}>Substitution Notes</Text>
                <Text style={styles.substitutionsText}>{substitutions}</Text>
            </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {instructions.length > 0 && Object.values(completedSteps).filter(Boolean).length === instructions.length && (
        <Animated.View 
          entering={FadeIn.duration(500)}
          style={styles.completionContainer}
        >
          <View style={styles.completionContent}>
            <Text style={styles.completionTitle}>Recipe Completed!</Text>
            <Text style={styles.completionText}>
              Enjoy!
            </Text>
          </View>
        </Animated.View>
      )}
      
      <ToolsModal 
          isVisible={isToolsPanelVisible}
          onClose={closeToolsModal}
          initialTool={initialToolToShow}
          timerTimeRemaining={timerTimeRemaining}
          isTimerActive={isTimerActive}
          formatTime={formatTime}
          handleTimerAddSeconds={handleTimerAddSeconds}
          handleTimerStartPause={handleTimerStartPause}
          handleTimerReset={handleTimerReset}
      />

      {!isToolsPanelVisible && isTimerActive && timerTimeRemaining > 0 && (
          <MiniTimerDisplay 
              timeRemaining={timerTimeRemaining} 
              formatTime={formatTime} 
              onPress={handleMiniTimerPress}
          />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.raisinBlack,
    marginHorizontal: 10,
  },
  placeholder: {
    // width: 24 + 16, // Can be removed if tools button is sized correctly
  },
  stepsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepNumberText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: 4,
  },
  stepConnectorCompleted: {
    backgroundColor: COLORS.primary,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 10,
  },
  stepText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: COLORS.textDark,
    marginBottom: 12,
    lineHeight: 22, 
  },
  stepTextCompleted: {
    color: COLORS.textGray,
    textDecorationLine: 'line-through',
  },
  markCompleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  markCompleteButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },
  markCompleteText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: COLORS.primary,
  },
  markCompleteTextActive: {
    color: COLORS.primary, 
  },
  completionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    padding: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  completionContent: {
    alignItems: 'center',
  },
  completionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 4,
  },
  completionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: COLORS.textDark,
    marginBottom: 15, 
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonSimple: {
     marginTop: 15,
     paddingVertical: 10,
     paddingHorizontal: 20,
     backgroundColor: COLORS.lightGray,
     borderRadius: 8,
  },
  backButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  placeholderText: {
    fontFamily: 'Poppins-Italic',
    fontSize: 14,
    color: COLORS.darkGray,
    marginTop: 20,
    textAlign: 'center',
  },
  substitutionsContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  substitutionsText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  toolsButton: {
    padding: 8,
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 0 : 10,
  },
});