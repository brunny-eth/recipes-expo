import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { COLORS } from '@/constants/theme';
import { FONT } from '@/constants/typography';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useState, useEffect } from 'react';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAnalytics } from '@/utils/analytics';

const { width: screenWidth } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const onboardingSteps = [
  {
    id: 1,
    title: "Transform any recipe",
    description: "Turn messy recipes into clean, customizable formats",
    gifSource: require('@/assets/gifs/FirstScreen.gif'),
  },
  {
    id: 2,
    title: "Prep and cook with ease",
    description: "Use the prep station to prepare for cooking multiple meals at once",
    gifSource: require('@/assets/gifs/SecondScreen.gif'),
  },
  {
    id: 3,
    title: "Make multiple meals",
    description: "Multi-recipe cooking \n made easy",
    gifSource: require('@/assets/gifs/ThirdScreen.gif'),
  },
  {
    id: 4,
    title: "Save and discover",
    description: "Build your recipe library and explore community favorites",
    gifSource: require('@/assets/gifs/FourthScreen.gif'),
  }
];

export default function OnboardingScreen({ onComplete, onBack }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSwiping, setIsSwiping] = useState(false);
  const currentStepData = onboardingSteps[currentStep - 1];
  const translateX = useSharedValue(0);
  const { track } = useAnalytics();

  // Preload all onboarding GIFs for smooth playback
  useEffect(() => {
    const preloadGifs = async () => {
      try {
        await FastImage.preload([
          require('@/assets/gifs/FirstScreen.gif'),
          require('@/assets/gifs/SecondScreen.gif'),
          require('@/assets/gifs/ThirdScreen.gif'),
          require('@/assets/gifs/FourthScreen.gif'),
        ]);
      } catch (error) {
        console.warn('Failed to preload onboarding GIFs:', error);
      }
    };
    
    preloadGifs();
  }, []);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (isSwiping) return; // Prevent multiple swipes
    
    setIsSwiping(true);
    if (direction === 'right' && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (direction === 'left' && currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
    
    // Reset swipe state after animation
    setTimeout(() => setIsSwiping(false), 500);
  };

  const onSwipeGesture = (event: any) => {
    const { translationX, velocityX } = event.nativeEvent;
    
    // Increased thresholds for less sensitivity
    const translationThreshold = 100; // Increased from 50
    const velocityThreshold = 800; // Increased from 500
    
    if (Math.abs(translationX) > translationThreshold || Math.abs(velocityX) > velocityThreshold) {
      if (translationX > 0 && currentStep > 1 && !isSwiping) {
        runOnJS(handleSwipe)('left');
      } else if (translationX < 0 && currentStep < 4 && !isSwiping) {
        runOnJS(handleSwipe)('right');
      }
    }
    
    translateX.value = withSpring(0);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View
        style={styles.container}
        entering={FadeIn.duration(800)}
        exiting={FadeOut.duration(600)}
      >
        <SafeAreaView style={styles.safeArea}>
          <PanGestureHandler onGestureEvent={onSwipeGesture}>
            <Animated.View style={[styles.content, animatedStyle]}>
              {/* Text Content - now above the GIF */}
              <Animated.View
                key={`text-${currentStep}`}
                entering={FadeIn.duration(600).delay(200)}
                style={styles.textContent}
              >
                <Text style={styles.stepTitle}>{currentStepData.title}</Text>
                <Text
                  style={styles.stepDescription}
                >{currentStepData.description}</Text>
              </Animated.View>

              {/* GIF Container - now below the text */}
              <View style={styles.videoContainer}>
                {currentStepData.gifSource ? (
                  <FastImage
                    source={currentStepData.gifSource}
                    style={styles.gifImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.gifPlaceholder}>
                    <Text style={styles.placeholderText}>
                      GIF {currentStep}{'\n'}
                      ({currentStepData.title})
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom controls container */}
              <View style={styles.controlsContainer}>
                {/* Step indicator - fixed position */}
                <View style={styles.stepIndicator}>
                  {onboardingSteps.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.stepDot,
                        index + 1 === currentStep && styles.stepDotActive,
                      ]}
                    />
                  ))}
                </View>

                {/* Button area - separate from step indicator */}
                <View style={styles.buttonArea}>
                  {/* Start Cooking button - only on step 4 */}
                  {currentStep === 4 ? (
                    <Animated.View 
                      style={styles.buttonContainer}
                      entering={FadeIn.duration(800).delay(3000)}
                    >
                      <TouchableOpacity
                        style={styles.startButton}
                        onPress={async () => {
                          try {
                            // Track tutorial completion event
                            await track('tutorial_completed', { method: 'onboarding' });
                          } catch (error) {
                            console.error('Failed to track tutorial completion:', error);
                          }
                          // Always call onComplete, even if tracking fails
                          onComplete();
                        }}
                      >
                        <Text style={styles.startButtonText}>Start Cooking</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ) : (
                    // Empty space to maintain consistent layout
                    <View style={styles.buttonPlaceholder} />
                  )}
                </View>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </SafeAreaView>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
  },
  videoContainer: {
    flex: 4, // Reduced from 5 since text is now above
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20, // Reduced margin since text is above
  },
  gifPlaceholder: {
    width: '100%',
    height: '100%', // Changed from 90%
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  gifImage: {
    width: '100%',
    height: '110%', // Changed from 90%
    borderRadius: 20,
    resizeMode: 'stretch',
    borderWidth: 2,
    borderColor: '#5C6B73',
  },
  controlsContainer: {
    flex: 2, // Decreased from 3 to give more space to GIF
    justifyContent: 'center',
    marginTop: 20, // Add top margin to push controls down
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
    fontFamily: FONT.family.inter,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30, 
    gap: 10,
  },
  buttonArea: {
    alignItems: 'center',
    minHeight: 80, // Fixed height to maintain consistent spacing
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lightGray,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  textContent: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: FONT.family.ubuntu,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  buttonPlaceholder: {
    height: 50,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '80%', // Reduced from 100% to make it less wide
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    height: 60, // Increased from 50 to make it taller
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONT.family.interSemiBold,
  },
});