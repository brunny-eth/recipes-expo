import { TextStyle } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';

export function responsiveFont(base: number, min: number, max: number) {
  try {
    const scaled = RFValue(base);
    // Ensure we never return NaN or Infinity
    if (isNaN(scaled) || !isFinite(scaled)) {
      console.warn('[Typography] RFValue returned invalid value, using base:', scaled, base);
      return Math.min(Math.max(base, min), max);
    }
    return Math.min(Math.max(scaled, min), max);
  } catch (error) {
    console.warn('[Typography] Error in responsiveFont calculation:', error);
    return Math.min(Math.max(base, min), max);
  }
}

export const FONT = {
  family: {
    logo: 'Ubuntu-Regular',
    heading: 'Ubuntu-Regular',
    body: 'Inter-Regular',
    bold: 'Inter-SemiBold',
    graphikMedium: 'GraphikMedium',
    // Legacy aliases (to be removed after full migration)
    ubuntu: 'Ubuntu-Regular',
    inter: 'Inter-Regular',
    interSemiBold: 'Inter-SemiBold',
  },
  size: {
    meta: responsiveFont(12, 11, 12),
    caption: responsiveFont(14, 13, 14),
    body: responsiveFont(16, 14, 16),
    sectionHeader: responsiveFont(18, 16, 18),
    screenTitle: responsiveFont(26, 22, 26),
    logo: responsiveFont(32, 28, 32),
    // Legacy aliases (to be removed after full migration)
    xs: responsiveFont(12, 11, 12),
    smBody: responsiveFont(14, 13, 14),
    bodyMedium: responsiveFont(16, 14, 16),
    lg: responsiveFont(18, 16, 18),
    xl: responsiveFont(26, 22, 26),
    xxl: responsiveFont(32, 28, 32),
  },
  weight: {
    regular: '400',
    semiBold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 20,
    normal: 24,
    relaxed: 28,
    spacious: 32,
    // Legacy alias (to be removed after full migration)
    compact: 20,
  },
} as const;

// Predefined text styles for common use cases
export const screenTitleText: TextStyle = {
  fontFamily: FONT.family.bold,
  fontSize: FONT.size.screenTitle,
  fontWeight: '600',
};

export const sectionHeaderText: TextStyle = {
  fontFamily: FONT.family.body,
  fontSize: FONT.size.sectionHeader,
  fontWeight: '600',
};

export const bodyText: TextStyle = {
  fontFamily: FONT.family.body,
  fontSize: FONT.size.body,
  lineHeight: FONT.lineHeight.normal,
};

export const bodyStrongText: TextStyle = {
  fontFamily: FONT.family.bold,
  fontSize: FONT.size.body,
  lineHeight: FONT.lineHeight.normal,
};

export const captionText: TextStyle = {
  fontFamily: FONT.family.body,
  fontSize: FONT.size.caption,
  lineHeight: FONT.lineHeight.tight,
};

export const captionStrongText: TextStyle = {
  fontFamily: FONT.family.bold,
  fontSize: FONT.size.caption,
  lineHeight: FONT.lineHeight.tight,
};

export const metaText: TextStyle = {
  fontFamily: FONT.family.body,
  fontSize: FONT.size.meta,
  lineHeight: FONT.lineHeight.tight,
};

export const logoText: TextStyle = {
  fontFamily: FONT.family.logo,
  fontSize: FONT.size.logo,
};

// Legacy exports for backward compatibility during migration
// These will be removed after all components are updated
export const titleText = screenTitleText;
export const bodyTextLoose = bodyText;
export const monoSpacedText: TextStyle = {
  fontFamily: 'monospace',
  fontSize: FONT.size.caption,
};
