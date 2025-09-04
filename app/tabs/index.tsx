import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableHighlight,
  Image,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
} from '@/constants/theme';
import {
  bodyText,
  bodyStrongText,
  FONT,
  captionText,
  sectionHeaderText,
} from '@/constants/typography';
import { useAuth } from '@/context/AuthContext';
import ScreenHeader from '@/components/ScreenHeader';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [isHomeFocused, setIsHomeFocused] = useState(false);

  const { session } = useAuth();
  const router = useRouter();



  // Compact layout detection (smaller iPhones)
  const { height } = useWindowDimensions();
  const isCompact = height < 700;



  // Focus effect logging
  useFocusEffect(
    useCallback(() => {
      setIsHomeFocused(true);
      if (__DEV__) console.log('[Home] focus effect: focused');
      return () => {
        setIsHomeFocused(false);
        if (__DEV__) console.log('[Home] focus effect: blurred');
      };
    }, [])
  );

  // Handle section actions
  const handleSectionAction = useCallback((action: string) => {
    switch (action) {
      case 'customize':
        router.push('/tabs/import');
            break;
      case 'prep_cook':
        router.push('/tabs/mise');
            break;
      case 'cookbooks':
        router.push('/tabs/library');
            break;
          default:
        break;
    }
  }, [router]);

    return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="OLEA"
        showBack={false}
        titleStyle={{ fontSize: 32, fontWeight: '800' }}
      />

                    <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        {/* Tagline */}
        <View style={styles.taglineSection}>
          <Text style={[styles.taglineText, styles.taglineFirstLine]}>
            Turn any recipe into{' '}
            <Text style={styles.taglineBold}>your recipe.</Text>
                      </Text>
          <Text style={[styles.taglineText, styles.taglineBullet]}>
            Customize freely, swap ingredients, personalize instructions, and auto-build shopping lists.
                      </Text>
                  </View>

        {/* Expandable sections */}
        <View style={styles.sectionsContainer}>
          {/* CUSTOMIZE */}
          <View style={styles.sectionWrapper}>
            <TouchableHighlight
              style={styles.sectionCard}
              onPress={() => handleSectionAction('customize')}
              underlayColor="#EEF6FF"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sectionContent}>
                <TouchableOpacity
                  style={styles.headerTouchable}
                  onPress={() => handleSectionAction('customize')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>CUSTOMIZE</Text>
                </TouchableOpacity>
              </View>
            </TouchableHighlight>

            <View style={styles.expandedContent}>
              <Text style={styles.expandedDescription}>
                Transform any recipe to match your preferences, dietary needs, and cooking style.
              </Text>
            </View>
          </View>

          {/* PREP & COOK */}
          <View style={styles.sectionWrapper}>
            <TouchableHighlight
              style={styles.sectionCard}
              onPress={() => handleSectionAction('prep_cook')}
              underlayColor="#EEF6FF"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sectionContent}>
                <TouchableOpacity
                  style={styles.headerTouchable}
                  onPress={() => handleSectionAction('prep_cook')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>PREP & COOK</Text>
                </TouchableOpacity>
              </View>
            </TouchableHighlight>

            <View style={styles.expandedContent}>
              <Text style={styles.expandedDescription}>
                Get step-by-step guidance, smart prep suggestions, and embedded timers.
              </Text>
            </View>
          </View>

          {/* COOKBOOKS */}
          <View style={styles.sectionWrapper}>
            <TouchableHighlight
              style={styles.sectionCard}
              onPress={() => handleSectionAction('cookbooks')}
              underlayColor="#EEF6FF"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sectionContent}>
                <TouchableOpacity
                  style={styles.headerTouchable}
                  onPress={() => handleSectionAction('cookbooks')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>COOKBOOKS</Text>
                </TouchableOpacity>
              </View>
            </TouchableHighlight>

            <View style={styles.expandedContent}>
              <Text style={styles.expandedDescription}>
                Organize and access your personalized recipes. Browse your saved collection and discover new favorites.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom callout */}
      <View style={styles.bottomCallout}>
        <Text style={styles.inlineText}>New to Meez?</Text>
        <TouchableOpacity onPress={() => router.push('/onboarding')}>
          <Text style={styles.inlineLink}>Take a quick tour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.sm,
    paddingBottom: 120, // Increased to account for tab bar height
  },
  taglineSection: {
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl * 2, // 3 lines of space (xl is typically 24px, so xl*2 = 48px)
  },
  taglineText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 0,
  },
  taglineFirstLine: {
    marginBottom: SPACING.lg, // 2 lines of space (lg is typically 16px)
  },
  taglineBold: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    color: COLORS.textDark,
  },
  taglineBullet: {
    marginTop: SPACING.xs,
  },
  sectionsContainer: {
    gap: 0,
  },
  sectionWrapper: {
    marginBottom: 0,
  },
  sectionCard: {
    height: 60,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#D9D5CC',
    borderBottomColor: '#D9D5CC',
    backgroundColor: COLORS.white,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
    paddingHorizontal: 18,
    flex: 1,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
    textTransform: 'uppercase' as const,
    color: COLORS.primary,
    textAlign: 'left',
    flex: 1,
  },
  headerTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    height: '100%',
    paddingVertical: 12,
  },

  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#D9D5CC',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },

  expandedDescription: {
    ...bodyText,
    color: COLORS.textDark,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: SPACING.pageHorizontal,
  },

  inlineLink: {
    color: COLORS.primary,
    textDecorationLine: 'none',
    ...captionText,
  },
  inlineText: {
    ...captionText,
    color: COLORS.textMuted,
  },
  bottomCallout: {
    width: '100%',
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
  },
});