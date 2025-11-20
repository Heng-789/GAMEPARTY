/**
 * Firestore Service for Users (USERS_EXTRA)
 * Phase 1-3: Dual Write/Read with Migration Support
 * 
 * Phase 1: Dual Write (เขียนทั้ง RTDB และ Firestore)
 * Phase 2: Dual Read (อ่านจาก Firestore ก่อน, fallback RTDB)
 * Phase 3: Migration (migrate 600K users จาก RTDB ไป Firestore)
 */

import { firestore } from './firebase'
import { db } from './firebase'
import { ref, get, set, update, remove, runTransaction as rtdbRunTransaction } from 'firebase/database'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  runTransaction as firestoreRunTransaction
} from 'firebase/firestore'

export interface UserData {
  userId: string
  password?: string
  hcoin?: number
  status?: string
  createdAt?: Timestamp | number
  updatedAt?: Timestamp | number
  [key: string]: any // สำหรับ fields อื่นๆ
}

/**
 * Phase 1: Dual Write - เขียนทั้ง RTDB และ Firestore
 */
export async function writeUserData(
  userId: string,
  data: Partial<UserData>,
  options: {
    useDualWrite?: boolean // Phase 1: เขียนทั้งสองที่ (deprecated - ใช้ Firestore 100%)
    preferFirestore?: boolean // Phase 3: เขียน Firestore เป็นหลัก (default: true)
  } = {}
): Promise<{ rtdb?: boolean; firestore?: boolean; error?: string }> {
  const { useDualWrite = false, preferFirestore = true } = options

  const result: { rtdb?: boolean; firestore?: boolean; error?: string } = {}

  try {
    // ✅ Phase 1: Dual Write - เขียนทั้ง RTDB และ Firestore
    if (useDualWrite) {
      // เขียน RTDB
      try {
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
        const rtdbData = {
          ...data,
          updatedAt: Date.now()
        }
        await set(rtdbRef, rtdbData)
        result.rtdb = true
      } catch (rtdbError: any) {
        console.error(`Error writing to RTDB for user ${userId}:`, rtdbError)
        result.error = `RTDB error: ${rtdbError.message}`
      }

      // เขียน Firestore
      try {
        const firestoreRef = doc(firestore, 'users', userId)
        const firestoreData = {
          userId,
          ...data,
          updatedAt: serverTimestamp()
        }
        await setDoc(firestoreRef, firestoreData, { merge: true })
        result.firestore = true
      } catch (firestoreError: any) {
        console.error(`Error writing to Firestore for user ${userId}:`, firestoreError)
        result.error = result.error 
          ? `${result.error}; Firestore error: ${firestoreError.message}`
          : `Firestore error: ${firestoreError.message}`
      }
    } else {
      // ✅ Phase 2+: เขียน Firestore เท่านั้น (หรือ RTDB เท่านั้น)
      if (preferFirestore) {
        const firestoreRef = doc(firestore, 'users', userId)
        const firestoreData = {
          userId,
          ...data,
          updatedAt: serverTimestamp()
        }
        await setDoc(firestoreRef, firestoreData, { merge: true })
        result.firestore = true
        
        // ✅ OPTIMIZED: Invalidate cache เมื่อมีการเขียนข้อมูล (ลด stale data)
        const { dataCache } = await import('./cache')
        const cacheKey = `user:${userId}`
        dataCache.delete(cacheKey)
      } else {
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
        const rtdbData = {
          ...data,
          updatedAt: Date.now()
        }
        await set(rtdbRef, rtdbData)
        result.rtdb = true
        
        // ✅ OPTIMIZED: Invalidate cache เมื่อมีการเขียนข้อมูล
        const { dataCache } = await import('./cache')
        const cacheKey = `user:${userId}`
        dataCache.delete(cacheKey)
      }
    }

    return result
  } catch (error: any) {
    console.error(`Error writing user data for ${userId}:`, error)
    return { error: error.message }
  }
}

/**
 * Phase 2: Dual Read - อ่านจาก Firestore ก่อน, fallback RTDB
 * ✅ OPTIMIZED: เพิ่ม cache เพื่อลด Firestore reads (รองรับ 10,000+ users)
 */
