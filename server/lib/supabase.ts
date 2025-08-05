import { createClient } from '@supabase/supabase-js'
import { Database } from '../../common/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.');
}

export const supabase = <Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // For server-side, we don't need to persist session.
    autoRefreshToken: false,
    persistSession: false,
  },
})