// src/components/LiveChat.tsx
import React, { useState, useEffect, useRef } from 'react'
import { ref, push, onValue, off, set } from 'firebase/database'
import { db } from '../services/firebase'
import { useThemeColors, useThemeBranding } from '../contexts/ThemeContext'

type ChatMessage = {
  id: string
  username: string
  message: string
  timestamp: number
}

interface LiveChatProps {
  gameId: string
  username: string
  maxMessages?: number
  isHost?: boolean
}

export default function LiveChat({ gameId, username, maxMessages = 50, isHost = false }: LiveChatProps) {
  const colors = useThemeColors()
  const branding = useThemeBranding()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const lastMessageCountRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatRef = ref(db, `chat/${gameId}`)
  
  // Create theme-aware chat label
  const chatLabel = `${branding.title} CHAT`

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Track unread messages when chat is collapsed
  useEffect(() => {
    if (!isExpanded && messages.length > lastMessageCountRef.current) {
      const newMessages = messages.length - lastMessageCountRef.current
      setUnreadCount(prev => prev + newMessages)
    }
    lastMessageCountRef.current = messages.length
  }, [messages, isExpanded])

  // Reset unread count when expanding chat
  const handleToggleExpand = () => {
    if (!isExpanded) {
      setUnreadCount(0)
      lastMessageCountRef.current = messages.length
    }
    setIsExpanded(!isExpanded)
  }

  // Listen for new messages (with throttling for performance)
  useEffect(() => {
    let throttleTimer: NodeJS.Timeout | null = null
    let lastUpdateTime = 0
    const THROTTLE_MS = 200 // Update at most once every 200ms
    
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTime
      
      // If enough time has passed, update immediately
      if (timeSinceLastUpdate >= THROTTLE_MS) {
        lastUpdateTime = now
        updateMessages(snapshot)
      } else {
        // Otherwise, schedule an update
        if (throttleTimer) {
          clearTimeout(throttleTimer)
        }
        throttleTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          updateMessages(snapshot)
        }, THROTTLE_MS - timeSinceLastUpdate)
      }
    })
    
    const updateMessages = (snapshot: any) => {
      if (!snapshot.exists()) {
        setMessages([])
        return
      }

      const data = snapshot.val()
      const messagesList: ChatMessage[] = Object.entries(data)
        .map(([id, msg]: [string, any]) => ({
          id,
          username: msg.username || 'Unknown',
          message: msg.message || '',
          timestamp: msg.timestamp || Date.now()
        }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxMessages) // Keep only last N messages

      setMessages(messagesList)
    }

    return () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      off(chatRef, 'value', unsubscribe)
    }
  }, [gameId, maxMessages])

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || !username) return

    try {
      const newMessageRef = push(chatRef)
      await set(newMessageRef, {
        username,
        message: inputMessage.trim(),
        timestamp: Date.now()
      })
      setInputMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div 
      className="live-chat-container"
      style={{
        position: 'fixed',
        bottom: isExpanded ? '80px' : '20px',
        right: '20px',
        width: isExpanded ? '320px' : '60px',
        height: isExpanded ? '400px' : '60px',
        borderRadius: '16px',
        background: colors.bgPrimary,
        boxShadow: `0 8px 32px ${colors.primary}50`,
        border: `2px solid ${colors.primary}`,
        transition: 'all 0.3s ease',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Chat Header */}
      <div
        className="chat-header"
        onClick={handleToggleExpand}
        style={{
          padding: '12px 16px',
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          color: colors.textInverse,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: isExpanded ? '16px 16px 0 0' : '16px',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>💬</span>
          {isExpanded && (
            <span style={{ fontWeight: '700', fontSize: '14px' }}>{chatLabel}</span>
          )}
        </div>
        
        {/* Unread Badge */}
        {!isExpanded && unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: '#EF4444',
              color: 'white',
              borderRadius: '10px',
              minWidth: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '700',
              padding: '0 6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              animation: 'pulse 1s infinite'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Messages Container */}
          <div
            className="chat-messages"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bgTertiary} 100%)`
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: colors.textTertiary,
                  fontSize: '13px',
                  padding: '20px',
                  fontStyle: 'italic'
                }}
              >
                ยังไม่มีข้อความ...
              </div>
            ) : (
              messages.map((msg) => {
                // เช็คว่าเป็น HOST หรือไม่ (HENG36, MAX56, JEED24)
                const isHostUser = msg.username === 'HENG36' || msg.username === 'MAX56' || msg.username === 'JEED24'
                
                return (
                <div
                  key={msg.id}
                  className="chat-message"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: msg.username === username 
                      ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
                      : isHostUser
                        ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' // สีเหลืองทองสำหรับ HOST
                        : colors.bgPrimary,
                    border: msg.username === username 
                      ? `2px solid ${colors.primary}`
                      : isHostUser
                        ? '2px solid #FFD700' // กรอบสีเหลืองทองสำหรับ HOST
                        : `1px solid ${colors.borderLight}`,
                    alignSelf: msg.username === username ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    animation: 'fadeIn 0.3s ease',
                    boxShadow: msg.username === username 
                      ? `0 2px 8px ${colors.primary}30`
                      : isHostUser
                        ? '0 4px 12px rgba(255, 215, 0, 0.5)' // เงาสีทองสำหรับ HOST
                        : `0 1px 4px ${colors.borderLight}`
                  }}
                >
                  {msg.username !== username && (
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: colors.primary, // สีเขียวตามธีม
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {/* แสดงไอคอนมงกุฎสำหรับ HOST (HENG36, MAX56, JEED24) */}
                      {isHostUser && (
                        <span style={{ fontSize: '12px' }}>👑</span>
                      )}
                      <span style={{ fontWeight: isHostUser ? '800' : '700' }}>
                        {msg.username}
                      </span>
                    </div>
                  )}
                  {/* แสดงชื่อผู้ใช้สำหรับข้อความของตัวเอง (ถ้าเป็น HOST) */}
                  {msg.username === username && isHost && (
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: colors.textInverse,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: 0.9
                      }}
                    >
                      <span style={{ fontSize: '12px' }}>👑</span>
                      {msg.username}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '13px',
                      color: msg.username === username 
                        ? colors.textInverse 
                        : isHostUser 
                          ? '#1a1a1a' // สีข้อความเข้มสำหรับ HOST (เพื่อให้อ่านง่ายบนพื้นหลังสีทอง)
                          : colors.textPrimary,
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                      fontWeight: isHostUser ? '600' : '400'
                    }}
                  >
                    {msg.message}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: msg.username === username ? colors.textInverse : colors.textTertiary,
                      marginTop: '4px',
                      textAlign: 'right',
                      opacity: 0.8
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className="chat-input-area"
            style={{
              padding: '12px',
              borderTop: `2px solid ${colors.primary}`,
              background: `linear-gradient(135deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="พิมพ์ข้อความ..."
                maxLength={200}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `2px solid ${colors.primary}`,
                  outline: 'none',
                  fontSize: '13px',
                  color: colors.textPrimary,
                  background: colors.bgPrimary
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: inputMessage.trim() 
                    ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
                    : colors.gray300,
                  color: colors.textInverse,
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
              >
                ส่ง
              </button>
            </div>
            <div
              style={{
                fontSize: '10px',
                color: colors.textTertiary,
                marginTop: '4px',
                textAlign: 'right'
              }}
            >
              กด Enter เพื่อส่ง
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  )
}

