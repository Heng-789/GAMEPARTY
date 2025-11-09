// src/components/DynamicLogo.tsx
import React from 'react'
import { useThemeAssets, useThemeBranding, useThemeColors } from '../contexts/ThemeContext'

interface DynamicLogoProps {
  width?: number
  height?: number
  className?: string
  showText?: boolean
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'horizontal' | 'vertical' | 'icon-only' | 'title-bar'
}

export default function DynamicLogo({ 
  width = 40, 
  height = 40, 
  className = '',
  showText = true,
  textSize = 'md',
  variant = 'horizontal'
}: DynamicLogoProps) {
  const assets = useThemeAssets()
  const branding = useThemeBranding()
  const colors = useThemeColors()

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  // สร้าง gradient สำหรับชื่อแบรนด์
  const brandGradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`

  if (variant === 'title-bar') {
    return (
      <div 
        className={`flex items-center gap-4 p-4 rounded-lg border ${className}`}
        style={{
          background: `linear-gradient(135deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`,
          borderColor: colors.borderLight,
          boxShadow: `0 4px 12px ${colors.shadowLight}`
        }}
      >
        <img 
          src={assets.logo} 
          alt={branding.title}
          width={width}
          height={height}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }}
        />
        {showText && (
          <div className="flex flex-col">
            <div 
              className={`font-bold ${textSizeClasses[textSize]}`}
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
            <div 
              className="text-xs"
              style={{ color: colors.textSecondary }}
            >
              {branding.subtitle}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <img 
          src={assets.logo} 
          alt={branding.title}
          width={width}
          height={height}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }}
        />
        {showText && (
          <div className="text-center">
            <div 
              className={`font-bold ${textSizeClasses[textSize]}`}
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
            <div className="text-xs text-gray-600 mt-1">
              {branding.subtitle}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Horizontal layout (default)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img 
        src={assets.logo.replace('url("', '').replace('")', '')} 
        alt={branding.title}
        width={width}
        height={height}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
        }}
      />
      {showText && (
        <div className="flex flex-col">
          <div 
            className={`font-bold ${textSizeClasses[textSize]}`}
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
          <div className="text-xs text-gray-600">
            {branding.subtitle}
          </div>
        </div>
      )}
    </div>
  )
}
