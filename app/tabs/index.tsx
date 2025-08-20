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
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
// import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
  SHADOWS,
} from '@/constants/theme';
import { useErrorModal } from '@/context/ErrorModalContext';
import {
  bodyText,
  bodyStrongText,
  FONT,
  captionText,
  sectionHeaderText,
  captionStrongText,
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
import { useHandleError } from '@/hooks/useHandleError';

export default function HomeScreen() {
  const [isHomeFocused, setIsHomeFocused] = useState(false);
  const [recipeUrl, setRecipeUrl] = useState('');
  const { session } = useAuth();
  
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
  const handleError = useHandleError();
  
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


  // Placeholder rotation state (separate for URL and Name)
  const [urlDisplayedPlaceholder, setUrlDisplayedPlaceholder] = useState('');
  const [isTypingUrlPlaceholder, setIsTypingUrlPlaceholder] = useState(false);
  const [nameDisplayedPlaceholder, setNameDisplayedPlaceholder] = useState('');
  const [isTypingNamePlaceholder, setIsTypingNamePlaceholder] = useState(false);
  // Compact layout detection (smaller iPhones)
  const { height } = useWindowDimensions();
  const isCompact = height < 700;


  // Keep interval handles so we never run two animations at once
  const urlIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const urlPrompt = "www.recipe.com/too-many-ads";
  const namePrompt = "try 'garlic chicken' or 'pizza'";

  // Local state for name input
  const [recipeName, setRecipeName] = useState('');

  // Generic typewriter starter for any placeholder with cleanup
  const startTypewriter = useCallback(
    (
      label: 'URL' | 'NAME',
      text: string,
      setTyping: (b: boolean) => void,
      setDisplayed: (s: string) => void,
      intervalRef: React.MutableRefObject<NodeJS.Timeout | null>
    ) => {
      try {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTyping(true);
        setDisplayed('');

        let index = 0;
        const interval = setInterval(() => {
          index += 1;
          const slice = text.slice(0, index);
          setDisplayed(slice);
          if (index >= text.length) {
            clearInterval(interval);
            intervalRef.current = null;
            setTyping(false);
          }
        }, 60);

        intervalRef.current = interval as unknown as NodeJS.Timeout;
        return () => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setTyping(false);
        };
      } catch (err) {
        console.error('[Typewriter] error starting animation', err);
      }
    },
    []
  );

  // Import mode: 'url' | 'image' | 'name'
  const [importMode, setImportMode] = useState<'url' | 'image' | 'name'>('url');

  // On mount, animate URL prompt once
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startTypewriter('URL', urlPrompt, setIsTypingUrlPlaceholder, setUrlDisplayedPlaceholder, urlIntervalRef);
    }, 1200);
    return () => {
      clearTimeout(timeoutId);
      // Hard cleanup for both animations on unmount
      if (urlIntervalRef.current) clearInterval(urlIntervalRef.current);
      if (nameIntervalRef.current) clearInterval(nameIntervalRef.current);
    };
  }, [startTypewriter]);

  // Track whether the initial mount kick-off has completed
  const mountKickoffDoneRef = useRef(false);
  useEffect(() => {
    // When URL placeholder completes, mark kickoff done
    if (!isTypingUrlPlaceholder && urlDisplayedPlaceholder === urlPrompt) {
      mountKickoffDoneRef.current = true;
    }
  }, [isTypingUrlPlaceholder, urlDisplayedPlaceholder]);

  // When switching tabs, start the appropriate animation if it hasn't run yet
  useEffect(() => {
    // Avoid starting again during the first mount kick-off window
    if (!mountKickoffDoneRef.current && importMode === 'url') {
      return;
    }
    if (importMode === 'url' && !urlDisplayedPlaceholder && !isTypingUrlPlaceholder) {
      startTypewriter('URL', urlPrompt, setIsTypingUrlPlaceholder, setUrlDisplayedPlaceholder, urlIntervalRef);
    }
    if (importMode === 'name' && !nameDisplayedPlaceholder && !isTypingNamePlaceholder) {
      startTypewriter('NAME', namePrompt, setIsTypingNamePlaceholder, setNameDisplayedPlaceholder, nameIntervalRef);
    }
    // Do NOT stop the other animation when switching away.
    // Let any in-progress typewriter finish in the background so
    // placeholders are fully written when user returns.
  }, [importMode, urlDisplayedPlaceholder, isTypingUrlPlaceholder, nameDisplayedPlaceholder, isTypingNamePlaceholder, startTypewriter]);

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
      setIsHomeFocused(true);
      if (__DEV__) console.log('[Home] focus effect: focused');
      return () => {
        setIsHomeFocused(false);
        if (__DEV__) console.log('[Home] focus effect: blurred');
        // Clear submission state when leaving screen
        clearState();
        // Also hard-close any Home tab modals to prevent background flashes
        setShowMatchSelectionModal(false);
        setShowUploadModal(false);
        setPotentialMatches([]);
      };
    }, [clearState])
  );

  const handleMatchSelectionAction = useCallback((action: 'select' | 'createNew' | 'returnHome', extra?: string) => {
    setShowMatchSelectionModal(false); // Always dismiss the modal first

    if (action === 'select' && extra) {
      // Find the selected recipe from potentialMatches using the selectedRecipeId
      const selectedMatch = potentialMatches.find(match => 
        match.recipe.id === Number(extra)
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
        console.error('[HomeScreen] Could not find selected recipe in potentialMatches:', extra);
        showError('Navigation Error', "We couldn't open that recipe. Please try again.");
      }
    } else if (action === 'createNew') {
      // Prefer user-supplied additional details from modal, otherwise fall back to last typed input
      const inputToParse = (extra?.trim() || recipeName?.trim() || recipeUrl?.trim() || '');
      if (!inputToParse) {
        showError('Missing recipe text', 'Please enter some recipe text and try again.');
        return;
      }
      track('recipe_create_new_selected', {
        recipeInput: inputToParse,
        inputType: 'raw_text',
        userId: session?.user?.id,
      });
      router.push({
        pathname: '/loading',
        params: {
          recipeUrl: inputToParse,
          inputType: 'raw_text',
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
  }, [potentialMatches, router, showError, recipeUrl, recipeName, track, session?.user?.id]);

  // Replace isValidRecipeInput with a function that uses detectInputType
  function isValidRecipeInput(input: string) {
    const trimmed = input.trim();
    const detectedType = detectInputType(trimmed);
    // Accept if it's a valid URL, video, or valid text
    return detectedType === 'url' || detectedType === 'video' || detectedType === 'raw_text';
  }

  // Generic submit handler that takes arbitrary input text (URL or name)
  const handleSubmitInput = async (inputRaw: string) => {
    if (__DEV__) {
      console.log('[DEBUG] handleSubmitInput – START');
      console.log('[UI] 🚀 Submit pressed with value:', inputRaw);
    }

    // Prepare shared variables so catch block can reference them
    const preTrimmed = (inputRaw || '').trim();
    let localSubmissionId: string | undefined;
    let localRecipeInput: string = preTrimmed;
    let currentStage = 'initialization';

    try {
      currentStage = 'validation';
      // Validate input
      if (localRecipeInput.length === 0) {
        showError(
          'Input Required',
          'Add a recipe to get started.\n\nLooking for ideas? Head to the Explore tab.',
          undefined,
          'Go to Explore',
          () => {
            hideError();
            router.push('/tabs/library');
          }
        );
        // Clear the active input for better UX
        if (importMode === 'url') setRecipeUrl('');
        if (importMode === 'name') setRecipeName('');
        return;
      }

      // Name mode: require a minimal amount of descriptive letters
      if (importMode === 'name') {
        const letterCount = (localRecipeInput.match(/[a-zA-Z]/g) || []).length;
        if (letterCount < 6) {
          showError(
            'Please enter more detail',
            'Please be a bit more descriptive about the dish you want to cook.'
          );
          setRecipeName('');
          return;
        }
      }

      // Early validation of the text/URL before mode-specific checks
      if (!isValidRecipeInput(localRecipeInput)) {
        showError(
          'Input Not Recognized',
          'Please enter a real dish name (like "chicken soup" or "tomato pasta") or a recipe link',
          undefined,
          'Go to Explore',
          () => {
            hideError();
            router.push('/tabs/library');
          }
        );
        if (importMode === 'url') setRecipeUrl('');
        if (importMode === 'name') setRecipeName('');
        return;
      }

      // localRecipeInput already set above for catch; continue using within try
      
      currentStage = 'authentication';
      if (!session) {
        showError(
          'Login Required',
          'Please log in to continue using the app.',
          () => router.replace('/login'),
        );
        return;
      }

      localSubmissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const inputType = detectInputType(localRecipeInput);

      // If user is in URL mode, strictly require a valid URL or video; do not allow raw text
      if (importMode === 'url' && !(inputType === 'url' || inputType === 'video')) {
        showError(
          'Please enter a valid link',
          'The URL field only accepts links (e.g., https://example.com/recipe). If you want to search by name, switch to Dish name.',
        );
        return;
      }

      // If user is in text mode, strictly disallow URLs/videos and require text
      if (importMode === 'name' && inputType !== 'raw_text') {
        showError(
          'Please enter text',
          'The Text field is for recipe text or a dish name. If you have a link, switch to URL.',
        );
        return;
      }
      currentStage = 'analytics_tracking';
      try { await track('input_mode_selected', { inputType }); } catch {}
      try { await track('recipe_submission_started', { inputLength: localRecipeInput.length, inputType, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}

      console.log('[HomeScreen] About to call submitRecipe with input:', { 
        inputLength: localRecipeInput.length, 
        inputType, 
        submissionId: localSubmissionId 
      });
      
      currentStage = 'recipe_submission';
      const result = await submitRecipe(localRecipeInput);
      
      console.log('[HomeScreen] submitRecipe returned:', { 
        success: result.success, 
        action: result.action, 
        hasRecipe: !!result.recipe,
        hasMatches: !!result.matches,
        error: result.error,
        submissionId: localSubmissionId
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
           submissionId: localSubmissionId,
          userId: session?.user?.id,
        });
      } catch {}

      currentStage = 'result_processing';
      if (!result.success) {
        console.log('[HomeScreen] Submission failed:', { 
          action: result.action, 
          error: result.error,
          submissionId: localSubmissionId
        });
        if (result.action === 'show_validation_error') {
          // In Dish name mode, show a name-specific message instead of the generic URL/text one
          if (importMode === 'name') {
            showError('Invalid dish name', 'Please input a valid dish name.');
          } else if (result.error) {
            handleError('Validation Error', result.error, { stage: 'validation' });
          }
        }
        return;
      }

      currentStage = 'navigation_routing';
      console.log('[HomeScreen] Processing successful result, action:', result.action);
      
      if (result.action === 'show_match_modal' && result.matches) {
        // Always show match selection modal for textual queries, regardless of input field used
        setPotentialMatches(result.matches);
        setShowMatchSelectionModal(true);
        try { await track('recipe_matches_found', { match_count: result.matches.length, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
      } else if (result.action === 'navigate_to_summary' && result.recipe) {
        console.log('[HomeScreen] Navigating to summary with recipe:', { 
          recipeId: result.recipe.id, 
          recipeTitle: result.recipe.title,
          submissionId: localSubmissionId
        });
        try { await track('navigation_to_recipe_summary', { recipeId: result.recipe.id, entryPoint: 'new', submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/recipe/summary', params: { recipeData: JSON.stringify(result.recipe), entryPoint: 'new', from: '/tabs', inputType: result.inputType || detectInputType(localRecipeInput) } });
        });
      } else if (result.action === 'navigate_to_loading' && result.normalizedUrl) {
        console.log('[HomeScreen] Navigating to loading screen with URL:', { 
          normalizedUrl: result.normalizedUrl, 
          inputType: result.inputType,
          submissionId: localSubmissionId
        });
        try { await track('navigation_to_loading_screen', { normalizedUrl: result.normalizedUrl, inputType: result.inputType, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/loading', params: { recipeUrl: result.normalizedUrl, inputType: result.inputType } });
        });
      } else {
        console.warn('[HomeScreen] Unexpected result action or missing data:', { 
          action: result.action,
          hasRecipe: !!result.recipe,
          hasNormalizedUrl: !!result.normalizedUrl,
          hasMatches: !!result.matches,
          submissionId: localSubmissionId
        });
      }
      
      console.log('[HomeScreen] Recipe submission process completed successfully');
    } catch (error) {
      console.error('[HomeScreen] Submission error at stage:', currentStage);
      console.error('[HomeScreen] Error:', error);
      console.error('[HomeScreen] Error details:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        currentStage,
        submissionId: localSubmissionId || 'unknown',
        userId: session?.user?.id,
        recipeInput: localRecipeInput,
        inputType: detectInputType(localRecipeInput),
      });
      
      // Log and show normalized error
      try {
        track('recipe_submission_failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          currentStage,
          submissionId: localSubmissionId || 'unknown',
          userId: session?.user?.id,
          recipeInput: localRecipeInput,
          inputType: detectInputType(localRecipeInput),
        });
      } catch {}
      
      // Use the current stage for more accurate error messaging
      const errorStage = currentStage === 'navigation_routing' ? 'navigation' : currentStage;
      handleError('Recipe Submission Failed', error, { stage: errorStage });
    }
  };

  // URL submit wrapper
  const handleSubmit = async () => handleSubmitInput(recipeUrl);
  // Name submit wrapper
  const handleSubmitName = async () => handleSubmitInput(recipeName);

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

  // Removed legacy placeholder logic (now handled per-tab typewriter placeholders)

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
          width: isCompact ? 128 : 150,
          height: isCompact ? 64 : 75,
          alignSelf: 'center',
          marginTop: isCompact ? SPACING.lg : SPACING.xl,
          marginBottom: 0,
        }}
      />
    </Animated.View>
  ), [logoOpacity, logoTranslateY, isCompact]); // Recreate if compact state changes

  // Get appropriate button text based on submission state
  const getSubmitButtonContent = () => {
    if (submissionState === 'validating') {
      return <ActivityIndicator size="small" color={COLORS.primary} />;
    } else if (submissionState === 'checking_cache') {
      return <ActivityIndicator size="small" color={COLORS.primary} />;
    } else if (submissionState === 'parsing') {
      return <ActivityIndicator size="small" color={COLORS.primary} />;
    } else if (submissionState === 'navigating') {
      return <ActivityIndicator size="small" color={COLORS.primary} />;
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
                    <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionsContainer}>
              {/* Marketing heading */}
              <View style={[styles.heroSection, isCompact && { marginTop: 0, marginBottom: 0 }]}>
                <Text
                  style={[styles.heroHeading, isCompact && { fontSize: FONT.size.sectionHeader }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}
                >
                  The best way to prep and cook
                </Text>
              </View>

              {/* Import section */}
              <View style={styles.importSection}>
                 {/* Removed legacy subheading above the import card */}

                {/* Unified import card: header + segmented control + input */}
                <View style={styles.importCard}>
                  <Text style={styles.importCardTitle}>Bring your recipes in</Text>
                  {/* Segmented control: URL | Dish Name | Image */}
                  <View style={styles.segmentedControlContainer}>
                    <TouchableOpacity
                      style={[styles.segmentedItem, styles.segmentedItemNarrow, importMode === 'url' && styles.segmentedItemActive]}
                      onPress={() => setImportMode('url')}
                    >
                      <Text
                        style={[styles.segmentedItemText, importMode === 'url' && styles.segmentedItemTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        URL
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segmentedItem, styles.segmentedItemWide, importMode === 'name' && styles.segmentedItemActive]}
                      onPress={() => setImportMode('name')}
                    >
                      <Text
                        style={[styles.segmentedItemText, importMode === 'name' && styles.segmentedItemTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        Dish name
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segmentedItem, styles.segmentedItemNarrow, importMode === 'image' && styles.segmentedItemActive]}
                      onPress={() => setImportMode('image')}
                    >
                      <Text
                        style={[styles.segmentedItemText, importMode === 'image' && styles.segmentedItemTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        Image
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {importMode === 'url' ? (
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, styles.inputLeft]}
                        placeholder={urlDisplayedPlaceholder}
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
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        style={[styles.submitButton, styles.submitButtonConnected, isSubmitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        onPressIn={() => console.log('[UI] 🎯 Submit button pressed in - isSubmitting:', isSubmitting)}
                      >
                        {getSubmitButtonContent()}
                      </TouchableOpacity>
                    </View>
                  ) : importMode === 'image' ? (
                    <View style={styles.fullWidthRow}>
                      <TouchableOpacity 
                        style={styles.fullWidthPrimaryButton}
                        onPress={handleShowUploadModal}
                      >
                        <Text style={styles.fullWidthPrimaryButtonText}>Choose image</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, styles.inputLeft]}
                        placeholder={nameDisplayedPlaceholder}
                        placeholderTextColor={COLORS.darkGray}
                        value={recipeName}
                        onChangeText={setRecipeName}
                        autoCapitalize="sentences"
                        autoCorrect={true}
                        editable={true}
                        returnKeyType="search"
                        blurOnSubmit={true}
                        enablesReturnKeyAutomatically={true}
                        keyboardType="default"
                        onSubmitEditing={handleSubmitName}
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          styles.submitButtonConnected,
                          isSubmitting && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmitName}
                        disabled={isSubmitting}
                      >
                        {getSubmitButtonContent()}
                      </TouchableOpacity>
                      
                    </View>
                  )}
                  {/* Removed inline community link for name mode */}
                </View>
              </View>

              {/* Slight spacer before secondary actions (reduced from flexGrow to bring items up slightly) */}
              <View style={{ height: SPACING.lg }} />

              {/* Secondary actions grouped near bottom */}
              <View style={styles.secondarySections}>
                  {/* Action section 3: Explore */}
                  <View style={styles.actionSection}>
                    <View style={styles.sectionTitleWrap}>
                      <Text style={[styles.subheadingText, { marginTop: 0, marginBottom: SPACING.xs }]}>{''}</Text>
                    </View>
                    <View style={[styles.quickList, { marginBottom: 0 }]}> 
                      <TouchableOpacity
                        style={styles.quickPill}
                        onPress={() => router.push('/explore')}
                      >
                        <Text style={styles.quickPillText}>Discover new dishes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPill}
                        onPress={() => router.push('/tabs/mise')}
                      >
                        <Text style={styles.quickPillText}>Use your prep station</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </TouchableWithoutFeedback>
      {/* Bottom callout above tabs */}
      <View style={styles.bottomCallout}>
        <Text style={styles.inlineText}>New to Meez?</Text>
        <TouchableOpacity onPress={() => router.push('/onboarding')}>
          <Text style={styles.inlineLink}>Take a quick tour</Text>
        </TouchableOpacity>
      </View>
      
      {/* Hidden uploader anchor for image/PDF selection (driven by modal actions) */}
      <RecipePDFImageUploader
        ref={uploaderRef}
        onUploadComplete={handleUploadComplete}
        style={{ display: 'none' }}
      />

      {/* Recipe Match Selection Modal */}
      {isHomeFocused && showMatchSelectionModal && (
        <RecipeMatchSelectionModal
          visible={isHomeFocused && showMatchSelectionModal}
          matches={potentialMatches}
          onAction={handleMatchSelectionAction}
          debugSource={isHomeFocused ? 'HomeTab (focused)' : 'HomeTab (background)'}
          initialInputText={(recipeName?.trim() || recipeUrl?.trim() || '')}
        />
      )}

      {/* Upload Recipe Modal */}
      {isHomeFocused && (
        <UploadRecipeModal
          visible={isHomeFocused && showUploadModal}
        onClose={handleCloseUploadModal}
        onTakePhoto={handleTakePhoto}
        onChooseImage={handleChooseImage}
        onBrowseFiles={handleBrowseFiles}
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  sectionsContainer: {
    gap: 0,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  importSection: {
    gap: 0,
    marginTop: SPACING.xxxl,
  },
  secondarySections: {
    width: '100%',
    marginTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: 0,
    marginBottom: SPACING.md,
  },
  heroHeading: {
    fontFamily: FONT.family.body,
    fontSize: FONT.size.sectionHeader,
    fontWeight: '600',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  heroSubheading: {
    ...bodyText,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  importCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.smLg,
    marginBottom: SPACING.xl,
    ...SHADOWS.small, // subtle shadow (~2px blur equivalent)
  },
  importCardTitle: {
    fontFamily: FONT.family.body,
    fontSize: FONT.size.sectionHeader,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  actionSection: {
    gap: 0,
    marginTop: 0,
  },
  quickList: {
    width: '100%',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  quickPill: {
    width: '100%',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  quickPillText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.caption,
  },
  sectionLabel: {
    ...bodyText,
    fontSize: FONT.size.body,
    fontWeight: '300',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xs,
  },
  subheadingText: {
    fontFamily: FONT.family.heading,
    fontSize: FONT.size.body,
    fontWeight: '600',
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: 0,
  },
  sectionTitleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  sectionRule: {
    height: BORDER_WIDTH.hairline,
    alignSelf: 'stretch',
    backgroundColor: COLORS.darkGray,
    opacity: 0.25,
    marginHorizontal: SPACING.pageHorizontal,
  },
  importSubheading: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
    marginBottom: 0,
  },
  sectionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  sectionButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 16,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  ghostButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 46,
    gap: 0,
  },
  input: {
    ...bodyText,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.base,
    color: COLORS.textDark,
    fontSize: FONT.size.caption,
    lineHeight: undefined,
    backgroundColor: COLORS.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: RADIUS.sm,
  },
  inputLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  submitButton: {
    height: '100%',
    minWidth: 60,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  submitButtonConnected: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadButton: {
    backgroundColor: 'transparent',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: 14,
  },
  divider: {
    width: BORDER_WIDTH.default,
    height: '100%',
    backgroundColor: COLORS.lightGray,
  },
  segmentedControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    marginTop: 0,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemWide: {
    flex: 1.3,
  },
  segmentedItemNarrow: {
    flex: 0.85,
  },
  segmentedItemActive: {
    backgroundColor: COLORS.primary,
  },
  segmentedItemText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.caption,
  },
  segmentedItemTextActive: {
    color: COLORS.white,
  },
  fullWidthRow: {
    width: '100%',
    height: 46,
  },
  fullWidthPrimaryButton: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthPrimaryButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  inlineLink: {
    color: COLORS.primary,
    textDecorationLine: 'none',
    ...captionText,
  },
  inlineText: {
    ...captionText,
    color: COLORS.textMuted,
  },
  bottomCallout: {
    width: '100%',
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
  },
});