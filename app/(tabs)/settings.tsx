import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bodyText, bodyStrongText, titleText, sectionHeaderText } from '@/constants/typography';

function AuthStatus() {
  const { session } = useAuth();
  const isAuthenticated = !!session;

  return (
    <View style={[styles.authStatusContainer, { backgroundColor: isAuthenticated ? COLORS.primaryLight : COLORS.lightGray }]}>
      <Text style={[bodyStrongText, { color: isAuthenticated ? COLORS.primary : COLORS.darkGray, marginLeft: 8 }]}>
        {isAuthenticated ? `Logged in as ${session?.user?.email}` : 'Not Logged In'}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [autoScale, setAutoScale] = useState(true);
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <AuthStatus />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40}}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primaryLight }}
              thumbColor={darkMode ? COLORS.primary : COLORS.white}
              disabled={true} // Disabled until implemented
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipe Preferences</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Save Recipe History</Text>
            <Switch
              value={saveHistory}
              onValueChange={setSaveHistory}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primaryLight }}
              thumbColor={saveHistory ? COLORS.primary : COLORS.white}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Auto-scale Ingredients</Text>
            <Switch
              value={autoScale}
              onValueChange={setAutoScale}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primaryLight }}
              thumbColor={autoScale ? COLORS.primary : COLORS.white}
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Contact Us</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Support Development</Text>
          </TouchableOpacity>
        </View>
        
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
    fontFamily: 'Recoleta-Medium',
    fontSize: 28,
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  settingText: {
    ...bodyText,
    fontSize: 16,
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
}); 