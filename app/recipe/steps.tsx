import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import ToolsModal from '@/components/ToolsModal';
import MiniTimerDisplay from '@/components/MiniTimerDisplay';
import { ActiveTool } from '@/components/ToolsModal';
import { useErrorModal } from '@/context/ErrorModalContext';
import InlineErrorBanner from '@/components/InlineErrorBanner';
import { StructuredIngredient } from '@/api/types';
import { abbreviateUnit } from '@/utils/format';

export default function StepsScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  const { showError } = useErrorModal();
  
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<StructuredIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<{[key: number]: boolean}>({});
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState(false);
  const [initialToolToShow, setInitialToolToShow] = useState<ActiveTool>(null);
  const [isHeaderToolsVisible, setIsHeaderToolsVisible] = useState(false);
  
  // --- Tooltip State ---
  const [selectedIngredient, setSelectedIngredient] = useState<StructuredIngredient | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  // --- End Tooltip State ---

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
          ingredients?: StructuredIngredient[] | null;
        };

        if (parsedData.instructions && Array.isArray(parsedData.instructions)) {
            setInstructions(parsedData.instructions);
        } else {
            console.warn("[StepsScreen] Instructions missing or not an array in recipeData.");
            setInstructions([]); 
        }
        
        setRecipeTitle(parsedData.title || 'Instructions'); 

        if (parsedData.ingredients && Array.isArray(parsedData.ingredients)) {
          setIngredients(parsedData.ingredients);
        }

      } else {
        showError({
          title: "Error Loading Steps",
          message: "Recipe data was not provided. Please go back and try again."
        });
        setInstructions([]);
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

  // --- Ingredient Tooltip Logic ---
  const handleIngredientPress = (ingredient: StructuredIngredient) => {
    setSelectedIngredient(ingredient);
    setIsTooltipVisible(true);
  };

  const escapeRegex = (string: string) => {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  const renderHighlightedInstruction = (step: string, isCompleted: boolean, isActive: boolean) => {
    if (!ingredients || ingredients.length === 0) {
      return (
        <Text style={[styles.stepText, isCompleted && styles.stepTextCompleted, isActive && styles.activeStepText]}>
          {step}
        </Text>
      );
    }

    const searchTermsWithIng = ingredients.flatMap(ing => {
      const baseName = ing.name.split(' (substituted for')[0].trim();
      if (!baseName) return [];

      const terms = new Set<string>();
      terms.add(baseName);

      const words = baseName.split(' ');
      if (words.length > 1) {
        words.forEach(word => {
          if (word.length > 3) {
            terms.add(word);
          }
        });
      }

      const finalTerms = new Set<string>(terms);
      terms.forEach(term => {
        const lowerTerm = term.toLowerCase();
        if (lowerTerm.endsWith('s')) {
          finalTerms.add(term.slice(0, -1));
        } else {
          if (!term.includes(' ')) {
            finalTerms.add(term + 's');
          }
        }
      });
      
      return Array.from(finalTerms).map(term => ({ ingredient: ing, searchTerm: term }));
    })
    .filter(item => item.searchTerm);

    const uniqueSearchTermItems = Array.from(new Map(searchTermsWithIng.map(item => [item.searchTerm.toLowerCase(), item])).values());
    uniqueSearchTermItems.sort((a, b) => b.searchTerm.length - a.searchTerm.length);

    if (uniqueSearchTermItems.length === 0) {
      return <Text style={[styles.stepText, isCompleted && styles.stepTextCompleted, isActive && styles.activeStepText]}>{step}</Text>;
    }

    const regex = new RegExp(`(${uniqueSearchTermItems.map(item => escapeRegex(item.searchTerm)).join('|')})`, 'gi');
    const parts = step.split(regex);

    return (
      <Text style={[styles.stepText, isCompleted && styles.stepTextCompleted, isActive && styles.activeStepText]}>
        {parts.filter(part => part).map((part, index) => {
          const matchedItem = uniqueSearchTermItems.find(item => item.searchTerm.toLowerCase() === part.toLowerCase());
          if (matchedItem) {
            return (
              <Text
                key={index}
                style={[styles.highlightedText, isCompleted && styles.stepTextCompleted]}
                onPress={!isCompleted ? () => handleIngredientPress(matchedItem.ingredient) : undefined}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };
  // --- End Ingredient Tooltip Logic ---

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

  const firstUncompletedIndex = instructions.findIndex((_, index) => !completedSteps[index]);
  const activeStepIndex = firstUncompletedIndex === -1 ? null : firstUncompletedIndex;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolsButton} onPress={() => setIsHeaderToolsVisible(true)}>
            <MaterialCommunityIcons name="tools" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      </Animated.View>
      
      <Modal
        transparent
        visible={isHeaderToolsVisible}
        animationType="fade"
        onRequestClose={() => setIsHeaderToolsVisible(false)}
      >
        <Pressable style={styles.headerToolsBackdrop} onPress={() => setIsHeaderToolsVisible(false)}>
          <View style={styles.headerToolsContainer}>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('timer');
              }}
            >
              <MaterialCommunityIcons name="timer-outline" size={24} color={COLORS.textDark} />
              <Text style={styles.headerToolButtonText}>Timer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('units');
              }}
            >
              <MaterialCommunityIcons name="ruler" size={24} color={COLORS.textDark} />
              <Text style={styles.headerToolButtonText}>Units</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerToolButton}
              onPress={() => {
                setIsHeaderToolsVisible(false);
                openToolsModal('help');
              }}
            >
              <MaterialCommunityIcons name="help-circle-outline" size={24} color={COLORS.textDark} />
              <Text style={styles.headerToolButtonText}>Help</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {recipeTitle && (
        <Text style={styles.pageTitle}>{recipeTitle}</Text>
      )}

      <ScrollView 
        style={styles.stepsContainer}
        showsVerticalScrollIndicator={false}
      >
        {instructions.length > 0 ? (
            instructions.map((step, index) => (
              <TouchableOpacity
                key={`step-${index}`}
                onPress={() => toggleStepCompleted(index)}
                activeOpacity={0.6}
              >
                <Animated.View
                  entering={FadeInUp.delay(index * 50).duration(300)}
                  style={[
                    styles.stepItem,
                    index === activeStepIndex && styles.activeStep
                  ]}
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
                    {index < instructions.length - 1 && !completedSteps[index] && (
                      <View style={styles.stepConnector} />
                    )}
                  </View>
                  
                  <View style={styles.stepContent}>
                    {renderHighlightedInstruction(step, !!completedSteps[index], index === activeStepIndex)}
                  </View>
                </Animated.View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.centeredStatusContainerForBanner}> 
              <InlineErrorBanner 
                message="Could not load recipe steps. Data might be missing or invalid."
                showGoBackButton={true}
              />
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
      />

      {!isToolsPanelVisible && isTimerActive && timerTimeRemaining > 0 && (
          <MiniTimerDisplay 
              timeRemaining={timerTimeRemaining} 
              formatTime={formatTime} 
              onPress={handleMiniTimerPress}
          />
      )}

      <Modal
        transparent
        visible={isTooltipVisible}
        animationType="fade"
        onRequestClose={() => setIsTooltipVisible(false)}
      >
        <Pressable style={styles.tooltipBackdrop} onPress={() => setIsTooltipVisible(false)}>
          <Pressable style={styles.tooltipContainer}>
            {selectedIngredient && (
              <>
                <Text style={styles.tooltipTitle}>{selectedIngredient.name}</Text>
                {(selectedIngredient.amount || selectedIngredient.unit) && (
                  <Text style={styles.tooltipText}>
                    {selectedIngredient.amount || ''} {abbreviateUnit(selectedIngredient.unit || '')}
                  </Text>
                )}
                {selectedIngredient.preparation && (
                   <Text style={styles.tooltipPreparationText}>{selectedIngredient.preparation}</Text>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
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
    marginBottom: 15,
    alignItems: 'flex-start',
    padding: 5,
    borderRadius: 10,
  },
  activeStep: {
    transform: [{ scale: 1.02 }],
    backgroundColor: 'rgba(0,0,0,0.04)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
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
  activeStepText: {
    fontSize: 18,
    lineHeight: 26,
  },
  highlightedText: {
    fontFamily: 'Poppins-SemiBold',
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
  toolsButton: {
    padding: 8,
  },
  headerToolsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  headerToolsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 82 : 48,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  headerToolButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
    marginLeft: 12,
  },
  // --- Tooltip Styles ---
  tooltipBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  tooltipContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  tooltipPreparationText: {
    fontFamily: 'Poppins-Italic',
    fontSize: 14,
    color: COLORS.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
});