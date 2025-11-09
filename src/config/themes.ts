// src/config/themes.ts
import { ThemeConfig, ThemeName } from '../types/theme'

export const themes: Record<ThemeName, ThemeConfig> = {
  heng36: {
    name: 'heng36',
    displayName: 'HENG36 PARTY',
    domain: 'heng36.party',
    url: 'https://heng-36s.com/',
    colors: {
      primary: '#10B981',        // เขียวหลัก
      primaryLight: '#34D399',  // เขียวอ่อน
      primaryDark: '#059669',   // เขียวเข้ม
      secondary: '#059669',     // เขียวเข้ม (เดิมเป็นส้ม)
      secondaryLight: '#10B981', // เขียวหลัก (เดิมเป็นส้มอ่อน)
      secondaryDark: '#047857',  // เขียวเข้มกว่า
      accent: '#8B5CF6',        // ม่วงหลัก
      accentLight: '#A78BFA',   // ม่วงอ่อน
      accentDark: '#7C3AED',    // ม่วงเข้ม
      success: '#10B981',        // เขียว
      successLight: '#34D399',   // เขียวอ่อน
      danger: '#EF4444',        // แดง
      dangerLight: '#F87171',   // แดงอ่อน
      warning: '#10B981',        // เขียว (เดิมเป็นส้ม)
      info: '#3B82F6',          // น้ำเงิน
      // Neutral colors
      gray50: '#F9FAFB',
      gray100: '#F3F4F6',
      gray200: '#E5E7EB',
      gray300: '#D1D5DB',
      gray400: '#9CA3AF',
      gray500: '#6B7280',
      gray600: '#4B5563',
      gray700: '#374151',
      gray800: '#1F2937',
      gray900: '#111827',
      // Background colors
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F9FAFB',
      bgTertiary: '#F3F4F6',
      // Text colors
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textTertiary: '#6B7280',
      textInverse: '#FFFFFF',
      // Border colors
      borderLight: '#E5E7EB',
      borderMedium: '#D1D5DB',
      borderDark: '#9CA3AF',
      // Shadow colors
      shadowLight: 'rgba(16, 185, 129, 0.1)',
      shadowMedium: 'rgba(16, 185, 129, 0.2)',
      shadowDark: 'rgba(16, 185, 129, 0.3)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
      secondary: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      accent: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
      success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
      danger: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
      pageBg: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 25%, #BBF7D0 50%, #86EFAC 75%, #4ADE80 100%)',
    },
    assets: {
      logo: '/image/logo-heng36.png',
      logoContainer: '/image/logo-heng36.png',
      backgroundImage: '/image/loykrathong_bg_heng36.png',
      favicon: '/image/heng36.png',
    },
    branding: {
      title: 'HENG36 PARTY',
      subtitle: 'ระบบจัดการเกม HENG36',
      description: 'ระบบจัดการเกมและกิจกรรมสำหรับ HENG36 PARTY',
    },
  },
  max56: {
    name: 'max56',
    displayName: 'MAX56 PARTY',
    domain: 'max56.party',
    url: 'https://max-56.com',
    colors: {
      primary: '#DC2626',        // แดงหลัก
      primaryLight: '#EF4444',   // แดงอ่อน
      primaryDark: '#B91C1C',    // แดงเข้ม
      secondary: '#7C2D12',      // น้ำตาลแดงหลัก
      secondaryLight: '#EA580C',  // ส้มแดงอ่อน
      secondaryDark: '#C2410C',   // น้ำตาลแดงเข้ม
      accent: '#F97316',         // ส้มหลัก
      accentLight: '#FB923C',    // ส้มอ่อน
      accentDark: '#EA580C',     // ส้มเข้ม
      success: '#059669',        // เขียว
      successLight: '#10B981',    // เขียวอ่อน
      danger: '#991B1B',         // แดงเข้ม
      dangerLight: '#DC2626',    // แดง
      warning: '#EA580C',        // ส้มแดง
      info: '#7C2D12',           // น้ำตาลแดง
      // Neutral colors
      gray50: '#F8FAFC',
      gray100: '#F1F5F9',
      gray200: '#E2E8F0',
      gray300: '#CBD5E1',
      gray400: '#94A3B8',
      gray500: '#64748B',
      gray600: '#475569',
      gray700: '#334155',
      gray800: '#1E293B',
      gray900: '#0F172A',
      // Background colors
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F8FAFC',
      bgTertiary: '#F1F5F9',
      // Text colors
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textTertiary: '#64748B',
      textInverse: '#FFFFFF',
      // Border colors
      borderLight: '#E2E8F0',
      borderMedium: '#CBD5E1',
      borderDark: '#94A3B8',
      // Shadow colors
      shadowLight: 'rgba(220, 38, 38, 0.1)',
      shadowMedium: 'rgba(220, 38, 38, 0.2)',
      shadowDark: 'rgba(220, 38, 38, 0.3)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      secondary: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)',
      accent: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
      success: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      danger: 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)',
      pageBg: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 25%, #FECACA 50%, #FCA5A5 75%, #EF4444 100%)',
    },
    assets: {
      logo: '/image/logo-max56.png',
      logoContainer: '/image/logo-max56.png',
      backgroundImage: '/image/loykrathong_bg_max56.png',
      favicon: '/image/max56.png',
    },
    branding: {
      title: 'MAX56 PARTY',
      subtitle: 'ระบบจัดการเกม MAX56',
      description: 'ระบบจัดการเกมและกิจกรรมสำหรับ MAX56 GAME',
    },
  },
  jeed24: {
    name: 'jeed24',
    displayName: 'JEED24 PARTY',
    domain: 'jeed24.party',
    url: 'https://jeed24.org/',
    colors: {
      primary: '#CC5500',        // ส้มหลัก (Burnt Orange)
      primaryLight: '#FF7F00',  // ส้มอ่อน
      primaryDark: '#AA4400',  // ส้มเข้ม
      secondary: '#FF6347',    // Tomato (สีรอง)
      secondaryLight: '#FF8C69', // Light Salmon
      secondaryDark: '#DC3525',  // Fire Brick
      accent: '#FF4500',        // Orange Red
      accentLight: '#FF6B35',   // Coral
      accentDark: '#D2691E',    // Chocolate
      success: '#10B981',       // เขียว
      successLight: '#34D399',  // เขียวอ่อน
      danger: '#EF4444',        // แดง
      dangerLight: '#F87171',   // แดงอ่อน
      warning: '#F59E0B',       // ส้ม
      info: '#CC5500',          // ส้มหลัก
      // Neutral colors
      gray50: '#FAFAFA',
      gray100: '#F5F5F5',
      gray200: '#E5E5E5',
      gray300: '#D4D4D4',
      gray400: '#A3A3A3',
      gray500: '#737373',
      gray600: '#525252',
      gray700: '#404040',
      gray800: '#262626',
      gray900: '#171717',
      // Background colors
      bgPrimary: '#FFFFFF',
      bgSecondary: '#FFF8F0',
      bgTertiary: '#FFF4E6',
      // Text colors
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textTertiary: '#6B7280',
      textInverse: '#FFFFFF',
      // Border colors
      borderLight: '#FFE5CC',
      borderMedium: '#FFCC99',
      borderDark: '#CC5500',
      // Shadow colors
      shadowLight: 'rgba(204, 85, 0, 0.1)',
      shadowMedium: 'rgba(204, 85, 0, 0.2)',
      shadowDark: 'rgba(204, 85, 0, 0.3)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #CC5500 0%, #FF7F00 100%)',
      secondary: 'linear-gradient(135deg, #FF6347 0%, #FF8C69 100%)',
      accent: 'linear-gradient(135deg, #FF4500 0%, #FF6B35 100%)',
      success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
      danger: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
      pageBg: 'linear-gradient(135deg, #FFF8F0 0%, #FFE5CC 25%, #FFCC99 50%, #FFB366 75%, #CC5500 100%)',
    },
    assets: {
      logo: '/image/logo-jeed24.png',
      logoContainer: '/image/logo-jeed24.png',
      backgroundImage: '/image/loykrathong_bg_jeed24.png',
      favicon: '/image/jeed24.png',
    },
    branding: {
      title: 'JEED24 PARTY',
      subtitle: 'ระบบจัดการเกม JEED24',
      description: 'ระบบจัดการเกมและกิจกรรมสำหรับ JEED24',
    },
  },
}

