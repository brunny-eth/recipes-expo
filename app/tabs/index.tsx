import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Image,
  SafeAreaView,
  ActivityIndicator,
  InteractionManager,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
} from '@/constants/theme';
import { useErrorModal } from '@/context/ErrorModalContext';
import {
  bodyText,
  bodyStrongText,
  FONT,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import LogoHeader from '@/components/LogoHeader';
import RecipeMatchSelectionModal from '@/components/RecipeMatchSelectionModal';
import { CombinedParsedRecipe } from '@/common/types';
import { useRecipeSubmission } from '@/hooks/useRecipeSubmission';
import { detectInputType } from '../../server/utils/detectInputType';

// Custom hook for interval management
const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [showMatchSelectionModal, setShowMatchSelectionModal] = useState(false);
  const [potentialMatches, setPotentialMatches] = useState<{ recipe: CombinedParsedRecipe; similarity: number; }[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();
  const { showError, hideError } = useErrorModal();
  const { session } = useAuth();
  
  // Use the new submission hook
  const {
    submitRecipe,
    isSubmitting,
    submissionState,
    clearState
  } = useRecipeSubmission();
  
  // Animation for smooth fade-in to mask layout jitter
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Logo animation - slide down + fade in
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(-30)).current;

  // Placeholder rotation state
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(false);

  const firstPrompt = "Try 'mac and cheese' or 'www...'";

  // Typewriter effect for placeholder
  const typewriterEffect = useCallback((text: string, onComplete?: () => void) => {
    setIsTypingPlaceholder(true);
    setDisplayedPlaceholder('');
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedPlaceholder(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsTypingPlaceholder(false);
        onComplete?.();
      }
    }, 60); // 50ms per character for smooth typewriter effect

    return () => clearInterval(interval);
  }, []);

  // On mount, typewriter animate first prompt after a short delay, and keep it until first focus
  useEffect(() => {
    let typewriterTimeout: NodeJS.Timeout;
    setDisplayedPlaceholder(""); // Start with empty placeholder
    typewriterTimeout = setTimeout(() => {
      typewriterEffect(firstPrompt);
    }, 2500); // 2500ms initial delay
    return () => clearTimeout(typewriterTimeout);
  }, []);

  // Keyboard listeners (only track visible state for possible future use)
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);



  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[HomeScreen] Component DID MOUNT');
    
    // Stage 1: Logo slides down and fades in (starts immediately)
    const logoTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700, // Slower, more elegant logo animation
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 700, // Slower, more elegant logo animation
          useNativeDriver: true,
        }),
      ]).start();
    }, 50); // Small delay for initial render
    
    // Stage 2: Content fades in after logo finishes
    const contentTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900, // Slower, more luxurious content fade-in
        useNativeDriver: true,
      }).start();
    }, 750); // Logo animation (700ms) + small gap (50ms)
    
    return () => {
      console.log('[HomeScreen] Component WILL UNMOUNT');
      clearTimeout(logoTimer);
      clearTimeout(contentTimer);
    };
  }, [fadeAnim, logoOpacity, logoTranslateY]);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] 🎯 useFocusEffect triggered');
      console.log('[HomeScreen] 👁️ Screen focused');

      return () => {
        console.log('[HomeScreen] 🌀 useFocusEffect cleanup');
        console.log('[HomeScreen] 🌀 Screen is blurring (not necessarily unmounting)');
        // Clear submission state when leaving screen
        clearState();
      };
    }, [clearState])
  );

  const handleMatchSelectionAction = useCallback((action: 'select' | 'createNew' | 'returnHome', selectedRecipeId?: string) => {
    setShowMatchSelectionModal(false); // Always dismiss the modal first

    if (action === 'select' && selectedRecipeId) {
      // Find the selected recipe from potentialMatches using the selectedRecipeId
      const selectedMatch = potentialMatches.find(match => 
        match.recipe.id?.toString() === selectedRecipeId
      );
      
      if (selectedMatch) {
        router.push({
          pathname: '/recipe/summary',
          params: {
            recipeData: JSON.stringify(selectedMatch.recipe),
            entryPoint: 'new',
            from: '/tabs',
          },
        });
        console.log('[HomeScreen] User selected from modal, routing to recipe:', selectedMatch.recipe.title);
      } else {
        console.error('[HomeScreen] Could not find selected recipe in potentialMatches:', selectedRecipeId);
        showError('Navigation Error', 'Could not load the selected recipe. Please try again.');
      }
    } else if (action === 'createNew') {
      console.log('[Home] User chose to create new. Navigating to loading for new parse.');
      router.push({
        pathname: '/loading',
        params: {
          recipeUrl: recipeUrl,
          forceNewParse: 'true',
        },
      });
    } else if (action === 'returnHome') {
      // Clear input and stay on home screen
      setRecipeUrl('');
      console.log('[HomeScreen] User opted to return to home, clearing input.');
    }
  }, [potentialMatches, router, showError, recipeUrl]);

  // Replace isValidRecipeInput with a function that uses detectInputType
  function isValidRecipeInput(input: string) {
    const trimmed = input.trim();
    const detectedType = detectInputType(trimmed);
    // Accept if it's a valid URL, video, or valid text
    return detectedType === 'url' || detectedType === 'video' || detectedType === 'raw_text';
  }

  const handleSubmit = async () => {
    if (!recipeUrl || recipeUrl.trim() === '') {
      showError(
        'Input Required',
        'Add a recipe link or dish name.\n\nLooking for ideas? Head to the Explore tab to see what others are cooking.',
        undefined,
        undefined,
        'Go to Library',
        () => {
          hideError();
          router.push('/tabs/library');
        }
      );
      setRecipeUrl(''); // Clear the input bar on error
      return;
    }
    // --- New client-side validation ---
    if (!isValidRecipeInput(recipeUrl)) {
      showError(
        'Input Not Recognized',
        'Please enter a real dish name (like "chicken soup" or "tomato pasta") or a recipe link',
        undefined,
        undefined,
        'Go to Library',
        () => {
          hideError();
          router.push('/tabs/library');
        }
      );
      setRecipeUrl('');
      return;
    }

    const recipeInput = recipeUrl.trim();

    // Users must be authenticated to use the app
    if (!session) {
      showError(
        'Login Required',
        'Please log in to continue using the app.',
        () => router.replace('/login'),
      );
      setRecipeUrl('');
      return;
    }

    try {
      console.log('[HomeScreen] Starting submission with:', {
        inputLength: recipeInput.length,
        inputType: detectInputType(recipeInput),
      });

      const result = await submitRecipe(recipeInput);
      console.log('[HomeScreen] handleSubmit: Result from submitRecipe:', JSON.stringify(result)); // NEW LOG
      
      if (!result.success) {
        if (result.action === 'show_validation_error' && result.error) {
          showError('Validation Error', result.error);
        }
        return;
      }

      if (result.action === 'show_match_modal' && result.matches) {
        // Show the match selection modal
        setPotentialMatches(result.matches);
        setShowMatchSelectionModal(true);
        console.log('[HomeScreen] Multiple matches found, showing selection modal.');
      } else if (result.action === 'navigate_to_summary' && result.recipe) {
        // Navigate to summary with cached recipe
        console.log('[HomeScreen] Recipe submitted successfully - navigating to summary');
        InteractionManager.runAfterInteractions(() => {
          router.push({
            pathname: '/recipe/summary',
            params: {
              recipeData: JSON.stringify(result.recipe),
              entryPoint: 'new',
              from: '/tabs',
            },
          });
        });
        setRecipeUrl(''); // Clear input after successful submission
      } else if (result.action === 'navigate_to_loading' && result.normalizedUrl) {
        // Navigate to loading with normalized URL
        console.log('[HomeScreen] Recipe submitted successfully - navigating to loading with normalized URL');
        InteractionManager.runAfterInteractions(() => {
                  router.push({
          pathname: '/loading',
          params: { 
            recipeUrl: result.normalizedUrl,
            inputType: result.inputType
          },
        });
        });
        setRecipeUrl(''); // Clear input after successful submission
      }
    } catch (error) {
      console.error('[HomeScreen] Submission error:', error);
      showError('Recipe Submission Failed', 'Something went wrong while submitting your recipe. Please try again, and if the problem continues, try pasting the recipe text instead of a URL.');
    }
  };

  const [hasUserTyped, setHasUserTyped] = useState(false);

  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  // Track if user has typed
  const handleChangeText = (text: string) => {
    setRecipeUrl(text);
    if (text.length > 0 && !hasUserTyped) {
      setHasUserTyped(true);
    }
  };

  // Placeholder logic - show first prompt until user starts typing
  let placeholder = '';
  if (hasUserTyped) {
    placeholder = '';
  } else {
    placeholder = displayedPlaceholder;
  }

  // Memoized animated logo component to prevent recreation on re-renders
  const animatedLogo = useMemo(() => (
    <Animated.View
      style={{
        opacity: logoOpacity,
        transform: [{ translateY: logoTranslateY }],
      }}
    >
      <Image
        source={require('@/assets/images/meezblue_underline.png')}
        resizeMode="contain"
        style={{
          width: 400,
          height: 200,
          alignSelf: 'center',
        }}
      />
    </Animated.View>
  ), [logoOpacity, logoTranslateY]); // Only recreate if animation values change

  // Get appropriate button text based on submission state
  const getSubmitButtonContent = () => {
    if (submissionState === 'validating') {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    } else if (submissionState === 'checking_cache') {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    } else if (submissionState === 'parsing') {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    } else if (submissionState === 'navigating') {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    } else {
      return <Text style={styles.submitButtonText}>Go</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Static logo header - memoized to prevent re-renders on input changes */}
      <LogoHeader animatedLogo={animatedLogo} />
      
      {/* Dynamic content that can re-render without affecting the logo */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <View style={styles.contentContainer}>
            <View style={styles.headerContainer}>
              <View style={{ width: '90%', maxWidth: 340, alignSelf: 'center' }}>
                <Text style={styles.mainFeatureText}>Meez helps you prep and cook without clutter
                </Text>
              </View>
            </View>
            <View style={styles.secondaryTextContainer}>
              <View style={{ width: '90%', maxWidth: 340, alignSelf: 'center' }}>
                <Text style={styles.subheadingText}>
                  Paste a link or recipe idea to get started
                </Text>
              </View>
            </View>
          </View>

          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={60}
          >
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <View style={styles.textInputWrapper}>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => {
                      /* TODO */
                    }}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={ICON_SIZE.md}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.darkGray}
                    value={recipeUrl}
                    onChangeText={handleChangeText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleSubmit}
                    editable={!isSubmitting}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {getSubmitButtonContent()}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
      
      {/* Recipe Match Selection Modal */}
      {showMatchSelectionModal && (
        <RecipeMatchSelectionModal
          visible={showMatchSelectionModal}
          matches={potentialMatches}
          onAction={handleMatchSelectionAction}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    marginTop: SPACING.xxs,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
    maxWidth: 365,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: -SPACING.lg,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    paddingHorizontal: SPACING.lg,
  },
  inputSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 240,
  },
  mainFeatureText: {
    fontFamily: FONT.family.interSemiBold,
    fontSize: 26,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subheadingText: {
    fontFamily: FONT.family.inter,
    fontSize: 18, // slightly larger than before
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: SPACING.xxs, 
    marginBottom: SPACING.lg, 
    lineHeight: 24,
  },
  secondaryTextContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    maxWidth: 365,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
  },
  secondaryText: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.body + 2,
    color: COLORS.darkGray,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
    marginTop: 20,
  },
  textInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
    borderRightWidth: 0,
    borderTopLeftRadius: RADIUS.sm,
    borderBottomLeftRadius: RADIUS.sm,
  },
  input: {
    ...bodyText,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.base,
    color: COLORS.textDark,
    fontSize: FONT.size.smBody,
    lineHeight: undefined,
  },
  submitButton: {
    height: '100%',
    width: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  submitButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  divider: {
    width: BORDER_WIDTH.default,
    height: '100%',
    backgroundColor: COLORS.lightGray,
  },
});