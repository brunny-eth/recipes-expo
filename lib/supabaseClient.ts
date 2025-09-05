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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // we handle the return URL ourselves
  },
})