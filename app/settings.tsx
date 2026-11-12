import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableHighlight,
  ScrollView,
  ViewStyle,
  TextStyle,
  Linking,
  Alert,
  TextInput,
  Animated,
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
import ConfirmationModal from '@/components/ConfirmationModal';
import { supabase } from '@/lib/supabaseClient';

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
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackAnimation] = useState(new Animated.Value(0));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const appVersion = (Application?.nativeApplicationVersion as string | null) || (Constants?.expoConfig?.version as string | undefined) || 'dev';

  // Animation functions
  const showFeedback = () => {
    setShowFeedbackForm(true);
    Animated.timing(feedbackAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const hideFeedback = () => {
    Animated.timing(feedbackAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowFeedbackForm(false);
    });
  };

  const handleToggleFeedback = () => {
    if (showFeedbackForm) {
      hideFeedback();
    } else {
      showFeedback();
    }
  };

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
        hideFeedback(); // Close the feedback form after successful submission
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


  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error('No active session');
      }

      const backendUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      const response = await fetch(`${backendUrl}/api/users/delete-account`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Sign out locally
        await supabase.auth.signOut();
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Could not delete account');
      }
    } catch (error) {
      console.error('[AccountScreen] Delete account error:', error);
      handleError('Delete Account Error', error);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
      setConfirmStep(1);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="ACCOUNT" showBack={false} backgroundColor="#DEF6FF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Who you are */}
        {isAuthenticated ? (
          <View style={styles.identityBlock}>
            <Text style={styles.groupLabel}>SIGNED IN AS</Text>
            <Text style={styles.identityEmail} numberOfLines={1}>{session?.user?.email}</Text>
          </View>
        ) : (
          <View style={styles.identityBlock}>
            <Text style={styles.signedOutBlurb}>Sign in to save recipes and see your prep work.</Text>
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Log In or Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* General */}
        <View style={styles.group}>
          <SettingsRow label="Send Feedback" onPress={handleToggleFeedback} trailing={showFeedbackForm ? '–' : '›'} />
        {/* Animated Feedback Form Section */}
        {showFeedbackForm && (
          <Animated.View 
            style={[
              styles.feedbackSection,
              {
                opacity: feedbackAnimation,
                transform: [{
                  translateY: feedbackAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  })
                }]
              }
            ]}
          >
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
            <TouchableHighlight
              style={styles.submitFeedbackButton}
              onPress={handleSubmitFeedback}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={!feedbackMessage.trim() || isSubmitting}
            >
              <View style={styles.submitFeedbackButtonContent}>
                <Text style={[
                  styles.submitFeedbackButtonText,
                  (!feedbackMessage.trim() || isSubmitting) && styles.submitFeedbackButtonTextDisabled
                ]}>
                  {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                </Text>
              </View>
            </TouchableHighlight>
          </Animated.View>
        )}
          <SettingsRow label="Privacy Policy" onPress={() => Linking.openURL('https://cookolea.com/privacy.html')} trailing="↗" />
          <SettingsRow label="Terms of Service" onPress={() => Linking.openURL('https://cookolea.com/tos.html')} trailing="↗" />
          {isAuthenticated && (
            <SettingsRow
              label={isSigningOut ? 'Signing Out...' : 'Sign Out'}
              onPress={handleSignOut}
              disabled={isSigningOut}
              last
            />
          )}
        </View>

        {isAuthenticated && (
          <View style={styles.group}>
            <SettingsRow
              label={isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
              onPress={() => setShowDeleteModal(true)}
              disabled={isDeletingAccount}
              destructive
              last
            />
          </View>
        )}

        <Text style={styles.versionText}>Version {appVersion}</Text>
       </ScrollView>

       {/* Delete Account Confirmation Modal */}
       {showDeleteModal && (
         <ConfirmationModal
           visible={showDeleteModal}
           title={confirmStep === 1 ? "Delete Account?" : "Final Confirmation"}
           message={
             confirmStep === 1
               ? "Are you sure you want to delete your Olea account? This will delete all your saved recipes and cancel any existing subscriptions."
               : "Just making sure you clicked that on purpose. If you want to delete your account, click DELETE below and it'll be deleted forever."
           }
           confirmLabel={confirmStep === 1 ? "Continue" : "DELETE"}
           cancelLabel="Cancel"
           destructive={confirmStep === 2}
           onConfirm={() => {
             if (confirmStep === 1) {
               setConfirmStep(2);
             } else {
               handleDeleteAccount();
             }
           }}
           onCancel={() => {
             setConfirmStep(1);
             setShowDeleteModal(false);
           }}
         />
       )}

      <BottomTabBar />
    </View>
  );
}

