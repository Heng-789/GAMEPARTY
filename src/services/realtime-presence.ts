// ✅ Removed Firebase imports - using PostgreSQL 100%
import * as postgresqlAdapter from './postgresql-adapter'
import { getWebSocket } from './postgresql-websocket'

/**
 * Real-time User Presence System
 * ระบบตรวจสอบผู้ใช้ในห้องแบบเรียลไทม์
 */

export type UserPresence = {
  userId: string
  username: string
  status: 'online' | 'away' | 'offline'
  lastSeen: number
  joinedAt: number
  isInRoom: boolean
  roomId?: string
  gameId?: string
}

export type RoomPresence = {
  [userId: string]: UserPresence
}

/**
 * เริ่มต้นระบบ User Presence - ใช้ PostgreSQL 100%
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param userId - ID ของผู้ใช้
 * @param username - ชื่อผู้ใช้
 */
export const initializeUserPresence = async (
  gameId: string,
  roomId: string,
  userId: string,
  username: string
) => {
  try {
    // ✅ ใช้ PostgreSQL 100%
    await postgresqlAdapter.updatePresence(gameId, roomId, userId, username, 'online')
    
    const userPresence: UserPresence = {
      userId,
      username,
      status: 'online',
      lastSeen: Date.now(),
      joinedAt: Date.now(),
      isInRoom: true,
      roomId,
      gameId
    }
    
    // ตั้งค่า Heartbeat เพื่ออัปเดตสถานะเป็นประจำ
    setupHeartbeat(gameId, roomId, userId, username)
    
    // ตั้งค่า cleanup เมื่อผู้ใช้ออกจากหน้า
    setupCleanupOnUnload(gameId, roomId, userId, username)
    
    return userPresence
  } catch (error) {
    console.error('Error initializing user presence:', error)
    throw error
  }
}

/**
 * อัปเดตสถานะผู้ใช้ - ใช้ PostgreSQL 100%
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param userId - ID ของผู้ใช้
 * @param status - สถานะใหม่
 * @param username - ชื่อผู้ใช้ (optional, จะดึงจาก database ถ้าไม่ระบุ)
 */
export const updateUserStatus = async (
  gameId: string,
  roomId: string,
  userId: string,
  status: 'online' | 'away' | 'offline',
  username?: string
) => {
  try {
    // ✅ ใช้ PostgreSQL 100%
    let finalUsername = username
    if (!finalUsername) {
      // ดึง username จาก database ถ้าไม่ระบุ
      const presence = await postgresqlAdapter.getRoomPresence(gameId, roomId, 1)
      const existingUser = presence[userId]
      finalUsername = existingUser?.username || userId
    }
    
    await postgresqlAdapter.updatePresence(gameId, roomId, userId, finalUsername, status)
  } catch (error) {
    console.error('Error updating user status:', error)
  }
}

/**
 * ลบผู้ใช้ออกจากระบบ Presence - ใช้ PostgreSQL 100%
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param userId - ID ของผู้ใช้
 */
export const removeUserPresence = async (
  gameId: string,
  roomId: string,
  userId: string
) => {
  try {
    // ✅ ใช้ PostgreSQL 100% - ตั้ง status เป็น offline
    await postgresqlAdapter.removePresence(gameId, roomId, userId)
  } catch (error) {
    console.error('Error removing user presence:', error)
  }
}

/**
 * ✅ ฟังการเปลี่ยนแปลงของ Presence ในห้อง - ใช้ PostgreSQL + Polling
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param callback - ฟังก์ชัน callback ที่จะถูกเรียกเมื่อมีการเปลี่ยนแปลง
 */
export const listenToRoomPresence = (
  gameId: string,
  roomId: string,
  callback: (presence: RoomPresence) => void
) => {
  let intervalId: NodeJS.Timeout | null = null
  let lastUpdateTime = 0
  const POLL_INTERVAL = 2000 // Poll every 2 seconds
  const THROTTLE_MS = 500 // Throttle callback updates
  
  const fetchPresence = async () => {
    try {
      // ✅ ใช้ PostgreSQL 100%
      const presence = await postgresqlAdapter.getRoomPresence(gameId, roomId, 100)
      
      // ✅ Throttle callback updates
      const now = Date.now()
      if (now - lastUpdateTime >= THROTTLE_MS) {
        lastUpdateTime = now
        callback(presence)
      } else {
        // Schedule delayed update
        if (intervalId) {
          clearTimeout(intervalId as any)
        }
        setTimeout(() => {
          callback(presence)
          lastUpdateTime = Date.now()
        }, THROTTLE_MS - (now - lastUpdateTime))
      }
    } catch (error) {
      console.error('Error fetching presence:', error)
    }
  }
  
  // Fetch immediately
  fetchPresence()
  
  // Poll every 2 seconds
  intervalId = setInterval(fetchPresence, POLL_INTERVAL) as any

  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}

