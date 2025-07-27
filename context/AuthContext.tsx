// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabaseClient';
import { useErrorModal } from './ErrorModalContext';
import { router, useSegments } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';

interface UserMetadata {
  role?: 'beta_user' | 'control' | 'variant';
  first_login_at?: string;
  [key: string]: any;
}

type AuthProvider = 'google' | 'apple';

// Helper function to check if user is new
const isNewUser = async (userId: string): Promise<boolean> => {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    console.error('[AuthContext] Error checking if user is new:', error);
    return false;
  }
  
  const isNew = !userData.user.user_metadata?.first_login_at;
  return isNew;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  userMetadata: UserMetadata | null;
  isLoading: boolean;
  justLoggedIn: boolean;
  signIn: (provider: AuthProvider) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearJustLoggedIn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const { showError } = useErrorModal();

  // Use refs to access the latest values without causing function re-creation
  const showErrorRef = useRef(showError);

  // Update refs whenever the values change
  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!session && isLoading) {
        console.warn('[Auth] ⚠️ Session hydration is taking over 3 seconds.');
      } else if (!session && !isLoading) {
        console.warn('[Auth] No session found after initial hydration.');
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [session, isLoading]);

  const handleUrl = useCallback(
    async (url: string | null) => {
      // Add granular logging for useCallback recreation
      console.log('[AuthContext] handleUrl useCallback recreated. Empty dependencies array - should be stable.');
      
      if (!url) return;

      console.log('[AuthContext] Handling deep link URL:', url);

      // Extract tokens from URL fragment and set session explicitly using setSession()
      const urlParts = url.split('#');
      let fragment = null;
      if (urlParts.length > 1) {
        fragment = urlParts[1];
      }

      if (!fragment) {
        console.log('[AuthContext][handleUrl] No URL fragment found.');
        return;
      }

      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[AuthContext][handleUrl] Found access and refresh tokens.');
        try {
          const {
            data: { session: newSession },
            error: sessionError,
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            showErrorRef.current(
              'Authentication Error',
              `Authentication failed: ${sessionError.message}`,
            );
          } else if (newSession) {
            console.log('[AuthContext] Session successfully set via deeplink.');
            setSession(newSession);
            setJustLoggedIn(true);
            
            // Check if user is new and update metadata accordingly
            const isNew = await isNewUser(newSession.user.id);
            if (isNew) {
              console.log('[AuthContext] New user detected, updating metadata');
              const { error: metadataError } = await supabase.auth.updateUser({
                data: { 
                  first_login_at: new Date().toISOString(),
                  role: 'beta_user',
                },
              });
              
              if (metadataError) {
                console.error('[AuthContext] Error updating new user metadata:', metadataError);
              }
            }

            // Navigate to main app
            router.replace('/tabs');
          }
        } catch (e: any) {
          showErrorRef.current(
            'Authentication Error',
            `Unexpected error setting session: ${e.message}`,
          );
        }
      } else {
        console.log('[AuthContext][handleUrl] No access/refresh tokens found in URL fragment.');
      }
    },
    [], // Empty dependency array - function is now truly stable
  );

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    console.log('[AuthContext] Setting up auth state change listener and URL listener.');

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] Auth event: ${event}`, { sessionExists: !!session });

        if (event === 'SIGNED_IN' && session) {
          console.log('[AuthContext] User signed in');
          setSession(session);
          setJustLoggedIn(true);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] User signed out');
          setSession(null);
          setJustLoggedIn(false);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('[AuthContext] Token refreshed');
          setSession(session);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          console.log('[AuthContext] Initial session event');
          if (session) {
            console.log('[AuthContext] Initial session found, setting session');
            setSession(session);
          } else {
            console.log('[AuthContext] No initial session found');
            setSession(null);
          }
          setIsLoading(false);
        } else {
          console.log('[AuthContext] Other auth event, setting loading to false');
          setIsLoading(false);
        }
      },
    );

    // Set up URL listener for deep links
    const urlSubscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    // Check for initial URL when app starts
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[AuthContext] Initial URL detected:', url);
        handleUrl(url);
      }
    });

    // Cleanup function
    return () => {
      console.log('[AuthContext] Cleaning up auth state listener and URL listener.');
      authListener?.subscription?.unsubscribe();
      urlSubscription?.remove();
    };
  }, [handleUrl]);

  const signIn = useCallback(async (provider: AuthProvider): Promise<boolean> => {
    // Add granular logging for useCallback recreation
    console.log('[AuthContext] signIn useCallback recreated. Current dependencies:', {
      handleUrlDep: handleUrl,
    });
    
    console.log(`[Auth] Attempting to sign in with ${provider}...`);
    console.log('[Auth] State update: setIsLoading(true)');
    setIsLoading(true);

    try { // Wrap the entire logic in a try-finally
      if (provider === 'apple') {
        // Apple Native Sign-In
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (!isAvailable) {
            throw new Error('Apple authentication is not available on this device');
          }

          console.log('[Apple] Starting Apple Sign In process...');
          
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          const { identityToken, email, fullName } = credential;
          if (!identityToken) {
            throw new Error('No identity token returned from Apple');
          }

          console.log('[Apple] Identity token received, signing in with Supabase...');
          // Log the identityToken to inspect its 'aud' claim later if needed (copy-paste to jwt.io)
          console.log('[Apple] Identity Token:', identityToken);

          // *** THIS IS THE CRITICAL CHANGE ***
          // For native Apple Sign In, the clientId for Supabase's verification
          // should typically be your app's Bundle ID, not the Service ID (which is more for web flows).
          const supabaseClientId = 'com.meez.recipes';

          console.log('[Apple] Supabase signInWithIdToken clientId:', supabaseClientId);

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
            // @ts-expect-error Supabase types don't include clientId but it's supported at runtime
            clientId: supabaseClientId,
          });

          if (error) throw error;

          if (data?.user && (email || fullName)) {
            const fullNameStr = fullName
              ? [fullName.givenName, fullName.familyName]
                  .filter(Boolean)
                  .join(' ')
              : undefined;

            const metadataUpdate: Record<string, any> = {};
            if (email) metadataUpdate.email = email;
            if (fullNameStr) metadataUpdate.full_name = fullNameStr;

            if (Object.keys(metadataUpdate).length > 0) {
              console.log(
                '[Apple] Updating user metadata with Apple-provided values:',
                metadataUpdate,
              );
              const { error: metadataError } = await supabase.auth.updateUser({
                data: metadataUpdate,
              });
              if (metadataError) {
                console.error(
                  '[Apple] Failed to update user metadata:',
                  metadataError,
                );
              }
            }
          }
          return true; // Indicate success for Apple
        } catch (err: any) {
          console.error('[Apple] Native Sign-In Error:', err.message);
          showErrorRef.current(
            'Sign In Error',
            err.message || 'An unknown error occurred during Apple sign-in.',
          );
          return false; // Indicate failure
        }
      } else { // Google OAuth flow
        const redirectTo = process.env.EXPO_PUBLIC_AUTH_URL;

        if (!redirectTo) {
          const errorMsg =
            'Missing EXPO_PUBLIC_AUTH_URL environment variable. Cannot proceed with authentication.';
          console.error(`[Auth] ${errorMsg}`);
          showErrorRef.current('Configuration Error', errorMsg);
          return false; // Indicate failure
        }

        console.log(
          `[Auth] Attempting Google sign-in. Redirect URL: ${redirectTo}`,
        );

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });

        if (error) throw error;

        if (data.url) {
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectTo,
          );
          if (result.type === 'success' && result.url) {
            console.log('[Auth] WebBrowser.openAuthSessionAsync: Success.');
            await handleUrl(result.url);
            return true; // Indicate that browser flow completed successfully
          } else if (result.type === 'cancel') {
            console.log('[Auth] WebBrowser.openAuthSessionAsync: Cancelled by user.');
            showErrorRef.current(
              'Sign In Cancelled',
              'You cancelled the sign-in process.',
            );
            return false; // Indicate cancellation
          } else {
            console.log(`[Auth] WebBrowser.openAuthSessionAsync: Unknown result type: ${result.type}`);
            showErrorRef.current(
              'Sign In Error',
              `Sign-in was not completed. Reason: ${result.type}`,
            );
            return false; // Indicate other failure
          }
        } else {
          showErrorRef.current(
            'Sign In Error',
            'No redirect URL received. Please try again.',
          );
          return false; // Indicate failure to get URL
        }
      }
    } catch (err: any) {
      console.error('[Auth] Sign-In Error caught:', err.message);
      showErrorRef.current(
        'Sign In Error',
        err.message || 'An unknown error occurred during sign-in.',
      );
      return false; // Indicate failure due to an exception
    } finally {
      // Always ensure isLoading is set to false when the signIn process finishes,
      // regardless of success, error, or cancellation.
      console.log('[Auth] State update: setIsLoading(false) in finally block of signIn');
      setIsLoading(false);
    }
  }, [handleUrl, showErrorRef]); // Added showErrorRef to dependencies

  const signOut = useCallback(async () => {
    // Add granular logging for useCallback recreation
    console.log('[AuthContext] signOut useCallback recreated. Empty dependencies array - should be stable.');
    
    console.log('[Auth] Attempting to sign out.');

    try {
      console.log('[Auth] Initiating supabase.auth.signOut() promise.');
      const signOutPromise = supabase.auth.signOut();
      console.log('[Auth] supabase.auth.signOut() promise initiated.');

      const timeoutPromise = new Promise<{ error: Error | null }>((resolve) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          console.warn(
            '[Auth] Sign out operation timed out (Timeout Promise resolved).',
          );
          resolve({
            error: new Error(
              'Sign out timed out after 10 seconds. Forcing local logout.',
            ),
          });
        }, 10000);
      });

      const result = await Promise.race([
        signOutPromise
          .then(() => {
            console.log(
              '[Auth] supabase.auth.signOut() promise resolved successfully.',
            );
            return { error: null };
          })
          .catch((e) => {
            console.error(
              '[Auth] supabase.auth.signOut() promise rejected immediately:',
              e.message,
            );
            return { error: e };
          }),
        timeoutPromise,
      ]);

      if (result.error) {
        throw result.error;
      }

      console.log('[Auth] User signed out successfully via Supabase call.');

      // ✅ App-level session cleanup
      console.log('[Auth] State update: setSession(null) - clearing session');
      setSession(null);
      console.log('[Auth] State update: setIsLoading(false) - setting loading to false');
      setIsLoading(false);
      router.replace('/login');
    } catch (err: any) {
      console.error(
        '[Auth] Sign Out Error: Caught an error or timeout:',
        err.message,
      );
      showErrorRef.current(
        'Sign Out Error',
        err.message || 'An unknown error occurred during sign-out.',
      );

      console.log(
        '[Auth] Forcing local session clear due to sign out error/timeout.',
      );
      console.log('[Auth] State update: setSession(null) - forcing session clear');
      setSession(null);
      console.log('[Auth] State update: setIsLoading(false) - forcing loading to false');
      setIsLoading(false);
      router.replace('/login');
    }
  }, []); // Empty dependency array - function is now truly stable

  const clearJustLoggedIn = useCallback(() => {
    console.log('[Auth] Clearing justLoggedIn flag');
    setJustLoggedIn(false);
  }, []);

  const value = useMemo(() => {
    // Strategic logging: Track when useMemo recalculates
    console.log('[AuthContext] 🔄 useMemo RECALCULATING. Dependencies changed:', {
      'session?.user?.id': session?.user?.id,
      'session?.access_token': session?.access_token ? `${session.access_token.substring(0, 10)}...` : null,
      'session?.refresh_token': session?.refresh_token ? `${session.refresh_token.substring(0, 10)}...` : null,
      'isLoading': isLoading,
      'signIn reference': signIn,
      'signOut reference': signOut,
    });

    const contextValue = {
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      userMetadata: (session?.user?.user_metadata as UserMetadata) ?? null,
      isLoading,
      justLoggedIn,
      signIn,
      signOut,
      clearJustLoggedIn,
    };

    // Log the final value object reference
    console.log('[AuthContext] 📦 Provider value object created:', {
      reference: contextValue,
      sessionExists: !!contextValue.session,
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
    });

    return contextValue;
  }, [session?.user?.id, session?.access_token, session?.refresh_token, isLoading, justLoggedIn, signIn, signOut, clearJustLoggedIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
