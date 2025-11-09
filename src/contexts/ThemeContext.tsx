// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ThemeConfig, ThemeName } from '../types/theme'
import { themes, getCurrentTheme, getThemeFromDomain } from '../config/themes'

interface ThemeContextType {
  theme: ThemeConfig
  themeName: ThemeName
  setTheme: (themeName: ThemeName) => void
  applyTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    // ตรวจสอบ Vite mode ก่อน
    const viteMode = import.meta.env.MODE
    if (viteMode === 'jeed24') {
      return 'jeed24'
    }
    if (viteMode === 'max56') {
      return 'max56'
    }
    if (viteMode === 'heng36') {
      return 'heng36'
    }
    
    // ถ้าไม่มี mode ให้ตรวจสอบ hostname
    const hostname = window.location.hostname
    
    // ถ้าเป็น jeed24.party หรือ subdomain ของ jeed24
    if (hostname.includes('jeed24')) {
      return 'jeed24'
    }
    
    // ถ้าเป็น max56.party หรือ subdomain ของ max56
    if (hostname.includes('max56')) {
      return 'max56'
    }
    
    // ถ้าเป็น heng36.party หรือ subdomain ของ heng36
    if (hostname.includes('heng36')) {
      return 'heng36'
    }
    
    // default เป็น heng36 สำหรับ localhost และ domain อื่นๆ
    return 'heng36'
  })
  
  const [theme, setThemeState] = useState<ThemeConfig>(() => themes[themeName])

  // ฟังก์ชันสำหรับเปลี่ยน theme
  const setTheme = (newThemeName: ThemeName) => {
    setThemeName(newThemeName)
    setThemeState(themes[newThemeName])
  }

  // ฟังก์ชันสำหรับ apply theme ไปยัง CSS variables
  const applyTheme = () => {
    const root = document.documentElement
    
    // Apply color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVarName = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      root.style.setProperty(cssVarName, value)
    })

    // Apply gradient variables
    Object.entries(theme.gradients).forEach(([key, value]) => {
      const cssVarName = `--theme-gradient-${key}`
      root.style.setProperty(cssVarName, value)
    })

    // Apply branding variables
    Object.entries(theme.branding).forEach(([key, value]) => {
      const cssVarName = `--theme-branding-${key}`
      root.style.setProperty(cssVarName, `"${value}"`)
    })

    // Apply URL variable
    if (theme.url) {
      root.style.setProperty('--theme-url', theme.url)
    }

    // Apply asset variables
    Object.entries(theme.assets).forEach(([key, value]) => {
      const cssVarName = `--theme-asset-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      root.style.setProperty(cssVarName, `url("${value}")`)
    })

    // Update page title and favicon
    document.title = theme.branding.title
    updateFavicon(theme.assets.favicon)
  }

  // ฟังก์ชันสำหรับอัปเดต favicon
  const updateFavicon = (faviconPath: string) => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
    if (link) {
      link.href = faviconPath
    } else {
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      newLink.href = faviconPath
      document.head.appendChild(newLink)
    }
  }

  // Apply theme เมื่อ theme เปลี่ยน
  useEffect(() => {
    applyTheme()
    
    // เพิ่ม theme class ใน body
    document.body.className = document.body.className.replace(/theme-\w+/g, '')
    document.body.classList.add(`theme-${themeName}`)
  }, [theme, themeName])

  // Detect domain change (สำหรับกรณีที่เปลี่ยนโดเมนในขณะใช้งาน)
  useEffect(() => {
    const handleDomainChange = () => {
      // ตรวจสอบ Vite mode ก่อนเสมอ
      const viteMode = import.meta.env.MODE
      let newThemeName: ThemeName
      
      if (viteMode === 'jeed24') {
        newThemeName = 'jeed24'
      } else if (viteMode === 'max56') {
        newThemeName = 'max56'
      } else if (viteMode === 'heng36') {
        newThemeName = 'heng36'
      } else {
        // ถ้าไม่มี mode ให้ตรวจสอบ hostname
        const currentDomain = window.location.hostname
        newThemeName = getThemeFromDomain(currentDomain)
      }
      
      if (newThemeName !== themeName) {
        setTheme(newThemeName)
      }
    }

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleDomainChange)
    
    return () => {
      window.removeEventListener('popstate', handleDomainChange)
    }
  }, [themeName])

  const value: ThemeContextType = {
    theme,
    themeName,
    setTheme,
    applyTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Custom hook สำหรับใช้ theme context
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Hook สำหรับดึงข้อมูลเฉพาะของ theme
export function useThemeColors() {
  const { theme } = useTheme()
  return theme.colors
}

export function useThemeGradients() {
  const { theme } = useTheme()
  return theme.gradients
}

export function useThemeBranding() {
  const { theme } = useTheme()
  return theme.branding
}

export function useThemeUrl() {
  const { theme } = useTheme()
  return theme.url
}

export function useThemeAssets() {
  const { theme } = useTheme()
  return theme.assets
}