export async function getUserData(
  userId: string,
  options: {
    preferFirestore?: boolean // Phase 3: อ่าน Firestore ก่อน (default: true)
    fallbackRTDB?: boolean // Phase 3: fallback ไป RTDB ถ้าไม่มีใน Firestore (default: false - ใช้ Firestore 100%)
    useCache?: boolean // ✅ OPTIMIZED: ใช้ cache เพื่อลด reads (default: true)
    cacheTTL?: number // ✅ OPTIMIZED: cache TTL ใน milliseconds (default: 60 seconds)
  } = {}
): Promise<UserData | null> {
  const { preferFirestore = true, fallbackRTDB = false, useCache = true, cacheTTL = 60000 } = options

  // ✅ OPTIMIZED: ตรวจสอบ cache ก่อน (ลด Firestore reads)
  if (useCache) {
    const { dataCache } = await import('./cache')
    const cacheKey = `user:${userId}`
    const cached = dataCache.get<UserData>(cacheKey)
    if (cached) {
      return cached
    }
  }

  try {
    // ✅ Phase 2: อ่าน Firestore ก่อน
    if (preferFirestore) {
      try {
        const firestoreRef = doc(firestore, 'users', userId)
        const firestoreSnap = await getDoc(firestoreRef)

        if (firestoreSnap.exists()) {
          const data = firestoreSnap.data() as UserData
          // แปลง Timestamp เป็น number ถ้าจำเป็น
          if (data.createdAt instanceof Timestamp) {
            data.createdAt = data.createdAt.toMillis()
          }
          if (data.updatedAt instanceof Timestamp) {
            data.updatedAt = data.updatedAt.toMillis()
          }
          
          // ✅ OPTIMIZED: เก็บใน cache (ลด Firestore reads)
          if (useCache) {
            const { dataCache } = await import('./cache')
            const cacheKey = `user:${userId}`
            dataCache.set(cacheKey, data, cacheTTL)
          }
          
          return data
        }
      } catch (firestoreError: any) {
        console.error(`Error reading from Firestore for user ${userId}:`, firestoreError)
        // ต่อไป fallback RTDB
      }
    }

    // ✅ Phase 2: Fallback ไป RTDB ถ้าไม่มีใน Firestore หรือ preferFirestore = false
    if (fallbackRTDB) {
      try {
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
        const rtdbSnap = await get(rtdbRef)

        if (rtdbSnap.exists()) {
          const data = rtdbSnap.val() as UserData
          data.userId = userId
          return data
        }
      } catch (rtdbError: any) {
        console.error(`Error reading from RTDB for user ${userId}:`, rtdbError)
      }
    }

    return null
  } catch (error: any) {
    console.error(`Error getting user data for ${userId}:`, error)
    return null
  }
}

/**
 * Phase 2: Query Users (Top 100 by hcoin) - Firestore
 */
export async function getTopUsersByHcoin(
  limitCount: number = 100
): Promise<UserData[]> {
  try {
    const usersRef = collection(firestore, 'users')
    const q = query(
      usersRef,
      orderBy('hcoin', 'desc'),
      limit(limitCount)
    )

    const querySnapshot = await getDocs(q)
    const users: UserData[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data() as UserData
      data.userId = doc.id
      // แปลง Timestamp เป็น number
      if (data.createdAt instanceof Timestamp) {
        data.createdAt = data.createdAt.toMillis()
      }
      if (data.updatedAt instanceof Timestamp) {
        data.updatedAt = data.updatedAt.toMillis()
      }
      users.push(data)
    })

    return users
  } catch (error: any) {
    console.error('Error querying top users by hcoin:', error)
    // ✅ Fallback: อ่านจาก RTDB แล้ว sort client-side
    return await getTopUsersByHcoinFromRTDB(limitCount)
  }
}

/**
 * Fallback: Query Users from RTDB (client-side sort)
 */
async function getTopUsersByHcoinFromRTDB(limitCount: number): Promise<UserData[]> {
  try {
    const rtdbRef = ref(db, 'USERS_EXTRA')
    const rtdbSnap = await get(rtdbRef)

    if (!rtdbSnap.exists()) {
      return []
    }

    const allUsers = rtdbSnap.val() as Record<string, UserData>
    const users: UserData[] = []

    Object.entries(allUsers).forEach(([userId, userData]) => {
      users.push({
        ...userData,
        userId,
        hcoin: Number(userData.hcoin || 0)
      })
    })

    // Sort by hcoin (descending) แล้วเลือก top N
    users.sort((a, b) => (b.hcoin || 0) - (a.hcoin || 0))
    return users.slice(0, limitCount)
  } catch (error: any) {
    console.error('Error querying top users from RTDB:', error)
    return []
  }
}

