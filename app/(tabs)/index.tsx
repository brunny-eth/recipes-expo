import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Keyboard, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { ArrowRight } from 'lucide-react-native';
import ChefIcon from '@/assets/images/Chef.svg';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
    if (!recipeUrl) return;
    
    Keyboard.dismiss();
    setIsLoading(true);
    
    // Simulate API call to parse recipe
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to recipe detail with mock ID
      router.push('/recipe/sample-recipe');
    }, 2000);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View 
          entering={FadeIn.duration(500)}
          style={styles.logoContainer}
        >
          <ChefIcon width={120} height={120} />
          <Text style={styles.loadingText}>Loading....</Text>
          <View style={styles.loadingIndicator} />
          <Text style={styles.loadingHint}>
            Just a moment while we transform your recipe!
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
            <View style={{ height: 32 }} />
            <Text style={styles.title}>Transform recipes</Text>
            <View style={styles.featuresContainer}>
              <Text style={styles.featureText}>No ads</Text>
              <Text style={styles.featureText}>No fluff</Text>
              <Text style={styles.featureText}>Just recipes</Text>
            </View>
            <View style={{ height: 24 }} />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Paste a recipe link here"
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
    marginBottom: 40,
  },
  contentContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 24,
  },
  featuresContainer: {
    alignItems: 'center',
    marginBottom: 40,
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
    marginTop: 20,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
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
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'center',
    maxWidth: '80%',
  },
});