import { TextStyle } from 'react-native';

const recoleta = 'Recoleta-Medium';
const inter = 'Inter-Regular';
const interSemiBold = 'Inter-SemiBold';

export const screenTitleText: TextStyle = {
  fontFamily: recoleta,
  fontSize: 28,
};

export const titleText: TextStyle = {
  fontFamily: recoleta,
  fontSize: 22,
};

export const sectionHeaderText: TextStyle = {
  fontFamily: recoleta,
  fontSize: 20,
};

export const bodyText: TextStyle = {
  fontFamily: inter,
  fontSize: 16,
};

export const bodyStrongText: TextStyle = {
  fontFamily: interSemiBold,
  fontSize: 16,
};

export const captionText: TextStyle = {
  fontFamily: inter,
  fontSize: 13,
};

export const captionStrongText: TextStyle = {
  fontFamily: interSemiBold,
  fontSize: 13,
};

export const monoSpacedText: TextStyle = {
  fontFamily: 'monospace', // A generic font family that should work on both platforms
  fontSize: 14,
}; 