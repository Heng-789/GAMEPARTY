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
 * ✅ OPTIMIZED: ฟังการเปลี่ยนแปลงของ Presence ในห้อง
 * เพิ่ม throttle เพื่อลด download
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
  
  // ✅ เพิ่ม throttle เพื่อลด download
  let throttleTimer: NodeJS.Timeout | null = null
  let lastUpdateTime = 0
  const THROTTLE_MS = 500 // Update at most once every 500ms
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTime
    
    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= THROTTLE_MS) {
      lastUpdateTime = now
      updatePresence(snapshot)
    } else {
      // Otherwise, schedule an update
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      throttleTimer = setTimeout(() => {
        lastUpdateTime = Date.now()
        updatePresence(snapshot)
      }, THROTTLE_MS - timeSinceLastUpdate)
    }
  })
  
  const updatePresence = (snapshot: any) => {
    const presence = snapshot.val() || {}
    
    // ✅ CRITICAL FIX: จำกัดจำนวน users ที่แสดงเพื่อลด download (10,000 users → 100 users)
    const MAX_USERS_DISPLAY = 100 // แสดงเฉพาะ 100 users active ล่าสุด
    
    // ✅ กรองผู้ใช้ที่ยัง online หรือเพิ่ง offline (ภายใน 30 วินาที)
    const activePresence: RoomPresence = {}
    const now = Date.now()
    const offlineThreshold = 30000 // 30 วินาที
    
    // ✅ สร้าง array ของ active users พร้อม lastSeen เพื่อเรียงลำดับ
    const activeUsersArray: Array<[string, any]> = []
    
    Object.entries(presence).forEach(([userId, userData]: [string, any]) => {
      const timeSinceLastSeen = now - userData.lastSeen
      
      if (userData.status === 'online' || timeSinceLastSeen < offlineThreshold) {
        activeUsersArray.push([userId, userData])
      }
    })
    
    // ✅ เรียงตาม lastSeen (ล่าสุดก่อน) แล้วเลือกเฉพาะ MAX_USERS_DISPLAY users แรก
    activeUsersArray.sort(([, a], [, b]) => {
      const aLastSeen = a.lastSeen || 0
      const bLastSeen = b.lastSeen || 0
      return bLastSeen - aLastSeen // เรียงตาม lastSeen (ล่าสุดก่อน)
    })
    
    // ✅ CRITICAL FIX: เลือกเฉพาะ MAX_USERS_DISPLAY users แรก (100 users ล่าสุด)
    const limitedUsersArray = activeUsersArray.slice(0, MAX_USERS_DISPLAY)
    
    // ✅ แปลงกลับเป็น object
    limitedUsersArray.forEach(([userId, userData]) => {
      activePresence[userId] = userData
    })
    
    callback(activePresence)
  }

  return () => {
    if (throttleTimer) {
      clearTimeout(throttleTimer)
    }
    off(presenceRef, 'value', unsubscribe)
  }
}

/**
 * ✅ OPTIMIZED: ฟังการเปลี่ยนแปลงของ Presence ในเกมทั้งหมด (สำหรับ Lobby)
 * เพิ่ม throttle เพื่อลด download
 * @param gameId - ID ของเกม
 * @param callback - ฟังก์ชัน callback ที่จะถูกเรียกเมื่อมีการเปลี่ยนแปลง
 */
export const listenToGamePresence = (
  gameId: string,
  callback: (roomsPresence: { [roomId: string]: RoomPresence }) => void
) => {
  const presenceRef = ref(db, `presence/${gameId}/rooms`)
  
  // ✅ เพิ่ม throttle เพื่อลด download
  let throttleTimer: NodeJS.Timeout | null = null
  let lastUpdateTime = 0
  const THROTTLE_MS = 500 // Update at most once every 500ms
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTime
    
    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= THROTTLE_MS) {
      lastUpdateTime = now
      updatePresence(snapshot)
    } else {
      // Otherwise, schedule an update
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      throttleTimer = setTimeout(() => {
        lastUpdateTime = Date.now()
        updatePresence(snapshot)
      }, THROTTLE_MS - timeSinceLastUpdate)
    }
  })
  
  const updatePresence = (snapshot: any) => {
    const roomsPresence = snapshot.val() || {}
    
    // ✅ CRITICAL FIX: จำกัดจำนวน users ที่แสดงเพื่อลด download (10,000 users → 100 users)
    const MAX_USERS_DISPLAY = 100 // แสดงเฉพาะ 100 users active ล่าสุดในแต่ละห้อง
    
    // ✅ กรองผู้ใช้ที่ยัง active ในแต่ละห้อง (กรองเฉพาะห้องที่มีผู้ใช้ active)
    const activeRoomsPresence: { [roomId: string]: RoomPresence } = {}
    const now = Date.now()
    const offlineThreshold = 30000 // 30 วินาที
    
    Object.entries(roomsPresence).forEach(([roomId, roomData]: [string, any]) => {
      // ✅ สร้าง array ของ active users พร้อม lastSeen เพื่อเรียงลำดับ
      const activeUsersArray: Array<[string, any]> = []
      
      Object.entries(roomData.users || {}).forEach(([userId, userData]: [string, any]) => {
        const timeSinceLastSeen = now - userData.lastSeen
        
        if (userData.status === 'online' || timeSinceLastSeen < offlineThreshold) {
          activeUsersArray.push([userId, userData])
        }
      })
      
      // ✅ เรียงตาม lastSeen (ล่าสุดก่อน) แล้วเลือกเฉพาะ MAX_USERS_DISPLAY users แรก
      activeUsersArray.sort(([, a], [, b]) => {
        const aLastSeen = a.lastSeen || 0
        const bLastSeen = b.lastSeen || 0
        return bLastSeen - aLastSeen // เรียงตาม lastSeen (ล่าสุดก่อน)
      })
      
      // ✅ CRITICAL FIX: เลือกเฉพาะ MAX_USERS_DISPLAY users แรก (100 users ล่าสุด)
      const limitedUsersArray = activeUsersArray.slice(0, MAX_USERS_DISPLAY)
      
      // ✅ แปลงกลับเป็น object
      const activeUsers: RoomPresence = {}
      limitedUsersArray.forEach(([userId, userData]) => {
        activeUsers[userId] = userData
      })
      
      // ✅ เฉพาะห้องที่มีผู้ใช้ active เท่านั้น (ลดข้อมูลที่ไม่จำเป็น)
      if (Object.keys(activeUsers).length > 0) {
        activeRoomsPresence[roomId] = activeUsers
      }
    })
    
    callback(activeRoomsPresence)
  }

  return () => {
    if (throttleTimer) {
      clearTimeout(throttleTimer)
    }
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
