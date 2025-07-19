export const COLORS = {
  primary: '#109DF0', // Primary Accent: burnt orange
  primaryLight: '#e6f4fd', // A lighter shade of primary for backgrounds/hovers
  secondary: '#7a8c99', // Tertiary/Border for secondary or disabled states
  accent: '#9253E0', // A brighter, more vibrant orange for active states

  background: '#eeece5', // Main app background
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
  successDark: '#1b4b1e',
  successLight: '#dcfce7',
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
  xxs: 2,
  xs: 4,
  smAlt: 5,
  sm: 8,
  smMd: 10,
  base: 12,
  smLg: 15,
  md: 16,
  lg: 20,
  pageHorizontal: 20,
  xl: 24,
  xlAlt: 25,
  xxl: 32,
  xxlAlt: 30,
  xxxl: 48,
  xxxlAlt: 35,
  footerHeight: 80,
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
  lg: 20,
  xl: 32,
  xxl: 36,
};

export const RADIUS = {
  xs: 4,
  smAlt: 6,
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

export const IMAGE_SIZE = {
  badge: 25,
  thumbnail: 70,
  hero: 80,
  large: 120,
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
