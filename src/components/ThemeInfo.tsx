// src/components/ThemeInfo.tsx
import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface ThemeInfoProps {
  showDebug?: boolean
}

export default function ThemeInfo({ showDebug = false }: ThemeInfoProps) {
  const { theme, themeName } = useTheme()

  if (!showDebug) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div><strong>Theme:</strong> {themeName}</div>
      <div><strong>Domain:</strong> {window.location.hostname}</div>
      <div><strong>Title:</strong> {theme.branding.title}</div>
      <div><strong>Primary:</strong> {theme.colors.primary}</div>
    </div>
  )
}
