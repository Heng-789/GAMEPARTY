// src/utils/themeDebug.ts
import { debugDomainDetection } from './domainDetection'
import { getCurrentTheme } from '../config/themes'

/**
 * ฟังก์ชันสำหรับ debug ระบบ theme ทั้งหมด
 */
export function debugThemeSystem() {
  console.log('🎨 === THEME SYSTEM DEBUG ===')
  
  // Debug domain detection
  const domainDebug = debugDomainDetection()
  
  // Debug current theme
  const currentTheme = getCurrentTheme()
  
  console.log('📊 Current Theme Config:', {
    name: currentTheme.name,
    displayName: currentTheme.displayName,
    domain: currentTheme.domain,
    primaryColor: currentTheme.colors.primary,
    branding: currentTheme.branding,
  })
  
  // Debug CSS variables
  const root = document.documentElement
  const computedStyle = getComputedStyle(root)
  
  console.log('🎨 CSS Variables:', {
    '--theme-primary': computedStyle.getPropertyValue('--theme-primary'),
    '--theme-secondary': computedStyle.getPropertyValue('--theme-secondary'),
    '--theme-accent': computedStyle.getPropertyValue('--theme-accent'),
    '--theme-gradient-primary': computedStyle.getPropertyValue('--theme-gradient-primary'),
    '--theme-branding-title': computedStyle.getPropertyValue('--theme-branding-title'),
  })
  
  // Debug page metadata
  console.log('📄 Page Metadata:', {
    title: document.title,
    favicon: document.querySelector("link[rel*='icon']")?.getAttribute('href'),
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
  })
  
  return {
    domain: domainDebug,
    theme: currentTheme,
    cssVariables: {
      primary: computedStyle.getPropertyValue('--theme-primary'),
      secondary: computedStyle.getPropertyValue('--theme-secondary'),
      accent: computedStyle.getPropertyValue('--theme-accent'),
    }
  }
}

/**
 * ฟังก์ชันสำหรับทดสอบการเปลี่ยน theme
 */
export function testThemeSwitching() {
  console.log('🔄 === TESTING THEME SWITCHING ===')
  
  const themes = ['heng36', 'max56']
  
  themes.forEach((themeName, index) => {
    setTimeout(() => {
      console.log(`🔄 Switching to ${themeName} theme...`)
      
      // Simulate domain change
      const originalHostname = window.location.hostname
      Object.defineProperty(window.location, 'hostname', {
        writable: true,
        value: themeName === 'heng36' ? 'heng36.party' : 'max56.party'
      })
      
      // Trigger theme change
      window.dispatchEvent(new Event('popstate'))
      
      setTimeout(() => {
        console.log(`✅ Theme switched to ${themeName}`)
        debugThemeSystem()
        
        // Restore original hostname
        Object.defineProperty(window.location, 'hostname', {
          writable: true,
          value: originalHostname
        })
      }, 1000)
      
    }, index * 2000)
  })
}

// Auto-debug เมื่อโหลดหน้า (เฉพาะ development)
if (import.meta.env.DEV) {
  setTimeout(() => {
    debugThemeSystem()
  }, 1000)
}
