import React from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, KeyboardAvoidingView, Platform, View as RNView, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorModal } from '@/context/ErrorModalContext';
import { titleText, bodyText, bodyStrongText, captionText } from '@/constants/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getHasUsedFreeRecipe } from '@/server/lib/freeUsageTracker';

useEffect(() => {
  AsyncStorage.clear().then(() => {
    console.log('[DEBUG] AsyncStorage cleared');
  });
}, []);

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = React.useState('');
  const router = useRouter();
  const navigation = useNavigation();
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const { showError } = useErrorModal();
  const { session, isLoading, isAuthenticated } = useAuth();

  React.useEffect(() => {
    navigation.setOptions({
      headerLeft: () => null, // Remove back button
    });
  }, [navigation]);

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {}
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {}
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // This effect handles the redirection logic based on auth state and free usage.
  useEffect(() => {
    // Wait until auth status is known before doing anything.
    if (isLoading) return;

    // If the user is authenticated, we don't need to check for free usage.
    if (isAuthenticated) return;

    // If not loading and not authenticated, check free usage.
    const checkUsage = async () => {
      try {
        const hasUsedFree = await getHasUsedFreeRecipe();
        if (hasUsedFree) {
          if (__DEV__) {
            console.log('[UsageLimit] Free recipe used, redirecting to login from home screen.');
          }
          router.replace('/login');
        }
      } catch (error) {
        showError('Error', 'Could not check usage status.');
      }
    };

    checkUsage();
  }, [isLoading, isAuthenticated, router]);

  const handleNavigation = (recipeInput: string) => {
    Keyboard.dismiss();
    router.push({
      pathname: '/loading',
      params: { recipeInput },
    });
    setRecipeUrl(''); // Clear input after submission
  };

  const handleSubmit = async () => {
    if (!recipeUrl || recipeUrl.trim() === '') {
        showError("Input Required", "Please paste a recipe URL or recipe text.");
        return;
    }

    // The useEffect above handles the redirection logic.
    // By the time the user can submit, they are cleared to proceed.
    const recipeInput = recipeUrl.trim();
    handleNavigation(recipeInput);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        enabled={isInputFocused}
      >
        <RNView style={styles.outerContainer}>
          <Animated.View 
            entering={FadeIn.duration(500)}
            style={styles.logoContainer}
          >
            <Image source={require('@/assets/images/meez_logo.png')} style={{ width: 150, height: 150 }} />
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).duration(500)}
            style={styles.contentContainer}
          >
            <View style={styles.featuresContainer}>
              <Text style={styles.mainFeatureText}>{'No essays. No ads.\nJust the recipe.'}</Text>
              <Text style={styles.featureText}>Skip the scrolling and start cooking.</Text>
            </View>
          </Animated.View>

          <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Drop a recipe link or text."
                placeholderTextColor={COLORS.darkGray}
                value={recipeUrl}
                onChangeText={setRecipeUrl}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  outerContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 60, // Adjust this value to move the logo up or down
  },
  contentContainer: {
    alignItems: 'center',
  },
  featuresContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -48,
  },
  mainFeatureText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 30,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  featureText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: COLORS.textDark, // instead of darkGray
    opacity: 0.7, // gives contrast without using a different color
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 6,
  },
  inputWrapper: {
    marginBottom: 50, // Adjust this value to move the input bar up or down
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  input: {
    ...bodyText,
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    color: COLORS.textDark,
  },
  submitButton: {
    height: '100%',
    width: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.darkGray,
  },
  submitButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
  },
  loadingText: {
    ...bodyStrongText,
    marginTop: 20,
    fontSize: 18,
    color: COLORS.textDark,
  },
  loadingIndicator: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.primary,
    marginVertical: 15,
  },
  loadingHint: {
    ...captionText,
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    ...titleText,
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    ...bodyText,
    marginBottom: 24,
    textAlign: 'center',
    color: COLORS.darkGray,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modalButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 16,
  },
  modalButtonTextSecondary: {
    color: COLORS.primary,
  },
  modalCancelButton: {
    marginTop: 8,
  },
  modalCancelButtonText: {
    ...bodyText,
    color: COLORS.darkGray,
    fontSize: 14,
  },
});