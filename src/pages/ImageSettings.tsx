// src/pages/ImageSettings.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadImageToStorage } from '../services/image-upload'
import { useTheme, useThemeAssets } from '../contexts/ThemeContext'
import { getCurrentTheme } from '../config/themes'
import { getThemeSettings, saveThemeSettings, deleteThemeSetting } from '../services/postgresql-api'

const BACKGROUND_STORAGE_KEY = 'theme_background_image'
const LOGO_STORAGE_KEY = 'theme_logo'
const LOGO_CONTAINER_STORAGE_KEY = 'theme_logo_container'
const FAVICON_STORAGE_KEY = 'theme_favicon'

export default function ImageSettings() {
  const nav = useNavigate()
  const { themeName } = useTheme()
  const assets = useThemeAssets()
  const theme = getCurrentTheme()
  
  // State สำหรับพื้นหลัง
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('')
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [backgroundUploading, setBackgroundUploading] = useState(false)
  const [backgroundPreview, setBackgroundPreview] = useState<string>('')

  // State สำหรับ Logo
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string>('')

  // State สำหรับ Favicon
  const [faviconUrl, setFaviconUrl] = useState<string>('')
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconPreview, setFaviconPreview] = useState<string>('')

  // โหลดรูปภาพจาก backend เมื่อ component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getThemeSettings(themeName)
        const settings = response.settings || {}

        // โหลดพื้นหลัง
        const savedBackground = settings.backgroundImage || localStorage.getItem(`${BACKGROUND_STORAGE_KEY}_${themeName}`)
        if (savedBackground) {
          setBackgroundImageUrl(savedBackground)
          setBackgroundPreview(savedBackground)
          // Sync กับ localStorage สำหรับ backward compatibility
          localStorage.setItem(`${BACKGROUND_STORAGE_KEY}_${themeName}`, savedBackground)
        } else {
          const defaultBg = theme.assets.backgroundImage.replace('url("', '').replace('")', '')
          setBackgroundImageUrl(defaultBg)
          setBackgroundPreview(defaultBg)
        }

        // โหลด Logo
        const savedLogo = settings.logo || localStorage.getItem(`${LOGO_STORAGE_KEY}_${themeName}`)
        if (savedLogo) {
          setLogoUrl(savedLogo)
          setLogoPreview(savedLogo)
          localStorage.setItem(`${LOGO_STORAGE_KEY}_${themeName}`, savedLogo)
          localStorage.setItem(`${LOGO_CONTAINER_STORAGE_KEY}_${themeName}`, savedLogo)
        } else {
          const defaultLogo = theme.assets.logo.replace('url("', '').replace('")', '')
          setLogoUrl(defaultLogo)
          setLogoPreview(defaultLogo)
        }

        // โหลด Favicon
        const savedFavicon = settings.favicon || localStorage.getItem(`${FAVICON_STORAGE_KEY}_${themeName}`)
        if (savedFavicon) {
          setFaviconUrl(savedFavicon)
          setFaviconPreview(savedFavicon)
          localStorage.setItem(`${FAVICON_STORAGE_KEY}_${themeName}`, savedFavicon)
        } else {
          const defaultFavicon = theme.assets.favicon.replace('url("', '').replace('")', '')
          setFaviconUrl(defaultFavicon)
          setFaviconPreview(defaultFavicon)
        }
      } catch (error) {
        console.error('Error loading theme settings:', error)
        // Fallback to localStorage if backend fails
        const savedBackground = localStorage.getItem(`${BACKGROUND_STORAGE_KEY}_${themeName}`)
        if (savedBackground) {
          setBackgroundImageUrl(savedBackground)
          setBackgroundPreview(savedBackground)
        } else {
          const defaultBg = theme.assets.backgroundImage.replace('url("', '').replace('")', '')
          setBackgroundImageUrl(defaultBg)
          setBackgroundPreview(defaultBg)
        }

        const savedLogo = localStorage.getItem(`${LOGO_STORAGE_KEY}_${themeName}`)
        if (savedLogo) {
          setLogoUrl(savedLogo)
          setLogoPreview(savedLogo)
        } else {
          const defaultLogo = theme.assets.logo.replace('url("', '').replace('")', '')
          setLogoUrl(defaultLogo)
          setLogoPreview(defaultLogo)
        }

        const savedFavicon = localStorage.getItem(`${FAVICON_STORAGE_KEY}_${themeName}`)
        if (savedFavicon) {
          setFaviconUrl(savedFavicon)
          setFaviconPreview(savedFavicon)
        } else {
          const defaultFavicon = theme.assets.favicon.replace('url("', '').replace('")', '')
          setFaviconUrl(defaultFavicon)
          setFaviconPreview(defaultFavicon)
        }
      }
    }

    loadSettings()
  }, [themeName, theme])

  // เมื่อเลือกไฟล์พื้นหลัง
  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ตรวจสอบว่าเป็นไฟล์รูปภาพ
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    setBackgroundFile(file)

    // สร้าง preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setBackgroundPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // อัปโหลดพื้นหลัง
  const handleUploadBackground = async () => {
    if (!backgroundFile) {
      alert('กรุณาเลือกไฟล์รูปภาพก่อน')
      return
    }

    setBackgroundUploading(true)
    try {
      // อัปโหลดไปยัง CDN (ใช้ folder 'backgrounds')
      const cdnUrl = await uploadImageToStorage(backgroundFile, 'backgrounds')
      
      // บันทึก URL ลง backend
      await saveThemeSettings(themeName, {
        backgroundImage: cdnUrl
      })
      
      // บันทึก URL ลง localStorage สำหรับ backward compatibility
      localStorage.setItem(`${BACKGROUND_STORAGE_KEY}_${themeName}`, cdnUrl)
      
      setBackgroundImageUrl(cdnUrl)
      setBackgroundPreview(cdnUrl)
      setBackgroundFile(null)
      
      // อัปเดต CSS variable ทันที
      const root = document.documentElement
      root.style.setProperty('--theme-asset-background-image', `url("${cdnUrl}")`)
      
      alert('อัปโหลดพื้นหลังสำเร็จ')
    } catch (error) {
      console.error('Error uploading background:', error)
      alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setBackgroundUploading(false)
    }
  }

  // ลบพื้นหลัง (กลับไปใช้ default)
  const handleRemoveBackground = async () => {
    if (!confirm('ต้องการลบพื้นหลังที่กำหนดเองและกลับไปใช้พื้นหลังเริ่มต้นหรือไม่?')) {
      return
    }

    try {
      // ลบจาก backend
      await deleteThemeSetting(themeName, 'backgroundImage')
      
      // ลบจาก localStorage
      localStorage.removeItem(`${BACKGROUND_STORAGE_KEY}_${themeName}`)
      
      // ใช้ default จาก theme config
      const defaultBg = theme.assets.backgroundImage.replace('url("', '').replace('")', '')
      setBackgroundImageUrl(defaultBg)
      setBackgroundPreview(defaultBg)
      setBackgroundFile(null)

      // อัปเดต CSS variable
      const root = document.documentElement
      root.style.setProperty('--theme-asset-background-image', theme.assets.backgroundImage)
      
      alert('ลบพื้นหลังที่กำหนดเองเรียบร้อย')
    } catch (error) {
      console.error('Error removing background:', error)
      alert(`เกิดข้อผิดพลาดในการลบ: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // เมื่อเลือกไฟล์ Logo
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    setLogoFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setLogoPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // อัปโหลด Logo
  const handleUploadLogo = async () => {
    if (!logoFile) {
      alert('กรุณาเลือกไฟล์รูปภาพก่อน')
      return
    }

    setLogoUploading(true)
    try {
      const cdnUrl = await uploadImageToStorage(logoFile, 'logos')
      
      // บันทึก URL ลง backend
      await saveThemeSettings(themeName, {
        logo: cdnUrl,
        logoContainer: cdnUrl
      })
      
      // บันทึก URL ลง localStorage สำหรับ backward compatibility
      localStorage.setItem(`${LOGO_STORAGE_KEY}_${themeName}`, cdnUrl)
      localStorage.setItem(`${LOGO_CONTAINER_STORAGE_KEY}_${themeName}`, cdnUrl) // ใช้ URL เดียวกัน
      
      setLogoUrl(cdnUrl)
      setLogoPreview(cdnUrl)
      setLogoFile(null)
      
      // อัปเดต CSS variable
      const root = document.documentElement
      root.style.setProperty('--theme-asset-logo', `url("${cdnUrl}")`)
      root.style.setProperty('--theme-asset-logo-container', `url("${cdnUrl}")`)
      
      alert('อัปโหลด Logo สำเร็จ')
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLogoUploading(false)
    }
  }

  // ลบ Logo (กลับไปใช้ default)
  const handleRemoveLogo = async () => {
    if (!confirm('ต้องการลบ Logo ที่กำหนดเองและกลับไปใช้ Logo เริ่มต้นหรือไม่?')) {
      return
    }

    try {
      // ลบจาก backend
      await deleteThemeSetting(themeName, 'logo')
      await deleteThemeSetting(themeName, 'logoContainer')
      
      // ลบจาก localStorage
      localStorage.removeItem(`${LOGO_STORAGE_KEY}_${themeName}`)
      localStorage.removeItem(`${LOGO_CONTAINER_STORAGE_KEY}_${themeName}`)
      
      const defaultLogo = theme.assets.logo.replace('url("', '').replace('")', '')
      setLogoUrl(defaultLogo)
      setLogoPreview(defaultLogo)
      setLogoFile(null)

      const root = document.documentElement
      root.style.setProperty('--theme-asset-logo', theme.assets.logo)
      root.style.setProperty('--theme-asset-logo-container', theme.assets.logoContainer)
      
      alert('ลบ Logo ที่กำหนดเองเรียบร้อย')
    } catch (error) {
      console.error('Error removing logo:', error)
      alert(`เกิดข้อผิดพลาดในการลบ: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // เมื่อเลือกไฟล์ Favicon
  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    setFaviconFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setFaviconPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // อัปโหลด Favicon
  const handleUploadFavicon = async () => {
    if (!faviconFile) {
      alert('กรุณาเลือกไฟล์รูปภาพก่อน')
      return
    }

    setFaviconUploading(true)
    try {
      const cdnUrl = await uploadImageToStorage(faviconFile, 'favicons')
      
      // บันทึก URL ลง backend
      await saveThemeSettings(themeName, {
        favicon: cdnUrl
      })
      
      // บันทึก URL ลง localStorage สำหรับ backward compatibility
      localStorage.setItem(`${FAVICON_STORAGE_KEY}_${themeName}`, cdnUrl)
      
      setFaviconUrl(cdnUrl)
      setFaviconPreview(cdnUrl)
      setFaviconFile(null)
      
      // อัปเดต CSS variable และ favicon
      const root = document.documentElement
      root.style.setProperty('--theme-asset-favicon', `url("${cdnUrl}")`)
      
      // อัปเดต favicon ใน head
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (link) {
        link.href = cdnUrl
      } else {
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.href = cdnUrl
        document.head.appendChild(newLink)
      }
      
      alert('อัปโหลด Favicon สำเร็จ')
    } catch (error) {
      console.error('Error uploading favicon:', error)
      alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setFaviconUploading(false)
    }
  }

  // ลบ Favicon (กลับไปใช้ default)
  const handleRemoveFavicon = async () => {
    if (!confirm('ต้องการลบ Favicon ที่กำหนดเองและกลับไปใช้ Favicon เริ่มต้นหรือไม่?')) {
      return
    }

    try {
      // ลบจาก backend
      await deleteThemeSetting(themeName, 'favicon')
      
      // ลบจาก localStorage
      localStorage.removeItem(`${FAVICON_STORAGE_KEY}_${themeName}`)
      
      const defaultFavicon = theme.assets.favicon.replace('url("', '').replace('")', '')
      setFaviconUrl(defaultFavicon)
      setFaviconPreview(defaultFavicon)
      setFaviconFile(null)

      const root = document.documentElement
      root.style.setProperty('--theme-asset-favicon', theme.assets.favicon)
      
      // อัปเดต favicon ใน head
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (link) {
        link.href = defaultFavicon
      }
      
      alert('ลบ Favicon ที่กำหนดเองเรียบร้อย')
    } catch (error) {
      console.error('Error removing favicon:', error)
      alert(`เกิดข้อผิดพลาดในการลบ: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '24px',
      background: 'var(--theme-asset-background-image) center/cover no-repeat fixed'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: '2px solid var(--theme-border-light, #E5E7EB)'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--theme-text-primary, #111827)',
              margin: '0 0 8px 0'
            }}>
              ตั้งค่ารูปภาพ
            </h1>
            <p style={{
              fontSize: '16px',
              color: 'var(--theme-text-secondary, #4B5563)',
              margin: 0
            }}>
              จัดการรูปภาพของระบบ (พื้นหลัง, Logo, Favicon)
            </p>
          </div>
          <button
            onClick={() => nav('/home')}
            style={{
              padding: '10px 20px',
              background: 'var(--theme-bg-secondary, #F9FAFB)',
              border: '1px solid var(--theme-border-light, #E5E7EB)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #111827)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--theme-bg-tertiary, #F3F4F6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--theme-bg-secondary, #F9FAFB)'
            }}
          >
            ← กลับหน้าแรก
          </button>
        </div>

        {/* อัปโหลดพื้นหลัง */}
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--theme-bg-secondary, #F9FAFB)',
          borderRadius: '12px',
          border: '1px solid var(--theme-border-light, #E5E7EB)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--theme-text-primary, #111827)',
            margin: '0 0 16px 0'
          }}>
            อัปโหลดพื้นหลัง
          </h2>
          
          {/* Preview */}
          {backgroundPreview && (
            <div style={{
              marginBottom: '20px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid var(--theme-border-light, #E5E7EB)',
              background: 'white'
            }}>
              <img
                src={backgroundPreview}
                alt="Background Preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '300px',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            </div>
          )}

          {/* File Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--theme-text-primary, #111827)'
            }}>
              เลือกไฟล์รูปภาพ
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundFileChange}
              disabled={backgroundUploading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid var(--theme-border-light, #E5E7EB)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: backgroundUploading ? 'not-allowed' : 'pointer'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: 'var(--theme-text-secondary, #4B5563)',
              margin: '8px 0 0 0'
            }}>
              รองรับไฟล์รูปภาพ: JPG, PNG, GIF, WebP
            </p>
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleUploadBackground}
              disabled={!backgroundFile || backgroundUploading}
              style={{
                padding: '12px 24px',
                background: backgroundFile && !backgroundUploading
                  ? 'var(--theme-gradient-primary, linear-gradient(135deg, #10B981 0%, #34D399 100%))'
                  : 'var(--theme-gray-300, #D1D5DB)',
                border: 'none',
                borderRadius: '8px',
                cursor: backgroundFile && !backgroundUploading ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (backgroundFile && !backgroundUploading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (backgroundFile && !backgroundUploading) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              {backgroundUploading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  กำลังอัปโหลด...
                </>
              ) : (
                'อัปโหลดพื้นหลัง'
              )}
            </button>

            {backgroundImageUrl && backgroundImageUrl !== theme.assets.backgroundImage.replace('url("', '').replace('")', '') && (
              <button
                onClick={handleRemoveBackground}
                disabled={backgroundUploading}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  border: '1px solid var(--theme-border-medium, #D1D5DB)',
                  borderRadius: '8px',
                  cursor: backgroundUploading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--theme-text-primary, #111827)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!backgroundUploading) {
                    e.currentTarget.style.background = 'var(--theme-bg-secondary, #F9FAFB)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!backgroundUploading) {
                    e.currentTarget.style.background = 'white'
                  }
                }}
              >
                ลบพื้นหลังที่กำหนดเอง
              </button>
            )}
          </div>

          {/* Current URL Info */}
          {backgroundImageUrl && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid var(--theme-border-light, #E5E7EB)'
            }}>
              <p style={{
                fontSize: '12px',
                color: 'var(--theme-text-secondary, #4B5563)',
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                URL ปัจจุบัน:
              </p>
              <p style={{
                fontSize: '11px',
                color: 'var(--theme-text-tertiary, #6B7280)',
                margin: 0,
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {backgroundImageUrl}
              </p>
            </div>
          )}
        </div>

        {/* อัปโหลด Logo */}
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--theme-bg-secondary, #F9FAFB)',
          borderRadius: '12px',
          border: '1px solid var(--theme-border-light, #E5E7EB)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--theme-text-primary, #111827)',
            margin: '0 0 16px 0'
          }}>
            อัปโหลด Logo
          </h2>
          
          {/* Preview */}
          {logoPreview && (
            <div style={{
              marginBottom: '20px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid var(--theme-border-light, #E5E7EB)',
              background: 'white',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}>
              <img
                src={logoPreview}
                alt="Logo Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          )}

          {/* File Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--theme-text-primary, #111827)'
            }}>
              เลือกไฟล์รูปภาพ
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              disabled={logoUploading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid var(--theme-border-light, #E5E7EB)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: logoUploading ? 'not-allowed' : 'pointer'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: 'var(--theme-text-secondary, #4B5563)',
              margin: '8px 0 0 0'
            }}>
              รองรับไฟล์รูปภาพ: JPG, PNG, GIF, WebP, SVG
            </p>
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleUploadLogo}
              disabled={!logoFile || logoUploading}
              style={{
                padding: '12px 24px',
                background: logoFile && !logoUploading
                  ? 'var(--theme-gradient-primary, linear-gradient(135deg, #10B981 0%, #34D399 100%))'
                  : 'var(--theme-gray-300, #D1D5DB)',
                border: 'none',
                borderRadius: '8px',
                cursor: logoFile && !logoUploading ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (logoFile && !logoUploading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (logoFile && !logoUploading) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              {logoUploading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  กำลังอัปโหลด...
                </>
              ) : (
                'อัปโหลด Logo'
              )}
            </button>

            {logoUrl && logoUrl !== theme.assets.logo.replace('url("', '').replace('")', '') && (
              <button
                onClick={handleRemoveLogo}
                disabled={logoUploading}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  border: '1px solid var(--theme-border-medium, #D1D5DB)',
                  borderRadius: '8px',
                  cursor: logoUploading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--theme-text-primary, #111827)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!logoUploading) {
                    e.currentTarget.style.background = 'var(--theme-bg-secondary, #F9FAFB)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!logoUploading) {
                    e.currentTarget.style.background = 'white'
                  }
                }}
              >
                ลบ Logo ที่กำหนดเอง
              </button>
            )}
          </div>

          {/* Current URL Info */}
          {logoUrl && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid var(--theme-border-light, #E5E7EB)'
            }}>
              <p style={{
                fontSize: '12px',
                color: 'var(--theme-text-secondary, #4B5563)',
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                URL ปัจจุบัน:
              </p>
              <p style={{
                fontSize: '11px',
                color: 'var(--theme-text-tertiary, #6B7280)',
                margin: 0,
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {logoUrl}
              </p>
            </div>
          )}
        </div>

        {/* อัปโหลด Favicon */}
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--theme-bg-secondary, #F9FAFB)',
          borderRadius: '12px',
          border: '1px solid var(--theme-border-light, #E5E7EB)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--theme-text-primary, #111827)',
            margin: '0 0 16px 0'
          }}>
            อัปโหลด Favicon
          </h2>
          
          {/* Preview */}
          {faviconPreview && (
            <div style={{
              marginBottom: '20px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid var(--theme-border-light, #E5E7EB)',
              background: 'white',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}>
              <img
                src={faviconPreview}
                alt="Favicon Preview"
                style={{
                  width: '64px',
                  height: '64px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          )}

          {/* File Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--theme-text-primary, #111827)'
            }}>
              เลือกไฟล์รูปภาพ
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFaviconFileChange}
              disabled={faviconUploading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid var(--theme-border-light, #E5E7EB)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: faviconUploading ? 'not-allowed' : 'pointer'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: 'var(--theme-text-secondary, #4B5563)',
              margin: '8px 0 0 0'
            }}>
              รองรับไฟล์รูปภาพ: ICO, PNG, JPG (แนะนำขนาด 32x32 หรือ 64x64 pixels)
            </p>
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleUploadFavicon}
              disabled={!faviconFile || faviconUploading}
              style={{
                padding: '12px 24px',
                background: faviconFile && !faviconUploading
                  ? 'var(--theme-gradient-primary, linear-gradient(135deg, #10B981 0%, #34D399 100%))'
                  : 'var(--theme-gray-300, #D1D5DB)',
                border: 'none',
                borderRadius: '8px',
                cursor: faviconFile && !faviconUploading ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (faviconFile && !faviconUploading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (faviconFile && !faviconUploading) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              {faviconUploading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  กำลังอัปโหลด...
                </>
              ) : (
                'อัปโหลด Favicon'
              )}
            </button>

            {faviconUrl && faviconUrl !== theme.assets.favicon.replace('url("', '').replace('")', '') && (
              <button
                onClick={handleRemoveFavicon}
                disabled={faviconUploading}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  border: '1px solid var(--theme-border-medium, #D1D5DB)',
                  borderRadius: '8px',
                  cursor: faviconUploading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--theme-text-primary, #111827)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!faviconUploading) {
                    e.currentTarget.style.background = 'var(--theme-bg-secondary, #F9FAFB)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!faviconUploading) {
                    e.currentTarget.style.background = 'white'
                  }
                }}
              >
                ลบ Favicon ที่กำหนดเอง
              </button>
            )}
          </div>

          {/* Current URL Info */}
          {faviconUrl && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid var(--theme-border-light, #E5E7EB)'
            }}>
              <p style={{
                fontSize: '12px',
                color: 'var(--theme-text-secondary, #4B5563)',
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                URL ปัจจุบัน:
              </p>
              <p style={{
                fontSize: '11px',
                color: 'var(--theme-text-tertiary, #6B7280)',
                margin: 0,
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {faviconUrl}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

