import React from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, KeyboardAvoidingView, Platform, View as RNView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';
import { titleText, bodyText, bodyStrongText, captionText } from '@/constants/typography';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = React.useState('');
  const router = useRouter();
  const navigation = useNavigation();
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const { showError } = useErrorModal();

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

  const handleSubmit = async () => {
    if (!recipeUrl || recipeUrl.trim() === '') {
        showError({ title: "Input Required", message: "Please paste a recipe URL or recipe text." });
        return;
    }
    const recipeInput = recipeUrl.trim();
    Keyboard.dismiss();
    
    router.push({
      pathname: '/loading',
      params: { recipeInput },
    });
    setRecipeUrl(''); // Clear input after submission
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
              <Text style={styles.mainFeatureText}>No essays. No ads.</Text>
              <Text style={styles.mainFeatureText}>Just the recipe.</Text>
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
                style={[styles.submitButton, !recipeUrl ? styles.submitButtonDisabled : null]} 
                onPress={handleSubmit}
                disabled={!recipeUrl}
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
    position: 'relative',
  },
  input: {
    ...bodyText,
    flex: 1,
    height: 50,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingRight: 60, // Make space for the button
  },
  submitButton: {
    position: 'absolute',
    right: 6,
    height: 38,
    width: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
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
});