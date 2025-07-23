import { TextStyle } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';

const ubuntu = 'Ubuntu-Regular';
const ubuntuBold = 'Ubuntu-Bold';
const ubuntuMedium = 'Ubuntu-Medium';
const ubuntuLight = 'Ubuntu-Light';
const inter = 'Inter-Regular';
const interSemiBold = 'Inter-SemiBold';

export function responsiveFont(base: number, min: number, max: number) {
  const scaled = RFValue(base);
  return Math.min(Math.max(scaled, min), max);
}

export const FONT = {
  family: {
    ubuntu,
    ubuntuBold,
    ubuntuMedium,
    ubuntuLight,
    inter,
    interSemiBold,
  },
  size: {
    xs: responsiveFont(12, 10, 12),
    caption: responsiveFont(13, 11, 13),
    smBody: responsiveFont(14, 12, 14),
    bodyMedium: responsiveFont(15, 13, 15),
    body: responsiveFont(16, 14, 16),
    lg: responsiveFont(18, 16, 18),
    sectionHeader: responsiveFont(20, 18, 20),
    xl: responsiveFont(24, 20, 24),
    title: responsiveFont(28, 24, 28),
    screenTitle: responsiveFont(28, 24, 28),
    h1: responsiveFont(30, 26, 30),
    xxl: responsiveFont(32, 28, 32),
  },
  weight: {
    regular: '400',
    semiBold: '600',
    bold: '700',
  },
  lineHeight: {
    none: 1,
    compact: 22,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.625,
    loose: 1.75,
    spacious: 34,
  },
};

export const screenTitleText: TextStyle = {
  fontFamily: FONT.family.ubuntu,
  fontSize: FONT.size.screenTitle,
};

export const titleText: TextStyle = {
  fontFamily: FONT.family.ubuntu,
  fontSize: FONT.size.title,
};

export const sectionHeaderText: TextStyle = {
  fontFamily: FONT.family.ubuntu,
  fontSize: FONT.size.sectionHeader,
};

// Use `bodyText` for settings, buttons, and dense UI
export const bodyText = {
  fontFamily: FONT.family.inter,
  fontSize: FONT.size.smBody,
  lineHeight: 20, // UI-safe baseline
};

// Use `bodyTextLoose` only where font clipping was observed (e.g. Libre Baskerville on iOS)
export const bodyTextLoose = {
  ...bodyText,
  lineHeight: 24, // for custom font rendering quirks
};

export const bodyStrongText: TextStyle = {
  fontFamily: FONT.family.interSemiBold,
  fontSize: FONT.size.body,
};

export const captionText: TextStyle = {
  fontFamily: FONT.family.inter,
  fontSize: FONT.size.caption,
};

export const captionStrongText: TextStyle = {
  fontFamily: FONT.family.interSemiBold,
  fontSize: FONT.size.caption,
};

export const monoSpacedText: TextStyle = {
  fontFamily: 'monospace', // A generic font family that should work on both platforms
  fontSize: responsiveFont(14, 12, 14),
};
