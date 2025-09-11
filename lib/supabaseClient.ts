import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Database } from '../common/types/database.types'

// Polyfill for structuredClone (not available in React Native)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  };
}

// SecureStore adapter for Supabase
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // ✅ because you're handling deep links manually
    },
  }
)