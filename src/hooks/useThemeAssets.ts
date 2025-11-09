// src/hooks/useThemeAssets.ts
import { useThemeAssets } from '../contexts/ThemeContext'

/**
 * Hook สำหรับดึงรูปภาพตามธีมปัจจุบัน
 */
export function useThemeImages() {
  const assets = useThemeAssets()
  
  // ฟังก์ชันสำหรับดึงรูปภาพตามธีม
  const getThemeImage = (baseName: string, extension: string = 'png'): string => {
    // ดึงชื่อธีมจาก assets path
    const logoPath = assets.logo.replace('url("', '').replace('")', '')
    const themeName = logoPath.includes('heng36') ? 'heng36' : 'max56'
    
    return `/image/${baseName}-${themeName}.${extension}`
  }

  return {
    // Card images
    card1: getThemeImage('card1'),
    card2: getThemeImage('card2'),
    card3: getThemeImage('card3'),
    
    // Ghost images
    ghost: getThemeImage('ghost'),
    haha: getThemeImage('haha'),
    
    // Background images
    background: assets.backgroundImage.replace('url("', '').replace('")', ''),
    
    // Logo
    logo: assets.logo.replace('url("', '').replace('")', ''),
    
    // Helper function
    getThemeImage,
  }
}
