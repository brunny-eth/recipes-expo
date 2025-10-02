import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { bodyText, bodyStrongText } from '@/constants/typography';
import { FontAwesome } from '@expo/vector-icons';

interface FriendlyPaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function FriendlyPaywallModal({ visible, onClose }: FriendlyPaywallModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <FontAwesome name="gift" size={48} color={COLORS.primary} />
            </View>
            
            <Text style={styles.title}>Subscriptions Coming Soon!</Text>
            
            <Text style={styles.message}>
              Subscriptions will be available soon. In the meantime, enjoy Olea free.
            </Text>
            
            <Text style={styles.subtitle}>
              You can use all features without any limitations while we prepare our premium offerings.
            </Text>
            
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    margin: SPACING.lg,
    maxWidth: 400,
    width: '100%',
  },
  content: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...bodyStrongText,
    fontSize: 24,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  message: {
    ...bodyText,
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 24,
  },
  subtitle: {
    ...bodyText,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    minWidth: 120,
  },
  buttonText: {
    ...bodyStrongText,
    color: COLORS.white,
    textAlign: 'center',
  },
});
