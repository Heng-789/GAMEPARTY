// src/types/theme.ts
export interface ThemeConfig {
  name: string
  displayName: string
  domain: string
  url?: string
  colors: {
    primary: string
    primaryLight: string
    primaryDark: string
    secondary: string
    secondaryLight: string
    secondaryDark: string
    accent: string
    accentLight: string
    accentDark: string
    success: string
    successLight: string
    danger: string
    dangerLight: string
    warning: string
    info: string
    // Neutral colors
    gray50: string
    gray100: string
    gray200: string
    gray300: string
    gray400: string
    gray500: string
    gray600: string
    gray700: string
    gray800: string
    gray900: string
    // Background colors
    bgPrimary: string
    bgSecondary: string
    bgTertiary: string
    // Text colors
    textPrimary: string
    textSecondary: string
    textTertiary: string
    textInverse: string
    // Border colors
    borderLight: string
    borderMedium: string
    borderDark: string
    // Shadow colors
    shadowLight: string
    shadowMedium: string
    shadowDark: string
  }
  gradients: {
    primary: string
    secondary: string
    accent: string
    success: string
    danger: string
    pageBg: string
  }
  assets: {
    logo: string
    logoContainer: string
    backgroundImage: string
    favicon: string
  }
  branding: {
    title: string
    subtitle: string
    description: string
  }
}

export type ThemeName = 'heng36' | 'max56' | 'jeed24'
