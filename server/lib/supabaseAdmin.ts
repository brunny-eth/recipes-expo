import { createClient } from '@supabase/supabase-js';
import { Database } from '../../common/types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// This check is safe because this file should only ever be imported on the server.
if (!supabaseServiceKey || !supabaseUrl) {
  throw new Error('Missing Supabase admin environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

// For operations requiring elevated privileges, like raw RPC calls or bypassing RLS.
// This should only be used in server-side code.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    // These options are required for a service-role client
    autoRefreshToken: false,
    persistSession: false,
  },
}); 