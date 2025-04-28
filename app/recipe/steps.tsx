import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';

// Sample recipe data - in a real app, this would come from an API or local storage
const SAMPLE_RECIPES = {
  'sample-recipe': {
    id: 'sample-recipe',
    title: 'Chicken Avocado Sandwich',
    steps: [
      'Season chicken breast with salt and pepper.',
      'Cook chicken in a pan over medium heat until internal temperature reaches 165°F (74°C), about 6-8 minutes per side.',
      'Toast bread slices.',
      'Mash avocado and spread on one slice of bread.',
      'Spread mayo on the other slice of bread.',
      'Layer lettuce, cooked chicken, and tomato slices.',
      'Close sandwich and cut diagonally.',
      'Serve immediately.'
    ]
  },
  'recipe-1': {
    id: 'recipe-1',
    title: 'Chicken Avocado Sandwich',
    steps: [
      'Season chicken breast with salt and pepper.',
      'Cook chicken in a pan over medium heat until internal temperature reaches 165°F (74°C), about 6-8 minutes per side.',
      'Toast bread slices.',
      'Mash avocado and spread on one slice of bread.',
      'Spread mayo on the other slice of bread.',
      'Layer lettuce, cooked chicken, and tomato slices.',
      'Close sandwich and cut diagonally.',
      'Serve immediately.'
    ]
  },
};

export default function StepsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const recipeId = params.recipeId as string;
  const recipe = SAMPLE_RECIPES[recipeId];
  
  const [completedSteps, setCompletedSteps] = useState<{[key: number]: boolean}>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  if (!recipe) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const toggleStepCompleted = (index: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
    
    // If completing a step, move to the next one
    if (!completedSteps[index] && index === currentStep && index < recipe.steps.length - 1) {
      setCurrentStep(index + 1);
    }
  };
  
  const goToStep = (index: number) => {
    setCurrentStep(index);
  };
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cooking Steps</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>{recipe.title}</Text>
        <Text style={styles.progress}>
          {Object.keys(completedSteps).length} of {recipe.steps.length} steps completed
        </Text>
      </View>
      
      <ScrollView 
        style={styles.stepsContainer}
        showsVerticalScrollIndicator={false}
      >
        {recipe.steps.map((step, index) => (
          <Animated.View 
            key={index}
            entering={FadeInUp.delay(index * 50).duration(300)}
            style={[
              styles.stepItem,
              currentStep === index && styles.currentStep
            ]}
          >
            <TouchableOpacity
              style={styles.stepNumberContainer}
              onPress={() => goToStep(index)}
            >
              <View style={[
                styles.stepNumber,
                completedSteps[index] && styles.stepNumberCompleted,
                currentStep === index && styles.stepNumberCurrent
              ]}>
                {completedSteps[index] ? (
                  <CheckCircle2 size={24} color={COLORS.white} />
                ) : (
                  <Text style={[
                    styles.stepNumberText,
                    currentStep === index && styles.stepNumberTextCurrent
                  ]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < recipe.steps.length - 1 && (
                <View style={[
                  styles.stepConnector,
                  completedSteps[index] && styles.stepConnectorCompleted
                ]} />
              )}
            </TouchableOpacity>
            
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
        ))}
        
        {/* Add some space at the bottom for better scrolling */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {Object.keys(completedSteps).length === recipe.steps.length && (
        <Animated.View 
          entering={FadeIn.duration(500)}
          style={styles.completionContainer}
        >
          <View style={styles.completionContent}>
            <Text style={styles.completionTitle}>All Steps Completed!</Text>
            <Text style={styles.completionText}>
              Enjoy your {recipe.title}
            </Text>
            
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={() => router.push('/saved')}
            >
              <Text style={styles.finishButtonText}>Save to Favorites</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
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
  },
  placeholder: {
    width: 40,
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
    flex: 1,
    paddingHorizontal: 20,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  currentStep: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginLeft: -16,
    marginRight: -16,
    paddingLeft: 16,
  },
  stepNumberContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberCurrent: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  stepNumberCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepNumberText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.textDark,
  },
  stepNumberTextCurrent: {
    color: COLORS.primary,
  },
  stepConnector: {
    width: 2,
    height: 30,
    backgroundColor: COLORS.lightGray,
    marginVertical: 4,
  },
  stepConnectorCompleted: {
    backgroundColor: COLORS.primary,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  stepText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 16,
    lineHeight: 24,
  },
  stepTextCompleted: {
    color: COLORS.textGray,
    textDecorationLine: 'line-through',
  },
  markCompleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  markCompleteButtonActive: {
    backgroundColor: COLORS.primaryLight,
  },
  markCompleteText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: COLORS.primary,
  },
  markCompleteTextActive: {
    color: COLORS.primary,
  },
  completionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  completionContent: {
    alignItems: 'center',
  },
  completionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: 8,
  },
  completionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  finishButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  finishButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  backButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: COLORS.primary,
  },
});