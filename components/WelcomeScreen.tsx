import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH, SHADOWS } from '@/constants/theme';
import { FONT, bodyStrongText, screenTitleText, bodyText } from '@/constants/typography';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useState } from 'react';
import OnboardingScreen from './OnboardingScreen';
import ScreenHeader from './ScreenHeader';

type WelcomeScreenState = 'welcome' | 'onboarding';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<WelcomeScreenState>('welcome');
  const features: { text: string }[] = [
    {
      text: 'Customize any recipe.'
    },
    {
      text: 'Generate grocery lists.'
    },
    {
      text: 'Cook multiple recipes together.'
    },
    {
      text: 'Enjoy cooking your way.'
    },
  ];

  if (currentScreen === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={onDismiss}
        onBack={() => setCurrentScreen('welcome')}
      />
    );
  }
  return (
    <Animated.View 
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
      }}
      entering={FadeIn.duration(1500)}
      exiting={FadeOut.duration(800)}
    >
      <SafeAreaView style={{
        flex: 1,
      }}>
        {/* OLEA Header Section - mimicking index.tsx */}
        <ScreenHeader
          title="OLEA"
          showBack={false}
          titleStyle={{ fontSize: 32, fontWeight: '800' }}
          backgroundColor="#DEF6FF"
        />

        <View style={{
          flex: 1,
          paddingTop: SPACING.md, // Match index.tsx ScrollView paddingTop
          paddingHorizontal: 0, // Remove since taglineSection handles its own padding
        }}>
          {/* Top content container - natural flow */}
          <View style={{ width: '100%', alignItems: 'flex-start' }}>
            <Animated.View
              entering={FadeIn.duration(1200)}
              style={styles.taglineSection}
            >
              <Text style={[styles.taglineText, styles.taglineYourRecipe]}>
                Turn any recipe into{' '}
                <Text style={styles.taglineBold}>your{'\u00A0'}recipe.</Text>
              </Text>
              <Animated.View entering={FadeIn.duration(800).delay(1500)}>
                <Text style={[styles.taglineText, styles.taglineBullet]}>
                  {features.map(item => item.text).join('\n')}
                </Text>
              </Animated.View>
            </Animated.View>
          </View>

          {/* Spacer to push buttons higher up */}
          <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: SPACING.xxxl }}>
            {/* Button container - positioned higher up */}
            <View style={styles.buttonContainer}>
            <Animated.View entering={FadeIn.duration(1000).delay(3000)}>
              <TouchableOpacity
                style={styles.takeTourButton}
                onPress={() => setCurrentScreen('onboarding')}
              >
                <Text style={styles.buttonText}>
                  Take a quick tour
                </Text>
              </TouchableOpacity>
            </Animated.View>
            
            <Animated.View entering={FadeIn.duration(1000).delay(3000)}>
              <TouchableOpacity
                style={styles.getStartedButton}
                onPress={onDismiss}
              >
                <Text style={styles.buttonText}>
                  Get started
                </Text>
              </TouchableOpacity>
            </Animated.View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  taglineSection: {
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.sm, // Match index.tsx exactly
    marginBottom: SPACING.xl, // Match index.tsx exactly
  } as ViewStyle,
  taglineText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 0,
  } as TextStyle,
  taglineYourRecipe: {
    marginBottom: SPACING.lg, // Match index.tsx exactly (16px)
  } as TextStyle,
  taglineBold: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: COLORS.textDark,
  } as TextStyle,
  taglineBullet: {
    marginTop: SPACING.xs, // Match index.tsx exactly (4px)
  } as TextStyle,
  buttonContainer: {
    width: '100%',
    paddingHorizontal: SPACING.pageHorizontal, // Add horizontal padding for proper margins
    paddingBottom: SPACING.xl, // Natural bottom padding
    gap: SPACING.sm, // Add gap between buttons
  } as ViewStyle,
  takeTourButton: {
    width: '100%',
    height: 46, // Fixed height like the original button
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'flex-start', // Left align content
    paddingLeft: 16, // Match INPUT_LEFT_PAD from Import.tsx
    ...SHADOWS.medium,
  } as ViewStyle,
  getStartedButton: {
    width: '100%',
    height: 46, // Fixed height like the original button
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'flex-start', // Left align content
    paddingLeft: 16, // Match INPUT_LEFT_PAD from Import.tsx
    ...SHADOWS.medium,
  } as ViewStyle,
  buttonText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    color: '#000000',
    textAlign: 'left',
  } as TextStyle,
  // Legacy styles kept for reference
  bullet: {
    fontSize: 17,
    textAlign: 'left' as const,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 48,
  } as TextStyle,
  tagline: {
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.textDark,
    lineHeight: 18,
    fontFamily: FONT.family.ubuntu,
    marginBottom: 5,
  } as TextStyle,
});
