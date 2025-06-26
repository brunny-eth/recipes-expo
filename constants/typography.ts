import { TextStyle } from 'react-native';

const recoleta = 'Recoleta-Medium';
const inter = 'Inter-Regular';
const interSemiBold = 'Inter-SemiBold';

export const FONT = {
  family: {
    recoleta,
    inter,
    interSemiBold,
  },
  size: {
    xs: 12,
    caption: 13,
    smBody: 14,
    bodyMedium: 15,
    body: 16,
    lg: 18,
    sectionHeader: 20,
    xl: 24,
    title: 28,
    screenTitle: 28,
    h1: 30,
    xxl: 32,
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
  fontFamily: FONT.family.recoleta,
  fontSize: FONT.size.screenTitle,
};

export const titleText: TextStyle = {
  fontFamily: FONT.family.recoleta,
  fontSize: FONT.size.title,
};

export const sectionHeaderText: TextStyle = {
  fontFamily: FONT.family.recoleta,
  fontSize: FONT.size.sectionHeader,
};

// Use `bodyText` for settings, buttons, and dense UI
export const bodyText = {
  fontFamily: FONT.family.inter,
  fontSize: FONT.size.smBody,
  lineHeight: 20, // UI-safe baseline
};

// Use `bodyTextLoose` only where font clipping was observed (e.g. Recoleta on iOS)
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
  fontSize: 14,
};
