import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Animated,
  Image,
  SafeAreaView,
  ActivityIndicator,
  InteractionManager,
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
import RecipePDFImageUploader, { UploadResult } from '@/components/RecipePDFImageUploader';
import UploadRecipeModal from '@/components/UploadRecipeModal';
import { CombinedParsedRecipe } from '@/common/types';
import { useRecipeSubmission } from '@/hooks/useRecipeSubmission';
import { detectInputType } from '../../server/utils/detectInputType';
import { useAnalytics } from '@/utils/analytics';
import { useRenderCounter } from '@/hooks/useRenderCounter';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const { session } = useAuth();
  useRenderCounter('HomeScreen', { hasSession: !!session });
  
  // Debug: Log recipeUrl state changes
  useEffect(() => {
    if (__DEV__) {
      console.log('[UI] 🔍 recipeUrl state changed:', { value: recipeUrl, type: typeof recipeUrl, length: recipeUrl?.length });
    }
  }, [recipeUrl]);
  const [showMatchSelectionModal, setShowMatchSelectionModal] = useState(false);
  const [potentialMatches, setPotentialMatches] = useState<{ recipe: CombinedParsedRecipe; similarity: number; }[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const uploaderRef = useRef<any>(null);
  const router = useRouter();
  const { showError, hideError } = useErrorModal();
  const { track } = useAnalytics();
  
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
      clearTimeout(logoTimer);
      clearTimeout(contentTimer);
    };
  }, [fadeAnim, logoOpacity, logoTranslateY]);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      return () => {
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
        match.recipe.id === Number(selectedRecipeId)
      );
      
      if (selectedMatch) {
        router.push({
          pathname: '/recipe/summary',
          params: {
            recipeData: JSON.stringify(selectedMatch.recipe),
            entryPoint: 'new',
            from: '/tabs',
            inputType: 'raw_text', // Recipe matches are from text input
          },
        });
        track('recipe_selected_from_modal', {
          recipeId: selectedMatch.recipe.id,
          recipeTitle: selectedMatch.recipe.title,
          userId: session?.user?.id,
        });
      } else {
        console.error('[HomeScreen] Could not find selected recipe in potentialMatches:', selectedRecipeId);
        showError('Navigation Error', 'Could not load the selected recipe. Please try again.');
      }
    } else if (action === 'createNew') {
      track('recipe_create_new_selected', {
        recipeUrl: recipeUrl,
        userId: session?.user?.id,
      });
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
      track('recipe_modal_return_home', {
        userId: session?.user?.id,
      });
    }
  }, [potentialMatches, router, showError, recipeUrl, track, session?.user?.id]);

  // Replace isValidRecipeInput with a function that uses detectInputType
  function isValidRecipeInput(input: string) {
    const trimmed = input.trim();
    const detectedType = detectInputType(trimmed);
    // Accept if it's a valid URL, video, or valid text
    return detectedType === 'url' || detectedType === 'video' || detectedType === 'raw_text';
  }

  const handleSubmit = async () => {
    if (__DEV__) {
      console.log('[DEBUG] handleSubmit – START');
      console.log('[UI] 🚀 Submit button pressed with value:', recipeUrl);
      console.log('[UI] 🚀 Submit button pressed - recipeUrl type:', typeof recipeUrl);
      console.log('[UI] 🚀 Submit button pressed - recipeUrl length:', recipeUrl?.length);
    }
    
    try {
      // Temporary debug: Test PostHog directly
      if (__DEV__) {
        console.log('[DEBUG] Testing PostHog directly...');
        try {
          await track('debug_test', { test: true, timestamp: Date.now() });
          console.log('[DEBUG] PostHog test call succeeded');
        } catch (err) {
          console.error('[POSTHOG] Test call failed:', err);
        }
      }
    if (__DEV__) {
      console.log('[UI] 🔍 Checking if recipeUrl is empty...');
    }
    if (!recipeUrl || recipeUrl.trim() === '') {
      if (__DEV__) {
        console.log('[UI] ❌ recipeUrl is empty, showing error');
      }
      showError(
        'Input Required',
        'Add a recipe to get started.\n\nLooking for ideas? Head to the Explore tab.',
        undefined,
        undefined,
        'Go to Explore',
        () => {
          hideError();
          router.push('/tabs/library');
        }
      );
      setRecipeUrl(''); // Clear the input bar on error
      return;
    }
    if (__DEV__) {
      console.log('[UI] ✅ recipeUrl is not empty, continuing...');
    }
    // --- New client-side validation ---
    if (__DEV__) {
      console.log('[UI] 🔍 Running input validation...');
    }
    if (!isValidRecipeInput(recipeUrl)) {
      if (__DEV__) {
        console.log('[UI] ❌ Input validation failed');
      }
      showError(
        'Input Not Recognized',
        'Please enter a real dish name (like "chicken soup" or "tomato pasta") or a recipe link',
        undefined,
        undefined,
        'Go to Explore',
        () => {
          hideError();
          router.push('/tabs/library');
        }
      );
      setRecipeUrl('');
      return;
    }
    if (__DEV__) {
      console.log('[UI] ✅ Input validation passed');
    }

    const recipeInput = recipeUrl.trim();

    // Users must be authenticated to use the app
    if (__DEV__) {
      console.log('[UI] 🔍 Checking authentication...');
    }
    if (!session) {
      if (__DEV__) {
        console.log('[UI] ❌ No session found, showing login error');
      }
      showError(
        'Login Required',
        'Please log in to continue using the app.',
        () => router.replace('/login'),
      );
      setRecipeUrl('');
      return;
    }
    if (__DEV__) {
      console.log('[UI] ✅ User is authenticated');
    }

    // Generate submission ID for tracking
    const submissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      if (__DEV__) {
        console.log('[UI] 🚀 Starting recipe submission process...');
      }
      // Track input mode selection
      const inputType = detectInputType(recipeInput);
      if (__DEV__) {
        console.log('[UI] 🔍 Detected input type:', inputType);
      }
      if (__DEV__) {
        console.log('[POSTHOG] Tracking event: input_mode_selected', { inputType });
      }
      try {
        await track('input_mode_selected', { inputType });
        if (__DEV__) {
          console.log('[POSTHOG] input_mode_selected tracking succeeded');
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[POSTHOG] input_mode_selected tracking failed:', err);
        }
      }
      
      console.log('[POSTHOG] Tracking event: recipe_submission_started', {
        inputLength: recipeInput.length,
        inputType: inputType,
        submissionId,
        userId: session?.user?.id,
      });
      try {
        await track('recipe_submission_started', {
          inputLength: recipeInput.length,
          inputType: inputType,
          submissionId,
          userId: session?.user?.id,
        });
        console.log('[POSTHOG] recipe_submission_started tracking succeeded');
      } catch (err) {
        console.error('[POSTHOG] recipe_submission_started tracking failed:', err);
      }

      console.log('[UI] 🚀 Calling submitRecipe with:', recipeInput);
      const result = await submitRecipe(recipeInput);
      console.log('[UI] ✅ submitRecipe completed with result:', result);
      
      console.log('[POSTHOG] Tracking event: recipe_submission_result', {
        success: result.success,
        action: result.action,
        error: result.error,
        matches_count: result.matches?.length,
        recipeId: result.recipe?.id,
        normalizedUrl: result.normalizedUrl,
        inputType: result.inputType,
        submissionId,
        userId: session?.user?.id,
      });
      try {
        await track('recipe_submission_result', {
          success: result.success,
          action: result.action,
          error: result.error,
          matches_count: result.matches?.length,
          recipeId: result.recipe?.id,
          normalizedUrl: result.normalizedUrl,
          inputType: result.inputType,
          submissionId,
          userId: session?.user?.id,
        });
        console.log('[POSTHOG] recipe_submission_result tracking succeeded');
      } catch (err) {
        console.error('[POSTHOG] recipe_submission_result tracking failed:', err);
      }
      
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
        track('recipe_matches_found', {
          match_count: result.matches.length,
          submissionId,
          userId: session?.user?.id,
        });
      } else if (result.action === 'navigate_to_summary' && result.recipe) {
        // Navigate to summary with cached recipe
        track('navigation_to_recipe_summary', {
          recipeId: result.recipe.id,
          entryPoint: 'new',
          submissionId,
          userId: session?.user?.id,
        });
        InteractionManager.runAfterInteractions(() => {
          router.push({
            pathname: '/recipe/summary',
            params: {
              recipeData: JSON.stringify(result.recipe),
              entryPoint: 'new',
              from: '/tabs',
              inputType: result.inputType || detectInputType(recipeInput), // Use the result inputType or detect it
            },
          });
        });
        setRecipeUrl(''); // Clear input after successful submission
      } else if (result.action === 'navigate_to_loading' && result.normalizedUrl) {
        // Navigate to loading with normalized URL
        track('navigation_to_loading_screen', {
          normalizedUrl: result.normalizedUrl,
          inputType: result.inputType,
          submissionId,
          userId: session?.user?.id,
        });
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
      
      // Log to Logtail for production error tracking
      track('recipe_submission_failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        submissionId: submissionId || 'unknown',
        userId: session?.user?.id,
        recipeInput: recipeInput,
        inputType: detectInputType(recipeInput),
      });
      
      showError('Recipe Submission Failed', 'Something went wrong while submitting your recipe. Please try again, and if the problem continues, try pasting the recipe text instead of a URL.');
    }
  } catch (err) {
    console.error('[🔥 ERROR] Exception in handleSubmit:', err);
  }
  };

  const handleUploadComplete = async (result: UploadResult) => {
    if (result.success && result.navigateToLoading) {
      // Navigate to loading screen for image processing
      if (result.imageUri) {
        // Single image processing
        router.push({
          pathname: '/loading',
          params: {
            recipeUrl: result.imageUri,
            inputType: 'image',
            forceNewParse: 'true'
          }
        });
      } else if (result.imageUris && result.imageUris.length > 0) {
        // Multiple images processing - we'll need to modify the loading screen to handle this
        // For now, let's serialize the array
        router.push({
          pathname: '/loading',
          params: {
            recipeUrl: JSON.stringify(result.imageUris),
            inputType: 'images',
            forceNewParse: 'true'
          }
        });
      }
    } else if (result.success && result.recipe) {
      // Track successful upload
      track('recipe_upload_success', {
        hasExtractedText: !!result.extractedText,
        hasCoverImage: !!result.coverImageUrl,
        imageProcessingTime: result.imageProcessingTime,
        userId: session?.user?.id,
      });

      // Navigate to recipe summary
      router.push({
        pathname: '/recipe/summary',
        params: {
          recipeData: JSON.stringify(result.recipe),
          entryPoint: 'upload',
          from: '/tabs',
          inputType: 'image', // This is from image upload
        },
      });
    } else if (result.success && result.cachedMatches && result.cachedMatches.length > 0) {
      // Handle case where multiple similar recipes were found
      track('recipe_matches_found', {
        match_count: result.cachedMatches.length,
        hasExtractedText: !!result.extractedText,
        hasCoverImage: !!result.coverImageUrl,
        imageProcessingTime: result.imageProcessingTime,
        userId: session?.user?.id,
      });

      // Show the match selection modal
      setPotentialMatches(result.cachedMatches);
      setShowMatchSelectionModal(true);
    } else {
      // Track upload failure
      track('recipe_upload_failed', {
        error: result.error,
        userId: session?.user?.id,
      });

      showError('Upload Failed', result.error || 'Failed to process the uploaded image. Please try again.');
    }
  };

  // Upload modal handlers
  const handleShowUploadModal = () => {
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
  };

  const handleTakePhoto = () => {
    setShowUploadModal(false);
    // Small delay to ensure modal is fully closed before opening picker
    setTimeout(() => {
      uploaderRef.current?.handleCamera();
    }, 100);
  };

  const handleChooseImage = () => {
    setShowUploadModal(false);
    // Small delay to ensure modal is fully closed before opening picker
    setTimeout(() => {
      uploaderRef.current?.handleImagePicker();
    }, 100);
  };

  const handleBrowseFiles = () => {
    setShowUploadModal(false);
    // Small delay to ensure modal is fully closed before opening picker
    setTimeout(() => {
      uploaderRef.current?.handleDocumentPicker();
    }, 100);
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
    console.log('[UI] 📝 TextInput onChangeText called with:', { text, type: typeof text, length: text?.length });
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
                  <RecipePDFImageUploader
                    ref={uploaderRef}
                    onUploadComplete={handleUploadComplete}
                    isLoading={isSubmitting}
                    style={styles.uploadButton}
                    onShowUploadModal={handleShowUploadModal}
                  />
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
                    returnKeyType="go"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={true}
                    keyboardType="default"
                    textContentType="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  onPressIn={() => console.log('[UI] 🎯 Submit button pressed in - isSubmitting:', isSubmitting)}
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

      {/* Upload Recipe Modal */}
      <UploadRecipeModal
        visible={showUploadModal}
        onClose={handleCloseUploadModal}
        onTakePhoto={handleTakePhoto}
        onChooseImage={handleChooseImage}
        onBrowseFiles={handleBrowseFiles}
      />
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
    marginTop: -SPACING.md,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    maxWidth: 365,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: -SPACING.xl,
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