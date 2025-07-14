import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Image,
  Text,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '@/constants/theme';
import { bodyText, screenTitleText } from '@/constants/typography';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface WelcomeScreenProps {
  onDismiss: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onDismiss }) => {
  console.log('[WelcomeScreen] Component rendering');
  
  const [isDismissing, setIsDismissing] = useState(false);
  
  const handleDismiss = () => {
    console.log('[WelcomeScreen] onDismiss handler called, starting fade-out animation');
    setIsDismissing(true);
    
    // Add a small delay to allow the fade-out animation to start
    setTimeout(() => {
      console.log('[WelcomeScreen] Animation delay complete, calling props.onDismiss()');
      onDismiss();
    }, 300); // 300ms fade-out duration
  };

  return (
    <Animated.View 
      style={styles.overlay}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.contentContainer}>
          <View style={styles.bodyContainer}>
            <Text style={styles.welcomeTitle}>Welcome to Meez</Text>
            <Text style={styles.welcomeText}>
              We help you get rid of annoying recipe slop, standardize your recipe
              formats, and substitute ingredients with what you have on hand.
            </Text>
            <Text style={styles.welcomeText}>
              Ready to cook? We'll start the digital mise en place for you.
            </Text>
          </View>
        </View>

        <Animated.View
          entering={FadeIn.duration(500).delay(200)}
          style={styles.buttonContainer}
        >
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleDismiss}
            disabled={isDismissing}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: '40%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
  },
  tagline: {
    ...bodyText,
    marginTop: -10,
    color: COLORS.darkGray,
  },
  bodyContainer: {
    paddingHorizontal: 30,
    gap: 20,
  },
  welcomeTitle: {
    ...screenTitleText,
    textAlign: 'center',
    color: COLORS.textDark,
  },
  welcomeText: {
    ...bodyText,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: '35%',
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});

export default WelcomeScreen;
