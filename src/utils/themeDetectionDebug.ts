// Debug script สำหรับตรวจสอบ Theme Detection
console.log('🎨 Theme Detection Debug:')
console.log('Vite Mode:', import.meta.env.MODE)
console.log('Vite Theme:', import.meta.env.VITE_THEME)
console.log('Hostname:', window.location.hostname)
console.log('Port:', window.location.port)
console.log('URL:', window.location.href)

// ตรวจสอบ Theme Context
try {
  const { useTheme } = await import('../contexts/ThemeContext')
  console.log('Theme Context loaded successfully')
} catch (error) {
  console.log('Theme Context Error:', error)
}

// ตรวจสอบ CSS Variables
const root = document.documentElement
const computedStyle = getComputedStyle(root)
console.log('CSS Variables:')
console.log('--theme-asset-logo:', computedStyle.getPropertyValue('--theme-asset-logo'))
console.log('--theme-asset-backgroundImage:', computedStyle.getPropertyValue('--theme-asset-backgroundImage'))
console.log('--theme-branding-title:', computedStyle.getPropertyValue('--theme-branding-title'))
console.log('--theme-branding-subtitle:', computedStyle.getPropertyValue('--theme-branding-subtitle'))

// ตรวจสอบ Background Image
const body = document.body
const bodyStyle = getComputedStyle(body)
console.log('Body Background:', bodyStyle.backgroundImage)
console.log('Body Background Size:', bodyStyle.backgroundSize)
console.log('Body Background Position:', bodyStyle.backgroundPosition)
