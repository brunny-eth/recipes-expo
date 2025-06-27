import React from 'react';
import { useState, useEffect, useRef } from 'react'; 
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, KeyboardAvoidingView, Platform, View as RNView, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, OVERLAYS, SPACING, RADIUS, BORDER_WIDTH, ICON_SIZE } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErrorModal } from '@/context/ErrorModalContext';
import { titleText, bodyText, bodyStrongText, captionText, FONT } from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [recipeUrl, setRecipeUrl] = React.useState('');
  const router = useRouter();
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const { showError } = useErrorModal();
  const { session, user } = useAuth(); 
  const { hasUsedFreeRecipe } = useFreeUsage(); 

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

    const recipeInput = recipeUrl.trim();

    // If the user is not authenticated, we need to check their free usage
    // and mark it as used if they are submitting a recipe.
    if (!session) {
      if (hasUsedFreeRecipe) {
        // This case should theoretically be handled by the layout redirect,
        // but as a safeguard, we prevent submission and show an error.
        showError(
          "Login Required",
          "You've already used your free recipe. Please log in to continue.",
          () => router.replace('/login')
        );
        return;
      }
      
    }

    // Proceed with navigation
    handleNavigation(recipeInput);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <RNView style={styles.outerContainer}>
            <View style={styles.topContent}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/meez_logo.webp')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.contentContainer}>
                <View style={styles.featuresContainer}>
                  <Text style={styles.mainFeatureText}>{'Recipes, refined.'}</Text>
                  <Text style={styles.featureText}>Built for the home chef.</Text>
                </View>
              </View>
            </View>
            <View style={styles.bottomContent}>
              <View style={styles.inputContainer}>
                <View style={styles.textInputWrapper}>
                  <TouchableOpacity style={styles.uploadButton} onPress={() => { /* TODO */ }}>
                    <MaterialCommunityIcons name="plus" size={ICON_SIZE.md} color={COLORS.primary} />
                  </TouchableOpacity>
                  <View style={styles.divider} />
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
                </View>
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitButtonText}>Go</Text>
                </TouchableOpacity>
              </View>
            </View>
          </RNView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
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
    paddingHorizontal: SPACING.lg,
  },
  topContent: {
    flex: 2,
    justifyContent: 'center',
    paddingBottom: SPACING.xl,
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  contentContainer: {
    alignItems: 'center',
  },
  featuresContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
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
    fontSize: FONT.size.lg,
    color: COLORS.textDark, // instead of darkGray
    opacity: 0.7, // gives contrast without using a different color
    textAlign: 'center',
    maxWidth: 300,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
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
    fontSize: FONT.size.body,
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
  logo: {
    width: 150,
    height: 150,
  },
});