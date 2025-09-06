// lib/supabaseClient.ts (TOP)
console.log('[supabaseClient] loading; crypto?', {
  hasCrypto: !!globalThis.crypto,
  hasSubtle: !!globalThis.crypto?.subtle,
  hasGetRandomValues: !!globalThis.crypto?.getRandomValues,
});

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Database } from '../common/types/database.types'

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  };
}

console.log('[DEBUG] supabaseClient.ts file is being loaded.');

let _logHistory: string[] = []

export const getSecureStoreLogs = () => _logHistory

const log = (msg: string) => {
  if (_logHistory.length > 25) _logHistory.shift()
  _logHistory.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

// Environment variables loaded (values not logged for security)

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || SUPABASE_URL;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // we're handling deep links manually
    flowType: 'pkce',
    storage: {
      async getItem(key) { return AsyncStorage.getItem(key); },
      async setItem(key, value) { return AsyncStorage.setItem(key, value); },
      async removeItem(key) { return AsyncStorage.removeItem(key); },
    },
  },
});