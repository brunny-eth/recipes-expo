import { View, Text, TouchableOpacity, SafeAreaView, TextStyle, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
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
                marginBottom: 40,
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
              entering={FadeIn.duration(1000).delay(1500)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• No more ad-filled recipe blogs</Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(3000)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Clean, consistent, editable recipes</Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(4500)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Swap or remove ingredients with ease</Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1000).delay(6000)}
              style={{ width: '100%' }}
            >
              <Text style={styles.bullet}>• Cook with clear steps and useful tools</Text>
            </Animated.View>
          </View>

          {/* Button container with tagline */}
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Animated.View
              entering={FadeIn.duration(1000).delay(7200)}
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
                fontFamily: 'LibreBaskerville-Italic'
              }}>
                Designed for home cooks
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(1200).delay(7800)}
              style={{
                width: '100%',
                alignItems: 'center',
                marginBottom: 40
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
                onPress={onDismiss}
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
    lineHeight: 38,
    marginBottom: 16,
  } as TextStyle,
});
