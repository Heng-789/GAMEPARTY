import { ref, onValue, off, update, remove, set, serverTimestamp } from 'firebase/database'
import { db } from './firebase-theme'

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
 * เริ่มต้นระบบ User Presence
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
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`)
    
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

    await set(presenceRef, userPresence)
    
    // ตั้งค่า Heartbeat เพื่ออัปเดตสถานะเป็นประจำ
    setupHeartbeat(gameId, roomId, userId)
    
    // ตั้งค่า cleanup เมื่อผู้ใช้ออกจากหน้า
    setupCleanupOnUnload(gameId, roomId, userId)
    
    return userPresence
  } catch (error) {
    console.error('Error initializing user presence:', error)
    throw error
  }
}

/**
 * อัปเดตสถานะผู้ใช้
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param userId - ID ของผู้ใช้
 * @param status - สถานะใหม่
 */
export const updateUserStatus = async (
  gameId: string,
  roomId: string,
  userId: string,
  status: 'online' | 'away' | 'offline'
) => {
  try {
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`)
    await update(presenceRef, {
      status,
      lastSeen: Date.now()
    })
  } catch (error) {
    console.error('Error updating user status:', error)
  }
}

/**
 * ลบผู้ใช้ออกจากระบบ Presence
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
    const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users/${userId}`)
    await remove(presenceRef)
  } catch (error) {
    console.error('Error removing user presence:', error)
  }
}

/**
 * ฟังการเปลี่ยนแปลงของ Presence ในห้อง
 * @param gameId - ID ของเกม
 * @param roomId - ID ของห้อง
 * @param callback - ฟังก์ชัน callback ที่จะถูกเรียกเมื่อมีการเปลี่ยนแปลง
 */
export const listenToRoomPresence = (
  gameId: string,
  roomId: string,
  callback: (presence: RoomPresence) => void
) => {
  const presenceRef = ref(db, `presence/${gameId}/rooms/${roomId}/users`)
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const presence = snapshot.val() || {}
    
    // กรองผู้ใช้ที่ยัง online หรือเพิ่ง offline (ภายใน 30 วินาที)
    const activePresence: RoomPresence = {}
    const now = Date.now()
    const offlineThreshold = 30000 // 30 วินาที
    
    Object.entries(presence).forEach(([userId, userData]: [string, any]) => {
      const timeSinceLastSeen = now - userData.lastSeen
      
      if (userData.status === 'online' || timeSinceLastSeen < offlineThreshold) {
        activePresence[userId] = userData
      }
    })
    
    callback(activePresence)
  })

  return () => {
    off(presenceRef, 'value', unsubscribe)
  }
}

/**
 * ฟังการเปลี่ยนแปลงของ Presence ในเกมทั้งหมด (สำหรับ Lobby)
 * @param gameId - ID ของเกม
 * @param callback - ฟังก์ชัน callback ที่จะถูกเรียกเมื่อมีการเปลี่ยนแปลง
 */
export const listenToGamePresence = (
  gameId: string,
  callback: (roomsPresence: { [roomId: string]: RoomPresence }) => void
) => {
  const presenceRef = ref(db, `presence/${gameId}/rooms`)
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const roomsPresence = snapshot.val() || {}
    
    // กรองผู้ใช้ที่ยัง active ในแต่ละห้อง
    const activeRoomsPresence: { [roomId: string]: RoomPresence } = {}
    const now = Date.now()
    const offlineThreshold = 30000 // 30 วินาที
    
    Object.entries(roomsPresence).forEach(([roomId, roomData]: [string, any]) => {
      const activeUsers: RoomPresence = {}
      
      Object.entries(roomData.users || {}).forEach(([userId, userData]: [string, any]) => {
        const timeSinceLastSeen = now - userData.lastSeen
        
        if (userData.status === 'online' || timeSinceLastSeen < offlineThreshold) {
          activeUsers[userId] = userData
        }
      })
      
      if (Object.keys(activeUsers).length > 0) {
        activeRoomsPresence[roomId] = activeUsers
      }
    })
    
    callback(activeRoomsPresence)
  })

  return () => {
    off(presenceRef, 'value', unsubscribe)
  }
}

/**
 * ตั้งค่า Heartbeat เพื่ออัปเดตสถานะเป็นประจำ
 */
const setupHeartbeat = (gameId: string, roomId: string, userId: string) => {
  const heartbeatInterval = setInterval(async () => {
    try {
      await updateUserStatus(gameId, roomId, userId, 'online')
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
const setupCleanupOnUnload = (gameId: string, roomId: string, userId: string) => {
  const cleanup = () => {
    removeUserPresence(gameId, roomId, userId).catch(console.error)
  }
  
  // Cleanup เมื่อปิดหน้า
  window.addEventListener('beforeunload', cleanup)
  
  // Cleanup เมื่อออกจาก focus (อาจจะกลับมา)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      updateUserStatus(gameId, roomId, userId, 'away').catch(console.error)
    } else {
      updateUserStatus(gameId, roomId, userId, 'online').catch(console.error)
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
