// src/components/ThemeComparison.tsx
import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { themes } from '../config/themes'

export default function ThemeComparison() {
  const { themeName, setTheme } = useTheme()

  const themeList = [
    { name: 'heng36' as const },
    { name: 'max56' as const },
    { name: 'jeed24' as const }
  ]

  return (
    <div className="card">
      <h2 className="text-title mb-4">🔄 Theme Comparison</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {themeList.map(({ name }) => {
          const theme = themes[name]
          const isActive = themeName === name
          
          return (
            <div 
              key={name}
              className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                isActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                {/* Logo Preview */}
                <div className="mb-3 flex justify-center">
                  <img 
                    src={theme.assets.logo}
                    alt={theme.branding.title}
                    className="w-16 h-16 object-contain"
                    style={{
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                  />
                </div>
                
                {/* Title with gradient */}
                <h3 
                  className="font-bold text-lg mb-2"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {theme.branding.title}
                </h3>
                
                {/* Subtitle */}
                <div className="text-sm text-gray-600 mb-3">
                  {theme.branding.subtitle}
                </div>
                
                {/* Color preview */}
                <div className="flex gap-2 justify-center mb-3">
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: theme.colors.primary }}
                    title={`Primary: ${theme.colors.primary}`}
                  ></div>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: theme.colors.secondary }}
                    title={`Secondary: ${theme.colors.secondary}`}
                  ></div>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: theme.colors.accent }}
                    title={`Accent: ${theme.colors.accent}`}
                  ></div>
                </div>
                
                {/* Switch button */}
                <button
                  className={`btn w-full ${
                    isActive ? 'btn-primary' : 'btn-gray'
                  }`}
                  onClick={() => setTheme(name)}
                >
                  {isActive ? '✓ Current Theme' : `Switch to ${theme.branding.title}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">Current Theme Info:</h4>
        <div className="text-sm text-gray-600">
          <p><strong>Theme:</strong> {themeName}</p>
          <p><strong>Display Name:</strong> {themes[themeName].branding.title}</p>
          <p><strong>Primary Color:</strong> {themes[themeName].colors.primary}</p>
          <p><strong>Domain:</strong> {themes[themeName].domain}</p>
        </div>
      </div>
    </div>
  )
}
