import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
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
  OVERLAYS,
} from '@/constants/theme';
import { useErrorModal } from '@/context/ErrorModalContext';
import {
  bodyText,
  bodyStrongText,
  FONT,
  titleText,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import { useFreeUsage } from '@/context/FreeUsageContext';
import LogoHeaderLayout from '@/components/LogoHeaderLayout';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const router = useRouter();
  const { showError } = useErrorModal();
  const { session } = useAuth();
  const { hasUsedFreeRecipe } = useFreeUsage();

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[HomeScreen] Component DID MOUNT');
    return () => {
      console.log('[HomeScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] 🎯 useFocusEffect triggered');
      console.log('[HomeScreen] 👁️ Screen focused');

      return () => {
        console.log('[HomeScreen] 🌀 useFocusEffect cleanup');
        console.log('[HomeScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [])
  );

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
    <LogoHeaderLayout>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View>
            <Text style={styles.mainFeatureText}>Recipes, refined.</Text>
            <Text style={styles.featureText}>Built for the home chef.</Text>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          >
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <View style={styles.textInputWrapper}>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => {
                      /* TODO */
                    }}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={ICON_SIZE.md}
                      color={COLORS.primary}
                    />
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
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </LogoHeaderLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
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
    marginBottom: SPACING.lg,
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
});