// ฟังก์ชันสำหรับหา theme จากโดเมน
export function getThemeFromDomain(domain: string): ThemeName {
  // ถ้าเป็น jeed24.party หรือ subdomain ของ jeed24
  if (domain.includes('jeed24')) {
    return 'jeed24'
  }
  
  // ถ้าเป็น max56.party หรือ subdomain ของ max56
  if (domain.includes('max56')) {
    return 'max56'
  }
  
  // ถ้าเป็น heng36.party หรือ subdomain ของ heng36
  if (domain.includes('heng36')) {
    return 'heng36'
  }
  
  // default เป็น heng36 สำหรับ localhost และ domain อื่นๆ
  return 'heng36'
}

// ฟังก์ชันสำหรับดึง theme config ปัจจุบัน
export function getCurrentTheme(): ThemeConfig {
  // ตรวจสอบ Vite mode ก่อน
  const viteMode = import.meta.env.MODE
  if (viteMode === 'jeed24') {
    return themes.jeed24
  }
  if (viteMode === 'max56') {
    return themes.max56
  }
  if (viteMode === 'heng36') {
    return themes.heng36
  }
  
  // ถ้าไม่มี mode ให้ตรวจสอบ hostname
  const hostname = window.location.hostname
  
  // ถ้าเป็น jeed24.party หรือ subdomain ของ jeed24
  if (hostname.includes('jeed24')) {
    return themes.jeed24
  }
  
  // ถ้าเป็น max56.party หรือ subdomain ของ max56
  if (hostname.includes('max56')) {
    return themes.max56
  }
  
  // ถ้าเป็น heng36.party หรือ subdomain ของ heng36
  if (hostname.includes('heng36')) {
    return themes.heng36
  }
  
  // default เป็น heng36 สำหรับ localhost และ domain อื่นๆ
  return themes.heng36
}
