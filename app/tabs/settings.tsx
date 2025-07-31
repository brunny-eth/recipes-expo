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
import {
  bodyText,
  bodyStrongText,
  screenTitleText,
  sectionHeaderText,
  FONT,
} from '@/constants/typography';
import ScreenHeader from '@/components/ScreenHeader';

export default function AccountScreen() {
  const { signOut, isAuthenticated, session } = useAuth();
  const { showError } = useErrorModal();
  const { showSuccess } = useSuccessModal();
  const insets = useSafeAreaInsets();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      showError('Input Required', 'Please enter a message before submitting feedback.');
      return;
    }

    if (!session?.user?.email) {
      showError('Login Required', 'You must be logged in to submit feedback.');
      return;
    }

    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('Missing EXPO_PUBLIC_API_URL environment variable');
      showError('Configuration Error', 'Server configuration error. Please try again later.');
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
          app_version: '1.0.1', // Hardcoded version
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
      showError('Submission Error', 'Failed to submit feedback. Please try again.');
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
      showError('Sign Out Error', 'Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Account" />

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
          <Text style={styles.sectionTitle}>Send Feedback</Text>
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

      </ScrollView>

      {/* Legal Links and Version - Fixed to bottom */}
      <View style={[styles.bottomLegalSection, { paddingBottom: insets.bottom }]}>
        <View style={styles.legalSection}>
          <TouchableOpacity 
            style={styles.legalLink} 
            onPress={() => Linking.openURL('https://meez.app/tos.html')}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.legalLink} 
            onPress={() => Linking.openURL('https://meez.app/privacy.html')}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  scrollView: {
  } as ViewStyle,
  userInfoContainer: {
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm, // Minimal top padding
  } as ViewStyle,
  authStatusText: {
    ...bodyText,
    color: COLORS.textSubtle,
    textAlign: 'center',
  } as TextStyle,
  signOutButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
    backgroundColor: COLORS.primary,
    padding: SPACING.smLg,
    borderRadius: RADIUS.smMd,
    alignItems: 'center',
  } as ViewStyle,
  signOutButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
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
  feedbackInput: {
    backgroundColor: COLORS.white,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
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
    color: COLORS.primary,
  } as TextStyle,
  legalSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  } as ViewStyle,
  legalLink: {
  } as ViewStyle,
  legalLinkText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: COLORS.textSubtle,
  } as TextStyle,
  versionText: {
    ...bodyText,
    color: COLORS.textSubtle,
    textAlign: 'center',
    fontSize: FONT.size.caption,
  } as TextStyle,
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  loginButtonText: {
    ...bodyStrongText,
    color: COLORS.white,
    fontSize: FONT.size.smBody,
  } as TextStyle,
  scrollContent: {
    paddingBottom: SPACING.xl,
  } as ViewStyle,
  bottomLegalSection: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
  } as ViewStyle,
  signOutButtonDisabled: {
    backgroundColor: COLORS.disabled,
  } as ViewStyle,
});
