import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { COLORS } from '@/constants/theme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export default function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  console.log('[WelcomeScreen] Step 3: Adding visual flair with checkpoints');
  
    console.log('[WelcomeScreen] Checkpoint A: About to render with animations');
  
  return (
    <Animated.View 
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
      }}
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
    >
      <SafeAreaView style={{
        flex: 1,
      }}>
        <View style={{
          flex: 1,
          justifyContent: 'flex-start',
          paddingTop: '40%',
          paddingHorizontal: 30
        }}>
          <Animated.View
            entering={FadeIn.duration(500)}
          >
            <Text style={{ 
              fontSize: 28, 
              marginBottom: 20, 
              textAlign: 'center',
              color: COLORS.textDark,
              fontFamily: 'Inter-SemiBold'
            }}>
              Welcome to Meez
            </Text>
          </Animated.View>
          
          <Animated.View
            entering={FadeIn.duration(500).delay(200)}
          >
            <Text style={{ 
              fontSize: 16, 
              marginBottom: 40, 
              textAlign: 'center',
              color: COLORS.textDark,
              lineHeight: 24
            }}>
              We help you get rid of annoying recipe slop, standardize your recipe formats, and substitute ingredients with what you have on hand.
            </Text>
          </Animated.View>
          
          <Animated.View
            entering={FadeIn.duration(500).delay(400)}
          >
            <TouchableOpacity 
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 8,
                width: '100%',
                alignItems: 'center'
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
      </SafeAreaView>
    </Animated.View>
  );
}
