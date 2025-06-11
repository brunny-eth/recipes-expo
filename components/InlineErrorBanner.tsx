import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { bodyText, captionStrongText } from '@/constants/typography';

interface InlineErrorBannerProps {
  message: string;
  retryAction?: () => void;
  retryButtonText?: string;
  showGoBackButton?: boolean;
  goBackAction?: () => void;
  goBackButtonText?: string;
}

const InlineErrorBanner: React.FC<InlineErrorBannerProps> = ({
  message,
  retryAction,
  retryButtonText = 'Retry',
  showGoBackButton = false,
  goBackAction,
  goBackButtonText = 'Go Back',
}) => {
  const router = useRouter();

  const handleGoBack = () => {
    if (goBackAction) {
      goBackAction();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/'); // Fallback to home
    }
  };

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={28} color={COLORS.error} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.messageText}>{message}</Text>
      </View>
      <View style={styles.buttonContainer}>
        {retryAction && (
          <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={retryAction}>
            <Text style={[styles.buttonText, styles.retryButtonText]}>{retryButtonText}</Text>
          </TouchableOpacity>
        )}
        {showGoBackButton && (
          <TouchableOpacity style={[styles.button, styles.goBackButton]} onPress={handleGoBack}>
            <Text style={[styles.buttonText, styles.goBackButtonText]}>{goBackButtonText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.errorBackground,
    padding: Platform.OS === 'ios' ? 15 : 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    ...bodyText,
    color: COLORS.error,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end', // Align buttons to the right if stacked, or manage layout if side-by-side
    marginLeft: 10, // Space between message and buttons
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: Platform.OS === 'ios' ? 0 : 8, // No margin if stacked, else space between buttons
    marginBottom: Platform.OS === 'ios' ? 8 : 0, // Space if stacked vertically
    minWidth: 80,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.warning, // A less severe color for retry
    marginBottom: 8, // Add margin if both buttons are shown
  },
  retryButtonText: {
    ...captionStrongText,
    color: COLORS.white,
  },
  goBackButton: {
    backgroundColor: COLORS.lightGray, // Or another distinct color
  },
  goBackButtonText: {
    ...captionStrongText,
    color: COLORS.textDark,
  },
  buttonText: { // General button text, can be overridden by specific button styles
    ...captionStrongText,
    color: COLORS.white,
  },
});

export default InlineErrorBanner; 