import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamesList } from '../hooks/useOptimizedData'
import { dataCache, cacheKeys } from '../services/cache'
import { usePrefetch } from '../services/prefetching'
import { useTheme, useThemeBranding, useThemeAssets } from '../contexts/ThemeContext'
import { getPlayerLink } from '../utils/playerLinks'
import { deleteGame } from '../services/postgresql-adapter'

type GameRow = { id: string; name: string; type: string; createdAt?: number }

export default function Home() {
  const nav = useNavigate()
  const { themeName } = useTheme()
  const branding = useThemeBranding()
  const assets = useThemeAssets()
  
  // กำลังลบรายการไหนอยู่ (กันกดซ้ำ)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  
  // Use optimized data fetching
  const { data: gamesList, loading, error, refetch } = useGamesList()
  const { prefetchGame } = usePrefetch()

  // ถ้ามี ?id=... ให้ส่งผู้เล่นไปหน้าเล่น
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('id')
    if (q) nav(`/play/${q.trim()}`, { replace: true })
  }, [nav])

  // ✅ Clear cache and force refresh games list on mount
  useEffect(() => {
    // Clear games list cache to ensure fresh data from PostgreSQL
    dataCache.delete(cacheKeys.gamesList())
    refetch()
  }, [refetch])

  // Force refresh games list when returning to home page
  useEffect(() => {
    const handleFocus = () => {
      refetch()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetch])

  // Convert gamesList to rows format for compatibility
  const rows = React.useMemo(() => {
    if (!gamesList || !Array.isArray(gamesList)) return []
    const mapped = gamesList.map(game => ({
      id: game.id,
      name: game.name,
      type: game.type,
      createdAt: game.createdAt
    }))
    
    // ✅ Debug: Log games list and checkin games
    const checkinGames = mapped.filter(g => g.type === 'เกมเช็คอิน')
    console.log('[Home] Games list:', {
      total: mapped.length,
      checkinGames: checkinGames.length,
      checkinGameIds: checkinGames.map(g => g.id),
      allGames: mapped.map(g => ({ id: g.id, name: g.name, type: g.type }))
    })
    
    return mapped
  }, [gamesList])


  /** กดปุ่มลบจากการ์ด */
  const handleDelete = async (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (deletingId) return

    if (!confirm(`ต้องการลบเกม "${name || id}" และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?`)) return
    try {
      setDeletingId(id)
      await deleteGame(id)
      
      // Invalidate cache after successful deletion
      dataCache.invalidateGame(id)
      
      // Force refresh the games list
      await refetch()
      
      alert('ลบเกมเรียบร้อย')
    } catch (error) {
      console.error('Error deleting game:', error)
      alert('เกิดข้อผิดพลาดในการลบเกม')
    } finally {
      setDeletingId(null)
    }
  }

  const uiByType = (t: string) => {
    switch (t) {
      case 'เกมทายภาพปริศนา':

      return { 
          emoji: '🧩', 
          from: 'rgba(59, 130, 246, 0.4)', 
          to: 'rgba(147, 197, 253, 0.25)', 
          accent: '#3B82F6',
          glow: 'rgba(59, 130, 246, 0.3)'
        }
      case 'เกมทายเบอร์เงิน':
        return { 
          emoji: '🔢', 
          from: 'rgba(251, 191, 36, 0.4)', 
          to: 'rgba(245, 158, 11, 0.25)', 
          accent: '#FBBF24',
          glow: 'rgba(251, 191, 36, 0.3)'
        }
      case 'เกมทายผลบอล':
        return { 
          emoji: '⚽️', 
          from: 'rgba(16, 185, 129, 0.4)', 
          to: 'rgba(5, 150, 105, 0.25)', 
          accent: '#10B981',
          glow: 'rgba(16, 185, 129, 0.3)'
        }
      case 'เกมสล็อต':
        return { 
          emoji: '🎰', 
          from: 'rgba(239, 68, 68, 0.4)', 
          to: 'rgba(220, 38, 38, 0.25)', 
          accent: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.3)'
        }
      case 'เกมเช็คอิน':
        return { 
          emoji: '📍', 
          from: 'rgba(168, 85, 247, 0.4)', 
          to: 'rgba(147, 51, 234, 0.25)', 
          accent: '#A855F7',
          glow: 'rgba(168, 85, 247, 0.3)'
        }
      case 'เกม Trick or Treat':
        return { 
          emoji: '🎃', 
          from: 'rgba(255, 107, 53, 0.4)', 
          to: 'rgba(255, 87, 34, 0.25)', 
          accent: '#FF6B35',
          glow: 'rgba(255, 107, 53, 0.3)'
        }
      case 'เกมลอยกระทง':
        return { 
          emoji: '🪔', 
          from: 'rgba(76, 175, 80, 0.4)', 
          to: 'rgba(56, 142, 60, 0.25)', 
          accent: '#4CAF50',
          glow: 'rgba(76, 175, 80, 0.3)'
        }
      case 'เกม BINGO':
        return { 
          emoji: '🎯', 
          from: 'rgba(139, 92, 246, 0.4)', 
          to: 'rgba(124, 58, 237, 0.25)', 
          accent: '#8B5CF6',
          glow: 'rgba(139, 92, 246, 0.3)'
        }
      default:
        return { 
          emoji: '🎮', 
          from: 'rgba(107, 114, 128, 0.4)', 
          to: 'rgba(75, 85, 99, 0.25)', 
          accent: '#6B7280',
          glow: 'rgba(107, 114, 128, 0.3)'
        }
    }
  }

  return (
    <section className="home-hero">
      <div className="home-container">
        {/* Left Panel - Buttons */}
        <div className="home-left-panel">
          <div className="home-header">
                   <div className="home-logo-container">
                     <img 
                       key={`logo-${themeName}-${assets.logoContainer}`}
                       src={assets.logoContainer} 
                       alt={branding.title} 
                       className="home-logo-image"
                       onError={(e) => {
                         console.error('Failed to load logo:', assets.logoContainer, 'Theme:', themeName)
                         e.currentTarget.src = '/image/logo.png'
                       }}
                     />
                   </div>
            <div className="home-title-section">
              <p className="home-subtitle">{branding.subtitle}</p>
            </div>
          </div>

          <div className="home-actions-grid">
            {/* สร้างเกม - ด้านบนสุด */}
            <div className="action-section">
              <div className="section-title">สร้างเกม</div>
              <button className="home-action-card home-btn-create" onClick={() => nav('/creategame')}>
                <div className="card-icon">
                  <img src="/image/slot.svg" alt="Create Game" width="24" height="24" />
                </div>
                <div className="card-content">
                  <div className="card-title">สร้างเกม</div>
                  <div className="card-subtitle">สร้างเกมใหม่</div>
                </div>
              </button>
            </div>

            {/* จัดการผู้ใช้ */}
            <div className="action-section">
              <div className="section-title">จัดการผู้ใช้</div>
              <button className="home-action-card home-btn-users-extra" onClick={() => nav('/upload-users-extra')}>
                <div className="card-icon">
                  <img src="/image/user.svg" alt="Users Extra" width="24" height="24" />
                </div>
                <div className="card-content">
                  <div className="card-title">เพิ่มข้อมูลลูกค้า</div>
                  <div className="card-subtitle">จัดการข้อมูลลูกค้า</div>
                </div>
              </button>
            </div>

            {/* ตั้งค่ารูปภาพ */}
            <div className="action-section">
              <div className="section-title">ตั้งค่า</div>
              <button className="home-action-card home-btn-image-settings" onClick={() => nav('/image-settings')}>
                <div className="card-icon">
                  <span style={{ fontSize: '24px' }}>🖼️</span>
                </div>
                <div className="card-content">
                  <div className="card-title">ตั้งค่ารูปภาพ</div>
                  <div className="card-subtitle">อัปโหลดพื้นหลัง</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Game List */}
        <div className="home-right-panel">
          <div className="games-header">
            <h2 className="games-title">รายการเกมที่สร้างไว้</h2>
            <div className="games-count">{rows.length} เกม</div>
          </div>

          <div className="games-list">
            {loading && (
              <div className="games-loading">
                <div className="loading-skeleton">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-emoji"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-title"></div>
                        <div className="skeleton-subtitle"></div>
                      </div>
                      <div className="skeleton-actions">
                        <div className="skeleton-btn"></div>
                        <div className="skeleton-btn"></div>
                        <div className="skeleton-btn"></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="loading-text">กำลังโหลดรายการเกม…</div>
              </div>
            )}

            {error && (
              <div className="games-error">
                <div className="empty-icon">⚠️</div>
                <div className="empty-title">เกิดข้อผิดพลาด</div>
                <div className="empty-subtitle">{error}</div>
                <button 
                  className="btn-primary" 
                  onClick={() => refetch()}
                  style={{ marginTop: '16px' }}
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            )}

            {!loading && !error && rows.length === 0 && (
              <div className="games-empty">
                <div className="empty-icon">🎮</div>
                <div className="empty-title">ยังไม่มีเกมที่สร้างไว้</div>
                <div className="empty-subtitle">คลิกปุ่ม "สร้างเกม" เพื่อเริ่มสร้างเกมแรก</div>
              </div>
            )}

            {!loading && rows.length > 0 && rows.map((g) => {
              const ui = uiByType(g.type)
              const bg = `linear-gradient(135deg, ${ui.from} 0%, ${ui.to} 100%)`
              return (
                <div
                  key={g.id}
                  className="game-card"
                  data-game-type={g.type}
                  style={{ 
                    background: '#ffffff', 
                    borderLeft: `4px solid ${ui.accent}`,
                    boxShadow: `0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  }}
                  onClick={() => nav(`/games/${g.id}`)}
                  onMouseEnter={() => prefetchGame(g.id)}
                  role="button"
                  title="คลิกเพื่อแก้ไข"
                >
                  <div className="game-card-left">
                    <div 
                      className="game-emoji" 
                      style={{ 
                        borderColor: ui.accent,
                        boxShadow: `0 0 20px ${ui.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.8)`
                      }}
                    >
                      {ui.emoji}
                    </div>
                    <div className="game-info">
                      <div className="game-name">{g.name || '(ไม่มีชื่อเกม)'}</div>
                      <div className="game-type">{g.type}</div>
                    </div>
                  </div>

                  <div className="game-card-right">
                    {/* ปุ่มทั้งหมดในแถวเดียว */}
                    <div className="action-buttons" style={{
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center'
                    }}>
                      {/* ปุ่มคัดลอกลิงก์สำหรับลูกค้า */}
                      <button
                        className="btn-copy-customer"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(getPlayerLink(g.id))
                          alert('คัดลอกลิงก์สำหรับลูกค้าแล้ว')
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                          transition: 'all 0.2s ease',
                          minWidth: '90px',
                          justifyContent: 'center',
                          height: '36px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(249, 115, 22, 0.3)'
                        }}
                        title="คัดลอกลิงก์สำหรับลูกค้า"
                      >
                        <span style={{ fontSize: '14px' }}>🔗</span> ลูกค้า
                      </button>

                      {/* ปุ่มคัดลอกลิงก์สำหรับแอดมิน */}
                      <button
                        className="btn-copy-admin"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(`${window.location.origin}/admin/answers/${g.id}`)
                          alert('คัดลอกลิงก์สำหรับแอดมินแล้ว')
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s ease',
                          minWidth: '90px',
                          justifyContent: 'center',
                          height: '36px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}
                        title="คัดลอกลิงก์สำหรับแอดมิน"
                      >
                        <span style={{ fontSize: '14px' }}>🔗</span> แอดมิน
                      </button>

                      {/* ปุ่มลบเกม */}
                      <button
                        className={`btn-danger ${deletingId === g.id ? 'is-loading' : ''}`}
                        onClick={(e) => handleDelete(g.id, g.name, e)}
                        aria-label="ลบเกม"
                        title="ลบเกมนี้"
                        disabled={deletingId === g.id}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                          transition: 'all 0.2s ease',
                          minWidth: '90px',
                          height: '36px'
                        }}
                        onMouseEnter={(e) => {
                          if (!deletingId) {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        {deletingId === g.id ? (
                          <>
                            <div style={{display:'inline-block', width:'12px', height:'12px', border:'2px solid #ffffff', borderTop:'2px solid transparent', borderRadius:'50%', animation:'spin 1s linear infinite', marginRight:'6px'}}></div>
                            ลบ...
                          </>
                        ) : (
                          'ลบเกม'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}