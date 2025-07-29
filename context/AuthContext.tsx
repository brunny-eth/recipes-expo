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
import { useSegments } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '@/utils/logger';

const logger = createLogger('auth');

interface UserMetadata {
  role?: 'beta_user' | 'control' | 'variant';
  first_login_at?: string;
  [key: string]: any;
}

type AuthProvider = 'google' | 'apple';

// Navigation events that auth context can emit
export type AuthNavigationEvent = 
  | { type: 'SIGNED_IN'; userId: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'AUTH_ERROR'; error: string };

// Helper function to check if user is new
const isNewUser = async (userId: string): Promise<boolean> => {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    logger.error('Error checking if user is new', { userId, error: error?.message });
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
  // Navigation event emitter
  onAuthNavigation: (callback: (event: AuthNavigationEvent) => void) => () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const { showError } = useErrorModal();

  // Navigation event listeners
  const navigationListeners = useRef<Set<(event: AuthNavigationEvent) => void>>(new Set());

  // Use refs to access the latest values without causing function re-creation
  const showErrorRef = useRef(showError);

  // Update refs whenever the values change
  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  // Navigation event emitter
  const emitNavigationEvent = useCallback((event: AuthNavigationEvent) => {
    logger.info('Emitting auth navigation event', { eventType: event.type, userId: 'userId' in event ? event.userId : undefined });
    navigationListeners.current.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in auth navigation listener', { error: error instanceof Error ? error.message : String(error) });
      }
    });
  }, []);

  // Navigation event subscription
  const onAuthNavigation = useCallback((callback: (event: AuthNavigationEvent) => void) => {
    navigationListeners.current.add(callback);
    return () => {
      navigationListeners.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!session && isLoading) {
        logger.warn('Session hydration is taking over 3 seconds', { 
          sessionExists: !!session, 
          isLoading 
        });
      } else if (!session && !isLoading) {
        logger.warn('No session found after initial hydration', { 
          sessionExists: !!session, 
          isLoading 
        });
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [session, isLoading]);

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (!url) return;

      logger.info('Handling deep link URL', { url });

      // Extract tokens from URL fragment and set session explicitly using setSession()
      const urlParts = url.split('#');
      let fragment = null;
      if (urlParts.length > 1) {
        fragment = urlParts[1];
      }

      if (!fragment) {
        logger.warn('No URL fragment found in deep link', { url });
        return;
      }

      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        logger.info('Tokens found in deep link URL', { 
          accessTokenPresent: !!accessToken, 
          refreshTokenPresent: !!refreshToken 
        });
        
        try {
          const {
            data: { session: newSession },
            error: sessionError,
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            logger.error('Authentication Error: Failed to set session via deeplink', { 
              error: sessionError.message, 
              url 
            });
            showErrorRef.current(
              'Authentication Error',
              `Authentication failed: ${sessionError.message}`,
            );
            emitNavigationEvent({ type: 'AUTH_ERROR', error: sessionError.message });
          } else if (newSession) {
            logger.info('Session set via deep link', { userId: newSession.user.id });
            setSession(newSession);
            setJustLoggedIn(true);
            
            // Check if user is new and update metadata accordingly
            const isNew = await isNewUser(newSession.user.id);
            if (isNew) {
              logger.info('New user detected, updating metadata', { userId: newSession.user.id });
              const { error: metadataError } = await supabase.auth.updateUser({
                data: { 
                  first_login_at: new Date().toISOString(),
                  role: 'beta_user',
                },
              });
              
              if (metadataError) {
                logger.error('Error updating new user metadata', { 
                  userId: newSession.user.id, 
                  error: metadataError.message 
                });
              }
            }

            // Emit navigation event instead of direct navigation
            emitNavigationEvent({ type: 'SIGNED_IN', userId: newSession.user.id });
          }
        } catch (e: any) {
          logger.error('Authentication Error: Unexpected error setting session via deeplink', { 
            error: e.message, 
            url 
          });
          showErrorRef.current(
            'Authentication Error',
            `Unexpected error setting session: ${e.message}`,
          );
          emitNavigationEvent({ type: 'AUTH_ERROR', error: e.message });
        }
      } else {
        logger.warn('No access/refresh tokens found in URL fragment', { url });
      }
    },
    [emitNavigationEvent], // Add emitNavigationEvent to dependencies
  );

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    logger.info('Setting up auth state change listener and URL listener');

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info('Auth Event', { 
          event, 
          sessionExists: !!session, 
          userId: session?.user?.id 
        });

        if (event === 'SIGNED_IN' && session) {
          logger.info('User signed in', { userId: session.user.id });
          setSession(session);
          setJustLoggedIn(true);
          setIsLoading(false);
          // Emit navigation event
          emitNavigationEvent({ type: 'SIGNED_IN', userId: session.user.id });
        } else if (event === 'SIGNED_OUT') {
          logger.info('User signed out', { userId: session?.user?.id || 'unknown' });
          setSession(null);
          setJustLoggedIn(false);
          setIsLoading(false);
          // Emit navigation event
          emitNavigationEvent({ type: 'SIGNED_OUT' });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          logger.info('Session token refreshed', { userId: session.user.id });
          setSession(session);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          logger.info('Initial session check', { 
            sessionFound: !!session, 
            userId: session?.user?.id 
          });
          if (session) {
            setSession(session);
          } else {
            setSession(null);
          }
          setIsLoading(false);
        } else {
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
        logger.info('Initial URL detected', { url });
        handleUrl(url);
      }
    });

    // Cleanup function
    return () => {
      logger.info('Cleaning up auth state listener and URL listener');
      authListener?.subscription?.unsubscribe();
      urlSubscription?.remove();
    };
  }, [handleUrl, emitNavigationEvent]); // Add emitNavigationEvent to dependencies

  const signIn = useCallback(async (provider: AuthProvider): Promise<boolean> => {
    logger.info('Sign-in process started', { provider });
    setIsLoading(true);

    try { // Wrap the entire logic in a try-finally
      if (provider === 'apple') {
        // Apple Native Sign-In
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (!isAvailable) {
            logger.error('Apple Sign-In Error: Authentication not available', { 
              error: 'Apple authentication not available on this device' 
            });
            throw new Error('Apple authentication is not available on this device');
          }

          logger.info('Apple Sign In process started', { provider });
          
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          const { identityToken, email, fullName } = credential;
          if (!identityToken) {
            logger.error('Apple Sign-In Error: No identity token returned', { 
              error: 'No identity token returned from Apple' 
            });
            throw new Error('No identity token returned from Apple');
          }

          logger.info('Apple identity token received, signing in with Supabase', { provider });

          // *** THIS IS THE CRITICAL CHANGE ***
          // For native Apple Sign In, the clientId for Supabase's verification
          // should typically be your app's Bundle ID, not the Service ID (which is more for web flows).
          const supabaseClientId = 'com.meez.recipes';

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
            // @ts-expect-error Supabase types don't include clientId but it's supported at runtime
            clientId: supabaseClientId,
          });

          if (error) {
            logger.error('Apple Sign-In Error: Supabase signInWithIdToken failed', { 
              error: error.message 
            });
            throw error;
          }

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
              logger.info('Updating user metadata with Apple-provided values', { 
                userId: data.user.id,
                metadataKeys: Object.keys(metadataUpdate)
              });
              const { error: metadataError } = await supabase.auth.updateUser({
                data: metadataUpdate,
              });
              if (metadataError) {
                logger.error('Apple Sign-In Error: Failed to update user metadata', { 
                  userId: data.user.id,
                  error: metadataError.message 
                });
              }
            }
          }
          
          logger.info('User signed in successfully', { 
            provider, 
            userId: data?.user?.id,
            hasEmail: !!email,
            hasFullName: !!fullName 
          });
          return true; // Indicate success for Apple
        } catch (err: any) {
          logger.error('Apple sign-in failed', { provider, error: err.message });
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
          logger.error('Configuration Error: Missing EXPO_PUBLIC_AUTH_URL', { error: errorMsg });
          showErrorRef.current('Configuration Error', errorMsg);
          return false; // Indicate failure
        }

        logger.info('Web browser session opened', { provider, redirectTo });

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
            logger.info('Web browser session success', { provider, url: result.url });
            await handleUrl(result.url);
            return true; // Indicate that browser flow completed successfully
          } else if (result.type === 'cancel') {
            logger.warn('Web browser session cancelled by user', { provider });
            showErrorRef.current(
              'Sign In Cancelled',
              'You cancelled the sign-in process.',
            );
            return false; // Indicate cancellation
          } else {
            logger.error('Web browser session unknown result type', { 
              provider, 
              resultType: result.type 
            });
            showErrorRef.current(
              'Sign In Error',
              `Sign-in was not completed. Reason: ${result.type}`,
            );
            return false; // Indicate other failure
          }
        } else {
          logger.error('Sign-in failed: No redirect URL received', { provider });
          showErrorRef.current(
            'Sign In Error',
            'No redirect URL received. Please try again.',
          );
          return false; // Indicate failure to get URL
        }
      }
    } catch (err: any) {
      logger.error('Generic Sign-In Error', { error: err.message, provider });
      showErrorRef.current(
        'Sign In Error',
        err.message || 'An unknown error occurred during sign-in.',
      );
      return false; // Indicate failure due to an exception
    } finally {
      // Always ensure isLoading is set to false when the signIn process finishes,
      // regardless of success, error, or cancellation.
      setIsLoading(false);
    }
  }, [handleUrl, showErrorRef]); // Added showErrorRef to dependencies

  const signOut = useCallback(async () => {
    logger.info('Sign-out process initiated', { userId: session?.user?.id });

    try {
      const signOutPromise = supabase.auth.signOut();

      const timeoutPromise = new Promise<{ error: Error | null }>((resolve) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          logger.warn('Sign out operation timed out', { 
            userId: session?.user?.id, 
            timeout: '10s' 
          });
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
            return { error: null };
          })
          .catch((e) => {
            logger.error('Sign out promise rejected', { 
              userId: session?.user?.id, 
              error: e.message 
            });
            return { error: e };
          }),
        timeoutPromise,
      ]);

      if (result.error) {
        throw result.error;
      }

      logger.info('User signed out successfully via Supabase call', { userId: session?.user?.id });

      // ✅ App-level session cleanup
      setSession(null);
      setIsLoading(false);
      // Emit navigation event instead of direct navigation
      emitNavigationEvent({ type: 'SIGNED_OUT' });
    } catch (err: any) {
      logger.error('Sign out error or timeout', { 
        userId: session?.user?.id, 
        error: err.message 
      });
      showErrorRef.current(
        'Sign Out Error',
        err.message || 'An unknown error occurred during sign-out.',
      );

      logger.info('Local session cleared due to sign out error/timeout', { userId: session?.user?.id });
      setSession(null);
      setIsLoading(false);
      // Emit navigation event even on error
      emitNavigationEvent({ type: 'SIGNED_OUT' });
    }
  }, [session?.user?.id, emitNavigationEvent]); // Added emitNavigationEvent to dependencies

  const clearJustLoggedIn = useCallback(() => {
    logger.info('Clearing justLoggedIn flag', { userId: session?.user?.id });
    setJustLoggedIn(false);
  }, [session?.user?.id]); // Added session?.user?.id to dependencies for proper logging

  const value = useMemo(() => {
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
      onAuthNavigation,
    };

    return contextValue;
  }, [session?.user?.id, session?.access_token, session?.refresh_token, isLoading, justLoggedIn, signIn, signOut, clearJustLoggedIn, onAuthNavigation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
