import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useState } from 'react';
import OnboardingScreen from './OnboardingScreen';

type WelcomeScreenState = 'welcome' | 'onboarding';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<WelcomeScreenState>('welcome');

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
          paddingTop: '20%', // Increased from 3% to 20%
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
                marginBottom: 60,
                textAlign: 'center',
                color: COLORS.textDark,
                lineHeight: 28,
                paddingTop: 30,
                fontFamily: 'Inter-SemiBold'
              }}>
                Meez helps you prep and cook without clutter
              </Text>
            </Animated.View>

            {/* Bullets - each in its own animated container */}

            <Animated.View
              entering={FadeIn.duration(1000).delay(2000)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Import any recipe and customize it</Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(3500)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Easily swap or remove ingredients</Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(5000)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Cook multiple dishes at the same time</Text>
            </Animated.View>
          </View>

          {/* Button container with tagline */}
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Animated.View
              entering={FadeIn.duration(1000).delay(6500)}
              style={{
                width: '100%',
                alignItems: 'center',
                marginBottom: 24
              }}
            >
              <Text style={{ 
                fontSize: 16,
                textAlign: 'center',
                color: COLORS.textDark,
                lineHeight: 26,
                fontFamily: 'Ubuntu-Regular'
              }}>
                Designed by home cooks, for home cooks
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(6500)}
              style={{
                width: '100%',
                alignItems: 'center',
                marginBottom: 140
              }}
            >
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
                onPress={() => setCurrentScreen('onboarding')}
              >
                <Text style={{ 
                  color: COLORS.white, 
                  fontSize: 18, 
                  fontFamily: 'Inter-SemiBold' 
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
});
