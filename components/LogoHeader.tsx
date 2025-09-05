import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SPACING } from '@/constants/theme';
import Logo from '@/assets/images/logo.svg';

interface LogoHeaderProps {
  animatedLogo?: React.ReactNode;
}

const LogoHeader: React.FC<LogoHeaderProps> = React.memo(({ animatedLogo }) => {
  return (
    <View style={styles.logoContainer}>
      {animatedLogo || (
        <Logo width={220} height={120} style={styles.logo} />
      )}
    </View>
  );
});

LogoHeader.displayName = 'LogoHeader';

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    paddingTop: 0,
    marginBottom: 0,
  },
  logo: {
    width: 220,
    height: 120,
    marginBottom: SPACING.md,
    alignSelf: 'center',
  },
});

export default LogoHeader; 