/**
 * ✅ ฟังการเปลี่ยนแปลงของ Presence ในเกมทั้งหมด (สำหรับ Lobby) - ใช้ PostgreSQL + Polling
 * @param gameId - ID ของเกม
 * @param callback - ฟังก์ชัน callback ที่จะถูกเรียกเมื่อมีการเปลี่ยนแปลง
 */
export const listenToGamePresence = (
  gameId: string,
  callback: (roomsPresence: { [roomId: string]: RoomPresence }) => void
) => {
  // ✅ ใช้ polling สำหรับ game presence (เพราะต้อง query หลายห้อง)
  // สำหรับตอนนี้จะ return empty object (ถ้าต้องการจริงๆ อาจจะต้องสร้าง API endpoint ใหม่)
  let intervalId: NodeJS.Timeout | null = null
  const POLL_INTERVAL = 5000 // Poll every 5 seconds
  
  const fetchGamePresence = async () => {
    try {
      // ✅ สำหรับตอนนี้จะ return empty object
      // ถ้าต้องการจริงๆ อาจจะต้องสร้าง API endpoint `/api/presence/${gameId}` ที่ return ทุกห้อง
      callback({})
    } catch (error) {
      console.error('Error fetching game presence:', error)
    }
  }
  
  // Fetch immediately
  fetchGamePresence()
  
  // Poll every 5 seconds
  intervalId = setInterval(fetchGamePresence, POLL_INTERVAL) as any

  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}

/**
 * ตั้งค่า Heartbeat เพื่ออัปเดตสถานะเป็นประจำ - ใช้ PostgreSQL 100%
 */
const setupHeartbeat = (gameId: string, roomId: string, userId: string, username: string) => {
  const heartbeatInterval = setInterval(async () => {
    try {
      // ✅ ใช้ PostgreSQL 100%
      await postgresqlAdapter.updatePresence(gameId, roomId, userId, username, 'online')
    } catch (error) {
      console.error('Error updating heartbeat:', error)
    }
  }, 10000) // อัปเดตทุก 10 วินาที
  
  // เก็บ interval ID เพื่อ cleanup
  window.addEventListener('beforeunload', () => {
    clearInterval(heartbeatInterval)
  })
}

/**
 * ตั้งค่า cleanup เมื่อผู้ใช้ออกจากหน้า
 */
const setupCleanupOnUnload = (gameId: string, roomId: string, userId: string, username: string) => {
  const cleanup = () => {
    removeUserPresence(gameId, roomId, userId).catch(console.error)
  }
  
  // Cleanup เมื่อปิดหน้า
  window.addEventListener('beforeunload', cleanup)
  
  // Cleanup เมื่อออกจาก focus (อาจจะกลับมา)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      updateUserStatus(gameId, roomId, userId, 'away', username).catch(console.error)
    } else {
      updateUserStatus(gameId, roomId, userId, 'online', username).catch(console.error)
    }
  })
}

/**
 * ตรวจสอบจำนวนผู้ใช้ที่อยู่ในห้อง
 */
export const getRoomUserCount = (roomPresence: RoomPresence): number => {
  return Object.values(roomPresence).filter(user => 
    user.status === 'online' || (Date.now() - user.lastSeen) < 30000
  ).length
}

/**
 * ตรวจสอบว่าผู้ใช้อยู่ในห้องหรือไม่
 */
export const isUserInRoom = (
  roomPresence: RoomPresence,
  userId: string
): boolean => {
  const user = roomPresence[userId]
  if (!user) return false
  
  const timeSinceLastSeen = Date.now() - user.lastSeen
  return user.status === 'online' || timeSinceLastSeen < 30000
}
