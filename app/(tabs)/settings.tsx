import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { COLORS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [autoScale, setAutoScale] = useState(true);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primaryLight }}
              thumbColor={darkMode ? COLORS.primary : COLORS.white}
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
            <MaterialCommunityIcons name="open-in-new" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Terms of Service</Text>
            <MaterialCommunityIcons name="open-in-new" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Contact Us</Text>
            <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Support Development</Text>
            <MaterialCommunityIcons name="heart-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
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
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
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
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: COLORS.textDark,
  },
  versionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
});