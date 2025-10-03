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
import { useHandleError } from '@/hooks/useHandleError';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createLogger } from '@/utils/logger';
import { useAnalytics } from '@/utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';



const logger = createLogger('auth');

interface UserMetadata {
  first_login_at?: string;
  [key: string]: any;
}

type AuthProvider = 'google' | 'apple';

// Navigation events that auth context can emit
export type AuthNavigationEvent = 
  | { type: 'SIGNED_IN'; userId: string; userMetadata: UserMetadata | null }
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
  const handleError = useHandleError();
  const { maybeIdentifyUser, resetUser, track } = useAnalytics();


  // Keep stable references to external callbacks used inside long-lived listeners
  const showErrorRef = useRef(showError);
  const maybeIdentifyUserRef = useRef(maybeIdentifyUser);
  const resetUserRef = useRef(resetUser);
  const trackRef = useRef(track);

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    maybeIdentifyUserRef.current = maybeIdentifyUser;
    resetUserRef.current = resetUser;
    trackRef.current = track;
  }, [maybeIdentifyUser, resetUser, track]);

  // Navigation event listeners
  const navigationListeners = useRef<Set<(event: AuthNavigationEvent) => void>>(new Set());

  // Note: We use callbacks directly from hooks (showError, maybeIdentifyUser, resetUser)
  // and include them in dependency arrays where appropriate instead of storing in refs.

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
        logger.warn('Auth:Failure - Session hydration is taking over 3 seconds', { 
          sessionExists: !!session, 
          isLoading,
          timestamp: new Date().toISOString()
        });
      } else if (!session && !isLoading) {
        logger.warn('Auth:Failure - No session found after initial hydration', { 
          sessionExists: !!session, 
          isLoading,
          timestamp: new Date().toISOString()
        });
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [session, isLoading]);

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (!url) {
        logger.warn('Auth:DeepLink - No URL provided to handleUrl');
        return;
      }

      logger.info('Auth:DeepLink - Handling deep link URL', { 
        url,
        timestamp: new Date().toISOString()
      });

      // Validate app scheme
      const isOleaScheme = url.startsWith('olea://');
      const isHttpsScheme = url.includes('cookolea.com');
      
      logger.info('Auth:DeepLink - URL scheme validation', {
        url,
        isOleaScheme,
        isHttpsScheme,
        expectedScheme: 'olea://',
        timestamp: new Date().toISOString()
      });

      // Extract tokens from URL fragment and set session explicitly using setSession()
      const urlParts = url.split('#');
      console.log("🔍 DeepLink fragment:", url.split("#")[1]);
      let fragment = null;
      if (urlParts.length > 1) {
        fragment = urlParts[1];
      }

      if (!fragment) {
        logger.warn('Auth:DeepLink - No URL fragment found in deep link', { 
          url,
          urlParts: urlParts.length,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      logger.info('Auth:DeepLink - Extracted tokens from URL', {
        accessTokenPresent: !!accessToken,
        refreshTokenPresent: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
        refreshTokenLength: refreshToken?.length || 0,
        timestamp: new Date().toISOString()
      });

      if (accessToken && refreshToken) {
        logger.info('Auth:DeepLink - Tokens found, setting session', { 
          accessTokenPresent: !!accessToken, 
          refreshTokenPresent: !!refreshToken,
          timestamp: new Date().toISOString()
        });
        
        try {
          logger.info('Auth:DeepLink - Calling Supabase setSession', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            timestamp: new Date().toISOString()
          });

          const {
            data: { session: newSession },
            error: sessionError,
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            logger.error('Auth:DeepLink - Failed to set session via deeplink', { 
              error: sessionError.message, 
              url,
              timestamp: new Date().toISOString()
            });
            showErrorRef.current(
              'Authentication Error',
              `Authentication failed: ${sessionError.message}`,
            );
            emitNavigationEvent({ type: 'AUTH_ERROR', error: sessionError.message });
          } else if (newSession) {
            // We intentionally avoid local state updates and event emission here.
            // Setting the session triggers Supabase's onAuthStateChange listener, which is our single source of truth.                                                                                                 
            logger.info('Auth:DeepLink - Session set successfully via deep link', { 
              userId: newSession.user.id ? `${newSession.user.id.slice(0, 8)}...` : null,
              sessionExpiry: newSession.expires_at ? new Date(newSession.expires_at * 1000).toISOString() : null,
              timestamp: new Date().toISOString()
            });
            // Do not call setSession / setJustLoggedIn / maybeIdentifyUser / emit SIGNED_IN here
          } else {
            logger.warn('Auth:DeepLink - setSession returned null session', {
              hasError: !!sessionError,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e: any) {
          logger.error('Auth:DeepLink - Unexpected error setting session via deeplink', { 
            error: e.message, 
            url,
            timestamp: new Date().toISOString()
          });
          showErrorRef.current(
            'Authentication Error',
            `Unexpected error setting session: ${e.message}`,
          );
          emitNavigationEvent({ type: 'AUTH_ERROR', error: e.message });
        }
      } else {
        logger.warn('Auth:DeepLink - No access/refresh tokens found in URL fragment', { 
          url,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          timestamp: new Date().toISOString()
        });
      }
    },
    [emitNavigationEvent],
  );

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    logger.info('Setting up auth state change listener and URL listener');

    // Debug logging for auth events at app startup
    supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth][event]", event, {
        userId: session?.user.id,
        expiresAt: session?.expires_at,
        hasRefresh: !!session?.refresh_token,
      });
    });

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const sessionId = session?.user?.id ? `${session.user.id.slice(0, 8)}...` : null;
        const sessionExpiry = session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;
        
        logger.info('Auth:Callback - Supabase auth state change', { 
          event, 
          sessionExists: !!session, 
          userId: sessionId,
          sessionExpiry,
          timestamp: new Date().toISOString()
        });

        if (event === 'SIGNED_IN' && session) {
          // 5. "Auth: onAuthStateChange event SIGNED_IN"
          const authStateData = {
            event: 'SIGNED_IN',
            userId: sessionId,
            sessionExpiry,
            provider: session.user.app_metadata?.provider || 'unknown',
            timestamp: new Date().toISOString()
          };
          logger.info('Auth: onAuthStateChange event SIGNED_IN', authStateData);
          trackRef.current('Auth: onAuthStateChange event SIGNED_IN', authStateData);
          setSession(session);
          setJustLoggedIn(true);
          setIsLoading(false);
          
          // Identify user in PostHog
          maybeIdentifyUserRef.current(session.user);
          
          // For Apple login, the metadata might already be updated by the signIn function
          // For Google login, we need to update it here
          let updatedMetadata = session.user.user_metadata as UserMetadata;
          const isNew = !session.user.user_metadata?.first_login_at;

          if (isNew) {
            logger.info('New user detected, updating metadata', { userId: session.user.id });

            // For Apple login, check if metadata was already updated by the signIn function
            if (session.user.app_metadata?.provider === 'apple') {
              // Give Apple login flow a moment to complete metadata update
              await new Promise(resolve => setTimeout(resolve, 200));

              // Refresh user data to get latest metadata
              const { data: refreshedUser } = await supabase.auth.getUser();
              if (refreshedUser.user?.user_metadata?.first_login_at) {
                updatedMetadata = refreshedUser.user.user_metadata as UserMetadata;
                logger.info('Apple user metadata already updated by signIn flow', { userId: session.user.id });
              } else {
                // Fallback: update metadata if it wasn't set
                const { error: metadataError } = await supabase.auth.updateUser({
                  data: { first_login_at: new Date().toISOString() },
                });
                if (!metadataError) {
                  updatedMetadata = {
                    ...session.user.user_metadata,
                    first_login_at: new Date().toISOString(),
                  } as UserMetadata;
                }
              }
            } else {
              // For Google and other providers, update metadata normally
              const { error: metadataError } = await supabase.auth.updateUser({
                data: { first_login_at: new Date().toISOString() },
              });

              if (metadataError) {
                logger.error('Error updating new user metadata', {
                  userId: session.user.id,
                  error: metadataError.message
                });
              } else {
                updatedMetadata = {
                  ...session.user.user_metadata,
                  first_login_at: new Date().toISOString(),
                } as UserMetadata;
              }
            }
          }

          // Emit navigation event with the correct metadata
          logger.info('Auth:Navigation - Emitting SIGNED_IN event', {
            userId: sessionId,
            isNewUser: isNew,
            timestamp: new Date().toISOString()
          });
          emitNavigationEvent({ type: 'SIGNED_IN', userId: session.user.id, userMetadata: updatedMetadata });
        } else if (event === 'SIGNED_OUT') {
          // 5. "Auth: onAuthStateChange event SIGNED_OUT"
          const signedOutData = {
            event: 'SIGNED_OUT',
            userId: sessionId || 'unknown',
            timestamp: new Date().toISOString()
          };
          logger.info('Auth: onAuthStateChange event SIGNED_OUT', signedOutData);
          trackRef.current('Auth: onAuthStateChange event SIGNED_OUT', signedOutData);
          setSession(null);
          setJustLoggedIn(false);
          setIsLoading(false);
          
          // Reset user in PostHog
          resetUserRef.current();
          
          // Emit navigation event
          logger.info('Auth:Navigation - Emitting SIGNED_OUT event', {
            timestamp: new Date().toISOString()
          });
          emitNavigationEvent({ type: 'SIGNED_OUT' });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          logger.info('Auth:StateChange - Session token refreshed', { 
            userId: sessionId,
            sessionExpiry,
            timestamp: new Date().toISOString()
          });
          setSession(session);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          logger.info('Auth:StateChange - Initial session check', { 
            sessionFound: !!session, 
            userId: sessionId,
            sessionExpiry,
            timestamp: new Date().toISOString()
          });
          if (session) {
            setSession(session);
            // Identify user in PostHog for initial session
            maybeIdentifyUserRef.current(session.user);
          } else {
            setSession(null);
          }
          setIsLoading(false);
        } else {
          logger.info('Auth:StateChange - Other auth event', {
            event,
            sessionExists: !!session,
            userId: sessionId,
            timestamp: new Date().toISOString()
          });
          setIsLoading(false);
        }
      },
    );

    // Set up URL listener for deep links
    const urlSubscription = Linking.addEventListener('url', (event) => {
      logger.info('Auth:DeepLink - URL event received', {
        url: event.url,
        timestamp: new Date().toISOString()
      });
      handleUrl(event.url);
    });

    // Check for initial URL when app starts
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('Auth:DeepLink - Initial URL detected on app start', { 
          url,
          timestamp: new Date().toISOString()
        });
        handleUrl(url);
      } else {
        logger.info('Auth:DeepLink - No initial URL detected on app start', {
          timestamp: new Date().toISOString()
        });
      }
    }).catch((error) => {
      logger.error('Auth:DeepLink - Error getting initial URL', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    // Cleanup function
    return () => {
      logger.info('Cleaning up auth state listener and URL listener');
      authListener?.subscription?.unsubscribe();
      urlSubscription?.remove();
    };
  }, [handleUrl, emitNavigationEvent]);

  const signIn = useCallback(async (provider: AuthProvider): Promise<boolean> => {
    const sessionId = session?.user?.id ? `${session.user.id.slice(0, 8)}...` : null;
    logger.info('Sign-in process started', { 
      provider, 
      timestamp: new Date().toISOString(),
      existingSessionId: sessionId
    });
    setIsLoading(true);

    try { // Wrap the entire logic in a try-finally
      if (provider === 'apple') {
        // Apple Native Sign-In
        try {
          // 1. "Auth: Apple sign-in started"
          logger.info('Auth: Apple sign-in started', { provider, timestamp: new Date().toISOString() });
          track('Auth: Apple sign-in started', { provider, timestamp: new Date().toISOString() });
          
          logger.info('Checking Apple authentication availability', { provider });
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (!isAvailable) {
            logger.error('Apple Sign-In Error: Authentication not available', { 
              error: 'Apple authentication not available on this device',
              provider
            });
            throw new Error('Apple authentication is not available on this device');
          }

          logger.info('Apple authentication available, starting sign-in flow', { 
            provider,
            timestamp: new Date().toISOString()
          });
          
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          // Temporary debug line to check Apple identity token
          console.log('Apple identity token:', credential.identityToken);

          const { identityToken, email, fullName } = credential;
          
          // 2. "Auth: Apple returned credential"
          const credentialData = {
            provider,
            hasIdentityToken: !!identityToken,
            hasEmail: !!email,
            hasFullName: !!fullName,
            timestamp: new Date().toISOString()
          };
          logger.info('Auth: Apple returned credential', credentialData);
          track('Auth: Apple returned credential', credentialData);
          
          if (!identityToken) {
            const errorMsg = 'Apple didn\'t return a token. Please try again.';
            logger.error('Apple Sign-In Error: No identity token returned', { 
              error: errorMsg,
              provider,
              timestamp: new Date().toISOString()
            });
            track('Auth: Apple token missing', { provider, timestamp: new Date().toISOString() });
            
            // Show user-facing error message to prevent frozen login experience
            showError('Apple Sign-In Error', errorMsg);
            return false; // Don't throw, just return failure
          }

          logger.info('Apple identity token received, signing in with Supabase', { 
            provider,
            tokenPresent: true,
            timestamp: new Date().toISOString()
          });

          // *** APPLE SERVICE ID FOR TOKEN VERIFICATION ***
          // For Apple Sign In with Supabase, the clientId should be your Apple Service ID
          // (configured in Apple Developer Console), NOT the Bundle ID.
          // The Bundle ID is only used for app provisioning and entitlements.
          const supabaseClientId = process.env.EXPO_PUBLIC_APPLE_SERVICE_ID || 'com.meez.recipes.oauth';

          // 3. "Auth: Attempting Supabase exchange"
          const exchangeData = {
            provider: 'apple',
            clientId: supabaseClientId,
            timestamp: new Date().toISOString()
          };
          logger.info('Auth: Attempting Supabase exchange', exchangeData);
          track('Auth: Attempting Supabase exchange', exchangeData);

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
            // @ts-expect-error Supabase types don't include clientId but it's supported at runtime
            clientId: supabaseClientId,
          });

          if (error) {
            // 4. "Auth: Supabase exchange error"
            const errorData = {
              error: error.message,
              provider: 'apple',
              clientId: supabaseClientId,
              timestamp: new Date().toISOString()
            };
            logger.error('Auth: Supabase exchange error', errorData);
            track('Auth: Supabase exchange error', errorData);
            throw error;
          }

          // 4. "Auth: Supabase exchange success"
          const successData = {
            provider: 'apple',
            hasUser: !!data?.user,
            userId: data?.user?.id ? `${data.user.id.slice(0, 8)}...` : null,
            timestamp: new Date().toISOString()
          };
          logger.info('Auth: Supabase exchange success', successData);
          track('Auth: Supabase exchange success', successData);

          if (data?.user) {
            const fullNameStr = fullName
              ? [fullName.givenName, fullName.familyName]
                  .filter(Boolean)
                  .join(' ')
              : undefined;

            const metadataUpdate: Record<string, any> = {};
            if (email) metadataUpdate.email = email;
            if (fullNameStr) metadataUpdate.full_name = fullNameStr;

            // Check if user is new (no first_login_at in metadata) and add it
            if (!data.user.user_metadata?.first_login_at) {
              metadataUpdate.first_login_at = new Date().toISOString();
              logger.info('New Apple user detected, setting first_login_at', { userId: data.user.id });
            }

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
          if (err.code === 'ERR_REQUEST_CANCELED') {
            // User cancelled the sign-in flow - this is normal behavior
            logger.info('Apple sign-in cancelled by user', { provider });
            return false; // Return false but don't show error to user
          } else {
            // Actual error occurred
            logger.error('Apple sign-in failed', { provider, error: err.message });
            handleError('Sign In Error', err);
            return false; // Indicate failure
          }
        }
      } else { // Google OAuth flow
        const redirectTo = process.env.EXPO_PUBLIC_AUTH_URL;

        if (!redirectTo) {
          const errorMsg =
            'Missing EXPO_PUBLIC_AUTH_URL environment variable. Cannot proceed with authentication.';
          logger.error('Configuration Error: Missing EXPO_PUBLIC_AUTH_URL', { 
            error: errorMsg,
            provider: 'google'
          });
          handleError('Configuration Error', errorMsg);
          return false; // Indicate failure
        }

        logger.info('Starting Google OAuth flow', { 
          provider, 
          redirectTo,
          timestamp: new Date().toISOString()
        });

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          logger.error('Google OAuth: Supabase signInWithOAuth failed', {
            provider: 'google',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          throw error;
        }

        if (data.url) {
          logger.info('Opening WebBrowser for Google OAuth', {
            provider: 'google',
            hasUrl: !!data.url,
            redirectTo,
            timestamp: new Date().toISOString()
          });

          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectTo,
          );
          
          logger.info('WebBrowser session completed', {
            provider: 'google',
            resultType: result.type,
            hasResultUrl: 'url' in result && !!result.url,
            timestamp: new Date().toISOString()
          });

          if (result.type === 'success' && 'url' in result && result.url) {
            logger.info('Web browser session success', { 
              provider, 
              url: result.url,
              timestamp: new Date().toISOString()
            });
            await handleUrl(result.url);
            return true; // Indicate that browser flow completed successfully
          } else if (result.type === 'cancel') {
            logger.warn('Web browser session cancelled by user', { 
              provider,
              timestamp: new Date().toISOString()
            });
            handleError('Sign In Cancelled', 'You cancelled the sign-in process.');
            return false; // Indicate cancellation
          } else {
            logger.error('Web browser session unknown result type', { 
              provider, 
              resultType: result.type,
              timestamp: new Date().toISOString()
            });
            handleError('Sign In Error', `Sign-in was not completed. Reason: ${result.type}`);
            return false; // Indicate other failure
          }
        } else {
          logger.error('Sign-in failed: No redirect URL received', { 
            provider,
            timestamp: new Date().toISOString()
          });
          handleError('Sign In Error', 'No redirect URL received. Please try again.');
          return false; // Indicate failure to get URL
        }
      }
    } catch (err: any) {
      logger.error('Auth:Failure - Generic Sign-In Error', { 
        error: err.message, 
        provider,
        timestamp: new Date().toISOString()
      });
      handleError('Sign In Error', err);
      return false; // Indicate failure due to an exception
    } finally {
      // Always ensure isLoading is set to false when the signIn process finishes,
      // regardless of success, error, or cancellation.
      logger.info('Auth:OAuth - Sign-in process completed', {
        provider,
        timestamp: new Date().toISOString()
      });
      setIsLoading(false);
    }
  }, [handleUrl, showError, track]);

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
      handleError('Sign Out Error', err);

      logger.info('Local session cleared due to sign out error/timeout', { userId: session?.user?.id });
      setSession(null);
      setIsLoading(false);
      // Emit navigation event even on error
      emitNavigationEvent({ type: 'SIGNED_OUT' });
    }
  }, [session?.user?.id, emitNavigationEvent, showError]);

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
