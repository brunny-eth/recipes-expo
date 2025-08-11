import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Animated from 'react-native-reanimated';
import { SPACING } from '@/constants/theme';
import MeezLogo from '@/components/MeezLogo';

interface LogoHeaderProps {
  animatedLogo?: React.ReactNode;
}

const LogoHeader: React.FC<LogoHeaderProps> = React.memo(({ animatedLogo }) => {
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
    paddingTop: 4,
    marginBottom: 0,
  },
});

export default LogoHeader; 