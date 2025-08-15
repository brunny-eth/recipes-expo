import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import { FONT } from '@/constants/typography';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useState } from 'react';
import OnboardingScreen from './OnboardingScreen';

type WelcomeScreenState = 'welcome' | 'onboarding';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<WelcomeScreenState>('welcome');
  const features: { verb: string; rest: string }[] = [
    { verb: 'Import', rest: ' any recipe from any source' },
    { verb: 'Customize', rest: ' recipes to your preferences' },
    { verb: 'Shop & cook', rest: ' multiple recipes at the same time' },
    { verb: 'Save', rest: ' cookbooks of your favorite recipes' },
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
          paddingHorizontal: 30,
          alignItems: 'center'
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
              <Text style={{ 
                fontSize: 24,
                marginBottom: 68,
                textAlign: 'center',
                color: COLORS.textDark,
                lineHeight: 28,
                paddingTop: 30,
                fontFamily: FONT.family.interSemiBold
              }}>
                The best way to prep and cook meals at home
              </Text>
            </Animated.View>

            {/* Numbered list */}
            <View style={{ width: '100%' }}>
              {features.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listNumber}>
                    <Text style={styles.listNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.listText}>
                    <Text style={styles.listVerb}>{item.verb}</Text>
                    {item.rest}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Button container */}
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Animated.View entering={FadeIn.duration(1000).delay(1000)} style={{ width: '100%', alignItems: 'center', marginTop: 0, marginBottom: 140 }}>
              <TouchableOpacity 
                style={{
                  backgroundColor: COLORS.primary,
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  borderRadius: 16,
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
                }}
                onPress={onDismiss}
              >
                <Text style={{ 
                  color: COLORS.white, 
                  fontSize: 18, 
                  fontFamily: FONT.family.interSemiBold 
                }}>
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
  bullet: {
    fontSize: 17,
    textAlign: 'left' as const,
    color: COLORS.textDark,
    lineHeight: 22,
    marginBottom: 48,
  } as TextStyle,
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 36,
  } as ViewStyle,
  listNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  } as ViewStyle,
  listNumberText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: FONT.family.interSemiBold,
  } as TextStyle,
  listText: {
    flex: 1,
    fontSize: 17,
    color: COLORS.textDark,
    lineHeight: 22,
    // Nudge so the first line is vertically centered to the number badge
    marginTop: 2,
  } as TextStyle,
  listVerb: {
    fontFamily: FONT.family.interSemiBold,
    color: COLORS.textDark,
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
