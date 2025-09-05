import { Image, StyleSheet } from 'react-native';
import { SPACING } from '@/constants/theme';

export default function MeezLogo() {
  return (
    <Image
      source={require('@/assets/images/logo.svg')}
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 440, // Much bigger for testing: 220 * 2
    height: 240, // Much bigger for testing: 120 * 2
    marginBottom: SPACING.md,
    alignSelf: 'center',
  },
}); 