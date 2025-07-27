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
  const insets = useSafeAreaInsets();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Component Mount/Unmount logging
  useEffect(() => {
    console.log('[AccountScreen] Component DID MOUNT');
    console.log('[AccountScreen] Initial auth state:', { isAuthenticated, hasSession: !!session });
    return () => {
      console.log('[AccountScreen] Component WILL UNMOUNT');
    };
  }, []);

  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      console.log('[AccountScreen] 🎯 useFocusEffect triggered');
      console.log('[AccountScreen] 👁️ Screen focused');
      console.log('[AccountScreen] Auth state:', { isAuthenticated, hasSession: !!session });

      return () => {
        console.log('[AccountScreen] 🌀 useFocusEffect cleanup');
        console.log('[AccountScreen] 🌀 Screen is blurring (not necessarily unmounting)');
      };
    }, [isAuthenticated, session])
  );

  // Log auth state changes
  useEffect(() => {
    console.log('[AccountScreen] Auth state changed:', { isAuthenticated, hasSession: !!session });
  }, [isAuthenticated, session]);

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert('Error', 'Please enter a message before submitting feedback.');
      return;
    }

    if (!session?.user?.email) {
      Alert.alert('Error', 'You must be logged in to submit feedback.');
      return;
    }

    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('Missing EXPO_PUBLIC_API_URL environment variable');
      Alert.alert('Error', 'Server configuration error. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[AccountScreen] Submitting feedback to:', `${backendUrl}/api/feedback`);
      
      const response = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
          message: feedbackMessage.trim(),
          app_version: '1.0.0', // Hardcoded version
        }),
      });

      console.log('[AccountScreen] Feedback response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log('[AccountScreen] Feedback submitted successfully:', responseData);
        Alert.alert('Success', 'Thank you for your feedback!');
        setFeedbackMessage('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AccountScreen] Feedback submission failed:', errorData);
        throw new Error(errorData.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('[AccountScreen] Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    console.log('[AccountScreen] Starting sign out process...');
    
    try {
      await signOut();
      console.log('[AccountScreen] Sign out completed successfully');
      // The success feedback will show briefly before navigation
      Alert.alert('Success', 'You have been signed out successfully.', [
        { 
          text: 'OK', 
          onPress: () => {
            console.log('[AccountScreen] Sign out success alert dismissed');
          }
        }
      ]);
    } catch (error) {
      console.error('[AccountScreen] Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
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
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          console.log('[AccountScreen] ScrollView layout height:', height);
        }}
      >
        {/* User Info Section - Fixed height container */}
        <View 
          style={styles.userInfoContainer}
          onLayout={(event) => {
            const { height, y } = event.nativeEvent.layout;
            console.log('[AccountScreen] UserInfoContainer layout:', { height, y, isAuthenticated });
          }}
        >
          {isAuthenticated ? (
            <>
              <View style={styles.authStatusContainer}>
                <Text style={styles.authStatusText}>
                  {`Logged in as ${session?.user?.email}`}
                </Text>
              </View>
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
        <View 
          style={styles.feedbackSection}
          onLayout={(event) => {
            const { height, y } = event.nativeEvent.layout;
            console.log('[AccountScreen] FeedbackSection layout:', { height, y, isAuthenticated });
          }}
        >
          <Text style={styles.sectionTitle}>Send Feedback</Text>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Send us a note if you have an idea for a feature, found a bug, or just want to say hi."
            placeholderTextColor={COLORS.textSubtle}
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            multiline
            numberOfLines={4}
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
      <View style={[styles.bottomLegalSection, { paddingBottom: insets.bottom + SPACING.md }]}>
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
    marginTop: SPACING.xl,
  } as ViewStyle,
  userInfoContainer: {
    height: 140, // Fixed height to ensure consistent positioning (use exact height instead of minHeight)
    marginBottom: SPACING.lg,
    justifyContent: 'center', // Center content vertically within fixed height
  } as ViewStyle,
  authStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.sm,
  } as ViewStyle,
  authStatusText: {
    ...bodyStrongText,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  } as TextStyle,
  userSection: {
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.default,
    borderColor: COLORS.lightGray,
  } as ViewStyle,
  userEmail: {
    ...bodyStrongText,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
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
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xl,
  } as ViewStyle,
  sectionTitle: {
    ...sectionHeaderText,
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
    minHeight: 100,
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
    textDecorationLine: 'underline',
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
  bottomSection: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.lg,
    borderTopWidth: BORDER_WIDTH.default,
    borderTopColor: COLORS.lightGray,
  } as ViewStyle,
  bottomLegalSection: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.lg,
    borderTopWidth: BORDER_WIDTH.default,
    borderTopColor: COLORS.lightGray,
  } as ViewStyle,
  signOutButtonDisabled: {
    backgroundColor: COLORS.disabled,
  } as ViewStyle,
});