/**
 * Phase 2: Search Users by Username (userId) - Firestore
 * หมายเหตุ: userId = username (userId ใช้เป็น document ID ใน Firestore)
 */
export async function searchUsersByUsername(
  searchTerm: string,
  limitCount: number = 100
): Promise<UserData[]> {
  try {
    // ✅ Firestore: เนื่องจาก userId = username และ userId เป็น document ID
    // ✅ เราต้องค้นหาโดยใช้ document ID range query (แต่ Firestore ไม่รองรับ)
    // ✅ ดังนั้นต้องใช้ fallback: อ่านจาก RTDB แล้ว filter client-side
    // ⚠️ หมายเหตุ: Firestore ไม่รองรับ range query บน document ID โดยตรง
    // ✅ วิธีที่ดีที่สุด: ใช้ userId field ใน document สำหรับ search
    
    // ✅ ลองใช้ userId field (ถ้ามี)
    const usersRef = collection(firestore, 'users')
    const searchLower = searchTerm.trim().toLowerCase()
    const searchUpper = searchLower + '\uf8ff'

    try {
      // ✅ วิธีที่ 1: ใช้ userId field (ต้องมี userId field ใน document)
      const q = query(
        usersRef,
        where('userId', '>=', searchLower),
        where('userId', '<=', searchUpper),
        orderBy('userId', 'asc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      const users: UserData[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data() as UserData
        data.userId = doc.id
        // แปลง Timestamp เป็น number
        if (data.createdAt instanceof Timestamp) {
          data.createdAt = data.createdAt.toMillis()
        }
        if (data.updatedAt instanceof Timestamp) {
          data.updatedAt = data.updatedAt.toMillis()
        }
        users.push(data)
      })

      if (users.length > 0) {
        return users
      }
    } catch (queryError: any) {
      // ✅ ถ้า query ไม่ได้ (ไม่มี index) ให้ fallback
      console.warn('Firestore query failed, falling back to RTDB:', queryError)
    }

    // ✅ Fallback: ค้นหาใน RTDB แล้ว filter client-side
    return await searchUsersByUsernameFromRTDB(searchTerm, limitCount)
  } catch (error: any) {
    console.error('Error searching users in Firestore:', error)
    // ✅ Fallback: ค้นหาใน RTDB แล้ว filter client-side
    return await searchUsersByUsernameFromRTDB(searchTerm, limitCount)
  }
}

/**
 * Fallback: Search Users from RTDB (client-side filter)
 */
async function searchUsersByUsernameFromRTDB(
  searchTerm: string,
  limitCount: number
): Promise<UserData[]> {
  try {
    const rtdbRef = ref(db, 'USERS_EXTRA')
    const rtdbSnap = await get(rtdbRef)

    if (!rtdbSnap.exists()) {
      return []
    }

    const allUsers = rtdbSnap.val() as Record<string, UserData>
    const users: UserData[] = []
    const searchLower = searchTerm.trim().toLowerCase()

    Object.entries(allUsers).forEach(([userId, userData]) => {
      const userIdLower = userId.toLowerCase()
      if (userIdLower.startsWith(searchLower)) {
        users.push({
          ...userData,
          userId
        })
      }
    })

    // Sort by userId alphabetically แล้วเลือก top N
    users.sort((a, b) => a.userId.localeCompare(b.userId))
    return users.slice(0, limitCount)
  } catch (error: any) {
    console.error('Error searching users from RTDB:', error)
    return []
  }
}

/**
 * Real-time Listener for User Data - Firestore (fallback RTDB)
 * ✅ OPTIMIZED: เพิ่ม throttle และ cache เพื่อลด Firestore reads (รองรับ 10,000+ users)
 */