function SettingsRow({
  label,
  onPress,
  trailing,
  disabled,
  destructive,
  last,
}: {
  label: string;
  onPress: () => void;
  trailing?: string;
  disabled?: boolean;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive, disabled && styles.rowLabelDisabled]}>
        {label}
      </Text>
      {trailing ? <Text style={styles.rowTrailing}>{trailing}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  identityBlock: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,
  groupLabel: {
    ...bodyText,
    fontSize: FONT.size.caption,
    letterSpacing: 0.6,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  } as TextStyle,
  identityEmail: {
    ...bodyStrongText,
    color: COLORS.textDark,
  } as TextStyle,
  signedOutBlurb: {
    ...bodyText,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  } as TextStyle,
  group: {
    borderTopWidth: BORDER_WIDTH.hairline,
    borderTopColor: COLORS.divider,
    marginBottom: SPACING.lg,
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.base + 2,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  } as ViewStyle,
  rowLast: {} as ViewStyle,
  rowLabel: {
    ...bodyText,
    color: COLORS.textDark,
  } as TextStyle,
  rowLabelDestructive: {
    color: COLORS.error,
  } as TextStyle,
  rowLabelDisabled: {
    opacity: 0.5,
  } as TextStyle,
  rowTrailing: {
    ...bodyText,
    color: COLORS.textMuted,
  } as TextStyle,
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
  } as ViewStyle,
  scrollView: {
    flex: 1,
  } as ViewStyle,
  userInfoContainer: {
    marginBottom: SPACING.xxxl + 24,
    paddingTop: SPACING.sm,
  } as ViewStyle,
  authStatusText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
  } as TextStyle,
  subscriptionDetailsText: {
    ...bodyText,
    color: COLORS.textSubtle,
    textAlign: 'left',
    fontSize: FONT.size.caption,
    marginTop: SPACING.xs,
  } as TextStyle,
  signOutButton: {
    marginBottom: SPACING.xs,
  } as ViewStyle,
  signOutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  signOutButtonText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  feedbackSection: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.hairline,
    borderBottomColor: COLORS.divider,
  } as ViewStyle,
  signOutSection: {
    marginBottom: 0,
  } as ViewStyle,
  subscriptionSection: {
    marginBottom: 0,
  } as ViewStyle,
  subscriptionButton: {
    marginBottom: SPACING.xs,
  } as ViewStyle,
  subscriptionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  subscriptionButtonText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
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
  sendFeedbackButtonSection: {
    marginBottom: 0,
  } as ViewStyle,
  sendFeedbackButton: {
    marginBottom: SPACING.xs,
  } as ViewStyle,
  sendFeedbackButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  sendFeedbackButtonText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  submitFeedbackButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  } as ViewStyle,
  submitFeedbackButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  submitFeedbackButtonText: {
    ...bodyText,
    color: COLORS.textDark,
    textAlign: 'left',
  } as TextStyle,
  submitFeedbackButtonTextDisabled: {
    opacity: 0.5,
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
  legalLink: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  } as ViewStyle,
  legalLinkText: {
    ...bodyText,
    fontSize: FONT.size.caption,
    color: '#666666', // Greyish color
    textAlign: 'left',
  } as TextStyle,
  versionText: {
    ...bodyText,
    color: '#666666', // Greyish color
    textAlign: 'left',
    fontSize: FONT.size.caption,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  } as TextStyle,
  tagline: {
    ...bodyText,
    textAlign: 'center',
    color: '#666666', // Greyish color
    marginTop: SPACING.xs,
    marginBottom: SPACING.xxl,
    fontSize: FONT.size.caption,
  } as TextStyle,
  loginButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  } as ViewStyle,
  loginButtonText: {
    ...bodyStrongText,
    color: '#000000',
  } as TextStyle,
  scrollContent: {
    paddingBottom: 120, // Add padding to account for fixed bottom section
    paddingHorizontal: SPACING.pageHorizontal,
  } as ViewStyle,
  fixedBottomLegalSection: {
    position: 'absolute',
    bottom: 100, // Position above the bottom tabs (adjust based on tab height)
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.lg,
    paddingBottom: 0,
    paddingHorizontal: SPACING.pageHorizontal,
    alignItems: 'flex-start',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  } as ViewStyle,
  signOutButtonDisabled: {
    backgroundColor: COLORS.disabled,
  } as ViewStyle,
  deleteAccountButton: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  } as ViewStyle,
  deleteAccountButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  deleteAccountButtonText: {
    ...bodyText,
    color: COLORS.error,
    textAlign: 'left',
  } as TextStyle,
});
