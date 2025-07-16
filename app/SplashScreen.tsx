import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text, Dimensions } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { FONT, responsiveFont } from '@/constants/typography';
import ReanimatedAnimated, { FadeOut } from 'react-native-reanimated';
import SplashCookSVG from '@/assets/images/splash-cook.svg';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

function SplashScreenMeez({ onFinish }: { onFinish: () => void }) {
  const router = useRouter();
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const renderCount = useRef(0);
  const [isFinishing, setIsFinishing] = useState(false);

  renderCount.current += 1;
  console.log(`[SplashScreenMeez] Component rendering (render #${renderCount.current})`);

  useEffect(() => {
    console.log('[SplashScreenMeez] useEffect - Component mounted, starting animation sequence');
    
    // Logo animation: fade in and scale up
    const logoAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    // Start logo animation immediately
    logoAnimation.start(() => {
      console.log('[SplashScreenMeez] Logo animation completed');
    });

    // Fade in tagline after logo animation
    const taglineTimeout = setTimeout(() => {
      console.log('[SplashScreenMeez] Starting tagline fade-in animation');
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        console.log('[SplashScreenMeez] Tagline fade-in animation completed');
      });
    }, 1000);

    // Complete the animation sequence and call onFinish
    const finishTimeout = setTimeout(() => {
      console.log('[SplashScreenMeez] Animation sequence complete, calling onFinish');
      onFinish();
    }, 2000); // Reduced from 3 seconds to 2 seconds for faster testing

    // FALLBACK TIMEOUT: Force app to continue after 5 seconds to prevent getting stuck
    const fallbackTimeout = setTimeout(() => {
      console.warn('[SplashScreenMeez] 🚨 FALLBACK TIMEOUT: Splash screen active for 5+ seconds, forcing navigation to home');
      
      // Try to navigate to home screen as fallback
      try {
        router.replace('/tabs' as any);
      } catch (error) {
        console.error('[SplashScreenMeez] Failed to navigate to home screen:', error);
      }
    }, 5000);

    return () => {
      console.log('[SplashScreenMeez] useEffect cleanup - Component unmounting');
      clearTimeout(taglineTimeout);
      clearTimeout(finishTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [taglineOpacity, logoOpacity, logoScale, onFinish, router]);

  console.log('[SplashScreenMeez] About to render animated logo');

  return (
    <ReanimatedAnimated.View 
      style={styles.container}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logo,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <SplashCookSVG width={175} height={175} />
          </Animated.View>
        </View>
        <View style={styles.taglineContainer}>
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>Mise en place for the at-home chef</Animated.Text>
        </View>
      </View>
    </ReanimatedAnimated.View>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(SplashScreenMeez);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefcf7',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  taglineContainer: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontFamily: FONT.family.inter,
    fontSize: 18, // Match subheadingText exactly
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    // Add safeguards to prevent text cutoff
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});