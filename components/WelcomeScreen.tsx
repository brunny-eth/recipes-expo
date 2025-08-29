import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { FONT } from '@/constants/typography';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useState } from 'react';
import OnboardingScreen from './OnboardingScreen';

type WelcomeScreenState = 'welcome' | 'onboarding';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<WelcomeScreenState>('welcome');
  const features: { verb: string; rest: string }[] = [
    {
      verb: 'Import',
      rest: ' and save any recipe from any source'
    },
    {
      verb: 'Customize',
      rest: ' recipes to your taste and diet, then save for later'
    },
    {
      verb: 'Generate shopping lists',
      rest: ' and cook multiple recipes at once'
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
        <View style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingTop: '20%',
          paddingHorizontal: SPACING.pageHorizontal,
        }}>
          {/* Top content container */}
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Animated.View
              entering={FadeIn.duration(1200)}
              style={{
                width: '100%',
                alignItems: 'center'
              }}
            >
              <Text style={styles.mainTitle}>
                Every recipe, your way.
              </Text>
              <Text style={styles.subtitle}>
                Customize it. Shop it. Cook it.
              </Text>
            </Animated.View>

            {/* Numbered list */}
            <View style={styles.listContainer}>
              {features.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listNumber}>
                    <Text style={styles.listNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listText}>
                      <Text style={styles.listVerb}>{item.verb}</Text>
                      {item.rest}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Button container - positioned using rule of thirds */}
          <View style={styles.buttonContainer}>
            <Animated.View entering={FadeIn.duration(1000).delay(1000)}>
              <TouchableOpacity 
                style={styles.getStartedButton}
                onPress={onDismiss}
              >
                <Text style={styles.buttonText}>
                  Get Started
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mainTitle: {
    fontSize: FONT.size.screenTitle,
    marginBottom: SPACING.lg,
    textAlign: 'center',
    color: COLORS.textDark,
    lineHeight: FONT.lineHeight.relaxed,
    paddingTop: SPACING.xl,
    fontFamily: FONT.family.interSemiBold, // Semi-bold for better readability
    paddingHorizontal: SPACING.md, // Add horizontal padding for better text containment
  } as TextStyle,
  subtitle: {
    fontSize: FONT.size.sectionHeader,
    marginBottom: SPACING.xxxl,
    textAlign: 'center',
    color: COLORS.textMuted,
    lineHeight: FONT.lineHeight.normal,
    fontFamily: FONT.family.inter,
    paddingHorizontal: SPACING.md,
  } as TextStyle,
  listContainer: {
    width: '100%',
    paddingLeft: SPACING.sm, // Consistent left margin for the list
  } as ViewStyle,
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xxl, // Increased spacing between list items
    width: '100%',
  } as ViewStyle,
  listNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    marginTop: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    flexShrink: 0, // Prevent number from shrinking
  } as ViewStyle,
  listNumberText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: FONT.family.interSemiBold,
    textAlign: 'center',
    lineHeight: 16,
  } as TextStyle,
  listContent: {
    flex: 1,
    paddingRight: SPACING.pageHorizontal, // Add right padding to prevent text from extending to screen edge
  } as ViewStyle,
  listText: {
    fontSize: FONT.size.sectionHeader,
    color: COLORS.textDark,
    lineHeight: FONT.lineHeight.normal,
    marginTop: 2,
    paddingRight: SPACING.sm, // Right padding for text
    fontFamily: FONT.family.interSemiBold, // Semi-bold for main bullet text
  } as TextStyle,

  listVerb: {
    fontFamily: FONT.family.interSemiBold, // Semi-bold for sub-headers
    color: COLORS.textDark,
  } as TextStyle,
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: '33%', // Rule of thirds - button positioned at 2/3 from top
  } as ViewStyle,
  getStartedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.lg,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  } as ViewStyle,
  buttonText: {
    color: COLORS.white, 
    fontSize: FONT.size.sectionHeader, 
    fontFamily: FONT.family.interSemiBold 
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
