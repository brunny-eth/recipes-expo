import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import ToolsModal from '@/components/ToolsModal';
import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import { ActiveTool } from '@/components/ToolsModal';
import { useErrorModal } from '@/context/ErrorModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';

export default function StepsScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [substitutions, setSubstitutions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<{[key: number]: boolean}>({});
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState(false);
  const [initialToolToShow, setInitialToolToShow] = useState<ActiveTool>(null);
  
  // --- Lifted Timer State --- 
  const [timerTimeRemaining, setTimerTimeRemaining] = useState(0); // Time in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);
  // --- End Lifted Timer State ---
  
  useEffect(() => {
    setIsLoading(true);
    try {
      if (params.recipeData) {
        const parsedData = JSON.parse(params.recipeData) as {
          title?: string | null;
          instructions?: string[] | null;
          substitutions_text?: string | null;
        };

        if (parsedData.instructions && Array.isArray(parsedData.instructions)) {
            setInstructions(parsedData.instructions);
        } else {
            console.warn("[StepsScreen] Instructions missing or not an array in recipeData.");
            setInstructions([]); 
        }

        setSubstitutions(parsedData.substitutions_text || null);
        
        setRecipeTitle(parsedData.title || 'Instructions'); 

      } else {
        showError({
          title: "Error Loading Steps",
          message: "Recipe data was not provided. Please go back and try again."
        });
        setInstructions([]);
        setSubstitutions(null);
        setIsLoading(false);
        return;
      }
    } catch (e: any) {
        console.error("Failed to parse recipe data on steps screen:", e);
        showError({
          title: "Error Loading Steps",
          message: `Could not load recipe data: ${e.message}. Please go back and try again.`
        });
        setInstructions([]);
        setSubstitutions(null);
        setIsLoading(false);
        return;
    }
    setIsLoading(false);
  }, [params.recipeData, showError, router]);

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
      showError({ title: "Timer", message: "Time's up!" });
    }

    // Cleanup interval
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timerTimeRemaining, showError]);

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
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolsButton} onPress={() => openToolsModal()}>
            <MaterialCommunityIcons name="tools" size={24} color={COLORS.raisinBlack} />
        </TouchableOpacity>
      </Animated.View>
      
      {recipeTitle && (
        <Text style={styles.pageTitle}>{recipeTitle}</Text>
      )}

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
                      <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.white} />
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
            <View style={styles.centeredStatusContainerForBanner}> 
              <InlineErrorBanner 
                message="Could not load recipe steps. Data might be missing or invalid."
                showGoBackButton={true}
              />
            </View>
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
          recipeInstructions={instructions}
          recipeSubstitutions={substitutions}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
  },
  stepsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  pageTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 26,
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
    color: COLORS.gray,
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
    backgroundColor: COLORS.background, 
  },
  centeredStatusContainerForBanner: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 20,
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
  },
});