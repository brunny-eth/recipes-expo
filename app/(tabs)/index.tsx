import React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View as RNView,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  COLORS,
  OVERLAYS,
  SPACING,
  RADIUS,
  BORDER_WIDTH,
} from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorModal } from '@/context/ErrorModalContext';
import {
  titleText,
  bodyText,
  bodyStrongText,
  captionText,
  FONT,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = React.useState('');
  const router = useRouter();
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const { showError } = useErrorModal();
  const { session, user } = useAuth();
  const { hasUsedFreeRecipe } = useFreeUsage();

  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {},
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {},
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
      showError('Input Required', 'Please paste a recipe URL or recipe text.');
      return;
    }

    const recipeInput = recipeUrl.trim();

    // If the user is not authenticated, we need to check their free usage
    // and mark it as used if they are submitting a recipe.
    if (!session) {
      if (hasUsedFreeRecipe) {
        // This case should theoretically be handled by the layout redirect,
        // but as a safeguard, we prevent submission and show an error.
        showError(
          'Login Required',
          "You've already used your free recipe. Please log in to continue.",
          () => router.replace('/login'),
        );
        return;
      }
    }

    // Proceed with navigation
    handleNavigation(recipeInput);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
            <Image
              source={require('@/assets/images/meez_logo.png')}
              style={{ width: 150, height: 150 }}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(500)}
            style={styles.contentContainer}
          >
            <View style={styles.featuresContainer}>
              <Text style={styles.mainFeatureText}>
                {'No essays. No ads.\nJust the recipe.'}
              </Text>
              <Text style={styles.featureText}>
                Skip the scrolling and start cooking.
              </Text>
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
                onSubmitEditing={handleSubmit}
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: SPACING.xxl, // Adjust this value to move the logo up or down
  },
  contentContainer: {
    alignItems: 'center',
  },
  featuresContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: -SPACING.xl, // TODO: This is awkward. Maybe a different layout approach?
  },
  mainFeatureText: {
    fontFamily: FONT.family.interSemiBold,
    fontSize: 30, // TODO: Add FONT.size.h1? or similar
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 34, // TODO: No token for 34. FONT.lineHeight.loose is 30.
    letterSpacing: -0.5,
  },
  featureText: {
    fontFamily: FONT.family.inter,
    fontSize: FONT.size.body,
    color: COLORS.textDark, // instead of darkGray
    opacity: 0.7, // gives contrast without using a different color
    textAlign: 'center',
    maxWidth: 300,
    marginTop: SPACING.sm,
  },
  inputWrapper: {
    marginBottom: SPACING.xl, // Adjust this value to move the input bar up or down
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50, // TODO: Should this be a token? SPACING.xxl?
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  input: {
    ...bodyText,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.md,
    color: COLORS.textDark,
  },
  submitButton: {
    height: '100%',
    width: SPACING.xxl,
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
    marginTop: SPACING.xl,
    fontSize: 18, // TODO: Add FONT.size.lg?
    color: COLORS.textDark,
  },
  loadingIndicator: {
    width: SPACING.xxl,
    height: 3, // TODO: BORDER_WIDTH.md?
    backgroundColor: COLORS.primary,
    marginVertical: SPACING.md,
  },
  loadingHint: {
    ...captionText,
    color: COLORS.darkGray,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: OVERLAYS.dark,
  },
  modalContainer: {
    width: '85%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
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
    fontSize: FONT.size.sectionHeader,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalMessage: {
    ...bodyText,
    marginBottom: SPACING.lg,
    textAlign: 'center',
    color: COLORS.darkGray,
    lineHeight: FONT.lineHeight.relaxed, // Was 22, now 24
  },
  modalButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14, // TODO: SPACING.md is 16. New token?
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.primary,
  },
  modalButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.body,
  },
  modalButtonTextSecondary: {
    color: COLORS.primary,
  },
  modalCancelButton: {
    marginTop: SPACING.sm,
  },
  modalCancelButtonText: {
    ...bodyText,
    color: COLORS.darkGray,
    fontSize: 14, // TODO: new FONT.size?
  },
});
