import { supabase } from '../server/lib/supabase';

(async () => {
  const { data: session } = await supabase.auth.getSession();
  console.log('Initial session:', session);

  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error);
  else console.log('Sign-out success');

  const { data: newSession } = await supabase.auth.getSession();
  console.log('After logout, session:', newSession);
})();