import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Image, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import ChecklistProgress from './ChecklistProgress';
import { COLORS } from '@/constants/theme';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useHandleError } from '@/hooks/useHandleError';
import { normalizeError } from '@/utils/normalizeError';
import GlobalErrorModal from '../GlobalErrorModal';

interface LoadingExperienceScreenProps {
  recipeInput: string;
  onComplete: () => void;
  onFailure: () => void;
  loadingMode: 'checklist' | 'default';
}

const LoadingExperienceScreen: React.FC<LoadingExperienceScreenProps> = ({ recipeInput, onComplete, onFailure, loadingMode }) => {
    console.log(`[LoadingExperienceScreen] mount with input: ${recipeInput}`);
    const router = useRouter();
    const alreadyNavigated = useRef(false);
    const [isParsingFinished, setIsParsingFinished] = useState(false);
    const [recipeData, setRecipeData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [componentKey, setComponentKey] = useState(0);
    const handleError = useHandleError();

    const parseRecipe = async () => {
        const baseBackendUrl = process.env.EXPO_PUBLIC_API_URL!;
        const endpoint = '/api/recipes/parse';
        const backendUrl = `${baseBackendUrl}${endpoint}`;
    
        try {
          console.log(`[parseRecipe] Preparing to send request to: ${backendUrl}`);
          const requestBody = { input: recipeInput };
          console.log('[parseRecipe] Request Body:', JSON.stringify(requestBody, null, 2));

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
              setError(normalizeError("Received incomplete recipe data from the server."));
            }
          } else {
            const responseText = await response.text();
            setError(normalizeError(responseText));
          }
        } catch (e: any) {
            console.error('[parseRecipe] Fetch Error:', e);
            setError(normalizeError(e));
        } finally {
            setIsParsingFinished(true);
        }
    };

    useEffect(() => {
        parseRecipe();
    }, [recipeInput, componentKey]);
    
    useEffect(() => {
        if (isParsingFinished && !error && recipeData && !alreadyNavigated.current) {
            alreadyNavigated.current = true;
            console.log('[LoadingExperienceScreen] Parsing complete. Navigating...');
            router.replace({
              pathname: '/recipe/summary',
              params: { recipeData: JSON.stringify(recipeData) },
            });
            onComplete();
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
            <SafeAreaView style={styles.container}>
                <GlobalErrorModal
                    visible={!!error}
                    message={error ?? ''}
                    title="Oops!"
                    onClose={handleBack}
                />
                <View style={{ paddingTop: 24, gap: 16 }}>
                    <View style={{ alignItems: 'center', marginBottom: 60 }}>
                  <Image source={require('@/assets/images/meez_logo.png')} style={{ width: 120, height: 120 }} />
                  <Text style={[styles.loadingHint, { marginTop: -10 }]}>Working on our mise en place...</Text>
                </View>
            
                <ChecklistProgress isFinished={isParsingFinished} />
              </View>
            </SafeAreaView>
        );
      }
    
      return (
        <SafeAreaView style={[styles.container, { justifyContent: 'flex-start', paddingTop: 60 }]}>
          <GlobalErrorModal
                visible={!!error}
                message={error ?? ''}
                title="Oops!"
                onClose={handleBack}
            />
          <Animated.View 
            entering={FadeIn.duration(500)}
            style={styles.logoContainer}
          >
            <Image source={require('@/assets/images/meez_logo.png')} style={{ width: 120, height: 120 }} />
            <Text style={styles.loadingText}>Loading....</Text>
            <View style={styles.loadingIndicator} />
            <Text style={styles.loadingHint}>
              just a moment while we transform the recipe into something more useful...
            </Text>
          </Animated.View>
        </SafeAreaView>
      );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    logoContainer: {
        alignItems: 'center',
        paddingTop: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        color: COLORS.textDark,
    },
    loadingIndicator: {
        height: 2,
        width: 60,
        backgroundColor: COLORS.primary,
        marginVertical: 16,
    },
    loadingHint: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        color: COLORS.darkGray,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
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
    }
  });

export default LoadingExperienceScreen; 