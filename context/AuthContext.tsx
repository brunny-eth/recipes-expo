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
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/server/lib/supabase';
import { useErrorModal } from './ErrorModalContext';
import { useFreeUsage } from './FreeUsageContext';
import { router } from 'expo-router';

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
  const { hasUsedFreeRecipe: localHasUsedFreeRecipe, refetchFreeUsage, resetFreeRecipeUsage, isLoadingFreeUsage } = useFreeUsage();

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


  const handleUrl = useCallback(async (url: string | null) => {
    console.log('[Auth] handleUrl called with URL:', url);
    if (!url) {
      console.log('[Auth] No URL to handle from deep link.');
      return;
    }
    
    // Extract tokens from URL fragment and set session explicitly using setSession()
    const urlParts = url.split('#');
    let fragment = null;
    if (urlParts.length > 1) {
        fragment = urlParts[1];
    }

    if (!fragment) {
      console.warn('[Auth] handleUrl: No fragment found in deep link URL after OAuth.');
      return;
    }
    
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    console.log('[Auth] handleUrl: Parsed Access Token:', accessToken ? 'present' : 'null');
    console.log('[Auth] handleUrl: Parsed Refresh Token:', refreshToken ? 'present' : 'null');

    if (accessToken && refreshToken) {
      console.log('[Auth] handleUrl: Found tokens, attempting to set session via supabase.auth.setSession().');
      try {
        const { data: { session: newSession }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('[Auth] handleUrl: Error setting session:', sessionError.message);
          showError('Authentication Error', `Failed to set session: ${sessionError.message}`);
        } else if (newSession) {
          console.log('[Auth] handleUrl: Session successfully set via supabase.auth.setSession(). onAuthStateChange will now fire. 🚀');
        } else {
          console.warn('[Auth] handleUrl: setSession returned no session despite no error. This may indicate an issue with token validity or Supabase setup.');
        }
      } catch (e: any) {
        console.error('[Auth] handleUrl: Exception while setting session:', e.message);
        showError('Authentication Error', `Unexpected error setting session: ${e.message}`);
      }
    } else {
      console.warn('[Auth] handleUrl: No valid access_token or refresh_token found in deep link URL fragment.');
    }

  }, [showError]); 

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    console.log('[Auth] Initial check for deep link URL.');
    // Check for deep link on app start/resume if it's an OAuth callback
    Linking.getInitialURL().then(handleUrl);

    // Add event listener for deep links while the app is running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      // This listener is important for general deep links that open the app (e.g., from email magic links).
      // For WebBrowser.openAuthSessionAsync, we explicitly call handleUrl in signIn().
      handleUrl(event.url); // Keeping this for other deep link types
    });

    // Correctly get the auth listener object
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => { // Removed 'async' from the direct callback to prevent immediate deadlocks
        console.log(`[Auth] onAuthStateChange event: ${event} Current Session: ${currentSession ? 'present' : 'null'}`);
        // Always update session state synchronously
        setSession(currentSession);
        setIsLoading(false); // Ensure loading is false after any state change

        // Defer any async operations that call Supabase functions to avoid deadlocks
        setTimeout(async () => {
          if (currentSession && event === 'SIGNED_IN') {
            console.log('[Auth] onAuthStateChange: User signed in (deferred logic).');

            // Only perform first login logic if free usage context has finished loading
            if (!isLoadingFreeUsage) {
              if (isFirstLogin(currentSession)) {
                console.log(`[Auth] This is a first login for user: ${currentSession.user.id}`);
                // This check now ensures localHasUsedFreeRecipe is reliable
                if (localHasUsedFreeRecipe !== null) {
                  console.log(`[Auth] Syncing local free recipe usage to Supabase metadata. Local hasUsedFreeRecipe: ${localHasUsedFreeRecipe}`);
                  const { error: updateError } = await supabase.auth.updateUser({ // This await is now safely inside setTimeout
                    data: { has_used_free_recipe: localHasUsedFreeRecipe, first_login_at: new Date().toISOString() },
                  });
                  if (updateError) {
                    console.error('[Auth] Error updating user metadata on first login (deferred):', updateError);
                  } else {
                    console.log('[Auth] User metadata (has_used_free_recipe, first_login_at) successfully updated on Supabase (deferred).');
                  }
                } else {
                    console.warn('[Auth] localHasUsedFreeRecipe is null during first login metadata sync (deferred), even after FreeUsageContext loaded. This should not happen if isLoadingFreeUsage is false.');
                }
              } else {
                  console.log('[Auth] Not a first login or first_login_at already set (deferred).');
              }
            } else {
              console.log('[Auth] FreeUsageContext is still loading, skipping first login metadata sync for now (deferred).');
            }
          } else if (!currentSession && event === 'SIGNED_OUT') {
              console.log('[Auth] onAuthStateChange: User signed out (deferred logic). Resetting local free recipe usage as they are now anonymous again.');
              // Assuming resetFreeRecipeUsage() doesn't have an internal await to Supabase
              // if it does, and you need it to hit Supabase, ensure it's handled here or
              // within its own setTimeout if it causes issues.
              resetFreeRecipeUsage();
          }
        }, 0); // Dispatch to the next event loop tick
      }
    );

    return () => {
      console.log('[Auth] Cleaning up AuthContext subscriptions.');
      if (authListener && authListener.subscription) { // Ensure authListener and its subscription exist
        authListener.subscription.unsubscribe();
      }
      linkingSubscription.remove();
    };
  }, [localHasUsedFreeRecipe, refetchFreeUsage, handleUrl, showError, resetFreeRecipeUsage, isLoadingFreeUsage]); // Dependencies for useEffect


  const signIn = async (provider: AuthProvider) => {
    const redirectTo = AuthSession.makeRedirectUri({
      native: 'meez://auth/callback',
    });
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

        // --- THIS IS THE CRITICAL AND CORRECTED LOGIC FOR signIn ---
        if (result.type === 'success' && result.url) {
          console.log('[OAuth] Web browser session successful. Explicitly processing result.url via handleUrl.');
          await handleUrl(result.url); // <--- THIS IS THE LINE TO ENSURE IT'S PROCESSED
        } else {
          console.warn(`[OAuth] Web browser session not successful or URL missing. Type: ${result.type}`);
          if (result.type === 'cancel') {
             showError('Sign In Cancelled', 'You cancelled the sign-in process.');
          } else {
             showError('Sign In Error', `The sign-in process was not completed (reason: ${result.type}).`);
          }
        }
        console.log('[OAuth] Web browser session processing complete.');
      } else {
        console.warn('[OAuth] No URL received from signInWithOAuth. This might indicate an issue.');
        showError('Sign In Error', 'No redirect URL received from sign-in process. Please try again.');
      }
    } catch (err: any) {
      console.error('[Auth] Sign In Error:', err.message);
      showError('Sign In Error', err.message || 'An unknown error occurred during sign-in.');
    }
  };

  const signOut = async () => {
    console.log('[Auth] Attempting to sign out.');
    try {
        console.log('[Auth] Initiating supabase.auth.signOut() promise.');
        const signOutPromise = supabase.auth.signOut();
        console.log('[Auth] supabase.auth.signOut() promise initiated.');

        const timeoutPromise = new Promise<{ error: Error | null }>(resolve => {
            const id = setTimeout(() => {
                clearTimeout(id);
                console.warn('[Auth] Sign out operation timed out (Timeout Promise resolved).');
                resolve({ error: new Error('Sign out timed out after 10 seconds. Forcing local logout.') });
            }, 10000); // 10 seconds timeout
        });

        const result = await Promise.race([
            signOutPromise.then(() => {
                console.log('[Auth] supabase.auth.signOut() promise resolved successfully.');
                return { error: null };
            }).catch((e) => { // Catch potential immediate rejections from signOutPromise
                console.error('[Auth] supabase.auth.signOut() promise rejected immediately:', e.message);
                return { error: e };
            }),
            timeoutPromise
        ]);

        if (result.error) {
            throw result.error;
        }

        console.log('[Auth] User signed out successfully via Supabase call.');

    } catch (err: any) {
        console.error('[Auth] Sign Out Error: Caught an error or timeout:', err.message);
        showError('Sign Out Error', err.message || 'An unknown error occurred during sign-out.');

        console.log('[Auth] Forcing local session clear due to sign out error/timeout.');
        setSession(null);
        setIsLoading(false);
        resetFreeRecipeUsage();
        router.replace('/login');
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