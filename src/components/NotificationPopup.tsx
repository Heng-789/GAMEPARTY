import React from 'react'
import { createPortal } from 'react-dom'
import { useThemeColors } from '../contexts/ThemeContext'

type Props = {
  open: boolean
  imageUrl: string
  title: string
  message: string
  onClose: () => void
}

export default function NotificationPopup({ open, imageUrl, title, message, onClose }: Props) {
  const colors = useThemeColors()
  if (!open) {
    return null
  }
  
  // ตรวจสอบว่า component ถูก mount ใน DOM หรือไม่
  React.useEffect(() => {
    return () => {
      // Cleanup
    }
  }, [])

  const popupContent = (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.6)', 
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="notification-popup" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '90%',
          position: 'relative',
          zIndex: 10000
        }}
      >
        <div className="notification-header">
          <div className="notification-title">{title}</div>
          <button 
            className="notification-close"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `${colors.danger}20`,
              border: `1px solid ${colors.danger}30`,
              color: colors.danger,
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>
        
        <div className="notification-content" style={{ padding: '20px', textAlign: 'center' }}>
          <div className="notification-message" style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.success,
            lineHeight: '1.6',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            {title}
          </div>
          <div className="notification-message" style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.textPrimary,
            lineHeight: '1.6',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            {message}
          </div>
          <div style={{
            fontSize: '14px',
            color: colors.textTertiary,
            textAlign: 'center'
          }}>
            Image URL: {imageUrl}
          </div>
        </div>
        
        <div className="notification-actions" style={{
          padding: '16px 0 0 0',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button 
            className="notification-btn"
            onClick={onClose}
            style={{
              background: `linear-gradient(135deg, ${colors.success} 0%, ${colors.successLight} 100%)`,
              color: colors.textInverse,
              border: 'none',
              borderRadius: '14px',
              padding: '14px 32px',
              fontWeight: '800',
              fontSize: '16px',
              cursor: 'pointer',
              minWidth: '120px'
            }}
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  )
  
  // ตรวจสอบว่า Portal ทำงานหรือไม่
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        const popup = document.querySelector('.notification-popup')
        const overlay = document.querySelector('.modal-overlay')
        // Portal DOM check
      }, 50)
    }
  }, [open])

  return createPortal(popupContent, document.body)
}
