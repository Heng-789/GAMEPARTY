// src/components/LogoTitleBar.tsx
import React from 'react'
import { useThemeAssets, useThemeBranding, useThemeColors } from '../contexts/ThemeContext'

interface LogoTitleBarProps {
  className?: string
  height?: number
  showSubtitle?: boolean
  centered?: boolean
  variant?: 'full' | 'compact' | 'minimal'
}

export default function LogoTitleBar({ 
  className = '',
  height = 80,
  showSubtitle = true,
  centered = false,
  variant = 'full'
}: LogoTitleBarProps) {
  const assets = useThemeAssets()
  const branding = useThemeBranding()
  const colors = useThemeColors()

  // สร้าง gradient สำหรับชื่อแบรนด์
  const brandGradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`

  const getLogoStyle = () => {
    const baseStyle = {
      height: `${height}px`,
      width: 'auto',
      objectFit: 'contain' as const,
      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
    }

    switch (variant) {
      case 'compact':
        return { ...baseStyle, height: `${height * 0.7}px` }
      case 'minimal':
        return { ...baseStyle, height: `${height * 0.5}px` }
      default:
        return baseStyle
    }
  }

  const getContainerStyle = () => {
    const baseStyle = {
      background: `linear-gradient(135deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`,
      borderBottom: `2px solid ${colors.borderLight}`,
      boxShadow: `0 2px 12px ${colors.shadowLight}`
    }

    if (centered) {
      return { ...baseStyle, textAlign: 'center' as const }
    }

    return baseStyle
  }

  if (variant === 'minimal') {
    return (
      <div 
        className={`flex items-center justify-center p-4 ${className}`}
        style={getContainerStyle()}
      >
        <img 
          src={assets.logo} 
          alt={branding.title}
          style={getLogoStyle()}
        />
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center gap-4 p-4 ${className}`}
        style={getContainerStyle()}
      >
        <img 
          src={assets.logo} 
          alt={branding.title}
          style={getLogoStyle()}
        />
        <div className="flex flex-col">
          <div 
            className="font-bold text-lg"
            style={{
              background: brandGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {branding.title}
          </div>
          {showSubtitle && (
            <div 
              className="text-sm"
              style={{ color: colors.textSecondary }}
            >
              {branding.subtitle}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full variant (default)
  return (
    <div 
      className={`flex items-center justify-between p-6 ${className}`}
      style={getContainerStyle()}
    >
      <div className="flex items-center gap-6">
        <img 
          src={assets.logo} 
          alt={branding.title}
          style={getLogoStyle()}
        />
        <div className="flex flex-col">
          <div 
            className="font-bold text-2xl"
            style={{
              background: brandGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {branding.title}
          </div>
          {showSubtitle && (
            <div 
              className="text-base mt-1"
              style={{ color: colors.textSecondary }}
            >
              {branding.subtitle}
            </div>
          )}
        </div>
      </div>
      
      {/* Optional: Add navigation or action buttons here */}
      <div className="flex items-center gap-4">
        <div 
          className="text-sm px-3 py-1 rounded-full"
          style={{ 
            backgroundColor: colors.primary + '20',
            color: colors.primary,
            border: `1px solid ${colors.primary}40`
          }}
        >
          {branding.title}
        </div>
      </div>
    </div>
  )
}
