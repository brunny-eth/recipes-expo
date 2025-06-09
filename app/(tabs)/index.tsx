import { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, ActivityIndicator, KeyboardAvoidingView, Platform, View as RNView } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import ChefIcon from '@/assets/images/Chef.svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const [isInputFocused, setIsInputFocused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { showError } = useErrorModal();
  const handleError = useHandleError();

  // Reset loading state when component mounts
  useEffect(() => {
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, [])
  );

  // Update navigation options
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => null, // Remove back button
    });
  }, [navigation]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        // No longer need to manage keyboardVisible state
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // No longer need to manage keyboardVisible state
      }
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
    setIsLoading(true);
    
    const baseBackendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const endpoint = '/api/recipes/parse';
    const backendUrl = `${baseBackendUrl}${endpoint}`;

    try {
      console.log(`Sending request to: ${backendUrl} with input: ${recipeInput}`);
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', // Added to signal we prefer JSON
        },
        body: JSON.stringify({ input: recipeInput }),
      });

      if (response.ok) {
        try {
          const result = await response.json();
          if (result.recipe) {
            router.push({
              pathname: '/recipe/summary',
              params: { recipeData: JSON.stringify(result.recipe) }
            });
          } else {
            console.error("Parsed recipe data key ('recipe') is missing in the response object:", result);
            showError({ title: "Data Error", message: "Received incomplete recipe data from the server. Please check the format." });
          }
        } catch (jsonError: any) {
          console.error("[HomeScreen] JSON parsing error even though response.ok was true. Status:", response.status, "Error:", jsonError);
          const rawText = await response.text(); // Try to get raw text
          console.error("[HomeScreen] Raw response text for jsonError:", rawText);
          handleError(`Failed to parse server response: ${jsonError.message}. Server sent: ${rawText.substring(0,100)}...`, "ResponseParsingError");
        }
      } else {
        const responseText = await response.text(); // Get text for non-ok responses
        console.error(`[HomeScreen] Backend responded with status: ${response.status}. Response text:`, responseText);
        // Try to parse as JSON if it might contain an error object, otherwise use the text
        let backendErrorMsg = `Failed to process recipe (status ${response.status}).`;
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson && errorJson.error) {
            backendErrorMsg = errorJson.error;
          }
        } catch (e) {
          // Not JSON, or no .error field, use the raw text if it's not too long
          backendErrorMsg = responseText.length < 200 ? responseText : backendErrorMsg;
        }
        handleError(backendErrorMsg, "RecipeParsingBackend");
      }
    } catch (error: any) { // Catching network errors or other unexpected client-side errors
      console.error("[HomeScreen] Catch all handleSubmit error:", error);
      handleError(error, "RecipeParsingClient"); 
    } finally {
      setIsLoading(false); 
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <Animated.View 
          entering={FadeIn.duration(500)}
          style={styles.logoContainer}
        >
          <ChefIcon width={120} height={120} />
          <Text style={styles.loadingText}>Loading....</Text>
          <View style={styles.loadingIndicator} />
          <Text style={styles.loadingHint}>
            just a moment while we transform the recipe into something more useful...
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

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
            <ChefIcon width={120} height={120} />
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).duration(500)}
            style={styles.contentContainer}
          >
            <Text style={styles.title}>Sift and Serve</Text>
            <View style={styles.featuresContainer}>
              <Text style={styles.featureText}>No essays.</Text>
              <Text style={styles.featureText}>No ads.</Text>
              <Text style={styles.featureText}>Just the recipe you came for.</Text>
            </View>
          </Animated.View>

          <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Paste a recipe URL or text here"
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
                <Text style={{color: COLORS.white}}>Go</Text>
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
    paddingTop: 60, // Adjust as needed
  },
  contentContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  featuresContainer: {
    alignItems: 'center',
  },
  featureText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  inputWrapper: {
    // This wrapper ensures the input stays at the bottom
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingRight: 60, // Make space for the button
    fontFamily: 'Poppins-Regular',
  },
  submitButton: {
    position: 'absolute',
    right: 10,
    height: 40,
    width: 40,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  loadingText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 20,
    color: COLORS.textDark,
    marginTop: 20,
    marginBottom: 24,
  },
  loadingIndicator: {
    marginBottom: 30,
  },
  loadingHint: {
    fontFamily: 'Poppins-Regular',
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
    maxWidth: '80%',
  },
});