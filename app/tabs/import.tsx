import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
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
  Easing,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import ScreenHeader from '@/components/ScreenHeader';
import RecipeMatchSelectionModal from '@/components/RecipeMatchSelectionModal';
import RecipePDFImageUploader, { UploadResult } from '@/components/RecipePDFImageUploader';
import UploadRecipeModal from '@/components/UploadRecipeModal';
import { CombinedParsedRecipe } from '@/common/types';
import { useRecipeSubmission } from '@/hooks/useRecipeSubmission';
import { detectInputType, validateRawTextInput, validateDishNameInput } from '../../server/utils/detectInputType';
import { useAnalytics } from '@/utils/analytics';
import { useHandleError } from '@/hooks/useHandleError';

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const [isImportFocused, setIsImportFocused] = useState(false);
  const [expandedImportOption, setExpandedImportOption] = useState<string | null>(null);
  const [recipeUrl, setRecipeUrl] = useState('');

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
  const { session } = useAuth();

  // Use the new submission hook
  const {
    submitRecipe,
    isSubmitting,
    submissionState,
    clearState
  } = useRecipeSubmission();




  // Placeholder rotation state (separate for URL, Text, and Name)
  const [urlDisplayedPlaceholder, setUrlDisplayedPlaceholder] = useState('');
  const [isTypingUrlPlaceholder, setIsTypingUrlPlaceholder] = useState(false);
  const [textDisplayedPlaceholder, setTextDisplayedPlaceholder] = useState('');
  const [isTypingTextPlaceholder, setIsTypingTextPlaceholder] = useState(false);
  const [nameDisplayedPlaceholder, setNameDisplayedPlaceholder] = useState('');
  const [isTypingNamePlaceholder, setIsTypingNamePlaceholder] = useState(false);
  // Compact layout detection (smaller iPhones)
  const { height } = useWindowDimensions();
  const isCompact = height < 700;


  // Keep interval handles so we never run two animations at once
  const urlIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const urlPrompt = "www.recipe.com/too-many-ads";
  const textPrompt = "paste or type recipe text here";
  const namePrompt = "try 'garlic chicken' or 'pizza'";

  // Local state for inputs
  const [recipeText, setRecipeText] = useState('');
  const [recipeDishName, setRecipeDishName] = useState('');

  // Generic typewriter starter for any placeholder with cleanup
  const startTypewriter = useCallback(
    (
      label: 'URL' | 'TEXT' | 'NAME',
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

  // Chevron rotation animations for each option
  const chevronAnimations = useRef({
    website: new Animated.Value(0),
    photo: new Animated.Value(0),
    rawText: new Animated.Value(0),
    dishName: new Animated.Value(0),
    explore: new Animated.Value(0),
  }).current;

  // Animate chevron rotation
  const animateChevron = useCallback((optionName: string, toValue: number) => {
    Animated.timing(chevronAnimations[optionName as keyof typeof chevronAnimations], {
      toValue,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  // Toggle import option expansion
  const toggleImportOption = useCallback((optionName: string) => {
    const newOption = expandedImportOption === optionName ? null : optionName;
    setExpandedImportOption(newOption);

    // Animate chevrons: close previously opened card and open new one
    if (expandedImportOption && expandedImportOption !== newOption) {
      // Close the previously opened card
      animateChevron(expandedImportOption, 0);
    }

    if (newOption) {
      // Open the newly selected card
      animateChevron(newOption, 1);
    }

    // Set importMode based on the selected option
    if (newOption === 'website') {
      setImportMode('url');
    } else if (newOption === 'photo') {
      setImportMode('image');
    } else if (newOption === 'rawText') {
      setImportMode('text');
    } else if (newOption === 'dishName') {
      setImportMode('name');
    } else if (newOption === 'explore') {
      setImportMode('explore');
    }
  }, [expandedImportOption, animateChevron]);

  // Get rotation interpolation for chevron animation
  const getChevronRotation = useCallback((optionName: string) => {
    return chevronAnimations[optionName as keyof typeof chevronAnimations].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '90deg'],
    });
  }, []);

  // Import mode: 'url' | 'image' | 'text' | 'name' | 'explore'
  const [importMode, setImportMode] = useState<'url' | 'image' | 'text' | 'name' | 'explore'>('url');

  // On mount, animate URL prompt once
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startTypewriter('URL', urlPrompt, setIsTypingUrlPlaceholder, setUrlDisplayedPlaceholder, urlIntervalRef);
    }, 1200);
    return () => {
      clearTimeout(timeoutId);
      // Hard cleanup for all animations on unmount
      if (urlIntervalRef.current) clearInterval(urlIntervalRef.current);
      if (textIntervalRef.current) clearInterval(textIntervalRef.current);
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
    if (importMode === 'text' && !textDisplayedPlaceholder && !isTypingTextPlaceholder) {
      startTypewriter('TEXT', textPrompt, setIsTypingTextPlaceholder, setTextDisplayedPlaceholder, textIntervalRef);
    }
    if (importMode === 'name' && !nameDisplayedPlaceholder && !isTypingNamePlaceholder) {
      startTypewriter('NAME', namePrompt, setIsTypingNamePlaceholder, setNameDisplayedPlaceholder, nameIntervalRef);
    }
    // Do NOT stop the other animation when switching away.
    // Let any in-progress typewriter finish in the background so
    // placeholders are fully written when user returns.
  }, [importMode, urlDisplayedPlaceholder, isTypingUrlPlaceholder, textDisplayedPlaceholder, isTypingTextPlaceholder, nameDisplayedPlaceholder, isTypingNamePlaceholder, startTypewriter]);

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

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      setIsImportFocused(true);
      if (__DEV__) console.log('[Import] focus effect: focused');
      return () => {
        setIsImportFocused(false);
        if (__DEV__) console.log('[Import] focus effect: blurred');
        // Clear submission state when leaving screen
        clearState();
        // Also hard-close any Import tab modals to prevent background flashes
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
        console.error('[ImportScreen] Could not find selected recipe in potentialMatches:', extra);
        showError('Navigation Error', "We couldn't open that recipe. Please try again.");
      }
    } else if (action === 'createNew') {
      // Prefer user-supplied additional details from modal, otherwise fall back to last typed input
      const inputToParse = (extra?.trim() || recipeText?.trim() || recipeDishName?.trim() || recipeUrl?.trim() || '');
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
  }, [potentialMatches, router, showError, recipeUrl, recipeText, recipeDishName, track, session?.user?.id]);

  // Replace isValidRecipeInput with a function that uses detectInputType
  function isValidRecipeInput(input: string) {
    const trimmed = input.trim();
    const detectedType = detectInputType(trimmed);
    // Accept if it's a valid URL, video, or valid text
    return detectedType === 'url' || detectedType === 'video' || detectedType === 'raw_text';
  }

  // Generic submit handler that takes arbitrary input text (URL, text, or dish name)
  const handleSubmitInput = async (inputRaw: string, inputType: 'url' | 'text' | 'dishName' = 'url') => {
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
          'Add a recipe to get started',
          'Add a recipe to get started.',
          undefined,
          () => {
            hideError();
          },
          'OK'
        );
        // Clear the active input for better UX
        if (importMode === 'url') setRecipeUrl('');
        if (importMode === 'text') setRecipeText('');
        if (importMode === 'name') setRecipeDishName('');
        return;
      }

      // Mode-specific validation using new validation functions
      if (importMode === 'text') {
        const validation = validateRawTextInput(localRecipeInput);
        if (!validation.isValid) {
          showError(
            'Invalid recipe text',
            validation.error || 'Please provide valid recipe text or ingredients.',
            undefined,
            () => {
              hideError();
            },
            'OK'
          );
          setRecipeText('');
          return;
        }
      }

      // Name mode: use specific dish name validation
      if (importMode === 'name') {
        const validation = validateDishNameInput(localRecipeInput);
        if (!validation.isValid) {
          showError(
            'Invalid dish name',
            validation.error || 'Please enter a valid dish name.',
            undefined,
            () => {
              hideError();
            },
            'OK'
          );
          setRecipeDishName('');
          return;
        }
      }

      // Early validation of the text/URL before mode-specific checks
      if (!isValidRecipeInput(localRecipeInput)) {
        let errorMessage = 'Please enter valid input for the selected mode.';
        let errorTitle = 'Input Not Recognized';

        // Mode-specific error messages
        switch (importMode) {
          case 'url':
            errorMessage = 'Please enter a valid website link (e.g., https://example.com/recipe)';
            break;
          case 'name':
            errorMessage = 'Please enter a real dish name (like "chicken soup" or "tomato pasta")';
            break;
          case 'text':
            errorMessage = 'Please enter recipe text or ingredients';
            break;
          default:
            errorMessage = 'Please enter a valid recipe URL, dish name, or recipe text';
        }

        showError(
          errorTitle,
          errorMessage,
          undefined,
          () => {
            hideError();
          },
          'OK'
        );
        if (importMode === 'url') setRecipeUrl('');
        if (importMode === 'text') setRecipeText('');
        if (importMode === 'name') setRecipeDishName('');
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
        setRecipeUrl('');
        return;
      }

      // Mode-specific validation - raw text mode should have recipe-like content
      if (importMode === 'text') {
        const rawTextValidation = validateRawTextInput(localRecipeInput);
        if (!rawTextValidation.isValid) {
          showError(
            'Invalid recipe text',
            rawTextValidation.error || 'The Raw Text field is for recipe text or ingredients. If you have a link, switch to Website.',
          );
          return;
        }
      }

      // Mode-specific validation - dish name mode should be simple names, not full recipes
      if (importMode === 'name') {
        const dishNameValidation = validateDishNameInput(localRecipeInput);
        if (!dishNameValidation.isValid) {
          showError(
            'Invalid dish name',
            dishNameValidation.error || 'The Dish Name field is for recipe names. If you have a link, switch to Website.',
          );
          return;
        }
      }
      currentStage = 'analytics_tracking';
      try { await track('input_mode_selected', { inputType }); } catch {}
      try { await track('recipe_submission_started', { inputLength: localRecipeInput.length, inputType, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}

            // Handle dish name vs raw text differently
      let result;
      if (importMode === 'name') {
        // For dish names, we want to do fuzzy search first
        console.log('[ImportScreen] Dish name mode - doing fuzzy search first');
        currentStage = 'recipe_submission';
        result = await submitRecipe(localRecipeInput, { isDishNameSearch: true });
      } else if (importMode === 'text') {
        // For raw text, navigate to loading screen like URLs do
        console.log('[ImportScreen] Raw text mode - navigating to loading screen');
        currentStage = 'navigation_routing';
        try {
          await track('navigation_to_loading_screen', {
            normalizedUrl: localRecipeInput,
            inputType: 'raw_text',
            submissionId: localSubmissionId,
            userId: session?.user?.id
          });
        } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({
            pathname: '/loading',
            params: {
              recipeUrl: localRecipeInput,
              inputType: 'raw_text',
              forceNewParse: 'true'
            }
          });
        });
        return;
      } else {
        // For other modes, use the normal flow
        console.log('[ImportScreen] Other mode - using normal submit flow');
        currentStage = 'recipe_submission';
        result = await submitRecipe(localRecipeInput, { isDishNameSearch: false });
      }

      console.log('[ImportScreen] submitRecipe returned:', {
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
        console.log('[ImportScreen] Submission failed:', {
          action: result.action,
          error: result.error,
          submissionId: localSubmissionId
        });
        if (result.action === 'show_validation_error') {
          // Show mode-specific error messages
          if (importMode === 'url') {
            showError('Invalid website link', 'Please enter a valid website link (e.g., https://example.com/recipe).');
          } else if (importMode === 'image') {
            showError('Image processing error', 'There was an error processing your image. Please try again.');
          } else if (importMode === 'explore') {
            showError('Explore error', 'There was an error loading recipes. Please try again.');
          } else if (result.error) {
            handleError('Validation Error', result.error, { stage: 'validation' });
          }
        }
        return;
      }

      currentStage = 'navigation_routing';
      console.log('[ImportScreen] Processing successful result, action:', result.action);

      if (result.action === 'show_match_modal' && result.matches) {
        // Always show match selection modal for textual queries, regardless of input field used
        setPotentialMatches(result.matches);
        setShowMatchSelectionModal(true);
        try { await track('recipe_matches_found', { match_count: result.matches.length, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
      } else if (result.action === 'navigate_to_summary' && result.recipe) {
        console.log('[ImportScreen] Navigating to summary with recipe:', {
          recipeId: result.recipe?.id,
          recipeTitle: result.recipe?.title,
          submissionId: localSubmissionId
        });
        try { await track('navigation_to_recipe_summary', { recipeId: result.recipe?.id, entryPoint: 'new', submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/recipe/summary', params: { recipeId: result.recipe?.id?.toString(), entryPoint: 'new', from: '/tabs', inputType: result.inputType || detectInputType(localRecipeInput) } });
        });
      } else if (result.action === 'navigate_to_loading' && result.normalizedUrl) {
        console.log('[ImportScreen] Navigating to loading screen with URL:', {
          normalizedUrl: result.normalizedUrl,
          inputType: result.inputType,
          submissionId: localSubmissionId
        });
        try { await track('navigation_to_loading_screen', { normalizedUrl: result.normalizedUrl, inputType: result.inputType, submissionId: localSubmissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/loading', params: { recipeUrl: result.normalizedUrl, inputType: result.inputType } });
        });
      } else {
        console.warn('[ImportScreen] Unexpected result action or missing data:', {
          action: result.action,
          hasRecipe: !!result.recipe,
          hasNormalizedUrl: !!result.normalizedUrl,
          hasMatches: !!result.matches,
          submissionId: localSubmissionId
        });
      }

      console.log('[ImportScreen] Recipe submission process completed successfully');
    } catch (error) {
      console.error('[ImportScreen] Submission error at stage:', currentStage);
      console.error('[ImportScreen] Error:', error);
      console.error('[ImportScreen] Error details:', {
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
  const handleSubmit = async () => handleSubmitInput(recipeUrl, 'url');
  // Text submit wrapper
  const handleSubmitText = async () => handleSubmitInput(recipeText, 'text');
  // Name submit wrapper
  const handleSubmitName = async () => handleSubmitInput(recipeDishName, 'dishName');

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
    // Update the appropriate field based on current import mode
    if (importMode === 'url') {
      setRecipeUrl(text);
    } else if (importMode === 'text') {
      setRecipeText(text);
    } else if (importMode === 'name') {
      setRecipeDishName(text);
    }
    if (text.length > 0 && !hasUserTyped) {
      setHasUserTyped(true);
    }
  };

  // Removed legacy placeholder logic (now handled per-tab typewriter placeholders)



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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="IMPORT" showBack={false} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
            <View style={styles.sectionsContainer}>
              {/* Header moved up near the top */}
              <View style={styles.pageHeaderContainer}>
                <Text style={styles.pageHeader}>To start customizing, import a recipe from anywhere or find one of our curated recipes. </Text>
              </View>

              {/* Cards section pushed down */}
              <View style={styles.importSection}>

                {/* Website Button */}
                <View style={styles.sectionWrapper}>
                  <TouchableHighlight
                    style={[styles.sectionCard, styles.importWebsiteCard]}
                    onPress={() => toggleImportOption('website')}
                    underlayColor="#EEF6FF"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.sectionContent}>
                      <View style={styles.cardTextContainer}>
                        <Text style={styles.sectionTitle}>Link</Text>
                        <Text style={styles.sectionSubtext}>Paste a URL or social media link</Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.sectionChevron,
                          {
                            transform: [{ rotate: getChevronRotation('website') }]
                          }
                        ]}
                      >
                        ›
                      </Animated.Text>
                    </View>
                  </TouchableHighlight>

                  {expandedImportOption === 'website' && (
                    <View style={styles.expandedContent}>
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={styles.input}
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
                            allowFontScaling={false}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.submitButton, styles.submitButtonConnected, isSubmitting && styles.submitButtonDisabled]}
                          onPress={handleSubmit}
                          disabled={isSubmitting}
                          onPressIn={() => console.log('[UI] 🎯 Submit button pressed in - isSubmitting:', isSubmitting)}
                        >
                          {getSubmitButtonContent()}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Photo Button */}
                <View style={styles.sectionWrapper}>
                  <TouchableHighlight
                    style={[styles.sectionCard, styles.importPhotoCard]}
                    onPress={() => toggleImportOption('photo')}
                    underlayColor="#EEF6FF"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.sectionContent}>
                      <View style={styles.cardTextContainer}>
                        <Text style={styles.sectionTitle}>Photo</Text>
                        <Text style={styles.sectionSubtext}>Upload recipe PDFs or screenshots</Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.sectionChevron,
                          {
                            transform: [{ rotate: getChevronRotation('photo') }]
                          }
                        ]}
                      >
                        ›
                      </Animated.Text>
                    </View>
                  </TouchableHighlight>

                  {expandedImportOption === 'photo' && (
                    <View style={styles.expandedContent}>
                      <View style={styles.fullWidthRow}>
                        <TouchableOpacity
                          style={styles.fullWidthPrimaryButton}
                          onPress={handleShowUploadModal}
                        >
                          <Text style={styles.fullWidthPrimaryButtonText}>Choose image</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Raw Text Button */}
                <View style={styles.sectionWrapper}>
                  <TouchableHighlight
                    style={[styles.sectionCard, styles.importTextCard]}
                    onPress={() => toggleImportOption('rawText')}
                    underlayColor="#EEF6FF"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.sectionContent}>
                      <View style={styles.cardTextContainer}>
                        <Text style={styles.sectionTitle}>Text</Text>
                        <Text style={styles.sectionSubtext}>Write in your own recipe</Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.sectionChevron,
                          {
                            transform: [{ rotate: getChevronRotation('rawText') }]
                          }
                        ]}
                      >
                        ›
                      </Animated.Text>
                    </View>
                  </TouchableHighlight>

                  {expandedImportOption === 'rawText' && (
                    <View style={styles.expandedContent}>
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={styles.input}
                            placeholder={textDisplayedPlaceholder}
                            placeholderTextColor={COLORS.darkGray}
                            value={recipeText}
                            onChangeText={setRecipeText}
                            autoCapitalize="sentences"
                            autoCorrect={true}
                            editable={true}
                            returnKeyType="search"
                            blurOnSubmit={true}
                            enablesReturnKeyAutomatically={true}
                            keyboardType="default"
                            onSubmitEditing={handleSubmitText}
                            underlineColorAndroid="transparent"
                            allowFontScaling={false}
                          />
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.submitButton,
                            styles.submitButtonConnected,
                            isSubmitting && styles.submitButtonDisabled,
                          ]}
                          onPress={handleSubmitText}
                          disabled={isSubmitting}
                        >
                          {getSubmitButtonContent()}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Dish Name Button */}
                <View style={styles.sectionWrapper}>
                  <TouchableHighlight
                    style={[styles.sectionCard, styles.importDishCard]}
                    onPress={() => toggleImportOption('dishName')}
                    underlayColor="#EEF6FF"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.sectionContent}>
                      <View style={styles.cardTextContainer}>
                        <Text style={styles.sectionTitle}>Dish name</Text>
                        <Text style={styles.sectionSubtext}>Type in the name of a dish</Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.sectionChevron,
                          {
                            transform: [{ rotate: getChevronRotation('dishName') }]
                          }
                        ]}
                      >
                        ›
                      </Animated.Text>
                    </View>
                  </TouchableHighlight>

                  {expandedImportOption === 'dishName' && (
                    <View style={styles.expandedContent}>
                      <View style={styles.inputContainer}>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={styles.input}
                            placeholder={nameDisplayedPlaceholder}
                            placeholderTextColor={COLORS.darkGray}
                            value={recipeDishName}
                            onChangeText={setRecipeDishName}
                            autoCapitalize="sentences"
                            autoCorrect={true}
                            editable={true}
                            returnKeyType="search"
                            blurOnSubmit={true}
                            enablesReturnKeyAutomatically={true}
                            keyboardType="default"
                            onSubmitEditing={handleSubmitName}
                            underlineColorAndroid="transparent"
                            allowFontScaling={false}
                          />
                        </View>
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
                    </View>
                  )}
                </View>

                {/* Explore Button */}
                <View style={styles.sectionWrapper}>
                  <TouchableHighlight
                    style={[
                      styles.sectionCard,
                      expandedImportOption !== 'explore' && styles.importExploreCard
                    ]}
                    onPress={() => toggleImportOption('explore')}
                    underlayColor="#EEF6FF"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.sectionContent}>
                      <View style={styles.sectionTextContainer}>
                        <Text style={styles.sectionTitle}>Explore</Text>
                        <Text style={styles.sectionSubtext}>Find a recipe from our collection</Text>
                      </View>
                      <Animated.Text
                        style={[
                          styles.sectionChevron,
                          {
                            transform: [{ rotate: getChevronRotation('explore') }]
                          }
                        ]}
                      >
                        ›
                      </Animated.Text>
                    </View>
                  </TouchableHighlight>

                  {expandedImportOption === 'explore' && (
                    <View style={[styles.expandedContent, styles.exploreExpandedContent]}>
                      <View style={styles.fullWidthRow}>
                        <TouchableOpacity
                          style={styles.fullWidthPrimaryButton}
                          onPress={() => router.push('/explore')}
                        >
                          <Text style={styles.fullWidthPrimaryButtonText}>Discover new dishes</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>


            </View>
        </ScrollView>
      </TouchableWithoutFeedback>


      {/* Hidden uploader anchor for image/PDF selection (driven by modal actions) */}
      <RecipePDFImageUploader
        ref={uploaderRef}
        onUploadComplete={handleUploadComplete}
        style={{ display: 'none' }}
      />

      {/* Recipe Match Selection Modal */}
      {isImportFocused && showMatchSelectionModal && (
        <RecipeMatchSelectionModal
          visible={isImportFocused && showMatchSelectionModal}
          matches={potentialMatches}
          onAction={handleMatchSelectionAction}
          debugSource={isImportFocused ? 'ImportTab (focused)' : 'ImportTab (background)'}
          initialInputText={(recipeText?.trim() || recipeDishName?.trim() || recipeUrl?.trim() || '')}
        />
      )}

      {/* Upload Recipe Modal */}
      {isImportFocused && (
        <UploadRecipeModal
          visible={isImportFocused && showUploadModal}
        onClose={handleCloseUploadModal}
        onTakePhoto={handleTakePhoto}
        onChooseImage={handleChooseImage}
        onBrowseFiles={handleBrowseFiles}
        />
      )}

    </View>
  );
}

