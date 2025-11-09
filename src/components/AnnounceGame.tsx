// src/components/AnnounceGame.tsx
import React from 'react'
import { useTheme, useThemeColors } from '../contexts/ThemeContext'

type AnnounceGameProps = {
  gameId: string
  game: {
    announce?: {
      users?: string[]
      userBonuses?: Array<{ user: string; bonus: number }>
      imageDataUrl?: string
      fileName?: string
    }
  }
  username: string
  bonusData: { user: string; bonus: number } | null
  onGoToWebsite?: () => void
}

export default function AnnounceGame({ game, bonusData, onGoToWebsite }: AnnounceGameProps) {
  const colors = useThemeColors()
  const { themeName } = useTheme()
  // ✅ แสดงชื่อธีมตาม branding
  const getThemeDisplayName = () => {
    switch (themeName) {
      case 'max56':
        return 'MAX56'
      case 'jeed24':
        return 'JEED24'
      case 'heng36':
      default:
        return 'HENG36'
    }
  }
  const goButtonLabel = `ไปที่ ${getThemeDisplayName()}`

  if (!bonusData) return null

  return (
    <div style={{
      marginTop:'20px',
      padding:'24px',
      background:`linear-gradient(135deg, ${colors.successLight}15 0%, ${colors.success}10 100%)`,
      border:`2px solid ${colors.success}40`,
      borderRadius:'16px',
      boxShadow:`0 4px 16px ${colors.success}20`
    }}>
      {/* หัวข้อหลัก */}
      <div style={{
        textAlign:'center',
        marginBottom:'20px'
      }}>
        <div style={{
          fontSize:'28px',
          fontWeight:'800',
          color:colors.success,
          marginBottom:'8px',
          textShadow:`0 2px 4px ${colors.success}20`
        }}>
          🎉 ยินดีด้วย! {bonusData.user} ได้รับรางวัลโบนัสประจำเดือน {bonusData.bonus.toLocaleString()} 🎉
        </div>
      </div>

      {/* แสดงรูปภาพถ้ามี */}
      {game.announce?.imageDataUrl && (
        <div style={{
          marginBottom:'20px',
          borderRadius:'12px',
          overflow:'hidden',
          border:`2px solid ${colors.success}30`,
          boxShadow:`0 4px 12px ${colors.success}20`
        }}>
          <img 
            src={game.announce.imageDataUrl} 
            alt="Announcement"
            style={{
              width:'100%',
              maxHeight:'500px',
              objectFit:'contain',
              display:'block',
              background:colors.bgSecondary
            }}
          />
        </div>
      )}

      {/* วิธีการเช็คโบนัส */}
      <div style={{
        padding:'20px',
        background:colors.bgPrimary,
        borderRadius:'12px',
        marginBottom:'16px',
        border:`1px solid ${colors.borderLight}`
      }}>
        <div style={{
          fontSize:'18px',
          fontWeight:'700',
          color:colors.textPrimary,
          marginBottom:'16px',
          textAlign:'center'
        }}>
          วิธีการเช็คโบนัส
        </div>
        <ol style={{
          margin:0,
          paddingLeft:'20px',
          color:colors.textSecondary,
          fontSize:'15px',
          lineHeight:'1.8'
        }}>
          <li style={{marginBottom:'8px'}}>ล็อกอินเข้าหน้าระบบ</li>
          <li style={{marginBottom:'8px'}}>ไปที่เมนู "บัญชีของฉัน"</li>
          <li style={{marginBottom:'8px'}}>เช็คที่หัวข้อ "โบนัส"</li>
        </ol>
        <div style={{
          marginTop:'16px',
          padding:'12px',
          background:`${colors.successLight}10`,
          borderRadius:'8px',
          color:colors.textSecondary,
          fontSize:'14px',
          lineHeight:'1.6'
        }}>
          หากมีโบนัสอยู่ สามารถกดรับได้เลยค่ะ
        </div>
        <div style={{
          marginTop:'12px',
          padding:'12px',
          background:`${colors.warning}10`,
          borderRadius:'8px',
          color:colors.textSecondary,
          fontSize:'13px',
          lineHeight:'1.6',
          fontStyle:'italic'
        }}>
          💡 แนะนำให้เล่นเครดิตที่มีอยู่ในกระเป๋าหลักให้เรียบร้อยก่อนที่จะโยกเงินเข้า เพื่อป้องกันการติดเทิร์นจากโปรโมชั่นต่างๆค่ะ
        </div>
      </div>

      {/* ข้อความโปรโมชั่น */}
      <div style={{
        padding:'16px 20px',
        background:`linear-gradient(135deg, ${colors.successLight}20 0%, ${colors.successLight}40 100%)`,
        borderRadius:'12px',
        border:`2px solid ${colors.success}`,
        textAlign:'center',
        boxShadow:`0 4px 12px ${colors.success}30`
      }}>
        <div style={{
          fontSize:'16px',
          fontWeight:'700',
          color:colors.success,
          lineHeight:'1.6'
        }}>
          🎉 ชวนเพื่อนมาเล่น เพื่อนฝากบิลเพียง 50 บาท รับโบนัส เพิ่มอีก 1 เท่าจากเดิม!!! 🎉
        </div>
      </div>

      {/* ปุ่มไปที่เว็บ */}
      {onGoToWebsite && (
        <div style={{
          marginTop:'20px',
          textAlign:'center'
        }}>
          <button
            onClick={onGoToWebsite}
            style={{
              padding:'14px 32px',
              fontSize:'16px',
              fontWeight:'700',
              color:colors.textInverse,
              background:`linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
              border:'none',
              borderRadius:'12px',
              cursor:'pointer',
              boxShadow:`0 4px 12px ${colors.primary}30`,
              transition:'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = `0 6px 16px ${colors.primary}40`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.primary}30`
            }}
          >
            {goButtonLabel}
          </button>
        </div>
      )}
    </div>
  )
}

