// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
  useCallback,
  useMemo,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabaseClient';
import { useErrorModal } from './ErrorModalContext';
import { useFreeUsage } from './FreeUsageContext';
import { router, useSegments } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';

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
  console.log(
    `[AuthContext] isFirstLogin check: user ID ${session?.user?.id}, first_login_at: ${metadata?.first_login_at}, result: ${isNewUser}`,
  );
  return isNewUser;
};

// Helper function to compare sessions by meaningful data to prevent redundant updates
const isEqualSession = (prevSession: Session | null, newSession: Session | null): boolean => {
  // Both null or undefined
  if (!prevSession && !newSession) return true;
  
  // One is null, the other isn't
  if (!prevSession || !newSession) return false;
  
  // Compare key properties that matter for our app
  const prevUser = prevSession.user;
  const newUser = newSession.user;
  
  return (
    prevSession.access_token === newSession.access_token &&
    prevSession.refresh_token === newSession.refresh_token &&
    prevUser?.id === newUser?.id &&
    prevUser?.email === newUser?.email &&
    JSON.stringify(prevUser?.user_metadata) === JSON.stringify(newUser?.user_metadata)
  );
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showError } = useErrorModal();
  const {
    hasUsedFreeRecipe: localHasUsedFreeRecipe,
    refetchFreeUsage,
    resetFreeRecipeUsage,
    isLoadingFreeUsage,
  } = useFreeUsage();

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
      if (!url) {
        return;
      }

      // Extract tokens from URL fragment and set session explicitly using setSession()
      const urlParts = url.split('#');
      let fragment = null;
      if (urlParts.length > 1) {
        fragment = urlParts[1];
      }

      if (!fragment) {
        return;
      }

      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          const {
            data: { session: newSession },
            error: sessionError,
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            showError(
              'Authentication Error',
              `Failed to set session: ${sessionError.message}`,
            );
          } else if (newSession) {
            if (__DEV__) {
              console.log('[Auth] Session successfully set via deeplink.');
            }
          }
        } catch (e: any) {
          showError(
            'Authentication Error',
            `Unexpected error setting session: ${e.message}`,
          );
        }
      }
    },
    [showError],
  );

  // Effect to set up auth state change listener and deep link listener
  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (__DEV__) {
          console.log(`[Auth] onAuthStateChange event: ${event}`);
          console.log('[Auth] currentSession (before setSession):', currentSession ? { id: currentSession.user?.id, accessToken: currentSession.access_token?.substring(0, 10) + '...' } : 'null');
          if (session === currentSession) {
            console.log('[Auth] currentSession is referentially same as previous session state.');
          } else {
            console.log('[Auth] currentSession is referentially DIFFERENT from previous session state.');
          }
        }

        // Check if the session content has meaningfully changed before calling setSession
        if (!isEqualSession(session, currentSession)) {
          if (__DEV__) {
            console.log('[Auth] Session content has changed, updating state.');
          }
          setSession(currentSession);
          if (__DEV__) {
            console.log('[Auth] setSession called with:', currentSession ? { id: currentSession.user?.id, event } : 'null');
          }
        } else {
          if (__DEV__) {
            console.log('[Auth] Session content unchanged, skipping setSession to prevent unnecessary re-renders.');
          }
        }
        
        setIsLoading(false);

        setTimeout(async () => {
          if (currentSession && event === 'SIGNED_IN') {
            if (__DEV__) {
              console.log(
                `[Auth] Rehydrated session for user: ${currentSession.user.id}`,
              );
            }
            await new Promise((res) => setTimeout(res, 300));

            if (!isLoadingFreeUsage) {
              if (isFirstLogin(currentSession)) {
                if (localHasUsedFreeRecipe !== null) {
                  const { error: updateError } = await supabase.auth.updateUser(
                    {
                      data: {
                        has_used_free_recipe: localHasUsedFreeRecipe,
                        first_login_at: new Date().toISOString(),
                      },
                    },
                  );
                  if (updateError) {
                    console.error(
                      '[Auth] Error updating user metadata on first login (deferred):',
                      updateError,
                    );
                  }
                }
              }
            }
          } else if (!currentSession && event === 'SIGNED_OUT') {
            resetFreeRecipeUsage();
          }
        }, 0);
      },
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
      linkingSubscription.remove();
    };
  }, [
    localHasUsedFreeRecipe,
    refetchFreeUsage,
    handleUrl,
    showError,
    resetFreeRecipeUsage,
    isLoadingFreeUsage,
  ]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    console.log(`[Auth] Attempting to sign in with ${provider}...`);
    setIsLoading(true);

    if (provider === 'apple') {
      // Apple Native Sign-In
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          throw new Error('Apple authentication is not available on this device');
        }

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

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken,
          // @ts-expect-error Supabase types don't include clientId but it's supported at runtime
          clientId: 'app.meez.auth',
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
      } catch (err: any) {
        console.error('[Apple] Native Sign-In Error:', err.message);
        showError(
          'Sign In Error',
          err.message || 'An unknown error occurred during Apple sign-in.',
        );
      }
      return;
    }

    // Google OAuth flow
    const redirectTo = process.env.EXPO_PUBLIC_AUTH_URL;

    if (!redirectTo) {
      const errorMsg =
        'Missing EXPO_PUBLIC_AUTH_URL environment variable. Cannot proceed with authentication.';
      console.error(`[Auth] ${errorMsg}`);
      showError('Configuration Error', errorMsg);
      return;
    }

    console.log(
      `[Auth] Attempting Google sign-in. Redirect URL: ${redirectTo}`,
    );

    try {
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
          await handleUrl(result.url);
        } else {
          if (result.type === 'cancel') {
            showError(
              'Sign In Cancelled',
              'You cancelled the sign-in process.',
            );
          } else {
            showError(
              'Sign In Error',
              `Sign-in was not completed. Reason: ${result.type}`,
            );
          }
        }
      } else {
        showError(
          'Sign In Error',
          'No redirect URL received. Please try again.',
        );
      }
    } catch (err: any) {
      console.error('[Auth] Google Sign-In Error:', err.message);
      showError(
        'Sign In Error',
        err.message || 'An unknown error occurred during sign-in.',
      );
    }
  }, [handleUrl, showError]);

  const signOut = useCallback(async () => {
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
      setSession(null);
      setIsLoading(false);
      resetFreeRecipeUsage();
      router.replace('/tabs/explore');
    } catch (err: any) {
      console.error(
        '[Auth] Sign Out Error: Caught an error or timeout:',
        err.message,
      );
      showError(
        'Sign Out Error',
        err.message || 'An unknown error occurred during sign-out.',
      );

      console.log(
        '[Auth] Forcing local session clear due to sign out error/timeout.',
      );
      setSession(null);
      setIsLoading(false);
      resetFreeRecipeUsage();
      router.replace('/tabs/explore');
    }
  }, [resetFreeRecipeUsage, showError]);

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
      signIn,
      signOut,
    };

    // Log the final value object reference
    console.log('[AuthContext] 📦 Provider value object created:', {
      reference: contextValue,
      sessionExists: !!contextValue.session,
      isAuthenticated: contextValue.isAuthenticated,
      isLoading: contextValue.isLoading,
    });

    return contextValue;
  }, [session?.user?.id, session?.access_token, session?.refresh_token, isLoading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
