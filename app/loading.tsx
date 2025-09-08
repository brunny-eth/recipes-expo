import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingExperienceScreen from '@/components/loading/LoadingExperienceScreen';
import {
  SafeAreaView,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  Platform,
  Animated,
} from 'react-native';
import { COLORS, SPACING, ICON_SIZE } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { bodyStrongText } from '@/constants/typography';
import { useHandleError } from '@/hooks/useHandleError';

export default function LoadingRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuth();
  const handleError = useHandleError();
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessed = useRef(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  const { recipeUrl, forceNewParse, inputType, type, variationType, recipeId } = params as {
    recipeUrl?: string;
    forceNewParse?: string;
    inputType?: string;
    type?: string;
    variationType?: string;
    recipeId?: string;
  };

  // Handle remix processing
  useEffect(() => {
    const processRemix = async () => {
      if (hasProcessed.current || type !== 'remix') return;
      hasProcessed.current = true;

      try {
        if (!variationType || !recipeId) {
          throw new Error('Invalid parameters for remix loading');
        }

        // Make the remix API call
        const backendUrl = process.env.EXPO_PUBLIC_API_URL!;
        const response = await fetch(`${backendUrl}/api/recipes/variations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipeId: parseInt(recipeId as string),
            variationType: variationType as string,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to apply variation');
        }

        const data = await response.json();

        if (!data.recipe?.id) {
          throw new Error('Invalid response from remix API');
        }

        // Show checkmark briefly
        setIsProcessing(false);
        setShowCheckmark(true);

        // Navigate to the new recipe after a short delay
        setTimeout(() => {
          router.replace({
            pathname: '/recipe/summary',
            params: {
              recipeId: data.recipe.id.toString(),
              entryPoint: 'new',
              from: 'variation',
            }
          });
        }, 800);

      } catch (error) {
        console.error('Remix processing error:', error);
        setIsProcessing(false);
        handleError('Remix Error', 'Failed to apply recipe variation. Please try again.');
        // Navigate back to the original recipe on error
        setTimeout(() => {
          router.back();
        }, 1000);
      }
    };

    if (type === 'remix') {
      processRemix();
    }
  }, [type, variationType, recipeId, router, handleError]);

  // Spinning animation
  useEffect(() => {
    if (type === 'remix' && isProcessing) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();

      return () => {
        spinAnimation.stop();
        spinValue.setValue(0);
      };
    }
  }, [type, isProcessing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Move navigation to useEffect to avoid setState during render
  React.useEffect(() => {
    if (type !== 'remix' && !recipeUrl) {
      console.error('[LoadingRoute] No recipe URL provided.');
      router.back();
    }
  }, [recipeUrl, type, router]);

  // Show remix loading screen
  if (type === 'remix') {
    if (isProcessing) {
      return (
        <View style={styles.container}>
          <View style={styles.spinnerContainer}>
            <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
            <Text style={styles.loadingText}>Remixing the recipe...</Text>
          </View>
        </View>
      );
    }

    if (showCheckmark) {
      return (
        <View style={styles.container}>
          <View style={styles.checkmarkContainer}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.readyText}>Remix Ready!</Text>
          </View>
        </View>
      );
    }

    return null;
  }

  // Show parsing loading screen
  if (!recipeUrl) {
    return null;
  }

  const handleClose = () => {
    // Current navigation is to /tabs. This is the desired "home" screen for exit.
    console.log('[LoadingRoute] Close button pressed. Navigating to /tabs.'); // Added for debugging
    router.replace('/tabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top navigation bar - copied exactly from RecipeStepsHeader */}
      <View style={styles.mainHeader}>
        <TouchableOpacity style={styles.button} onPress={handleClose}>
          <MaterialCommunityIcons
            name="close"
            size={ICON_SIZE.lg}
            color={COLORS.textDark}
          />
        </TouchableOpacity>
      </View>

      <LoadingExperienceScreen
        recipeInput={recipeUrl}
        loadingMode="checklist"
        forceNewParse={forceNewParse === 'true'}
        inputType={inputType}
        onComplete={() => {
          console.log('[LoadingRoute] Recipe parsing complete callback.');
        }}
        onFailure={() => {
          console.log('[LoadingRoute] Recipe parsing failed, navigating back.');
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  } as ViewStyle,
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.sm,
    paddingBottom: SPACING.sm,
  } as ViewStyle,
  button: {
    padding: SPACING.sm,
  } as ViewStyle,
  // Remix loading styles
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 5,
    borderColor: COLORS.lightGray,
    borderTopColor: COLORS.primary,
    marginBottom: SPACING.lg,
  } as ViewStyle,
  loadingText: {
    ...bodyStrongText,
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  checkmarkContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  checkmark: {
    fontSize: 72,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.md,
  } as TextStyle,
  readyText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.black,
    textAlign: 'center',
  } as TextStyle,
});
