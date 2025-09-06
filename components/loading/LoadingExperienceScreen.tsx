import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import ChecklistProgress from './ChecklistProgress';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import Animated, { 
  FadeIn,
  FadeOut,
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useHandleError } from '@/hooks/useHandleError';
import { CombinedParsedRecipe as ParsedRecipe } from '../../common/types';
import { useAnalytics } from '@/utils/analytics';
import { FONT } from '@/constants/typography';
import { Image } from 'react-native';
import Logo from '@/assets/images/logo.svg';
import { getErrorMessage, getNetworkErrorMessage } from '../../utils/errorMessages';
import { ParseErrorCode } from '../../common/types/errors';
import LogoHeader from '@/components/LogoHeader';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LoadingExperienceScreenProps {
  recipeInput: string;
  onComplete: () => void;
  onFailure: () => void;
  loadingMode: 'checklist' | 'default';
  inputType?: string;
  forceNewParse?: boolean;
}

const LoadingExperienceScreen: React.FC<LoadingExperienceScreenProps> = ({
  recipeInput,
  onComplete,
  onFailure,
  loadingMode,
  inputType = 'url',
  forceNewParse,
}) => {
      if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [LoadingExperienceScreen] render/mount with input: ${recipeInput}`);
    }
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = height < 700;
  const alreadyNavigated = useRef(false);
  const [isParsingFinished, setIsParsingFinished] = useState(false);
  const [recipeData, setRecipeData] = useState<ParsedRecipe | null>(null);
  const [componentKey, setComponentKey] = useState(0);
  const [checkmarkShown, setCheckmarkShown] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [hideChecklist, setHideChecklist] = useState(false);
  const handleError = useHandleError();
  const isMountedRef = useRef(true);
  const { track } = useAnalytics();
  
  // Animation values
  const rotation = useSharedValue(0);
  
  // Input type-specific timing and messaging
  const isVideo = inputType === 'video';
  const isImage = inputType === 'image';
  const isImages = inputType === 'images';
  
  const getSpinnerDuration = () => 700; // Consistent timing for all input types
  const getTagline = () => {
    if (isVideo) return "Processing video recipe...";
    if (isImage) return "Extracting recipe from image...";
    if (isImages) return "Processing recipe pages...";
    return "Creating your recipe...";
  };
  const getReadyText = () => {
    if (isVideo) return "Video Recipe Ready!";
    if (isImage || isImages) return "Recipe Extracted!";
    return "Recipe Ready!";
  };
  
  // Animated styles
  const spinnerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debug: Track state changes
  useEffect(() => {
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [STATE] showSpinner changed to: ${showSpinner}`);
    }
  }, [showSpinner]);

  useEffect(() => {
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [STATE] checkmarkShown changed to: ${checkmarkShown}`);
    }
  }, [checkmarkShown]);

  useEffect(() => {
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [STATE] hideChecklist changed to: ${hideChecklist}`);
    }
  }, [hideChecklist]);

  // Helper function to process backend error responses
  const processBackendError = (errorResponse: any): string => {
    if (__DEV__) {
      console.log('[processBackendError] Processing error response:', errorResponse);
      console.log('[processBackendError] Input type:', inputType);
    }
    try {
      // Check if it's a structured error response with ParseErrorCode
      if (errorResponse && typeof errorResponse === 'object') {
        if (errorResponse.error && errorResponse.error.code) {
          const code = errorResponse.error.code as ParseErrorCode;
          // Determine context based on actual input type, not just URL detection
          let context: string;
          if (inputType === 'image') {
            context = 'image';
          } else if (inputType === 'images') {
            context = 'images';
          } else if (recipeInput.startsWith('http')) {
            context = 'url';
          } else {
            context = 'text';
          }
          if (__DEV__) {
            console.log('[processBackendError] Using getErrorMessage with code:', code, 'context:', context);
          }
          return getErrorMessage(code, context);
        }
        
        // Check for error message in response
        if (errorResponse.error && errorResponse.error.message) {
          return getNetworkErrorMessage(errorResponse.error.message);
        }
        
        if (errorResponse.message) {
          return getNetworkErrorMessage(errorResponse.message);
        }
      }
      
              // Handle string responses
        if (typeof errorResponse === 'string') {
          try {
            const parsed = JSON.parse(errorResponse);
            if (parsed.error && parsed.error.code) {
              const code = parsed.error.code as ParseErrorCode;
              // Use same context logic as above
              let context: string;
              if (inputType === 'image') {
                context = 'image';
              } else if (inputType === 'images') {
                context = 'images';
              } else if (recipeInput.startsWith('http')) {
                context = 'url';
              } else {
                context = 'text';
              }
              return getErrorMessage(code, context);
            }
        } catch {
          // Not JSON, treat as plain string
          return getNetworkErrorMessage(errorResponse);
        }
      }
      
      if (__DEV__) {
        console.log('[processBackendError] Falling back to getNetworkErrorMessage for unknown error');
      }
      return getNetworkErrorMessage('Unknown error');
    } catch (error) {
      console.error('[LoadingExperienceScreen] Error processing backend error:', error);
      if (__DEV__) {
        console.log('[processBackendError] Exception occurred, using fallback message');
      }
      return "We're having trouble processing your recipe. Please try again.";
    }
  };

  const handleSpinComplete = (finalRecipeData: ParsedRecipe) => {
    if (!isMountedRef.current) return;
    
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [handleSpinComplete] Starting state changes...`);
    }
    
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [handleSpinComplete] setShowSpinner(false) - HIDING SPINNER`);
    }
    setShowSpinner(false);
    
    if (__DEV__) {
      console.log(`[${new Date().toISOString()}] [handleSpinComplete] setCheckmarkShown(true) - SHOWING CHECKMARK`);
    }
    setCheckmarkShown(true);
    
    // Navigate after 1 second
    setTimeout(() => {
      if (!isMountedRef.current || !finalRecipeData) return;
      
      if (__DEV__) {
        console.log(`[${new Date().toISOString()}] [handleSpinComplete] Navigating to recipe summary...`);
      }
      router.replace({
        pathname: '/recipe/summary',
        params: {
          recipeData: JSON.stringify(finalRecipeData),
          entryPoint: 'new',
          from: '/',
          inputType: inputType, // Pass the input type to determine if we should show "Visit Source"
        },
      });
      onComplete();
    }, 1000);
  };

  const parseRecipe = async (): Promise<ParsedRecipe | null> => {
    const baseBackendUrl = process.env.EXPO_PUBLIC_API_URL!;
    
    // Choose endpoint based on input type
    let endpoint: string;
    let requestBody: any;
    let headers: any = {};
    
    if (isImage) {
      // Single image processing
      endpoint = '/api/recipes/parse-image';
      
      // Convert data URL to FormData
      const formData = new FormData();
      
      // Detect if this is a PDF based on the URI
      const isPDFFile = recipeInput.toLowerCase().includes('.pdf');
      
      const imageFile = {
        uri: recipeInput,
        type: isPDFFile ? 'application/pdf' : 'image/jpeg',
        name: isPDFFile ? 'recipe.pdf' : 'recipe-image.jpg',
      } as any;
      formData.append('image', imageFile);
      requestBody = formData;
    } else if (isImages) {
      // Multiple images processing
      endpoint = '/api/recipes/parse-images';
      
      // Parse the JSON array of image URIs
      const imageUris = JSON.parse(recipeInput);
      const formData = new FormData();
      
      imageUris.forEach((uri: string, index: number) => {
        const imageFile = {
          uri: uri,
          type: 'image/jpeg',
          name: `recipe-image-${index}.jpg`,
        } as any;
        formData.append('images', imageFile);
      });
      
      requestBody = formData;
    } else {
      // URL/text processing (existing logic)
      endpoint = '/api/recipes/parse';
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify({ input: recipeInput, forceNewParse });
    }
    
    const backendUrl = `${baseBackendUrl}${endpoint}`;

    try {
      if (__DEV__) {
        console.log(`[parseRecipe] Preparing to send request to: ${backendUrl}`);
        console.log('[parseRecipe] Input type:', inputType);

        // Environment variables loaded (values not logged for security)
      }

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (__DEV__) {
        console.log(`[parseRecipe] Response Status: ${response.status}`);
      }

      if (response.ok) {
        const result = await response.json();
        if (__DEV__) {
          console.log('[parseRecipe] Response JSON:', result);
        }

        // Handle video recipe source
        if (result.source === 'link') {
          // This is a success case where a link was followed from a caption.
          // The user gets the recipe they wanted, so we can proceed.
          // The source URL in the recipe data will correctly point to the blog post.
        } else if (result.source === null && !result.recipe) {
          // This is a specific failure case for videos where no recipe or link was found.
          handleError(
            'Could Not Find Recipe',
            "We couldn't find a recipe in this video's caption or a link to one.",
          undefined,
          { onDismissCallback: handleBack }
          );
          return null; // Stop further processing
        }

        if (result.recipe) {
          setRecipeData(result.recipe);
          
          // Track successful recipe parsing
          if (__DEV__) {
            console.log('[POSTHOG] Tracking event: recipe_parsed', { 
              inputType, 
              ingredientsCount: result.recipe.ingredients?.length || 0 
            });
          }
          await track('recipe_parsed', { 
            inputType, 
            ingredientsCount: result.recipe.ingredients?.length || 0 
          });
          
          return result.recipe;
        } else {
          // Show error modal globally
          const userMessage = result.error 
            ? processBackendError(result)
            : "We received an incomplete response from the server. Please try again.";
          if (isMountedRef.current) {
            handleError('Oops!', userMessage, { stage: 'parsing' }, { onDismissCallback: handleBack });
          }
        }
      } else {
        try {
          const errorResponse = await response.json();
          if (__DEV__) {
            console.log('[parseRecipe] Error response structure:', JSON.stringify(errorResponse, null, 2));
            console.log('[parseRecipe] Error response type:', typeof errorResponse);
            console.log('[parseRecipe] Has error property:', !!errorResponse.error);
            console.log('[parseRecipe] Error code:', errorResponse.error?.code);
          }
          if (isMountedRef.current) {
            const processedMessage = processBackendError(errorResponse);
            // Don't pass stage or statusCode if we have a properly processed error message
            // to avoid normalizeAppError overriding it with generic messages
            const isRecipeSpecificError = processedMessage.includes('images') || 
                                        processedMessage.includes('recipe') ||
                                        processedMessage.includes('ingredients');
            const errorOptions = isRecipeSpecificError 
              ? { context: 'image_processing' } // Use context instead of stage
              : { stage: 'parsing', statusCode: response.status };
            
            handleError(
              'Recipe Processing Error',
              processedMessage,
              errorOptions,
              { onDismissCallback: handleBack }
            );
          }
        } catch {
          const statusMessage = getNetworkErrorMessage(`HTTP ${response.status}`, response.status);
          if (isMountedRef.current) {
            handleError('Oops!', statusMessage, { statusCode: response.status }, { onDismissCallback: handleBack });
          }
        }
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        handleError('Oops!', e, undefined, { onDismissCallback: handleBack });
      }
    } finally {
      setIsParsingFinished(true);
    }
    return null;
  };

  useEffect(() => {
    let parsedRecipeResult: ParsedRecipe | null = null;
    const runParse = async () => {
      parsedRecipeResult = await parseRecipe();
    }
    runParse();

    return () => {
      // Cleanup if component unmounts during async operation
    };
  }, [recipeInput, componentKey]);

  useEffect(() => {
    let finalRecipeData: ParsedRecipe | null = null;
    const processFinishedParse = async () => {
      if (isParsingFinished && !alreadyNavigated.current) {
        alreadyNavigated.current = true;
        
        // Use the recipe data from the state, which should have been updated
        finalRecipeData = recipeData;
        if (__DEV__) {
          console.log('[LoadingExperienceScreen] Parsing complete. Starting spinner...');
          console.log('[LoadingExperienceScreen] recipeData with ID:', finalRecipeData?.id);
        }
        
        if (finalRecipeData) {
          // Hide checklist and start spinner animation
          setHideChecklist(true);
          setShowSpinner(true);
          
          // Animate rotation to 360 degrees with video-specific timing
          rotation.value = withTiming(360, { duration: getSpinnerDuration() }, (finished) => {
            if (finished && finalRecipeData) {
              runOnJS(handleSpinComplete)(finalRecipeData);
            }
          });
        }
      }
    };
    processFinishedParse();
  }, [isParsingFinished, recipeData]);

  const handleRetry = () => {
    setIsParsingFinished(false);
    setComponentKey((prevKey: number) => prevKey + 1);
  };

  const handleBack = () => {
    onFailure();
  };

  const headerLogo = useMemo(() => (
    <LogoHeader
      animatedLogo={(
        <Animated.View>
          <Logo
            width={isCompact ? 300 : 400}
            height={isCompact ? 150 : 200}
            style={{
              alignSelf: 'center',
              marginTop: isCompact ? SPACING.lg : SPACING.xl,
              marginBottom: 0,
            }}
          />
        </Animated.View>
      )}
    />
  ), [isCompact]);

  if (loadingMode === 'checklist') {
    return (
      <View style={{ flex: 1 }}>
        {headerLogo}
        {!hideChecklist && (
          <View style={styles.contentWrapper}>
            <View style={styles.checklistContainer}>
              <ChecklistProgress isFinished={isParsingFinished} inputType={inputType} />
            </View>
          </View>
        )}
        {(showSpinner || checkmarkShown) && (
          <View 
            style={styles.overlayContainer}
            onLayout={() => {
              if (__DEV__) {
                console.log(`[${new Date().toISOString()}] [OVERLAY_CONTAINER] Persistent overlay mounted/rendered`);
              }
            }}
          >
            {showSpinner && (
              <Animated.View 
                entering={FadeIn.duration(300).withCallback((finished) => {
                  if (__DEV__) {
                    console.log(`[${new Date().toISOString()}] [SPINNER] FadeIn animation finished: ${finished}`);
                  }
                })}
                exiting={FadeOut.duration(0).withCallback((finished) => {
                  if (__DEV__) {
                    console.log(`[${new Date().toISOString()}] [SPINNER] FadeOut animation finished: ${finished}`);
                  }
                })}
                style={styles.spinnerContent}
                onLayout={() => {
                  if (__DEV__) {
                    console.log(`[${new Date().toISOString()}] [SPINNER] Component mounted/rendered`);
                  }
                }}
              >
                <Animated.View style={[styles.spinner, spinnerStyle]} />
              </Animated.View>
            )}
            {checkmarkShown && (
              <Animated.View 
                entering={FadeIn.duration(400).withCallback((finished) => {
                  if (__DEV__) {
                    console.log(`[${new Date().toISOString()}] [CHECKMARK] FadeIn animation finished: ${finished}`);
                  }
                })}
                style={styles.checkmarkContent}
                onLayout={() => {
                  if (__DEV__) {
                    console.log(`[${new Date().toISOString()}] [CHECKMARK] Component mounted/rendered`);
                  }
                }}
              >
                <Text style={styles.bigCheckmark}>✓</Text>
                <Text style={styles.readyText}>{getReadyText()}</Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {headerLogo}
    </View>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    width: '100%',
    marginTop: SPACING.xxxl, // More space below Meez logo
    marginBottom: SPACING.xxxl, // Maintain spacing that was previously provided by tagline
  } as ViewStyle,
  checklistContainer: {
    alignItems: 'stretch',
  } as ViewStyle,
  logoContainer: {
    alignItems: 'center',
    paddingTop: 24,
    marginBottom: SPACING.md,
  } as ViewStyle,
  logo: {
    width: 220,
    height: 120,
    marginBottom: SPACING.md,
    alignSelf: 'center',
  } as ImageStyle,
  tagline: {
    fontSize: FONT.size.smBody,
    fontFamily: FONT.family.inter,
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xxxl,
  } as TextStyle,
  loadingText: {
    marginTop: 12, // TODO: SPACING.md is 16
    fontSize: FONT.size.lg,
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.textDark,
  } as TextStyle,
  loadingIndicator: {
    height: BORDER_WIDTH.thick,
    width: SPACING.xxl,
    backgroundColor: COLORS.primary,
    marginVertical: SPACING.md,
  } as ViewStyle,
  loadingHint: {
    fontSize: FONT.size.smBody,
    fontFamily: FONT.family.inter,
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  } as TextStyle,
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 12,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bigCheckmark: {
    fontSize: 72,
    fontWeight: 'bold',
    color: COLORS.textDark,
  } as TextStyle,
  readyText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 12,
  } as TextStyle,
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 5,
    borderColor: COLORS.lightGray,
    borderTopColor: COLORS.textDark,
  } as ViewStyle,
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Reduced from 1000 to ensure GlobalErrorModal (zIndex: 9999) appears above
    pointerEvents: 'none',
  } as ViewStyle,
  spinnerContent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  checkmarkContent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
});

export default LoadingExperienceScreen;
