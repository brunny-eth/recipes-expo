import { createClient } from '@supabase/supabase-js'
import { Database } from '../../common/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// This file is now safe to import into client-side code.
// It only uses public-facing environment variables.
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase public environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
