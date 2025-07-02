import { View, StyleSheet, SafeAreaView } from 'react-native';
import MeezLogo from '@/components/MeezLogo';
import { COLORS, SPACING } from '@/constants/theme';

export default function LogoHeaderLayout({
  children,
  animatedLogo,
}: {
  children: React.ReactNode;
  animatedLogo?: React.ReactNode;
}) {
  console.log(`[${new Date().toISOString()}] [LogoHeaderLayout] render`);
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {animatedLogo || <MeezLogo />}
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  content: {
    marginTop: SPACING.md,
    width: '100%',
    alignItems: 'center',
    flex: 1,
  },
}); 