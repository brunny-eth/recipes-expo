import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { FONT } from '@/constants/typography';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useState } from 'react';
import OnboardingScreen from './OnboardingScreen';

type WelcomeScreenState = 'welcome' | 'onboarding';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<WelcomeScreenState>('welcome');
  const features: { verb: string; rest: string; subtext: string }[] = [
    { 
      verb: 'Import', 
      rest: ' any recipe from any source',
      subtext: 'Food blogs, social media, or pics of cookbooks and handwritten recipes'
    },
    { 
      verb: 'Customize', 
      rest: ' recipes to your tastes',
      subtext: 'Swap ingredients, adjust servings, and recipe steps update automatically'
    },
    { 
      verb: 'Shop & cook', 
      rest: ' multiple recipes at once',
      subtext: 'Get organized grocery lists, then cook everything together'
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
                The best way to prep and cook meals at home
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
                    <Text style={styles.listSubtext}>{item.subtext}</Text>
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
    marginBottom: SPACING.xxxl,
    textAlign: 'center',
    color: COLORS.textDark,
    lineHeight: FONT.lineHeight.relaxed,
    paddingTop: SPACING.xl,
    fontFamily: FONT.family.interSemiBold, // Semi-bold for better readability
    paddingHorizontal: SPACING.md, // Add horizontal padding for better text containment
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
    fontSize: 13,
    fontFamily: FONT.family.interSemiBold,
  } as TextStyle,
  listContent: {
    flex: 1,
    paddingRight: SPACING.pageHorizontal, // Add right padding to prevent text from extending to screen edge
  } as ViewStyle,
  listText: {
    fontSize: FONT.size.body,
    color: COLORS.textDark,
    lineHeight: FONT.lineHeight.normal,
    marginTop: 2,
    marginBottom: SPACING.sm, // Increased space between main text and subtext
    paddingRight: SPACING.sm, // Right padding for text
    fontFamily: FONT.family.interSemiBold, // Semi-bold for main bullet text
  } as TextStyle,
  listSubtext: {
    fontSize: FONT.size.body, // Increased from caption for better readability
    color: COLORS.textMuted, // Changed from textSubtle for better contrast
    lineHeight: FONT.lineHeight.normal, // Increased line height for better readability
    fontFamily: FONT.family.inter,
    marginLeft: 0, // Align with main bullet text
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
