import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Animated from 'react-native-reanimated';
import { SPACING } from '@/constants/theme';
import MeezLogo from '@/components/MeezLogo';

interface LogoHeaderProps {
  animatedLogo?: React.ReactNode;
}

const LogoHeader: React.FC<LogoHeaderProps> = React.memo(({ animatedLogo }) => {
  console.log(`[${new Date().toISOString()}] [LogoHeader] 🎨 RENDER TRIGGERED`);
  console.log('[LogoHeader] Props analysis:', {
    hasAnimatedLogo: !!animatedLogo,
    animatedLogoReference: animatedLogo,
  });

  return (
    <View style={styles.logoContainer}>
      {animatedLogo || <MeezLogo />}
    </View>
  );
});

LogoHeader.displayName = 'LogoHeader';

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    paddingTop: 80,
    marginBottom: SPACING.md,
  },
});

export default LogoHeader; 