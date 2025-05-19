import { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Keyboard, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { ArrowRight } from 'lucide-react-native';
import ChefIcon from '@/assets/images/Chef.svg';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSubmit = async () => {
    // --- REMOVE Strict URL Validation, keep only a basic check for non-empty input ---
    // const urlPattern = new RegExp('^(https?:\\/\\/)?'+
    // '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))'+
    // '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+
    // '(\\?[;&a-z\\d%_.~+=-]*)?'+
    // '(\\#[-a-z\\d_]*)?$','i');

    // if (!recipeUrl || !urlPattern.test(recipeUrl)) {
    //     Alert.alert("Invalid Input", "Please enter a valid recipe URL starting with http:// or https://");
    //     return; // Stop execution if validation fails
    // }

    if (!recipeUrl || recipeUrl.trim() === '') {
        Alert.alert("Input Required", "Please paste a recipe URL or recipe text.");
        return; // Stop execution if input is empty
    }
    // --- End Validation Update ---

    // if (!recipeUrl) return; // This check is somewhat redundant now but safe to keep
    // Renaming recipeUrl to recipeInput for clarity, though the state variable name remains recipeUrl
    const recipeInput = recipeUrl.trim();
    
    Keyboard.dismiss();
    setIsLoading(true);
    
    // TODO: Replace with your actual local IP and port if different
    const backendUrl = 'http://192.168.1.99:3000/api/recipes/parse'; 

    try {
      console.log(`Sending request to: ${backendUrl} with URL: ${recipeInput}`);
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: recipeInput }), // Changed from url: recipeUrl to input: recipeInput
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Backend response:', JSON.stringify(result, null, 2));

        if (result.recipe) {
          console.log('Recipe data found in response.');
          console.log("Attempting navigation to /recipe/summary..."); 
          router.push({
            pathname: '/recipe/summary',
            params: { recipeData: JSON.stringify(result.recipe) }
          });
          console.log("Navigation call finished."); 
        } else {
          console.error("Parsed recipe data key ('recipe') is missing in the response object:", result);
          alert('Error: Received incomplete recipe data from server.');
        }

      } else {
        console.error(`Backend responded with status: ${response.status}`);
        console.error('Backend error:', result);
        alert(`Error: ${result.error || 'Failed to parse recipe'}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      // Handle network errors (e.g., server unreachable)
      alert(`Network Error: ${error instanceof Error ? error.message : 'Could not connect to server'}`);
    } finally {
      // Ensure loading state is turned off regardless of success or failure
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
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
            <View style={{ height: 16 }} />
            <Text style={styles.title}>Sift and Serve</Text>
            <View style={styles.featuresContainer}>
              <Text style={styles.featureText}>No essays.</Text>
              <Text style={styles.featureText}>No ads.</Text>
              <Text style={styles.featureText}>Just the recipe you came for.</Text>
            </View>
            <View style={{ height: 24 }} />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="  Paste a recipe link or recipe text here"
                placeholderTextColor={COLORS.darkGray}
                value={recipeUrl}
                onChangeText={setRecipeUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity 
                style={[styles.submitButton, !recipeUrl ? styles.submitButtonDisabled : null]} 
                onPress={handleSubmit}
                disabled={!recipeUrl}
              >
                <ArrowRight size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 68,
    marginBottom: 30,
  },
  contentContainer: {
    alignItems: 'center',
    paddingTop: 18,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  featuresContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  featureText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
  },
  submitButton: {
    position: 'absolute',
    right: 8,
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