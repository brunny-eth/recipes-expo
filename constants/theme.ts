export const COLORS = {
  primary: '#B05B3B', // Primary Accent: burnt orange
  primaryLight: '#D7AD9D', // A lighter shade of primary for backgrounds/hovers
  secondary: '#5C6B73', // Tertiary/Border for secondary or disabled states
  accent: '#E1572A', // A brighter, more vibrant orange for active states

  background: '#F5F3EC', // Main app background
  white: '#FFFFFF',
  black: '#000000',

  textDark: '#27241F', // Neutral Text
  textLight: '#FFFFFF',
  textSubtle: '#a8a29e',
  surface: '#f0f0f0',
  disabled: '#cccccc',

  // Using Tertiary/Border color for grays and borders
  lightGray: '#5C6B73',
  gray: '#5C6B73',
  darkGray: '#5C6B73',

  error: '#D32F2F',
  errorLight: '#fdecea',
  errorBackground: '#FFEBEE',
  success: '#2E7D32',
  warning: '#FFA000',
  divider: '#e6e0d9',
  textMuted: '#8e8e8e',
  googleBlue: '#4285F4',
};

export const OVERLAYS = {
  dark: 'rgba(0, 0, 0, 0.6)',
  medium: 'rgba(0, 0, 0, 0.5)',
  light: 'rgba(0, 0, 0, 0.4)',
  extraLight: 'rgba(0,0,0,0.04)',
  whiteOpaque: 'rgba(255, 255, 255, 0.97)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  smMd: 10,
  md: 16,
  pageHorizontal: 20,
  lg: 24,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BORDER_WIDTH = {
  hairline: 0.5,
  default: 1,
  thick: 2,
};

export const ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 28,
  xl: 32,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  smMd: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 18,
  xxxl: 24,
  pill: 999,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.textDark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.textDark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mediumUp: {
    shadowColor: COLORS.textDark,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  large: {
    shadowColor: COLORS.textDark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
};
