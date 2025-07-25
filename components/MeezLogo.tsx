import { Image, StyleSheet } from 'react-native';
import { SPACING } from '@/constants/theme';

export default function MeezLogo() {
  return (
    <Image
      source={require('@/assets/images/meezblue_underline.webp')}
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 220,
    height: 120,
    marginBottom: SPACING.md,
    alignSelf: 'center',
  },
}); 