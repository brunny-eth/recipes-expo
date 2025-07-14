import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text, Dimensions } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { FONT } from '@/constants/typography';
import ReanimatedAnimated, { FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

function SplashScreenMeez({ onFinish }: { onFinish: () => void }) {
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

    // Always show splash for at least 3 seconds, then start fade-out
    const finishTimeout = setTimeout(() => {
      console.log('[SplashScreenMeez] Starting fade-out animation');
      setIsFinishing(true);
      
      // Add delay to allow fade-out animation to complete
      setTimeout(() => {
        console.log('[SplashScreenMeez] Animation complete, calling onFinish');
        onFinish();
      }, 300); // 300ms fade-out duration
    }, 3000); // Ensures the animation plays for at least 3 seconds

    return () => {
      console.log('[SplashScreenMeez] useEffect cleanup - Component unmounting');
      clearTimeout(taglineTimeout);
      clearTimeout(finishTimeout);
    };
  }, [taglineOpacity, logoOpacity, logoScale, onFinish]);

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
            <Text style={styles.logoText}>🍳</Text>
          </Animated.View>
        </View>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Mise en place for the at-home chef
        </Animated.Text>
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
    backgroundColor: COLORS.primary,
    borderRadius: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 60,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FONT.family.inter,
    fontSize: 18,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});