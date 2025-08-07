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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

export default function HomeScreen() {
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
  const { session } = useAuth();
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

  // Placeholder rotation state (separate for URL and Name)
  const [urlDisplayedPlaceholder, setUrlDisplayedPlaceholder] = useState('');
  const [isTypingUrlPlaceholder, setIsTypingUrlPlaceholder] = useState(false);
  const [nameDisplayedPlaceholder, setNameDisplayedPlaceholder] = useState('');
  const [isTypingNamePlaceholder, setIsTypingNamePlaceholder] = useState(false);

  // Keep interval handles so we never run two animations at once
  const urlIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const urlPrompt = "try a recipe blog with lots of ads";
  const namePrompt = "try 'mac and cheese' or 'pasta'";

  // Local state for name input
  const [recipeName, setRecipeName] = useState('');

  // Generic typewriter starter for any placeholder with logging and cleanup
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
          if (__DEV__) console.log(`[Typewriter][${label}] clearing previous interval`);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTyping(true);
        setDisplayed('');
        if (__DEV__) console.log(`[Typewriter][${label}] starting with text:`, text);

        let index = 0;
        const interval = setInterval(() => {
          index += 1;
          const slice = text.slice(0, index);
          setDisplayed(slice);
          if (__DEV__) {
            // Log every ~6th char to reduce noise
            if (index % 6 === 0 || index === text.length) {
              console.log(`[Typewriter][${label}] tick index=${index}/${text.length} slice='${slice}'`);
            }
          }
          if (index >= text.length) {
            if (__DEV__) console.log(`[Typewriter][${label}] completed`);
            clearInterval(interval);
            intervalRef.current = null;
            setTyping(false);
          }
        }, 60);

        intervalRef.current = interval as unknown as NodeJS.Timeout;
        return () => {
          if (intervalRef.current) {
            if (__DEV__) console.log(`[Typewriter][${label}] cleanup (external)`);
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
    if (__DEV__) console.log('[Typewriter][URL] mount kick-off');
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
      if (__DEV__) console.log('[Typewriter][URL] starting on tab switch');
      startTypewriter('URL', urlPrompt, setIsTypingUrlPlaceholder, setUrlDisplayedPlaceholder, urlIntervalRef);
    }
    if (importMode === 'name' && !nameDisplayedPlaceholder && !isTypingNamePlaceholder) {
      if (__DEV__) console.log('[Typewriter][NAME] starting on tab switch');
      startTypewriter('NAME', namePrompt, setIsTypingNamePlaceholder, setNameDisplayedPlaceholder, nameIntervalRef);
    }
    // Stop the other animation if switching away mid-run
    if (importMode !== 'url' && urlIntervalRef.current) {
      if (__DEV__) console.log('[Typewriter][URL] stopping due to mode change');
      clearInterval(urlIntervalRef.current);
      urlIntervalRef.current = null;
      setIsTypingUrlPlaceholder(false);
    }
    if (importMode !== 'name' && nameIntervalRef.current) {
      if (__DEV__) console.log('[Typewriter][NAME] stopping due to mode change');
      clearInterval(nameIntervalRef.current);
      nameIntervalRef.current = null;
      setIsTypingNamePlaceholder(false);
    }
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

  // Generic submit handler that takes arbitrary input text (URL or name)
  const handleSubmitInput = async (inputRaw: string) => {
    if (__DEV__) {
      console.log('[DEBUG] handleSubmitInput – START');
      console.log('[UI] 🚀 Submit pressed with value:', inputRaw);
    }

    try {
      // Validate
      if (!inputRaw || inputRaw.trim().length === 0) {
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
        return;
      }

      const recipeInput = inputRaw.trim();

      if (!session) {
        showError(
          'Login Required',
          'Please log in to continue using the app.',
          () => router.replace('/login'),
        );
        return;
      }

      const submissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const inputType = detectInputType(recipeInput);
      try { await track('input_mode_selected', { inputType }); } catch {}
      try { await track('recipe_submission_started', { inputLength: recipeInput.length, inputType, submissionId, userId: session?.user?.id }); } catch {}

      const result = await submitRecipe(recipeInput);

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
      } catch {}

      if (!result.success) {
        if (result.action === 'show_validation_error' && result.error) {
          showError('Validation Error', result.error);
        }
        return;
      }

      if (importMode === 'name' && result.action === 'show_match_modal' && result.matches) {
        setPotentialMatches(result.matches);
        setShowMatchSelectionModal(true);
        try { await track('recipe_matches_found', { match_count: result.matches.length, submissionId, userId: session?.user?.id }); } catch {}
      } else if (result.action === 'navigate_to_summary' && result.recipe) {
        try { await track('navigation_to_recipe_summary', { recipeId: result.recipe.id, entryPoint: 'new', submissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/recipe/summary', params: { recipeData: JSON.stringify(result.recipe), entryPoint: 'new', from: '/tabs', inputType: result.inputType || detectInputType(recipeInput) } });
        });
      } else if (result.action === 'navigate_to_loading' && result.normalizedUrl) {
        try { await track('navigation_to_loading_screen', { normalizedUrl: result.normalizedUrl, inputType: result.inputType, submissionId, userId: session?.user?.id }); } catch {}
        InteractionManager.runAfterInteractions(() => {
          router.push({ pathname: '/loading', params: { recipeUrl: result.normalizedUrl, inputType: result.inputType } });
        });
      } else if (result.action === 'show_match_modal' && result.matches && importMode !== 'name') {
        // For URL or image, pick best match automatically (highest similarity) and navigate
        const best = [...result.matches].sort((a, b) => b.similarity - a.similarity)[0];
        if (best?.recipe) {
          router.push({ pathname: '/recipe/summary', params: { recipeData: JSON.stringify(best.recipe), entryPoint: 'new', from: '/tabs', inputType: result.inputType || detectInputType(recipeInput) } });
        }
      }
    } catch (err) {
      console.error('[🔥 ERROR] Exception in handleSubmitInput:', err);
      showError('Recipe Submission Failed', 'Something went wrong while submitting your recipe. Please try again.');
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
          width: 200,
          height: 100,
          alignSelf: 'center',
          marginTop: SPACING.xxl,
          marginBottom: SPACING.xxl,
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
                    <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionsContainer}>
              {/* Import section */}
              <View style={styles.importSection}>
                <Text style={styles.subheadingText}>Import recipes from anywhere</Text>

                {/* Segmented control: URL | Image | Recipe name */}
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segmentGhost, importMode === 'url' && styles.segmentSolid]}
                    onPress={() => setImportMode('url')}
                  >
                    <Text style={[styles.segmentGhostText, importMode === 'url' && styles.segmentSolidText]}>URL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentGhost, importMode === 'image' && styles.segmentSolid]}
                    onPress={() => setImportMode('image')}
                  >
                    <Text style={[styles.segmentGhostText, importMode === 'image' && styles.segmentSolidText]}>Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentGhost, importMode === 'name' && styles.segmentSolid]}
                    onPress={() => setImportMode('name')}
                  >
                    <Text style={[styles.segmentGhostText, importMode === 'name' && styles.segmentSolidText]}>Dish name</Text>
                  </TouchableOpacity>
                </View>

                {importMode === 'url' ? (
                  <View style={styles.inputContainer}>
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
                    />
                    <TouchableOpacity
                      style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
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
                      style={styles.input}
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
                    />
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleSubmitName}
                    >
                      <Text style={styles.submitButtonText}>Go</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Action section */}
              <View style={styles.actionSection}>
                <Text style={styles.subheadingText}>...or jump right back into it</Text>
                {/* Quick actions grid */}
                <View style={styles.quickGrid}>
                  <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/tabs/library')}>
                    <MaterialCommunityIcons name="compass" size={28} color={COLORS.primary} />
                    <Text style={styles.quickTileText}>Discover new recipes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/tabs/mise')}>
                    <MaterialCommunityIcons name="chef-hat" size={28} color={COLORS.primary} />
                    <Text style={styles.quickTileText}>Prep and cook</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/tabs/library')}>
                    <MaterialCommunityIcons name="bookmark-outline" size={28} color={COLORS.primary} />
                    <Text style={styles.quickTileText}>Saved recipes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/tabs/settings')}>
                    <MaterialCommunityIcons name="message-text-outline" size={28} color={COLORS.primary} />
                    <Text style={styles.quickTileText}>Give us feedback</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  sectionsContainer: {
    gap: SPACING.footerHeight,
  },
  importSection: {
    gap: SPACING.md,
  },
  actionSection: {
    gap: SPACING.md,
  },
  quickGrid: {
    marginTop: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  quickTile: {
    width: '48%',
    height: 104,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  quickTileText: {
    ...captionStrongText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: SPACING.xs,
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
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: SPACING.xl,
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
    height: 50,
    gap: SPACING.xs,
  },
  input: {
    ...bodyText,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.base,
    color: COLORS.textDark,
    fontSize: FONT.size.caption,
    lineHeight: undefined,
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.sm,
  },
  submitButton: {
    height: '100%',
    width: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  submitButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
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
  segmentedControl: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: SPACING.xs,
    width: '100%',
  },
  segmentGhost: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  segmentGhostText: {
    ...bodyStrongText,
    color: COLORS.primary,
    fontSize: FONT.size.caption,
    textAlign: 'center',
  },
  segmentSolid: {
    backgroundColor: COLORS.primary,
  },
  segmentSolidText: {
    color: COLORS.white,
  },
  fullWidthRow: {
    width: '100%',
    height: 50,
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
  // submitButtonPlaceholder removed in favor of true full-width button
});