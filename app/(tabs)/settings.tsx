import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bodyText, bodyStrongText, screenTitleText, sectionHeaderText } from '@/constants/typography';

function AuthStatus() {
  const { session } = useAuth();

  return (
    <View style={[styles.authStatusContainer, { backgroundColor: COLORS.primaryLight }]}>
      <Text style={[bodyStrongText, { color: COLORS.primary, marginLeft: 8 }]}>
        {`Logged in as ${session?.user?.email}`}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut, isAuthenticated } = useAuth();
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.authStatusContainer}></View>
      
      {isAuthenticated ? (
        <AuthStatus />
      ) : (
        <TouchableOpacity onPress={() => router.push('/login')} style={[styles.loginButton, {marginBottom: 20}]}>
            <Text style={styles.loginButtonText}>Log In or Sign Up</Text>
        </TouchableOpacity>
      )}
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40}}>
        <View style={styles.section}>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        {isAuthenticated && (
            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
                <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
        )}
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 20,
    marginBottom: 10,
  },
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
  },
  authStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...sectionHeaderText,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  linkText: {
    ...bodyText,
    fontSize: 16,
  },
  versionText: {
    ...bodyText,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginTop: 20,
  },
  signOutButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
      ...bodyStrongText,
      color: COLORS.white,
      fontSize: 16,
  },
}); 