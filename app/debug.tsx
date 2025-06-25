import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { Session, User } from '@supabase/supabase-js';

import { useAuth } from '@/context/AuthContext';
import { getSecureStoreLogs, supabase } from '@/lib/supabaseClient';
import { COLORS } from '@/constants/theme';
import { bodyStrongText, monoSpacedText, screenTitleText } from '@/constants/typography';

const SUPABASE_AUTH_TOKEN_KEY = 'sb-ttmijswwzijvyhnrpnoi-auth-token';

// Helper component for displaying a piece of debug info
const DebugField = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(value ?? 'null');
      Alert.alert('Copied!', `${label} value has been copied to the clipboard.`);
    } catch (e: any) {
      Alert.alert('Copy Failed', e.message);
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.valueContainer}>
        <Text style={styles.fieldValue} selectable>{value ?? 'null'}</Text>
        <TouchableOpacity onPress={onCopy} style={styles.copyButton}>
          <Text style={styles.copyButtonText}>Copy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


export default function SessionDebugScreen() {
  const { user, session, isAuthenticated, isLoading: isAuthLoading, signOut } = useAuth();
  
  const [hydratedSession, setHydratedSession] = useState<Session | null>(null);
  const [hydratedUser, setHydratedUser] = useState<User | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [isRehydrating, setIsRehydrating] = useState(false);
  const [secureStoreLogs, setSecureStoreLogs] = useState<string[]>([]);
  const [debugRawValueOnMount, setDebugRawValueOnMount] = useState<string | null>(null);

  const forceRehydrate = useCallback(async () => {
    setIsRehydrating(true);
    try {
      // 1. Get session from Supabase client
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setHydratedSession(sessionData.session);

      // 2. Get user from Supabase client
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setHydratedUser(userData.user);

      // 3. Get raw token from SecureStore
      const token = await SecureStore.getItemAsync(SUPABASE_AUTH_TOKEN_KEY);
      setStoredToken(token);

      // 4. Get SecureStore logs
      setSecureStoreLogs(getSecureStoreLogs());

    } catch (error: any) {
      Alert.alert('Rehydration Failed', error.message);
    } finally {
      setIsRehydrating(false);
    }
  }, []);

  // Initial hydration on component mount
  useEffect(() => {
    forceRehydrate();
  }, [forceRehydrate]);

  useEffect(() => {
    const debugSecureStore = async () => {
      const value = await SecureStore.getItemAsync(SUPABASE_AUTH_TOKEN_KEY);
      setDebugRawValueOnMount(value);
    };
    debugSecureStore();
  }, []);

  const renderContent = () => {
    if (isAuthLoading) {
      return <ActivityIndicator size="large" color={COLORS.primary} />;
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DebugField label="user.id" value={user?.id} />
        <DebugField label="session.expires_at" value={session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null} />
        <DebugField label="isAuthenticated (from AuthContext)" value={String(isAuthenticated)} />
        <DebugField label="isLoading (from AuthContext)" value={String(isAuthLoading)} />
        <DebugField label="auth.getSession() (on Rehydrate)" value={JSON.stringify(hydratedSession, null, 2)} />
        <DebugField label="auth.getUser() (on Rehydrate)" value={JSON.stringify(hydratedUser, null, 2)} />
        <DebugField label="SecureStore (on Rehydrate)" value={storedToken} />
        <DebugField label="SecureStore (on Mount)" value={debugRawValueOnMount} />
        <DebugField label="ExpoSecureStoreAdapter Logs" value={secureStoreLogs.join('\n')} />

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={forceRehydrate} disabled={isRehydrating}>
            {isRehydrating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Force Rehydrate</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={signOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Session Debug</Text>
      </View>
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    ...screenTitleText,
    color: COLORS.textDark,
  },
  scrollContent: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    ...bodyStrongText,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  valueContainer: {
    backgroundColor: COLORS.gray,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValue: {
    ...monoSpacedText,
    color: COLORS.textDark,
    flex: 1,
    fontSize: 12,
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  signOutButton: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    ...bodyStrongText,
    color: 'white',
    fontSize: 16,
  },
}); 