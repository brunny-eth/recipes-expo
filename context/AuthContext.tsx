// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
  useCallback,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/server/lib/supabase';
import { useErrorModal } from './ErrorModalContext';
import { useFreeUsage } from './FreeUsageContext';

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
  const isNewUser = !metadata?.first_login_at;
  console.log(`[AuthContext] isFirstLogin check: user ID ${session?.user?.id}, first_login_at: ${metadata?.first_login_at}, result: ${isNewUser}`);
  return isNewUser;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showError } = useErrorModal();
  const { hasUsedFreeRecipe: localHasUsedFreeRecipe, refetchFreeUsage } = useFreeUsage();

  // Effect to fetch initial session only once on mount
  useEffect(() => {
    const fetchInitialSession = async () => {
      try {
        console.log('[Auth] Initializing session by getting current session...');
        const { data: { session: initialSession }, error: initialError } = await supabase.auth.getSession();

        if (initialError) {
          console.error('[Auth] Error fetching initial session:', initialError);
          setSession(null);
        } else {
          setSession(initialSession);
        }
      } catch (err) {
        console.error('[Auth] Unexpected error during initial session fetch:', err);
        setSession(null);
      } finally {
        setIsLoading(false);
        console.log(`[Auth] Initial session fetch complete.`);
      }
    };

    fetchInitialSession();
  }, []); // Run only once on mount


  // Moved the handleUrl function outside to be a stable callback
  const handleUrl = useCallback(async (url: string | null) => {
    console.log('[Auth] handleUrl called with URL:', url);
    if (!url) {
      console.log('[Auth] No URL to handle from deep link.');
      return;
    }
    
    // Supabase OAuth often returns tokens in the hash fragment
    const urlParts = url.split('#');
    let fragment = null;
    if (urlParts.length > 1) {
        fragment = urlParts[1];
    }
    console.log('[Auth] URL Fragment:', fragment);

    if (!fragment) {
      console.log('[Auth] No fragment found in deep link URL.');
      return;
    }
    
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    console.log('[Auth] Parsed Access Token:', accessToken ? 'present' : 'null');
    console.log('[Auth] Parsed Refresh Token:', refreshToken ? 'present' : 'null');

    if (accessToken && refreshToken) {
      console.log('[Auth] Found tokens in URL, attempting to set session.');
      const { error } = await supabase.auth.setSession({ // Added await here
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[Auth] Error setting session from deep link:', error.message);
        showError('Authentication Error', 'Failed to set session from deep link.');
      } else {
        console.log('[Auth] Session successfully set from deep link. Login complete 🚀');
      }
    } else {
      console.warn('[Auth] No access_token or refresh_token found in deep link URL fragment.');
    }
  }, [showError]); // Add showError to dependencies since it's from another context

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    console.log('[Auth] Initial check for deep link URL.');
    // Check for deep link on app start/resume if it's an OAuth callback
    Linking.getInitialURL().then(handleUrl);

    // Add event listener for deep links while the app is running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    // Correctly get the auth listener object
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`[Auth] onAuthStateChange event: ${event} Current Session: ${currentSession ? 'present' : 'null'}`);
        // Always update session state
        setSession(currentSession);
        setIsLoading(false); // Ensure loading is false after any state change

        if (currentSession && event === 'SIGNED_IN') {
          console.log('[Auth] Session updated via onAuthStateChange, setting state.');
          // Only perform first login logic if hasUsedFreeRecipe is available and not null
          if (isFirstLogin(currentSession)) {
            console.log(`[Auth] This is a first login for user: ${currentSession.user.id}`);
            // Only sync free usage if its value is known (not null)
            if (localHasUsedFreeRecipe !== null) {
              console.log(`[Auth] Syncing local free recipe usage to Supabase metadata. Local hasUsedFreeRecipe: ${localHasUsedFreeRecipe}`);
              const { error: updateError } = await supabase.auth.updateUser({
                data: { has_used_free_recipe: localHasUsedFreeRecipe, first_login_at: new Date().toISOString() }, // Ensure first_login_at is set here
              });
              if (updateError) {
                console.error('[Auth] Error updating user metadata on first login:', updateError);
              }
            } else {
                console.warn('[Auth] localHasUsedFreeRecipe is null during first login metadata sync. Skipping.');
            }
          }
        } else if (!currentSession && event === 'SIGNED_OUT') {
            console.log('[Auth] User signed out. Optionally reset free recipe usage.');
            // Optionally, reset free usage flag locally on sign out if desired
            // resetFreeRecipeUsage();
        }
      }
    );

    return () => {
      console.log('[Auth] Cleaning up AuthContext subscriptions.');
      if (authListener && authListener.subscription) { // Ensure authListener and its subscription exist
        authListener.subscription.unsubscribe();
      }
      linkingSubscription.remove();
    };
  }, [localHasUsedFreeRecipe, refetchFreeUsage, handleUrl, showError]); // Dependencies for useEffect


  const signIn = async (provider: AuthProvider) => {
    const redirectTo = Linking.createURL('auth/callback');
    console.log(`[Auth] Attempting sign-in with ${provider}. Redirect URL: ${redirectTo}`);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true, // This is crucial for native app flow
        },
      });
  
      if (error) throw error;
  
      if (data.url) {
        console.log('[OAuth] Received redirect URL from Supabase for browser:', data.url);
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        console.log('[OAuth] Web browser session result:', result);

        // Directly process the URL from WebBrowser.openAuthSessionAsync
        if (result.type === 'success' && result.url) {
          console.log('[OAuth] Processing URL from WebBrowser session result.');
          await handleUrl(result.url); // Call handleUrl directly
        } else {
          console.warn(`[OAuth] Web browser session not successful or URL missing. Type: ${result.type}`);
          if (result.type === 'cancel') {
             showError('Sign In Cancelled', 'You cancelled the sign-in process.');
          } else if (result.error) {
             showError('Sign In Error', `Browser error: ${result.error}`);
          }
        }
        console.log('[OAuth] Web browser session processing complete.');
      } else {
        console.warn('[OAuth] No URL received from signInWithOAuth. This might indicate an issue.');
      }
    } catch (err: any) {
      console.error('[Auth] Sign In Error:', err.message);
      showError('Sign In Error', err.message || 'An unknown error occurred during sign-in.');
      throw err;
    }
  };

  const signOut = async () => {
    console.log('[Auth] Attempting to sign out.');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('[Auth] User signed out successfully.');
    } catch (err: any) {
      console.error('[Auth] Sign Out Error:', err.message);
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