export function subscribeToUserData(
  userId: string,
  callback: (data: UserData | null) => void,
  options: {
    preferFirestore?: boolean // default: true
    fallbackRTDB?: boolean // default: false - ใช้ Firestore 100%
    throttleMs?: number // ✅ OPTIMIZED: throttle updates (default: 1000ms = 1 second)
    useCache?: boolean // ✅ OPTIMIZED: ใช้ cache เพื่อลด reads (default: true)
    cacheTTL?: number // ✅ OPTIMIZED: cache TTL ใน milliseconds (default: 60 seconds)
  } = {}
): () => void {
  const { preferFirestore = true, fallbackRTDB = false, throttleMs = 1000, useCache = true, cacheTTL = 60000 } = options

  let unsubscribeFirestore: (() => void) | null = null
  let unsubscribeRTDB: (() => void) | null = null
  let hasData = false
  let lastUpdateTime = 0
  let pendingUpdate: NodeJS.Timeout | null = null
  let latestData: UserData | null = null

  // ✅ OPTIMIZED: Throttled callback เพื่อลด Firestore reads
  const throttledCallback = (data: UserData | null) => {
    latestData = data
    
    // ✅ เก็บใน cache (ลด Firestore reads)
    if (useCache && data) {
      import('./cache').then(({ dataCache }) => {
        const cacheKey = `user:${userId}`
        dataCache.set(cacheKey, data, cacheTTL)
      })
    }
    
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTime
    
    // ถ้าเวลาผ่านไปพอแล้ว ให้ update ทันที
    if (timeSinceLastUpdate >= throttleMs) {
      lastUpdateTime = now
      callback(data)
    } else {
      // ไม่งั้น schedule update
      if (pendingUpdate) {
        clearTimeout(pendingUpdate)
      }
      pendingUpdate = setTimeout(() => {
        lastUpdateTime = Date.now()
        callback(latestData)
        pendingUpdate = null
      }, throttleMs - timeSinceLastUpdate)
    }
  }

  // ✅ Phase 2: ลอง Firestore ก่อน
  if (preferFirestore) {
    try {
      const firestoreRef = doc(firestore, 'users', userId)
      unsubscribeFirestore = onSnapshot(
        firestoreRef,
        (snap) => {
          if (snap.exists()) {
            hasData = true
            const data = snap.data() as UserData
            data.userId = snap.id
            // แปลง Timestamp เป็น number
            if (data.createdAt instanceof Timestamp) {
              data.createdAt = data.createdAt.toMillis()
            }
            if (data.updatedAt instanceof Timestamp) {
              data.updatedAt = data.updatedAt.toMillis()
            }
            throttledCallback(data)
          } else if (!hasData && fallbackRTDB) {
            // ✅ Fallback: ถ้าไม่มีใน Firestore ให้ลอง RTDB
            subscribeRTDB()
          } else {
            throttledCallback(null)
          }
        },
        (error) => {
          console.error(`Firestore listener error for user ${userId}:`, error)
          if (!hasData && fallbackRTDB) {
            subscribeRTDB()
          } else {
            throttledCallback(null)
          }
        }
      )
    } catch (error: any) {
      console.error(`Error setting up Firestore listener for user ${userId}:`, error)
      if (fallbackRTDB) {
        subscribeRTDB()
      } else {
        throttledCallback(null)
      }
    }
  } else if (fallbackRTDB) {
    subscribeRTDB()
  }

  function subscribeRTDB() {
    try {
      const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
      // ใช้ get() แทน onValue() เพื่อให้เหมือน Firestore behavior
      get(rtdbRef).then((snap) => {
        if (snap.exists()) {
          const data = snap.val() as UserData
          data.userId = userId
          callback(data)
        } else {
          callback(null)
        }
      })
      // RTDB get() ไม่มี unsubscribe แต่เราต้อง return function ว่าง
      unsubscribeRTDB = () => {}
    } catch (error: any) {
      console.error(`Error setting up RTDB listener for user ${userId}:`, error)
      callback(null)
      unsubscribeRTDB = () => {}
    }
  }

  // Return unsubscribe function
  return () => {
    if (pendingUpdate) {
      clearTimeout(pendingUpdate)
      pendingUpdate = null
    }
    if (unsubscribeFirestore) {
      unsubscribeFirestore()
    }
    if (unsubscribeRTDB) {
      unsubscribeRTDB()
    }
  }
}

/**
 * Phase 3: Migration Helper - Migrate user from RTDB to Firestore
 */
export async function migrateUserFromRTDB(userId: string): Promise<boolean> {
  try {
    // อ่านจาก RTDB
    const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
    const rtdbSnap = await get(rtdbRef)

    if (!rtdbSnap.exists()) {
      console.warn(`User ${userId} not found in RTDB`)
      return false
    }

    const userData = rtdbSnap.val() as UserData

    // เขียนไป Firestore
    const firestoreRef = doc(firestore, 'users', userId)
    const firestoreData = {
      ...userData,
      userId,
      // แปลง number timestamp เป็น Timestamp ถ้าจำเป็น
      createdAt: userData.createdAt 
        ? (typeof userData.createdAt === 'number' 
            ? Timestamp.fromMillis(userData.createdAt) 
            : userData.createdAt)
        : serverTimestamp(),
      updatedAt: userData.updatedAt
        ? (typeof userData.updatedAt === 'number'
            ? Timestamp.fromMillis(userData.updatedAt)
            : userData.updatedAt)
        : serverTimestamp()
    }

    await setDoc(firestoreRef, firestoreData, { merge: true })
    return true
  } catch (error: any) {
    console.error(`Error migrating user ${userId}:`, error)
    return false
  }
}