// Shared input padding constants
const INPUT_LEFT_PAD = 16; // ~2 character spaces worth of padding
const INPUT_HEIGHT = 46; // Input container height
const INPUT_FONT_SIZE = 14; // Font size for caption
const INPUT_LINE_HEIGHT = Math.ceil(INPUT_FONT_SIZE * 1.3); // ~18px to prevent ascender clipping
const INPUT_VPAD = Math.floor((INPUT_HEIGHT - INPUT_LINE_HEIGHT) / 2) - 1; // Recomputed for new lineHeight

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  sectionsContainer: {
    gap: 0,
    flexGrow: 1,
  },
  importSection: {
    gap: 0,
    marginTop: SPACING.xxxl, // Increased from SPACING.lg to push cards down further
  },
  secondCardSection: {
    gap: 0,
    marginTop: SPACING.lg - 12, // Bring second card up by 12px
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

  cardSubheading: {
    fontFamily: FONT.family.body,
    fontSize: FONT.size.sectionHeader || 18, // Fallback to prevent NaN
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
  },
  sectionSubtext: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 18,
    color: '#000000',
    flex: 1,
  },
  sectionTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTextContainer: {
    flex: 1,
  },
  sectionHeader: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 0,
  },
  sectionHeaderContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  pageHeader: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
  },
  pageHeaderContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.sm, // Reduced from SPACING.xl to bring it closer to header
    marginBottom: SPACING.xl, // Increased to create more space before cards
  },
  sectionWrapper: {
    marginBottom: 0,
  },
  sectionCard: {
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  sectionChevron: {
    fontSize: 24,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  expandedContent: {
    backgroundColor: COLORS.background,
    paddingTop: 0,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
  },
  importWebsiteCard: {
    backgroundColor: COLORS.background,
  },
  importPhotoCard: {
    backgroundColor: COLORS.background,
  },
  importTextCard: {
    backgroundColor: COLORS.background,
  },
  importDishCard: {
    backgroundColor: COLORS.background,
  },
  importExploreCard: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  exploreExpandedContent: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  expandedDescription: {
    ...bodyText,
    color: COLORS.textDark,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: SPACING.pageHorizontal,
  },
  importCard: {
    width: '100%',
    backgroundColor: '#FAFAFA', // Off-white background for better contrast
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3, // Android shadow
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
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: SPACING.pageHorizontal,
    alignItems: 'flex-start',
  },
  sectionButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'left',
  },


  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: INPUT_HEIGHT,
    paddingLeft: INPUT_LEFT_PAD, // Left padding moved to wrapper
    borderWidth: 1,
    borderColor: '#000000',
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderRightWidth: 0, // Remove right border since button will be attached
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: INPUT_VPAD + 0.5, // Fine-tuned vertical centering
    color: COLORS.textDark,
    fontFamily: FONT.family.body, // Explicit font family
    fontSize: INPUT_FONT_SIZE, // Explicit font size
    lineHeight: INPUT_LINE_HEIGHT, // Explicit line height - prevents ascender clipping
    fontWeight: '400', // Explicit font weight
    letterSpacing: 0, // Explicit letter spacing to prevent any glyph shifts
    textAlignVertical: 'center', // Ensure vertical centering
    includeFontPadding: false, // Prevent Android font padding issues
    backgroundColor: 'transparent',
  },
  submitButton: {
    height: '100%',
    minWidth: 60,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopRightRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    borderLeftWidth: 0, // Remove left border since input will be attached
  },
  submitButtonConnected: {
    borderLeftWidth: 0,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...bodyStrongText,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadButton: {
    backgroundColor: 'transparent',
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
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

  segmentedItemActive: {
    backgroundColor: COLORS.primary,
  },
  segmentedItemText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.caption || 14, // Fallback to prevent NaN
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
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'flex-start', // Left align content
    paddingLeft: INPUT_LEFT_PAD, // Match input left padding
  },
  fullWidthPrimaryButtonText: {
    ...bodyStrongText,
    color: '#000000',
    textAlign: 'left',
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
  helperText: {
    ...bodyText,
    color: COLORS.textMuted,
    fontSize: FONT.size.caption || 14, // Fallback to prevent NaN
    textAlign: 'center',
    lineHeight: FONT.lineHeight.normal || 24, // Fallback to prevent NaN
    fontStyle: 'italic',
  },
});
