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
import { useRevenueCat } from '@/context/RevenueCatContext';
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
  const { subscriptionStatus, customerInfo, restorePurchases } = useRevenueCat();
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
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const appVersion = (Application?.nativeApplicationVersion as string | null) || (Constants?.expoConfig?.version as string | undefined) || 'dev';

  // Helper function to get subscription details
  const getSubscriptionDetails = (customerInfo: any, status: string): string => {
    if (status === 'Free') return '';
    
    const premiumEntitlement = customerInfo.entitlements?.all?.["premium_access"];
    if (!premiumEntitlement) return '';

    const details = [];
    
    // Handle expiration dates
    if (premiumEntitlement.expirationDate) {
      const expirationDate = new Date(premiumEntitlement.expirationDate);
      const formattedDate = expirationDate.toLocaleDateString();
      
      if (status === 'Free Trial' || status === 'Introductory Period') {
        details.push(`Trial expires ${formattedDate}`);
      } else if (status === 'Set to Cancel') {
        details.push(`Cancels ${formattedDate}`);
      } else if (status === 'Subscribed') {
        details.push(`Renews ${formattedDate}`);
      }
    }

    // Handle product types - updated for new offerings
    if (premiumEntitlement.productIdentifier) {
      const productId = premiumEntitlement.productIdentifier.toLowerCase();
      
      if (productId.includes('lifetime') || productId.includes('$rc_lifetime')) {
        details.push('Lifetime Purchase ($15)');
      } else if (productId.includes('monthly') || productId.includes('$rc_monthly')) {
        details.push('Monthly Subscription ($3/month)');
      } else {
        // Fallback for other product identifiers
        const productName = premiumEntitlement.productIdentifier.replace('olea.', '').replace('$rc_', '');
        details.push(`${productName.charAt(0).toUpperCase() + productName.slice(1)} Plan`);
      }
    }

    return details.join(' • ');
  };

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

  const handleRestorePurchases = async () => {
    if (isRestoringPurchases) {
      return;
    }

    setIsRestoringPurchases(true);
    
    try {
      const success = await restorePurchases();
      if (success) {
        showSuccess('Purchases Restored!', 'Your previous purchases have been restored successfully.');
      }
    } catch (error) {
      // Error handling is done in the context
      console.log('Restore purchases error handled in context');
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const handleManageSubscriptions = () => {
    // Open Apple's subscription management page
    Linking.openURL('itms-apps://apps.apple.com/account/subscriptions').catch((err) => {
      console.log('Error opening subscription management:', err);
      // Fallback to web version
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    });
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
        {/* User Info Section - Just the login status at top */}
        <View style={styles.userInfoContainer}>
          {isAuthenticated ? (
            <>
              <Text style={styles.authStatusText}>
                {`Logged in as ${session?.user?.email}`}
              </Text>
              <Text style={styles.authStatusText}>
                Account Status: {subscriptionStatus}
              </Text>
              {customerInfo && subscriptionStatus !== 'Free' && (
                <Text style={styles.subscriptionDetailsText}>
                  {getSubscriptionDetails(customerInfo, subscriptionStatus)}
                </Text>
              )}
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

        {/* Subscription Management Section */}
        {isAuthenticated && (
          <View style={styles.subscriptionSection}>
            <TouchableHighlight
              style={styles.subscriptionButton}
              onPress={handleRestorePurchases}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isRestoringPurchases}
            >
              <View style={styles.subscriptionButtonContent}>
                <Text style={styles.subscriptionButtonText}>
                  {isRestoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </View>
            </TouchableHighlight>
            
            <TouchableHighlight
              style={styles.subscriptionButton}
              onPress={handleManageSubscriptions}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.subscriptionButtonContent}>
                <Text style={styles.subscriptionButtonText}>
                  Manage Subscriptions
                </Text>
              </View>
            </TouchableHighlight>
          </View>
        )}

        {/* Send Feedback Button - Right under Sign Out */}
        <View style={styles.sendFeedbackButtonSection}>
            <TouchableHighlight
              style={styles.sendFeedbackButton}
              onPress={handleToggleFeedback}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sendFeedbackButtonContent}>
                <Text style={styles.sendFeedbackButtonText}>
                  Send Feedback
                </Text>
              </View>
            </TouchableHighlight>
        </View>

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

        {/* Debug Section - Commented out for now */}
        {/* {__DEV__ && (
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
        )} */}

        {/* Sign Out Section - Moved to bottom */}
        {isAuthenticated && (
          <View style={styles.signOutSection}>
            <TouchableHighlight
              style={styles.signOutButton}
              onPress={handleSignOut}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isSigningOut}
            >
              <View style={styles.signOutButtonContent}>
                <Text style={styles.signOutButtonText}>
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </Text>
              </View>
            </TouchableHighlight>

            {/* Delete Account Button */}
            <TouchableHighlight
              style={styles.deleteAccountButton}
              onPress={() => setShowDeleteModal(true)}
              underlayColor="transparent"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isDeletingAccount}
            >
              <View style={styles.deleteAccountButtonContent}>
                <Text style={styles.deleteAccountButtonText}>
                  {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                </Text>
              </View>
            </TouchableHighlight>
          </View>
        )}

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

       {/* Fixed Bottom Legal Section - Above tabs */}
       <View style={styles.fixedBottomLegalSection}>
         <Text style={styles.versionText}>Version {appVersion}</Text>
         <TouchableOpacity
           style={styles.legalLink}
           onPress={() => Linking.openURL('https://cookolea.com/privacy.html')}
         >
           <Text style={styles.legalLinkText}>Privacy Policy</Text>
         </TouchableOpacity>
         <TouchableOpacity
           style={styles.legalLink}
           onPress={() => Linking.openURL('https://cookolea.com/tos.html')}
         >
           <Text style={styles.legalLinkText}>Terms of Service</Text>
         </TouchableOpacity>
       </View>

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
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
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
    marginTop: 0,
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
    marginBottom: SPACING.lg,
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
