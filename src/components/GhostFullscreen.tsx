import React, { useEffect } from 'react'
import '../styles/ghost-fullscreen.css'

type Props = {
  isVisible: boolean
  onClose: () => void
  duration?: number // เวลาแสดงเป็นมิลลิวินาที (default: 3000ms)
  ghostImage?: string // รูปผีที่ต้องการแสดง (default: '/image/haha.png')
}

export default function GhostFullscreen({ 
  isVisible, 
  onClose, 
  duration = 3000,
  ghostImage = '/image/ghost.png' // ใช้รูปผีจริง
}: Props) {
  
  useEffect(() => {
    if (!isVisible) return

    // เล่นเสียงผี (ถ้ามี)
    const playGhostSound = () => {
      try {
        const audio = new Audio('/image/ghostsound.mp3')
        audio.play().catch(() => {
          // ถ้าไม่มีไฟล์เสียง ให้เล่นเสียงระบบแทน
          console.log('ไม่มีไฟล์เสียงผี')
        })
      } catch (error) {
        console.log('ไม่สามารถเล่นเสียงได้:', error)
      }
    }

    // เล่นเสียงทันทีเมื่อแสดงผี
    playGhostSound()

    // ซ่อนผีหลังเวลาที่กำหนด
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => {
      clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  return (
    <div className="ghost-fullscreen-overlay">
      <div className="ghost-fullscreen-container">
        <img 
          src={ghostImage} 
          alt="👻 ผี" 
          className="ghost-fullscreen-image"
        />
      </div>
    </div>
  )
}
