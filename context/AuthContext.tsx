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
import { InteractionManager } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
console.log('[auth-trace] expo-web-browser version?', WebBrowser);
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabaseClient';
import { useErrorModal } from './ErrorModalContext';
import { useHandleError } from '@/hooks/useHandleError';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createLogger } from '@/utils/logger';
import { useAnalytics } from '@/utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Manual PKCE helpers
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const REDIRECT = Linking.createURL('auth-callback');


const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ✅ correct random string (no i/closure bug)
function rand(len = 64) {
  const cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => cs[b % cs.length]).join('');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return b64url(new Uint8Array(hash));
}

let inFlight = false;
export { inFlight as isSignInInFlight };


export async function signInWithGoogleManualPkce() {
  try {
    const supabaseUrl = SUPABASE_URL;
    if (!supabaseUrl) throw new Error('MISSING_SUPABASE_URL');
    if (!/^https:\/\//.test(String(supabaseUrl))) throw new Error('BAD_SUPABASE_URL_EXPECT_HTTPS');

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256ToBase64Url(codeVerifier);

    // ✅ Use the same redirect for authorize and token exchange
    const authorizeUrl =
      `${supabaseUrl}/auth/v1/authorize?provider=google` +
      `&redirect_to=${encodeURIComponent(REDIRECT)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=s256`;

    // Persist only code_verifier (PKCE protects the flow)
    await AsyncStorage.setItem('pkce_code_verifier', codeVerifier);

    // Non-blocking cleanup helper
    const swallow = (p: Promise<any> | Promise<void> | (() => any) | (() => void), name: string) => {
      const promise = typeof p === 'function' ? p() : p;
      return Promise.resolve(promise).then(() => console.log(`[auth][google] ${name}: ok`))
       .catch(e => console.log(`[auth][google] ${name}: err`, String(e)));
    };

    let result;

    // Pre-open cleanup (non-blocking, best-effort)
    swallow(() => WebBrowser.dismissBrowser(), 'dismissBrowser');
    swallow(() => WebBrowser.dismissAuthSession(), 'dismissAuthSession');
    swallow(WebBrowser.coolDownAsync(), 'coolDown');

    // Tiny yield only, do NOT block the gesture
    await new Promise(r => setTimeout(r, 0));

    await InteractionManager.runAfterInteractions(() => Promise.resolve());

    result = await Promise.race([
      WebBrowser.openAuthSessionAsync(authorizeUrl, REDIRECT, { preferEphemeralSession: false }),
      new Promise<unknown>(r => setTimeout(() => r({ type: 'timeout' as const }), 15000)),
    ]);

    // Post-open cleanup
    await WebBrowser.coolDownAsync().catch(()=>{});
    await new Promise(r => setTimeout(r, 120));

    let callbackUrl: string | null = null;
    if (result && typeof result === 'object' && 'type' in result && result.type === 'success' && 'url' in result && typeof result.url === 'string') {
      callbackUrl = result.url;
      console.log('[auth][google] callbackUrl via ASWebAuth ✓');
    } else {
      const resultType = result && typeof result === 'object' && 'type' in result ? result.type : 'unknown';
      console.log('[auth][google] ASWebAuth returned', resultType, '— ASWebAuth failed, no fallback enabled');
      throw new Error(`ASWebAuth failed: ${resultType}`);
    }

    if (!callbackUrl) throw new Error('NO_CALLBACK_URL');

    console.log('[auth][google] T3 parsing callback…');
    console.log('[auth][google] full callback URL:', callbackUrl);

    // Parse using Linking.parse
    const parsed = Linking.parse(callbackUrl);
    const { code, error: oauthError, error_description } = parsed.queryParams ?? {};
    console.log('[auth][google] parsed', { hasCode: !!code, oauthError });

    if (oauthError) {
      console.log('[auth][google] OAuth error:', oauthError, error_description);
      throw new Error(`OAUTH_ERROR: ${oauthError} - ${error_description}`);
    }

    if (!code) {
      console.log('[auth][google] ERROR: Missing authorization code in callback');
      throw new Error('OAUTH_MISSING_CODE');
    }

    console.log('[auth][google] T4 exchanging code…');

    // Read persisted code_verifier
    const persistedVerifier = await AsyncStorage.getItem('pkce_code_verifier');
    console.log('[auth][google] persisted verifier check', { hasVerifier: !!persistedVerifier });
    if (!persistedVerifier) throw new Error('MISSING_PERSISTED_VERIFIER');

    const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`;

    const body = {
      auth_code: code,                 // <-- exact key name for Supabase PKCE
      code_verifier: persistedVerifier,
      redirect_uri: REDIRECT,          // 'olea://auth-callback'
    };

    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!.trim();

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    const json = JSON.parse(text);

    const { access_token, refresh_token } = json;
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    });

    const ex = { session: data?.session, error };

    console.log('[auth][google] exchange result', { ok: !!ex?.session, err: ex?.error });

    if (ex?.error) throw ex.error;
    if (!ex?.session) throw new Error('OAUTH_NO_SESSION');

    // Clean up persisted PKCE values (single-use)
    await AsyncStorage.removeItem('pkce_code_verifier');

    return ex.session;
  } catch (err: any) {
    throw err;
  } finally {
    // GUARANTEE the UI recovers
    inFlight = false; // Reset inFlight flag

    // Clean up any persisted PKCE values in case of failure
    try {
      await AsyncStorage.removeItem('pkce_code_verifier');
    } catch (e) {
      // Silent cleanup failure
    }
  }
}

/** Helpers (keep yours if you already have them) */
function makeState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes); // length ~43, okay
}

async function sha256ToBase64Url(verifier: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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
  const { maybeIdentifyUser, resetUser } = useAnalytics();


  // Keep stable references to external callbacks used inside long-lived listeners
  const showErrorRef = useRef(showError);
  const maybeIdentifyUserRef = useRef(maybeIdentifyUser);
  const resetUserRef = useRef(resetUser);

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    maybeIdentifyUserRef.current = maybeIdentifyUser;
    resetUserRef.current = resetUser;
  }, [maybeIdentifyUser, resetUser]);

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

      try {
        console.log('[auth][exchange] attempting exchangeCodeForSession with url:', url);
        const {
          data: { session: newSession },
          error: sessionError,
        } = await supabase.auth.exchangeCodeForSession(url);

        console.log('[auth][exchange] result', { ok: !sessionError, session: !!newSession, sessionError });

        if (sessionError) {
          logger.error('Authentication Error: Failed to exchange code for session', { 
            error: sessionError.message, 
            url 
          });
          showErrorRef.current(
            'Authentication Error',
            `Authentication failed: ${sessionError.message}`,
          );
          emitNavigationEvent({ type: 'AUTH_ERROR', error: sessionError.message });
        } else if (newSession) {
          // We intentionally avoid local state updates and event emission here.
          // The session will be picked up by the useEffect that listens to onAuthStateChange.
          logger.info('Authentication successful via PKCE code exchange', { 
            userId: newSession.user.id, 
            provider: newSession.user.app_metadata?.provider 
          });
          emitNavigationEvent({ 
            type: 'SIGNED_IN', 
            userId: newSession.user.id, 
            userMetadata: newSession.user.user_metadata || null 
          });
        }
      } catch (error: any) {
        console.log('[auth][exchange] exception during code exchange', error);
        logger.error('Authentication Error: Exception during code exchange', { 
          error: error.message, 
          url 
        });
        showErrorRef.current(
          'Authentication Error',
          `Authentication failed: ${error.message}`,
        );
        emitNavigationEvent({ type: 'AUTH_ERROR', error: error.message });
      }
    },
    [emitNavigationEvent],
  );

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    logger.info('Setting up auth state change listener and URL listener');

    // Temporary debug logging for auth events
    supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[auth] event=', _event, 'hasSession=', !!session);
    });

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
          emitNavigationEvent({ type: 'SIGNED_IN', userId: session.user.id, userMetadata: updatedMetadata });
        } else if (event === 'SIGNED_OUT') {
          logger.info('User signed out', { userId: session?.user?.id || 'unknown' });
          setSession(null);
          setJustLoggedIn(false);
          setIsLoading(false);
          
          // Reset user in PostHog
          resetUserRef.current();
          
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
            // Identify user in PostHog for initial session
            maybeIdentifyUserRef.current(session.user);
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
  }, [handleUrl, emitNavigationEvent]);

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
          const supabaseClientId = 'com.meez.recipes.oauth';

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
          logger.error('Apple sign-in failed', { provider, error: err.message });
          handleError('Sign In Error', err);
          return false; // Indicate failure
        }
      } else { // Google OAuth flow - Manual PKCE
        console.log('[auth][google] starting manual PKCE sign-in');
        await signInWithGoogleManualPkce();
        return true; // Manual PKCE handles everything including session setup
      }
    } catch (err: any) {
      logger.error('Generic Sign-In Error', { error: err.message, provider });
      handleError('Sign In Error', err);
      return false; // Indicate failure due to an exception
    } finally {
      // Always ensure isLoading is set to false when the signIn process finishes,
      // regardless of success, error, or cancellation.
      setIsLoading(false);
    }
  }, [handleUrl, showError]);

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
