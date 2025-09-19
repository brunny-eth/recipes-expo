import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { FONT, screenTitleText, bodyText, bodyStrongText } from '@/constants/typography';
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
    videoSource: require('@/assets/videos/FirstScreen.mp4'),
  },
  {
    id: 2,
    title: "Remix to your taste",
    description: "Use the prep station to prepare for cooking multiple meals at once",
    videoSource: require('@/assets/videos/SecondScreen.mp4'),
  },
  {
    id: 3,
    title: "Make multiple meals",
    description: "Multi-recipe cooking \n made easy",
    videoSource: require('@/assets/videos/ThirdScreen.mp4'),
  },
  {
    id: 4,
    title: "Follow steps easily",
    description: "Build your recipe library and explore community favorites",
    videoSource: require('@/assets/videos/FourthScreen.mp4'),
  }
];

export default function OnboardingScreen({ onComplete, onBack }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSwiping, setIsSwiping] = useState(false);
  const currentStepData = onboardingSteps[currentStep - 1];
  const translateX = useSharedValue(0);
  const { track } = useAnalytics();
  const { width } = useWindowDimensions();
  
  // iPad detection: consider iPad if width is greater than 768px
  // This ensures iPhone layouts remain unchanged while fixing iPad display
  const isIpad = width > 768;

  // Create video player for current step
  const videoPlayer = useVideoPlayer(currentStepData.videoSource || '', player => {
    if (currentStepData.videoSource) {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  });

  // Update video when step changes
  useEffect(() => {
    const updateVideo = async () => {
      if (currentStepData.videoSource) {
        try {
          await videoPlayer.replaceAsync(currentStepData.videoSource);
          videoPlayer.loop = true;
          videoPlayer.muted = true;
          videoPlayer.play();
        } catch (error) {
          console.warn('Failed to replace video:', error);
        }
      }
    };

    updateVideo();
  }, [currentStep, videoPlayer, currentStepData.videoSource]);

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
            <Animated.View style={[styles.content, animatedStyle, isIpad ? styles.ipadContent : {}]}>
                {/* Text Content - now above the GIF */}
                <Animated.View
                  key={`text-${currentStep}`}
                  entering={FadeIn.duration(600).delay(200)}
                  style={styles.textContent}
                >
                  <Text style={styles.stepTitle}>{currentStepData.title}</Text>
                </Animated.View>

                {/* Video Container - now below the text */}
                <View style={styles.videoContainer}>
                  {currentStepData.videoSource ? (
                    <VideoView
                      player={videoPlayer}
                      style={styles.video}
                      contentFit="cover"
                      allowsFullscreen={false}
                      allowsPictureInPicture={false}
                    />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Text style={styles.placeholderText}>
                        VIDEO {currentStep}{'\n'}
                        ({currentStepData.title}){'\n'}
                        {currentStepData.videoSource ? 'VIDEO LOADED' : 'WAITING FOR MP4'}
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
                        entering={FadeIn.duration(800).delay(1500)}
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
  // iPad-specific content styling for proper centering and max width
  ipadContent: {
    alignSelf: 'center',
    maxWidth: 500, // Reasonable max width for iPad content
    width: '100%',
    paddingHorizontal: SPACING.xl, // Extra horizontal padding for iPad
  },
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
    alignItems: 'center', // Center the video container horizontally
  },
  videoContainer: {
    alignItems: 'center',
    marginTop: 10, // Further reduced to maximize GIF container size
    marginBottom: 20, // Add bottom padding between video and step indicators
    overflow: 'visible', // Allow bleed to show
  },
  videoPlaceholder: {
    width: '90%',
    maxWidth: 360, // Prevent exploding on tablets
    aspectRatio: 9 / 16, // iPhone portrait aspect ratio
    backgroundColor: '#f5f5f5',
    borderRadius: 0, // Rectangular edges
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1, // Thin border
    borderColor: '#000000', // Black border
    borderStyle: 'solid', // Solid border for cleaner look
    overflow: 'hidden', // Clean cropping
  },
  video: {
    width: '90%',
    maxWidth: 360, // Prevent exploding on tablets
    aspectRatio: 9 / 16, // iPhone portrait aspect ratio
    borderRadius: 0, // Rectangular edges
    borderWidth: 1, // Thin border
    borderColor: '#000000', // Black border
    // Tiny overscan to hide 0.5px seams from rounding - increased for visibility
    transform: [{ scale: 1.08 }],
  },
  controlsContainer: {
    flex: 1, // Restored to balance layout with fixed aspect ratio video container
    justifyContent: 'center',
    marginTop: 10, // Reduced from 20 to maximize GIF container size
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
    marginBottom: 15, // Reduced from 30 to maximize GIF container size
    gap: 10,
  },
  buttonArea: {
    alignItems: 'center',
    minHeight: 60, // Reduced from 80 to maximize GIF container size
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary, // Blue for inactive dots
  },
  stepDotActive: {
    backgroundColor: COLORS.lightGray, // Grey for active dot
  },
  textContent: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15, // Further reduced since no description text
    marginTop: 25, // Adjusted for cleaner spacing with title only
  },
  stepTitle: {
    ...screenTitleText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 25, // Add more space between title and video container
  },
  stepDescription: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
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
    backgroundColor: COLORS.primary, // Blue primary button
    borderWidth: 1,
    borderColor: '#000000', // Black border
    borderRadius: 8, // Match button consistency
    paddingHorizontal: SPACING.lg, // Match modal button padding
    alignItems: 'center',
    justifyContent: 'center',
    height: 46, // Match button height consistency
    marginHorizontal: SPACING.lg,
  },
  startButtonText: {
    ...bodyText, // Match modal button text style
    fontSize: FONT.size.body, // 16px consistency
    color: '#000000', // Black text on blue background
    textAlign: 'center',
  },
});