import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/server/lib/supabase';
import { useErrorModal } from './ErrorModalContext';
import { getHasUsedFreeRecipe } from '@/server/lib/freeUsageTracker';

interface UserMetadata {
  role?: 'beta_user' | 'control' | 'variant';
  first_login_at?: string;
  has_used_free_recipe?: boolean;
  [key: string]: any;
}

type AuthProvider = 'google' | 'apple';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  userMetadata: UserMetadata | null;
  isLoading: boolean;
  signIn: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isFirstLogin = (session: Session) => {
  const metadata = session?.user?.user_metadata as UserMetadata | undefined;
  return !metadata?.first_login_at;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showError } = useErrorModal();

  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    };
    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (currentSession && isFirstLogin(currentSession)) {
        try {
          const usedFreeRecipe = await getHasUsedFreeRecipe();

          const { data, error } = await supabase.auth.updateUser({
            data: {
              role: 'beta_user',
              first_login_at: new Date().toISOString(),
              has_used_free_recipe: usedFreeRecipe,
            },
          });
          if (error) throw error;
          
          if (__DEV__) {
            console.log('[Auth] First login: role set to beta_user');
            console.log('[Auth] Synced hasUsedFreeRecipe to Supabase');
          }
          
          // The auth listener will fire again with the updated user,
          // so we don't need to manually set the session here.
          // The next event will handle it.
          return;
        } catch (err: any) {
          showError('Error Updating User', err.message || 'Could not set user role.');
        }
      }

      if (isMounted) {
        setSession(currentSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (provider: AuthProvider) => {
    const redirectTo = Linking.createURL('login-callback');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true, // Required for mobile OAuth
        },
      });

      if (error) throw error;

      if (data.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      }
    } catch (err: any) {
      showError('Sign In Error', err.message || 'An unknown error occurred during sign-in.');
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      showError('Sign Out Error', err.message || 'An unknown error occurred during sign-out.');
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    userMetadata: (session?.user?.user_metadata as UserMetadata) ?? null,
    isLoading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 