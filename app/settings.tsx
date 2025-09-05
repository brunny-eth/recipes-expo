import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
  TextStyle,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, BORDER_WIDTH } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useErrorModal } from '@/context/ErrorModalContext';
import { useSuccessModal } from '@/context/SuccessModalContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import {
  bodyText,
  bodyStrongText,
  screenTitleText,
  sectionHeaderText,
  captionText,
  FONT,
} from '@/constants/typography';
import ScreenHeader from '@/components/ScreenHeader';
import { useRenderCounter } from '@/hooks/useRenderCounter';
import { useHandleError } from '@/hooks/useHandleError';
import BottomTabBar from '@/components/BottomTabBar';

export default function AccountScreen() {
  const { signOut, isAuthenticated, session } = useAuth();
  useRenderCounter('AccountScreen', { hasSession: !!session, isAuthenticated });
  const { showError } = useErrorModal();
  const handleError = useHandleError();
  const { showSuccess } = useSuccessModal();
  const insets = useSafeAreaInsets();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const appVersion = (Application?.nativeApplicationVersion as string | null) || (Constants?.expoConfig?.version as string | undefined) || 'dev';

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      handleError('Input Required', 'Please enter a message before submitting feedback.');
      return;
    }

    if (!session?.user?.email) {
      handleError('Login Required', 'You must be logged in to submit feedback.');
      return;
    }

    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('Missing EXPO_PUBLIC_API_URL environment variable');
      handleError('Configuration Error', 'Server configuration error. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
          message: feedbackMessage.trim(),
          app_version: appVersion,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        showSuccess('Success', 'Thank you for your feedback!');
        setFeedbackMessage('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AccountScreen] Feedback submission failed:', errorData);
        throw new Error(errorData.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('[AccountScreen] Error submitting feedback:', error);
      handleError('Submission Error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    
    try {
      await signOut();
      // Success message will be shown by AuthNavigationHandler
    } catch (error) {
      console.error('[AccountScreen] Sign out error:', error);
      handleError('Sign Out Error', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="ACCOUNT" showBack={false} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* User Info Section - Just the login status at top */}
        <View style={styles.userInfoContainer}>
          {isAuthenticated ? (
            <>
              <Text style={styles.authStatusText}>
                {`Logged in as ${session?.user?.email}`}
              </Text>
              <Text style={styles.authStatusText}>
                Account status: Subscribed
              </Text>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/login')}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Log In or Sign Up</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback Form Section - Always at consistent position */}
        <View style={styles.feedbackSection}>
          <Text style={[styles.sectionTitle, styles.feedbackTitle]}>Tell us what to improve</Text>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Send us a note if you have an idea for a feature, found a bug, or just want to say hi."
            placeholderTextColor={COLORS.textSubtle}
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={400}
          />
          <TouchableOpacity
            style={[
              styles.sendFeedbackButton,
              (!feedbackMessage.trim() || isSubmitting) && styles.sendFeedbackButtonDisabled
            ]}
            onPress={handleSubmitFeedback}
            disabled={!feedbackMessage.trim() || isSubmitting}
          >
            <Text style={styles.sendFeedbackButtonText}>
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Section - After feedback */}
        {isAuthenticated && (
          <View style={styles.signOutSection}>
            <TouchableOpacity 
              style={[
                styles.signOutButton,
                isSigningOut && styles.signOutButtonDisabled
              ]} 
              onPress={handleSignOut}
              disabled={isSigningOut}
            >
              <Text style={styles.signOutButtonText}>
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {__DEV__ && (
          <View style={styles.devSection}>
            <TouchableOpacity
              style={styles.devLinkRow}
              onPress={() => router.push('/debug' as any)}
            >
              <Text style={styles.devLinkText}>Open Debug Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devLinkRow}
              onPress={async () => {
                try {
                  await AsyncStorage.removeItem('hasLaunched');
                  Alert.alert(
                    'Welcome Screen Reset',
                    'The welcome screen has been reset. The app will now reload.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          Updates.reloadAsync();
                        },
                      },
                    ],
                  );
                } catch (error) {
                  console.error('Failed to reset welcome screen:', error);
                  Alert.alert('Error', 'Failed to reset welcome screen');
                }
              }}
            >
              <Text style={styles.devLinkText}>Reset Welcome Screen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom info - ordered: tagline, version, legal links */}
        <View style={styles.bottomLegalSection}>
          <Text style={styles.tagline}>Designed for home cooks, by home cooks</Text>
          <Text style={styles.versionText}>Version {appVersion}</Text>
          <View style={styles.legalSection}>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://meez.app/privacy.html')}
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://meez.app/tos.html')}
            >
              <Text style={styles.legalLinkText}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
  } as ViewStyle,
  scrollView: {
    flex: 1,
  } as ViewStyle,
  userInfoContainer: {
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm, // Minimal top padding
  } as ViewStyle,
  authStatusText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  signOutButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    minHeight: 44,
  } as ViewStyle,
  signOutButtonText: {
    ...bodyStrongText,
    color: COLORS.textDark,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  feedbackSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  } as ViewStyle,
  signOutSection: {
    marginBottom: SPACING.md,
  } as ViewStyle,
  sectionTitle: {
    ...sectionHeaderText,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  feedbackTitle: {
    ...sectionHeaderText,
    color: COLORS.textDark,
    textAlign: 'center',
  } as TextStyle,
  feedbackInput: {
    backgroundColor: COLORS.background,
    borderWidth: BORDER_WIDTH.default,
    borderColor: '#000000',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    minHeight: 140,
    marginBottom: SPACING.sm,
    ...bodyText,
    color: COLORS.textDark,
  } as TextStyle,
  sendFeedbackButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  sendFeedbackButtonDisabled: {
    backgroundColor: COLORS.disabled,
  } as ViewStyle,
  sendFeedbackButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  devSection: {
    marginBottom: SPACING.xl,
  } as ViewStyle,
  devLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  } as ViewStyle,
  devLinkText: {
    ...bodyText,
    fontSize: FONT.size.smBody,
    color: COLORS.textDark,
  } as TextStyle,
  legalSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: 0,
  } as ViewStyle,
  legalLink: {
  } as ViewStyle,
  legalLinkText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textDark,
  } as TextStyle,
  versionText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'center',
    fontSize: FONT.size.caption,
    marginTop: 0,
  } as TextStyle,
  tagline: {
    ...bodyText,
    textAlign: 'center',
    color: COLORS.textDark,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xxl,
    fontSize: FONT.size.caption,
  } as TextStyle,
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  } as ViewStyle,
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  scrollContent: {
    paddingBottom: 0,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  bottomLegalSection: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,
  signOutButtonDisabled: {
    backgroundColor: COLORS.disabled,
  } as ViewStyle,
});
