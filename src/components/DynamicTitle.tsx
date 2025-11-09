// src/components/DynamicTitle.tsx
import React from 'react'
import { useThemeBranding, useThemeColors } from '../contexts/ThemeContext'

interface DynamicTitleProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
  showSubtitle?: boolean
  centered?: boolean
  variant?: 'gradient' | 'solid' | 'outline'
}

export default function DynamicTitle({ 
  level = 1, 
  className = '',
  showSubtitle = false,
  centered = false,
  variant = 'gradient'
}: DynamicTitleProps) {
  const branding = useThemeBranding()
  const colors = useThemeColors()

  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements

  // สร้าง gradient สำหรับชื่อแบรนด์
  const brandGradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`

  const getTitleStyle = () => {
    switch (variant) {
      case 'gradient':
        return {
          background: brandGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }
      case 'solid':
        return {
          color: colors.primary,
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }
      case 'outline':
        return {
          color: 'transparent',
          WebkitTextStroke: `2px ${colors.primary}`,
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }
      default:
        return {}
    }
  }

  const baseClasses = 'text-title font-bold'
  const centerClasses = centered ? 'text-center' : ''
  const combinedClasses = `${baseClasses} ${centerClasses} ${className}`

  return (
    <div className={centered ? 'text-center' : ''}>
      <HeadingTag 
        className={combinedClasses}
        style={getTitleStyle()}
      >
        {branding.title}
      </HeadingTag>
      {showSubtitle && (
        <p 
          className="text-subtitle mt-2"
          style={{ color: colors.textSecondary }}
        >
          {branding.subtitle}
        </p>
      )}
    </div>
  )
}
