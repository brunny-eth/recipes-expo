import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

// Type for data expected from navigation params
type RecipeData = {
  title?: string | null;
  prepSteps?: string[] | null; // Assuming prep steps are passed this way
  // Include other fields from recipeData that might be needed for navigation to the next screen
  ingredients?: any; // Replace 'any' with actual type if known
  instructions?: string[] | null;
  substitutions_text?: string | null;
  recipeYield?: string | null;
  // Add other fields as necessary from the typical recipe object structure
};

export default function PrepScreen() {
  const params = useLocalSearchParams<{ recipeData?: string }>();
  const router = useRouter();
  
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [prepSteps, setPrepSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<{[key: number]: boolean}>({});
  const [fullRecipeData, setFullRecipeData] = useState<RecipeData | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      if (params.recipeData) {
        const parsedData = JSON.parse(params.recipeData) as RecipeData;
        setFullRecipeData(parsedData); // Store the full data for navigation

        if (parsedData.prepSteps && Array.isArray(parsedData.prepSteps)) {
            setPrepSteps(parsedData.prepSteps);
        } else {
            console.warn("[PrepScreen] Prep steps missing or not an array in recipeData.");
            setPrepSteps([]); 
        }
        
        setRecipeTitle(parsedData.title || 'Preparation Steps');
        setCompletedSteps({}); // Reset completed steps when data changes

      } else {
        setError("Recipe data not provided to prep screen.");
        setPrepSteps([]);
      }
    } catch (e: any) {
        console.error("Failed to parse recipe data on prep screen:", e);
        setError(`Could not load recipe data: ${e.message}`);
        setPrepSteps([]);
    }
    setIsLoading(false);
  }, [params.recipeData]);
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredStatusContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const toggleStepCompleted = (index: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  const navigateToCookScreen = () => {
    if (!fullRecipeData) {
        console.error("Cannot navigate: full recipe data is missing.");
        // Optionally, show an alert to the user
        return;
    }
    router.push({
      pathname: '/recipe/steps', // Assuming '/recipe/steps' is the cook screen
      params: { recipeData: JSON.stringify(fullRecipeData) } // Pass the full original data
    });
  };
  
  const numCompleted = Object.values(completedSteps).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.containerSafeArea}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{recipeTitle || 'Prep Work'}</Text>
          <View style={styles.placeholder} />
        </View>
        
        {prepSteps.length > 0 && (
            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>{recipeTitle}</Text>
                <Text style={styles.progress}>
                {numCompleted} of {prepSteps.length} prep steps completed
                </Text>
            </View>
        )}
        
        <ScrollView 
          style={styles.stepsContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }} // Ensure space for footer button
        >
          {prepSteps.length > 0 ? (
            prepSteps.map((step: string, index: number) => (
              <Animated.View 
                key={`prep-${index}`}
                entering={FadeInUp.delay(index * 50).duration(300)}
                style={styles.stepItem}
              >
                <View style={styles.stepNumberContainer}>
                  <View style={[
                    styles.stepNumber,
                    completedSteps[index] && styles.stepNumberCompleted,
                  ]}>
                    {completedSteps[index] ? (
                      <CheckCircle2 size={24} color={COLORS.white} />
                    ) : (
                      <Text style={styles.stepNumberText}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {index < prepSteps.length - 1 && (
                    <View style={[
                      styles.stepConnector,
                      completedSteps[index] && styles.stepConnectorCompleted
                    ]} />
                  )}
                </View>
                
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepText,
                    completedSteps[index] && styles.stepTextCompleted
                  ]}>
                    {step}
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.markCompleteButton,
                      completedSteps[index] && styles.markCompleteButtonActive
                    ]}
                    onPress={() => toggleStepCompleted(index)}
                  >
                    <Text style={[
                      styles.markCompleteText,
                      completedSteps[index] && styles.markCompleteTextActive
                    ]}>
                      {completedSteps[index] ? 'Completed' : 'Mark as Complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))
          ) : (
            <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No preparation steps for this recipe.</Text>
            </View>
          )}
        </ScrollView>
        
        {numCompleted === prepSteps.length && prepSteps.length > 0 && (
          <Animated.View 
            entering={FadeIn.duration(500)}
            style={styles.completionContainer}
          >
            <View style={styles.completionContent}>
              <Text style={styles.completionTitle}>Prep Work Complete!</Text>
              <Text style={styles.completionText}>
                Ready to start cooking?
              </Text>
              
              <TouchableOpacity 
                style={styles.finishButton}
                onPress={navigateToCookScreen} // Updated function name
              >
                <Text style={styles.finishButtonText}>Go to Cooking Steps</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerSafeArea: { // Added SafeAreaView wrapper
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredStatusContainer: { // For loading/error states
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.error, 
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonSimple: { 
     marginTop: 15,
     paddingVertical: 10,
     paddingHorizontal: 20,
     backgroundColor: COLORS.lightGray,
     borderRadius: 8,
  },
  backButtonText: { // For simple back button on error screen
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 30, // Adjusted padding for SafeArea
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.textDark,
    textAlign: 'center',
    flex: 1, // Allow title to take space and center
    marginHorizontal: 10, // Add some margin if title is long
  },
  placeholder: {
    width: 40, // To balance the back button
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textGray,
  },
  progress: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  stepsContainer: {
    flex: 1, // Ensure ScrollView takes available space
    paddingHorizontal: 20,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start', // Align connector with top of text
  },
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: 15,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5, // Space before connector
  },
  stepNumberCompleted: {
    backgroundColor: COLORS.success,
  },
  stepNumberText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: COLORS.textDark,
  },
  stepConnector: {
    width: 2,
    flex: 1, // Takes up space between steps
    backgroundColor: COLORS.lightGray,
    minHeight: 30, // Ensure connector is visible even for short text
  },
  stepConnectorCompleted: {
    backgroundColor: COLORS.success,
  },
  stepContent: {
    flex: 1,
    paddingVertical: 5, // Align text nicely with number
  },
  stepText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    lineHeight: 24,
    marginBottom: 10,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textGray,
  },
  markCompleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
  },
  markCompleteButtonActive: {
    backgroundColor: COLORS.lightGray,
  },
  markCompleteText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: COLORS.primary,
  },
  markCompleteTextActive: {
    color: COLORS.textDark,
  },
  completionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Semi-transparent white
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  completionContent: {
    alignItems: 'center',
  },
  completionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  completionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  finishButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  finishButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50, // Give some space from header
  },
  emptyStateText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textGray,
    textAlign: 'center',
  },
}); 