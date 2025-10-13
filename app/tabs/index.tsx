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
      case 'library':
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
        backgroundColor="#DEF6FF"
      />

                    <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        {/* Tagline */}
        <View style={styles.taglineSection}>
          <Text style={[styles.taglineText, styles.taglineYourRecipe]}>
            Turn any recipe into{' '}
            <Text style={styles.taglineBold}>your{'\u00A0'}recipe.</Text>
          </Text>
          <Text style={[styles.taglineText, styles.taglineBullet]}>
            Remix your recipes.{'\n'}Swap ingredients.{'\n'}Personalize instructions.{'\n'}Cook your way.
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
                <View style={styles.cardTextContainer}>
                  <Text style={styles.sectionTitle}>Customize</Text>
                  <Text style={styles.sectionDescription}>
                    Import recipes to build your own versions
                  </Text>
                </View>
              </View>
            </TouchableHighlight>
          </View>

          {/* LIBRARY */}
          <View style={styles.sectionWrapper}>
            <TouchableHighlight
              style={styles.sectionCard}
              onPress={() => handleSectionAction('library')}
              underlayColor="#EEF6FF"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sectionContent}>
                <View style={styles.cardTextContainer}>
                  <Text style={styles.sectionTitle}>Library</Text>
                  <Text style={styles.sectionDescription}>
                    Organize your personalized recipes
                  </Text>
                </View>
              </View>
            </TouchableHighlight>
          </View>

          {/* PREP & COOK */}
          <View style={styles.sectionWrapper}>
            <TouchableHighlight
              style={[styles.sectionCard, styles.libraryCard]}
              onPress={() => handleSectionAction('prep_cook')}
              underlayColor="#EEF6FF"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.sectionContent}>
                <View style={styles.cardTextContainer}>
                  <Text style={styles.sectionTitle}>Prep & Cook</Text>
                  <Text style={styles.sectionDescription}>
                    Get your grocery list and start cooking
                  </Text>
                </View>
              </View>
            </TouchableHighlight>
          </View>
        </View>
      </ScrollView>

      {/* Bottom left buttons */}
      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.push('/onboarding')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.bottomButtonContent}>
            <Text style={styles.bottomButtonText}>Take a quick tour</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.bottomButtonContent}>
            <Text style={styles.bottomButtonText}>Settings</Text>
          </View>
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
    paddingTop: SPACING.md,
    paddingBottom: 120, // Increased to account for tab bar height
  },
  taglineSection: {
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.pageHorizontal,
    marginTop: SPACING.sm, // Reduced from SPACING.xl to bring it closer to header
    marginBottom: SPACING.xl, // Increased to create more space before cards
  },
  taglineText: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 0,
  },
  taglineFirstLine: {
    marginBottom: 0, // No space since "your recipe" is now on its own line
  },
  taglineYourRecipe: {
    marginBottom: SPACING.lg, // 2 lines of space (lg is typically 16px)
  },
  taglineBold: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: COLORS.textDark,
  },
  taglineBullet: {
    marginTop: SPACING.xs,
  },
  sectionsContainer: {
    gap: 0,
    marginTop: SPACING.xxxl - 6, // Move up 6px from original spacing
  },
  sectionWrapper: {
    marginBottom: 0,
  },
  sectionCard: {
    width: '90%',
    alignSelf: 'flex-start', // Left align to screen edge
    marginLeft: '5%', // Offset to account for 90% width
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 18, // Keep some right padding
  },
  sectionTitle: {
    fontFamily: FONT.family.graphikMedium,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: SPACING.xs,
  },
  cardTextContainer: {
    flex: 1,
  },
  sectionDescription: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 18,
    color: '#000000',
  },
  libraryCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },

  bottomButtonsContainer: {
    position: 'absolute',
    bottom: 20, // Above tab bar - back to original position
    left: SPACING.pageHorizontal, // Use left positioning instead of paddingLeft
    alignItems: 'flex-start', // Align buttons to start (left)
    gap: 2, // Space between buttons
  },
  bottomButton: {
    height: 32, // Increased height to prevent text cutoff
    backgroundColor: 'transparent',
    alignSelf: 'flex-start', // Only take up space needed for content
    minWidth: 120, // Ensure minimum width for text
  },
  bottomButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
    paddingLeft: 0, // Remove left padding for true left alignment
    paddingRight: 0, // Remove right padding since button is now text-width only
  },
  bottomButtonText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400', // Match Library.tsx headerText
    lineHeight: 24, // Increased line height to prevent descender cutoff
    color: COLORS.textDark,
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingVertical: 4, // Add vertical padding for better text positioning
    textDecorationLine: 'underline',
  },
});