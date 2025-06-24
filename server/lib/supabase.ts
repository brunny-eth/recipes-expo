import { createClient } from '@supabase/supabase-js'
import { Database } from '../../common/types/database.types'
import logger from './logger'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Log the variables at startup to ensure they are loaded correctly.
logger.info({
  context: 'SupabaseClientInit',
  supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
  hasSupabaseKey: !!supabaseKey,
  hasSupabaseServiceKey: !!supabaseServiceKey,
}, "Initializing Supabase clients");

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// --- Admin Client ---
// For operations requiring elevated privileges, like raw RPC calls or bypassing RLS.
// This should only be used in server-side code.
if (!supabaseServiceKey) {
  throw new Error('Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY is not set in your .env file.')
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    // These options are required for a service-role client
    autoRefreshToken: false,
    persistSession: false
  }
})
