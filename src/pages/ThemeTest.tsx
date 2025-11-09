// src/pages/ThemeTest.tsx
import React from 'react'
import { useTheme, useThemeColors, useThemeGradients, useThemeBranding } from '../contexts/ThemeContext'
import DynamicLogo from '../components/DynamicLogo'
import DynamicTitle from '../components/DynamicTitle'
import ThemeInfo from '../components/ThemeInfo'
import ThemeComparison from '../components/ThemeComparison'

export default function ThemeTest() {
  const { theme, themeName, setTheme } = useTheme()
  const colors = useThemeColors()
  const gradients = useThemeGradients()
  const branding = useThemeBranding()

  const handleThemeChange = (newTheme: 'heng36' | 'max56') => {
    setTheme(newTheme)
  }

  return (
    <div className="container mx-auto p-6">
      <ThemeInfo showDebug={true} />
      
      {/* Header */}
      <div className="card mb-6">
        <DynamicLogo width={80} height={80} textSize="xl" variant="horizontal" />
        <DynamicTitle level={1} showSubtitle={true} centered={true} className="mt-4" variant="gradient" />
      </div>

      {/* Logo Variations */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">🏷️ Logo Variations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <h3 className="font-semibold mb-3">Horizontal</h3>
            <DynamicLogo width={60} height={60} textSize="lg" variant="horizontal" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold mb-3">Vertical</h3>
            <DynamicLogo width={60} height={60} textSize="lg" variant="vertical" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold mb-3">Icon Only</h3>
            <DynamicLogo width={60} height={60} variant="icon-only" />
            <div className="mt-2 text-sm text-gray-600">{branding.title}</div>
          </div>
          <div className="text-center">
            <h3 className="font-semibold mb-3">Title Bar</h3>
            <DynamicLogo width={50} height={50} textSize="sm" variant="title-bar" />
          </div>
        </div>
      </div>

      {/* Title Variations */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">📝 Title Variations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <h3 className="font-semibold mb-3">Gradient</h3>
            <DynamicTitle level={2} variant="gradient" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold mb-3">Solid</h3>
            <DynamicTitle level={2} variant="solid" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold mb-3">Outline</h3>
            <DynamicTitle level={2} variant="outline" />
          </div>
        </div>
      </div>

      {/* Theme Comparison */}
      <ThemeComparison />

      {/* Theme Switcher */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">🎨 Theme Switcher</h2>
        <div className="flex gap-4">
          <button 
            className={`btn ${themeName === 'heng36' ? 'btn-primary' : 'btn-gray'}`}
            onClick={() => handleThemeChange('heng36')}
          >
            HENG36 Theme
          </button>
          <button 
            className={`btn ${themeName === 'max56' ? 'btn-primary' : 'btn-gray'}`}
            onClick={() => handleThemeChange('max56')}
          >
            MAX56 Theme
          </button>
        </div>
      </div>

      {/* Color Palette */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">🌈 Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2"
              style={{ backgroundColor: colors.primary }}
            ></div>
            <div className="text-sm font-semibold">Primary</div>
            <div className="text-xs text-muted">{colors.primary}</div>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2"
              style={{ backgroundColor: colors.secondary }}
            ></div>
            <div className="text-sm font-semibold">Secondary</div>
            <div className="text-xs text-muted">{colors.secondary}</div>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2"
              style={{ backgroundColor: colors.accent }}
            ></div>
            <div className="text-sm font-semibold">Accent</div>
            <div className="text-xs text-muted">{colors.accent}</div>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2"
              style={{ backgroundColor: colors.success }}
            ></div>
            <div className="text-sm font-semibold">Success</div>
            <div className="text-xs text-muted">{colors.success}</div>
          </div>
        </div>
      </div>

      {/* Gradients */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">🎭 Gradients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <div 
              className="w-full h-20 rounded-lg mb-2"
              style={{ background: gradients.primary }}
            ></div>
            <div className="text-sm font-semibold">Primary Gradient</div>
          </div>
          <div className="text-center">
            <div 
              className="w-full h-20 rounded-lg mb-2"
              style={{ background: gradients.secondary }}
            ></div>
            <div className="text-sm font-semibold">Secondary Gradient</div>
          </div>
          <div className="text-center">
            <div 
              className="w-full h-20 rounded-lg mb-2"
              style={{ background: gradients.accent }}
            ></div>
            <div className="text-sm font-semibold">Accent Gradient</div>
          </div>
          <div className="text-center">
            <div 
              className="w-full h-20 rounded-lg mb-2"
              style={{ background: gradients.pageBg }}
            ></div>
            <div className="text-sm font-semibold">Page Background</div>
          </div>
        </div>
      </div>

      {/* Button Examples */}
      <div className="card mb-6">
        <h2 className="text-title mb-4">🔘 Button Examples</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-accent">Accent</button>
          <button className="btn btn-success">Success</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-warning">Warning</button>
          <button className="btn btn-gray">Gray</button>
        </div>
      </div>

      {/* Theme Info */}
      <div className="card">
        <h2 className="text-title mb-4">ℹ️ Theme Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Branding</h3>
            <ul className="text-sm space-y-1">
              <li><strong>Title:</strong> {branding.title}</li>
              <li><strong>Subtitle:</strong> {branding.subtitle}</li>
              <li><strong>Description:</strong> {branding.description}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Technical</h3>
            <ul className="text-sm space-y-1">
              <li><strong>Theme Name:</strong> {themeName}</li>
              <li><strong>Domain:</strong> {window.location.hostname}</li>
              <li><strong>Current Time:</strong> {new Date().toLocaleString()}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
