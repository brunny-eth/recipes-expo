import React, { useState, useEffect, useRef } from 'react';
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
import { normalizeError } from '@/utils/normalizeError';
import GlobalErrorModal from '../GlobalErrorModal';
import { CombinedParsedRecipe as ParsedRecipe } from '../../common/types';
import { FONT } from '@/constants/typography';
import LogoHeaderLayout from '../LogoHeaderLayout';
import { getErrorMessage, getNetworkErrorMessage } from '../../utils/errorMessages';
import { ParseErrorCode } from '../../common/types/errors';

interface LoadingExperienceScreenProps {
  recipeInput: string;
  onComplete: () => void;
  onFailure: () => void;
  loadingMode: 'checklist' | 'default';
}

const LoadingExperienceScreen: React.FC<LoadingExperienceScreenProps> = ({
  recipeInput,
  onComplete,
  onFailure,
  loadingMode,
}) => {
  console.log(`[${new Date().toISOString()}] [LoadingExperienceScreen] render/mount with input: ${recipeInput}`);
  const router = useRouter();
  const alreadyNavigated = useRef(false);
  const [isParsingFinished, setIsParsingFinished] = useState(false);
  const [recipeData, setRecipeData] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [componentKey, setComponentKey] = useState(0);
  const [checkmarkShown, setCheckmarkShown] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [hideChecklist, setHideChecklist] = useState(false);
  const handleError = useHandleError();
  const isMountedRef = useRef(true);
  
  // Animation values
  const rotation = useSharedValue(0);
  
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
    console.log(`[${new Date().toISOString()}] [STATE] showSpinner changed to: ${showSpinner}`);
  }, [showSpinner]);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] [STATE] checkmarkShown changed to: ${checkmarkShown}`);
  }, [checkmarkShown]);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] [STATE] hideChecklist changed to: ${hideChecklist}`);
  }, [hideChecklist]);

  // Helper function to process backend error responses
  const processBackendError = (errorResponse: any): string => {
    try {
      // Check if it's a structured error response with ParseErrorCode
      if (errorResponse && typeof errorResponse === 'object') {
        if (errorResponse.error && errorResponse.error.code) {
          const code = errorResponse.error.code as ParseErrorCode;
          const inputType = recipeInput.startsWith('http') ? 'url' : 'text';
          return getErrorMessage(code, inputType);
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
            const inputType = recipeInput.startsWith('http') ? 'url' : 'text';
            return getErrorMessage(code, inputType);
          }
        } catch {
          // Not JSON, treat as plain string
          return getNetworkErrorMessage(errorResponse);
        }
      }
      
      return getNetworkErrorMessage('Unknown error');
    } catch (error) {
      console.error('[LoadingExperienceScreen] Error processing backend error:', error);
      return "We're having trouble processing your recipe. Please try again.";
    }
  };

  const handleSpinComplete = () => {
    if (!isMountedRef.current) return;
    
    console.log(`[${new Date().toISOString()}] [handleSpinComplete] Starting state changes...`);
    
    console.log(`[${new Date().toISOString()}] [handleSpinComplete] setShowSpinner(false) - HIDING SPINNER`);
    setShowSpinner(false);
    
    console.log(`[${new Date().toISOString()}] [handleSpinComplete] setCheckmarkShown(true) - SHOWING CHECKMARK`);
    setCheckmarkShown(true);
    
    // Navigate after 1 second
    setTimeout(() => {
      if (!isMountedRef.current || !recipeData) return;
      
      console.log(`[${new Date().toISOString()}] [handleSpinComplete] Navigating to recipe summary...`);
      router.replace({
        pathname: '/recipe/summary',
        params: {
          recipeData: JSON.stringify(recipeData),
          from: '/',
        },
      });
      onComplete();
    }, 1000);
  };

  const parseRecipe = async () => {
    const baseBackendUrl = process.env.EXPO_PUBLIC_API_URL!;
    const endpoint = '/api/recipes/parse';
    const backendUrl = `${baseBackendUrl}${endpoint}`;

    try {
      console.log(`[parseRecipe] Preparing to send request to: ${backendUrl}`);
      const requestBody = { input: recipeInput };
      console.log(
        '[parseRecipe] Request Body:',
        JSON.stringify(requestBody, null, 2),
      );

      // Temporarily log env vars to verify them at runtime
      console.log('EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
      console.log('EXPO_PUBLIC_AUTH_URL:', process.env.EXPO_PUBLIC_AUTH_URL);

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[parseRecipe] Response Status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log('[parseRecipe] Response JSON:', result);
        if (result.recipe) {
          setRecipeData(result.recipe);
        } else {
          // Handle successful response but no recipe data
          const userMessage = result.error 
            ? processBackendError(result)
            : "We received an incomplete response from the server. Please try again.";
          setError(userMessage);
        }
      } else {
        // Handle HTTP error responses
        try {
          const errorResponse = await response.json();
          console.log('[parseRecipe] Error response JSON:', errorResponse);
          setError(processBackendError(errorResponse));
        } catch {
          // If JSON parsing fails, fall back to status-based message
          const statusMessage = getNetworkErrorMessage(`HTTP ${response.status}`, response.status);
          setError(statusMessage);
        }
      }
    } catch (e: any) {
      console.error('[parseRecipe] Fetch Error:', e);
      // Handle network/connection errors
      setError(getNetworkErrorMessage(e));
    } finally {
      setIsParsingFinished(true);
    }
  };

  useEffect(() => {
    parseRecipe();
  }, [recipeInput, componentKey]);

  useEffect(() => {
    if (
      isParsingFinished &&
      !error &&
      recipeData &&
      !alreadyNavigated.current
    ) {
      alreadyNavigated.current = true;
      console.log('[LoadingExperienceScreen] Parsing complete. Starting spinner...');
      console.log(
        '[LoadingExperienceScreen] recipeData with ID:',
        recipeData?.id,
      );
      
      // Hide checklist and start spinner animation
      setHideChecklist(true);
      setShowSpinner(true);
      
      // Animate rotation to 360 degrees over 700ms
      rotation.value = withTiming(360, { duration: 700 }, (finished) => {
        console.log(`[${new Date().toISOString()}] [ROTATION] Spinner rotation animation finished: ${finished}`);
        if (finished) {
          runOnJS(handleSpinComplete)();
        }
      });
    }
  }, [isParsingFinished, recipeData, error, router]);

  const handleRetry = () => {
    setError(null);
    setIsParsingFinished(false);
    setComponentKey((prevKey: number) => prevKey + 1);
  };

  const handleBack = () => {
    onFailure();
  };

  if (loadingMode === 'checklist') {
    return (
      <View style={{ flex: 1 }}>
        <LogoHeaderLayout>
          <GlobalErrorModal
            visible={!!error}
            message={error ?? ''}
            title="Oops!"
            onClose={handleBack}
          />
          {!hideChecklist && (
            <View style={styles.contentWrapper}>
              <Text style={styles.tagline}>Working on our mise en place...</Text>
              <View style={styles.checklistContainer}>
                <ChecklistProgress isFinished={isParsingFinished} />
              </View>
            </View>
          )}
        </LogoHeaderLayout>

        {(showSpinner || checkmarkShown) && (
          <View 
            style={styles.overlayContainer}
            onLayout={() => console.log(`[${new Date().toISOString()}] [OVERLAY_CONTAINER] Persistent overlay mounted/rendered`)}
          >
            {showSpinner && (
              <Animated.View 
                entering={FadeIn.duration(300).withCallback((finished) => {
                  console.log(`[${new Date().toISOString()}] [SPINNER] FadeIn animation finished: ${finished}`);
                })}
                exiting={FadeOut.duration(0).withCallback((finished) => {
                  console.log(`[${new Date().toISOString()}] [SPINNER] FadeOut animation finished: ${finished}`);
                })}
                style={styles.spinnerContent}
                onLayout={() => console.log(`[${new Date().toISOString()}] [SPINNER] Component mounted/rendered`)}
              >
                <Animated.View style={[styles.spinner, spinnerStyle]} />
              </Animated.View>
            )}
            {checkmarkShown && (
              <Animated.View 
                entering={FadeIn.duration(400).withCallback((finished) => {
                  console.log(`[${new Date().toISOString()}] [CHECKMARK] FadeIn animation finished: ${finished}`);
                })}
                style={styles.checkmarkContent}
                onLayout={() => console.log(`[${new Date().toISOString()}] [CHECKMARK] Component mounted/rendered`)}
              >
                <Text style={styles.bigCheckmark}>✓</Text>
                <Text style={styles.readyText}>Recipe Ready!</Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <LogoHeaderLayout>
      <GlobalErrorModal
        visible={!!error}
        message={error ?? ''}
        title="Oops!"
        onClose={handleBack}
      />
      <View style={styles.logoContainer}>
        <Text style={styles.loadingText}>Loading....</Text>
        <View style={styles.loadingIndicator} />
        <Text style={styles.loadingHint}>
          just a moment while we transform the recipe into something more
          useful...
        </Text>
      </View>
    </LogoHeaderLayout>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    width: '100%',
    marginTop: -SPACING.xxxl,
  } as ViewStyle,
  checklistContainer: {
    alignItems: 'stretch',
  } as ViewStyle,
  logoContainer: {
    alignItems: 'center',
  } as ViewStyle,
  tagline: {
    fontSize: FONT.size.smBody,
    fontFamily: FONT.family.inter,
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
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
    color: COLORS.primary,
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
    borderTopColor: COLORS.primary,
  } as ViewStyle,
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