/**
 * Phase 3: Batch Migration - Migrate multiple users
 */
export async function migrateUsersBatch(
  userIds: string[],
  batchSize: number = 100
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  // Process in batches
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    
    const promises = batch.map(async (userId) => {
      try {
        const result = await migrateUserFromRTDB(userId)
        if (result) {
          success++
        } else {
          failed++
          errors.push(`User ${userId}: Not found in RTDB`)
        }
      } catch (error: any) {
        failed++
        errors.push(`User ${userId}: ${error.message}`)
      }
    })

    await Promise.all(promises)
    
    // Log progress
    console.log(`Migration progress: ${Math.min(i + batchSize, userIds.length)}/${userIds.length} users`)
  }

  return { success, failed, errors }
}

/**
 * Phase 1: Add Coins with Dual Write (RTDB + Firestore)
 * สำหรับใช้ใน CheckinGame และส่วนอื่นๆ ที่ต้องเพิ่ม hcoin
 */
export async function addUserHcoin(
  userId: string,
  amount: number,
  options: {
    useDualWrite?: boolean // deprecated - ใช้ Firestore 100%
    preferFirestore?: boolean // default: true
  } = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { useDualWrite = false, preferFirestore = true } = options

  try {
    // ✅ Phase 1: Dual Write - อ่าน balance จากทั้งสองที่
    let currentBalance = 0
    let newBalance = 0

    if (useDualWrite) {
      // อ่านจาก Firestore ก่อน
      try {
        const firestoreData = await getUserData(userId, {
          preferFirestore: true,
          fallbackRTDB: true
        })
        currentBalance = Number(firestoreData?.hcoin || 0)
      } catch (error: any) {
        console.error(`Error reading balance for user ${userId}:`, error)
      }

      newBalance = currentBalance + amount

      // ✅ เขียนทั้ง RTDB และ Firestore
      const rtdbRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
      await set(rtdbRef, newBalance)

      const firestoreRef = doc(firestore, 'users', userId)
      await setDoc(firestoreRef, {
        hcoin: newBalance,
        updatedAt: serverTimestamp()
      }, { merge: true })

      return { success: true, newBalance }
    } else {
      // Phase 2+: เขียน Firestore เท่านั้น (หรือ RTDB เท่านั้น)
      if (preferFirestore) {
        const firestoreData = await getUserData(userId, {
          preferFirestore: true,
          fallbackRTDB: false
        })
        currentBalance = Number(firestoreData?.hcoin || 0)
        newBalance = currentBalance + amount

        const firestoreRef = doc(firestore, 'users', userId)
        await setDoc(firestoreRef, {
          hcoin: newBalance,
          updatedAt: serverTimestamp()
        }, { merge: true })

        // ✅ OPTIMIZED: Invalidate cache เมื่อมีการอัพเดท hcoin
        const { dataCache } = await import('./cache')
        const cacheKey = `user:${userId}`
        dataCache.delete(cacheKey)

        return { success: true, newBalance }
      } else {
        // RTDB only (backward compatibility)
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
        const rtdbSnap = await get(rtdbRef)
        currentBalance = Number(rtdbSnap.val() || 0)
        newBalance = currentBalance + amount

        await set(rtdbRef, newBalance)
        return { success: true, newBalance }
      }
    }
  } catch (error: any) {
    console.error(`Error adding hcoin for user ${userId}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Phase 1: Transaction-based Add Coins (for race condition prevention)
 * ใช้ Firestore transaction สำหรับ Firestore, RTDB transaction สำหรับ RTDB
 */
export async function addUserHcoinWithTransaction(
  userId: string,
  amount: number,
  options: {
    useDualWrite?: boolean // deprecated - ใช้ Firestore 100%
    preferFirestore?: boolean // default: true
    allowNegative?: boolean // ✅ อนุญาตให้ amount เป็นค่าลบได้ (สำหรับหักเหรียญ) - default: false
  } = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { useDualWrite = false, preferFirestore = true, allowNegative = false } = options

  // ✅ ตรวจสอบว่า amount เป็นตัวเลขที่ถูกต้อง
  if (!Number.isFinite(amount)) {
    console.error(`Invalid amount for addUserHcoinWithTransaction: ${amount} (must be a finite number)`)
    return { success: false, error: 'INVALID_AMOUNT' }
  }

  // ✅ ถ้าไม่อนุญาตให้เป็นค่าลบ และ amount <= 0 ให้ reject
  if (!allowNegative && amount <= 0) {
    console.error(`Invalid amount for addUserHcoinWithTransaction: ${amount} (must be positive when allowNegative is false)`)
    return { success: false, error: 'INVALID_AMOUNT' }
  }

  try {
    if (useDualWrite) {
      // ✅ Phase 1: Dual Write with Transactions
      // RTDB Transaction
      const rtdbRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
      const rtdbResult = await rtdbRunTransaction(rtdbRef, (current: any) => {
        const currentBalance = Number(current || 0)
        const newBalance = currentBalance + amount
        // ✅ ป้องกัน balance ติดลบ (สำคัญมากเมื่อ allowNegative = true)
        if (newBalance < 0) {
          throw new Error('INSUFFICIENT_BALANCE')
        }
        return newBalance
      })

      // Firestore Transaction
      const firestoreRef = doc(firestore, 'users', userId)
      const firestoreResult = await firestoreRunTransaction(firestore, async (transaction) => {
        const userDoc = await transaction.get(firestoreRef)
        const currentBalance = userDoc.exists()
          ? Number(userDoc.data()?.hcoin || 0)
          : 0
        const newBalance = currentBalance + amount
        // ✅ ป้องกัน balance ติดลบ (สำคัญมากเมื่อ allowNegative = true)
        if (newBalance < 0) {
          throw new Error('INSUFFICIENT_BALANCE')
        }

        transaction.set(firestoreRef, {
          userId,
          hcoin: newBalance,
          updatedAt: serverTimestamp()
        }, { merge: true })

        return newBalance
      })

      // ✅ OPTIMIZED: Invalidate cache เมื่อมีการอัพเดท hcoin
      const { dataCache } = await import('./cache')
      const cacheKey = `user:${userId}`
      dataCache.delete(cacheKey)

      return {
        success: rtdbResult.committed && true,
        newBalance: firestoreResult
      }
    } else {
      // Phase 2+: Firestore transaction เท่านั้น (หรือ RTDB เท่านั้น)
      if (preferFirestore) {
        const firestoreRef = doc(firestore, 'users', userId)
        
        const newBalance = await firestoreRunTransaction(firestore, async (transaction) => {
          const userDoc = await transaction.get(firestoreRef)
          const currentBalance = userDoc.exists()
            ? Number(userDoc.data()?.hcoin || 0)
            : 0
          const newBalanceValue = currentBalance + amount
          // ✅ ป้องกัน balance ติดลบ (สำคัญมากเมื่อ allowNegative = true)
          if (newBalanceValue < 0) {
            throw new Error('INSUFFICIENT_BALANCE')
          }

          transaction.set(firestoreRef, {
            userId,
            hcoin: newBalanceValue,
            updatedAt: serverTimestamp()
          }, { merge: true })

          return newBalanceValue
        })

        // ✅ OPTIMIZED: Invalidate cache เมื่อมีการอัพเดท hcoin
        const { dataCache } = await import('./cache')
        const cacheKey = `user:${userId}`
        dataCache.delete(cacheKey)

        return { success: true, newBalance }
      } else {
        // RTDB transaction only
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
        const result = await rtdbRunTransaction(rtdbRef, (current: any) => {
          const currentBalance = Number(current || 0)
          const newBalance = currentBalance + amount
          // ✅ ป้องกัน balance ติดลบ (สำคัญมากเมื่อ allowNegative = true)
          if (newBalance < 0) {
            throw new Error('INSUFFICIENT_BALANCE')
          }
          return newBalance
        })

        return {
          success: result.committed,
          newBalance: result.snapshot.val()
        }
      }
    }
  } catch (error: any) {
    console.error(`Error adding hcoin with transaction for user ${userId}:`, error)
    // ✅ ตรวจสอบว่าเป็น error เกี่ยวกับ balance ไม่พอหรือไม่
    if (error.message === 'INSUFFICIENT_BALANCE' || error.code === 'INSUFFICIENT_BALANCE') {
      return { success: false, error: 'INSUFFICIENT_BALANCE' }
    }
    return { success: false, error: error.message || 'TRANSACTION_FAILED' }
  }
}

