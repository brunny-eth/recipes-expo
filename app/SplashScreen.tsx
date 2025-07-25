import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { COLORS } from '@/constants/theme';
import ReanimatedAnimated, { FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

function SplashScreenMeez({ onFinish }: { onFinish: () => void }) {
  const router = useRouter();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const renderCount = useRef(0);

  renderCount.current += 1;
  console.log(`[SplashScreenMeez] Component rendering (render #${renderCount.current})`);

  useEffect(() => {
    console.log('[SplashScreenMeez] useEffect - Component mounted, starting animation sequence');
    
    // Simple fade in animation to match native splash
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      console.log('[SplashScreenMeez] Logo fade-in animation completed');
    });

    // Complete the animation sequence and call onFinish
    const finishTimeout = setTimeout(() => {
      console.log('[SplashScreenMeez] Animation sequence complete, calling onFinish');
      onFinish();
    }, 3000); 

    // FALLBACK TIMEOUT: Force app to continue after 4 seconds to prevent getting stuck
    const fallbackTimeout = setTimeout(() => {
      console.warn('[SplashScreenMeez] 🚨 FALLBACK TIMEOUT: Splash screen active for 4+ seconds, forcing navigation to home');
      
      // Try to navigate to home screen as fallback
      try {
        router.replace('/tabs' as any);
      } catch (error) {
        console.error('[SplashScreenMeez] Failed to navigate to home screen:', error);
      }
    }, 4000);

    return () => {
      console.log('[SplashScreenMeez] useEffect cleanup - Component unmounting');
      clearTimeout(finishTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [logoOpacity, onFinish, router]);

  console.log('[SplashScreenMeez] About to render logo');

  return (
    <ReanimatedAnimated.View 
      style={styles.container}
      exiting={FadeOut.duration(300)}
    >
      <Animated.View
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
          },
        ]}
      >
        <Image 
          source={require('@/assets/images/meezblue_underline.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </ReanimatedAnimated.View>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(SplashScreenMeez);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefcf7', // Exact same as native splash background
    width: '100%',
    height: '100%',
  },
  logo: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});