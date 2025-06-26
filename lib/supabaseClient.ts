// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Database } from '../common/types/database.types'
import 'react-native-url-polyfill/auto'

let _logHistory: string[] = []

export const getSecureStoreLogs = () => _logHistory

const log = (msg: string) => {
  if (_logHistory.length > 25) _logHistory.shift()
  _logHistory.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// SecureStore adapter
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    log(`[getItem] ${key}`)
    const value = await SecureStore.getItemAsync(key)
    log(`[getItem] ${key} -> ${value ? `exists (${value.slice(0,15)}...)` : 'null'}`)
    return value
  },
  setItem: async (key: string, value: string) => {
    log(`[setItem] Storing key: ${key} with value length: ${value.length} bytes.`)
    return SecureStore.setItemAsync(key, value)
  },
  removeItem: async (key: string) => {
    log(`[removeItem] ${key}`)
    return SecureStore.deleteItemAsync(key)
  },
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // we'll handle this manually in Linking
  },
})