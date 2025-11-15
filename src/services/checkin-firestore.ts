/**
 * Firestore Service for Check-in System
 * ใช้ Firestore สำหรับ critical operations เพื่อป้องกัน race condition
 */

import { firestore } from './firebase'
import { 
  doc, 
  runTransaction, 
  serverTimestamp, 
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore'

export interface CheckinData {
  checked: boolean
  date: string
  ts: Timestamp
  key?: string
  createdAt?: Timestamp
}

export interface CompleteRewardData {
  claimed: boolean
  ts: Timestamp
  key?: string
  createdAt?: Timestamp
}

/**
 * Get server date from Firestore
 * ใช้ Firestore serverTimestamp เพื่อรับวันที่จาก server
 * รูปแบบวันที่จะใช้ local timezone เหมือนกับ dkey() ใน CheckinGame.tsx
 */
async function getServerDate(): Promise<string> {
  try {
    // ✅ ใช้ Firestore serverTimestamp เพื่อรับวันที่จาก server
    // ✅ สร้าง temporary document เพื่ออ่าน serverTimestamp
    const tempRef = doc(firestore, '_temp/serverDate')
    await setDoc(tempRef, { ts: serverTimestamp() })
    const tempDoc = await getDoc(tempRef)
    const tempData = tempDoc.data()
    if (tempData?.ts) {
      const serverTs = tempData.ts as Timestamp
      // ✅ แปลง Timestamp เป็น Date object (ใช้ local timezone)
      const serverDateObj = serverTs.toDate()
      // ✅ ใช้ local timezone formatting เหมือนกับ dkey() ใน CheckinGame.tsx
      // ✅ เพื่อให้วันที่ตรงกันแม้ว่าจะอยู่ใน timezone ที่ต่างจาก UTC
      const y = serverDateObj.getFullYear()
      const m = String(serverDateObj.getMonth() + 1).padStart(2, '0')
      const dd = String(serverDateObj.getDate()).padStart(2, '0')
      const serverDate = `${y}-${m}-${dd}`
      // ✅ ลบ temporary document
      try {
        await deleteDoc(tempRef)
      } catch (error) {
        // Ignore delete error
      }
      return serverDate
    }
  } catch (error) {
    console.error('Error getting server date:', error)
  }
  // ✅ Fallback: ใช้ client date (format เหมือน dkey())
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Check-in with Firestore transaction
 * ใช้ Firestore transaction เพื่อป้องกัน race condition
 */
export async function checkinWithFirestore(
  gameId: string,
  userId: string,
  dayIndex: number,
  serverDate: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // ✅ ตรวจสอบว่า serverDate ตรงกับวันที่ปัจจุบันจาก server หรือไม่
    // ✅ เพื่อป้องกันการเช็คอินด้วยวันที่ผิด (เช่น วันที่วานหรืออนาคต)
    const actualServerDate = await getServerDate()
    if (serverDate !== actualServerDate) {
      // ✅ ถ้า serverDate ไม่ตรงกับวันที่ปัจจุบันจาก server ให้ reject
      return { success: false, error: 'INVALID_DATE' }
    }
    
    const checkinRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    
    // ✅ Firestore transaction จะ retry อัตโนมัติเมื่อมี conflict
    // ✅ แต่ถ้ามี transaction หลายตัวทำงานพร้อมกัน อาจผ่านได้หลายตัว
    // ✅ ดังนั้นต้องใช้ uniqueKey เพื่อตรวจสอบอีกครั้งหลัง transaction
    let transactionSuccess = false
    let retryCount = 0
    const maxRetries = 5
    
    while (!transactionSuccess && retryCount < maxRetries) {
      try {
        await runTransaction(firestore, async (transaction) => {
          const checkinDoc = await transaction.get(checkinRef)
          const data = checkinDoc.data() as CheckinData | undefined
          
          // ✅ ตรวจสอบว่ามีการเช็คอินแล้วหรือไม่
          if (data?.checked === true) {
            // ✅ ถ้าเคยเช็คอินแล้ว และ date เป็นวันเดียวกันกับ serverDate
            // ✅ แสดงว่าเช็คอินวันนี้แล้ว
            if (data.date === serverDate) {
              throw new Error('ALREADY_CHECKED_IN_TODAY')
            }
            // ✅ ถ้าเคยเช็คอินแล้ว แต่ date ไม่ตรงกับ serverDate
            // ✅ อาจเป็นข้อมูลเก่า ให้ throw error เพื่อให้ transaction fail
            throw new Error('ALREADY_CHECKED_IN')
          }
          
          // ✅ ตรวจสอบว่ามี date เป็นวันเดียวกันหรือไม่ (แต่ยังไม่ checked)
          // ✅ ถ้ามี date เป็นวันเดียวกัน แต่ยังไม่ checked แสดงว่าเป็นข้อมูลเก่าที่ migrate มา
          // ✅ ให้อนุญาตให้เช็คอินได้ (จะเขียนทับข้อมูลเก่า)
          if (data?.date === serverDate && !data?.checked) {
            // ✅ ข้อมูลเก่าที่ migrate มา (มี date แต่ยังไม่ checked) ให้อนุญาตให้เช็คอินได้
            // ✅ จะเขียนทับข้อมูลเก่า
          }
          
          // ✅ ตรวจสอบว่า uniqueKey ตรงกับที่เราสร้างหรือไม่ (ป้องกัน duplicate)
          if (data?.key && data.key !== uniqueKey && data?.checked) {
            // ✅ พบว่า transaction อื่นทำไปแล้วก่อนเรา
            throw new Error('ALREADY_CHECKED_IN')
          }
          
          // ✅ บันทึกการเช็คอิน
          transaction.set(checkinRef, {
            checked: true,
            date: serverDate,
            ts: serverTimestamp(),
            key: uniqueKey,
            createdAt: serverTimestamp()
          } as CheckinData)
        })
        
        transactionSuccess = true
      } catch (error: any) {
        // ✅ ถ้า error เป็น ALREADY_CHECKED_IN หรือ ALREADY_CHECKED_IN_TODAY ให้ return ทันที
        if (error.message === 'ALREADY_CHECKED_IN' || error.message === 'ALREADY_CHECKED_IN_TODAY') {
          throw error
        }
        
        // ✅ ถ้า error เป็น conflict ให้ retry
        if (error.code === 'failed-precondition' || error.code === 'aborted') {
          retryCount++
          // ✅ รอสักครู่ก่อน retry
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount))
          continue
        }
        
        // ✅ Error อื่นๆ ให้ throw
        throw error
      }
    }
    
    if (!transactionSuccess) {
      return { success: false, error: 'TRANSACTION_FAILED_MAX_RETRIES' }
    }
    
    // ✅ ตรวจสอบอีกครั้งหลัง transaction เพื่อยืนยัน
    const verifyResult = await verifyCheckin(gameId, userId, dayIndex, uniqueKey)
    if (!verifyResult.verified) {
      // ✅ Transaction อื่นทำไปแล้วก่อนเรา
      await rollbackCheckin(gameId, userId, dayIndex)
      return { success: false, error: 'ANOTHER_TRANSACTION_SUCCEEDED' }
    }
    
    // ✅ Clear cache เมื่อเช็คอินสำเร็จ
    try {
      const { clearCheckinCache } = await import('./checkin-cache')
      clearCheckinCache(gameId, userId, dayIndex)
    } catch (error) {
      // Ignore cache clear errors
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Checkin Firestore transaction error:', error)
    
    // ✅ ตรวจสอบ error code
    if (error.code === 'permission-denied') {
      return { success: false, error: 'PERMISSION_DENIED' }
    }
    
    if (error.message === 'ALREADY_CHECKED_IN' || error.message === 'ALREADY_CHECKED_IN_TODAY') {
      return { success: false, error: error.message }
    }
    
    // ✅ Firestore transaction จะ retry อัตโนมัติเมื่อมี conflict
    // ✅ ถ้า retry แล้วยังล้มเหลว แสดงว่ามี transaction อื่นทำไปแล้ว
    // ✅ หรือมี error อื่นๆ
    return { success: false, error: 'TRANSACTION_FAILED' }
  }
}

/**
 * Verify check-in after transaction
 * ตรวจสอบว่า transaction ที่ทำสำเร็จเป็นของเราจริงๆ
 */
export async function verifyCheckin(
  gameId: string,
  userId: string,
  dayIndex: number,
  uniqueKey: string
): Promise<{ verified: boolean; data?: CheckinData }> {
  try {
    const checkinRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    const checkinDoc = await getDoc(checkinRef)
    
    if (!checkinDoc.exists()) {
      return { verified: false }
    }
    
    const data = checkinDoc.data() as CheckinData
    
    // ✅ ตรวจสอบว่า uniqueKey ตรงกับที่เราสร้างหรือไม่
    if (data.key !== uniqueKey) {
      return { verified: false, data }
    }
    
    return { verified: true, data }
  } catch (error) {
    console.error('Verify checkin error:', error)
    return { verified: false }
  }
}

/**
 * Claim complete reward with Firestore transaction
 * ใช้ Firestore transaction เพื่อป้องกัน race condition
 */
export async function claimCompleteRewardWithFirestore(
  gameId: string,
  userId: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // ✅ Firestore path ต้องมีจำนวน segments เป็นเลขคู่ (collection/document/collection/document)
    // ✅ เดิม: checkins/{gameId}/users/{userId}/completeReward = 5 segments ❌
    // ✅ ใหม่: checkins/{gameId}/users/{userId}/rewards/completeReward = 6 segments ✅
    const claimedRef = doc(firestore, `checkins/${gameId}/users/${userId}/rewards/completeReward`)
    
    // ✅ Firestore transaction จะ retry อัตโนมัติเมื่อมี conflict
    let transactionSuccess = false
    let retryCount = 0
    const maxRetries = 5
    
    while (!transactionSuccess && retryCount < maxRetries) {
      try {
        await runTransaction(firestore, async (transaction) => {
          const claimedDoc = await transaction.get(claimedRef)
          const data = claimedDoc.data() as CompleteRewardData | undefined
          
          // ✅ ตรวจสอบว่ามีการเคลมแล้วหรือไม่
          if (data?.claimed === true) {
            throw new Error('ALREADY_CLAIMED')
          }
          
          // ✅ ตรวจสอบว่า uniqueKey ตรงกับที่เราสร้างหรือไม่ (ป้องกัน duplicate)
          if (data?.key && data.key !== uniqueKey) {
            // ✅ พบว่า transaction อื่นทำไปแล้วก่อนเรา
            throw new Error('ALREADY_CLAIMED')
          }
          
          // ✅ บันทึกการเคลม
          transaction.set(claimedRef, {
            claimed: true,
            ts: serverTimestamp(),
            key: uniqueKey,
            createdAt: serverTimestamp()
          } as CompleteRewardData)
        })
        
        transactionSuccess = true
      } catch (error: any) {
        // ✅ ถ้า error เป็น ALREADY_CLAIMED ให้ return ทันที
        if (error.message === 'ALREADY_CLAIMED') {
          throw error
        }
        
        // ✅ ถ้า error เป็น conflict ให้ retry
        if (error.code === 'failed-precondition' || error.code === 'aborted') {
          retryCount++
          // ✅ รอสักครู่ก่อน retry
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount))
          continue
        }
        
        // ✅ Error อื่นๆ ให้ throw
        throw error
      }
    }
    
    if (!transactionSuccess) {
      return { success: false, error: 'TRANSACTION_FAILED_MAX_RETRIES' }
    }
    
    // ✅ ตรวจสอบอีกครั้งหลัง transaction เพื่อยืนยัน
    const verifyResult = await verifyCompleteReward(gameId, userId, uniqueKey)
    if (!verifyResult.verified) {
      // ✅ Transaction อื่นทำไปแล้วก่อนเรา
      await rollbackCompleteReward(gameId, userId)
      return { success: false, error: 'ANOTHER_TRANSACTION_SUCCEEDED' }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Claim complete reward Firestore transaction error:', error)
    
    // ✅ ตรวจสอบ error code
    if (error.code === 'permission-denied') {
      return { success: false, error: 'PERMISSION_DENIED' }
    }
    
    if (error.message === 'ALREADY_CLAIMED') {
      return { success: false, error: error.message }
    }
    
    return { success: false, error: 'TRANSACTION_FAILED' }
  }
}

/**
 * Verify complete reward claim
 * ตรวจสอบว่า transaction ที่ทำสำเร็จเป็นของเราจริงๆ
 */
export async function verifyCompleteReward(
  gameId: string,
  userId: string,
  uniqueKey: string
): Promise<{ verified: boolean; data?: CompleteRewardData }> {
  try {
    // ✅ Firestore path ต้องมีจำนวน segments เป็นเลขคู่ (collection/document/collection/document)
    // ✅ เดิม: checkins/{gameId}/users/{userId}/completeReward = 5 segments ❌
    // ✅ ใหม่: checkins/{gameId}/users/{userId}/rewards/completeReward = 6 segments ✅
    const claimedRef = doc(firestore, `checkins/${gameId}/users/${userId}/rewards/completeReward`)
    const claimedDoc = await getDoc(claimedRef)
    
    if (!claimedDoc.exists()) {
      return { verified: false }
    }
    
    const data = claimedDoc.data() as CompleteRewardData
    
    // ✅ ตรวจสอบว่า uniqueKey ตรงกับที่เราสร้างหรือไม่
    if (data.key !== uniqueKey) {
      return { verified: false, data }
    }
    
    return { verified: true, data }
  } catch (error) {
    console.error('Verify complete reward error:', error)
    return { verified: false }
  }
}

/**
 * Get check-in status from Firestore
 * อ่านสถานะการเช็คอินจาก Firestore (ใช้ cache เพื่อลดการอ่าน)
 */
export async function getCheckinStatus(
  gameId: string,
  userId: string,
  dayIndex: number
): Promise<CheckinData | null> {
  try {
    // ✅ ตรวจสอบ cache ก่อน
    const { getCheckinCache, setCheckinCache } = await import('./checkin-cache')
    const cached = getCheckinCache(gameId, userId, dayIndex)
    if (cached !== null) {
      return cached as CheckinData | null
    }
    
    const checkinRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    const checkinDoc = await getDoc(checkinRef)
    
    if (!checkinDoc.exists()) {
      setCheckinCache(gameId, userId, dayIndex, null)
      return null
    }
    
    const data = checkinDoc.data() as CheckinData
    setCheckinCache(gameId, userId, dayIndex, data)
    return data
  } catch (error) {
    console.error('Get checkin status error:', error)
    return null
  }
}

/**
 * Get all check-ins for a user
 * อ่านการเช็คอินทั้งหมดของ user (ใช้ cache และอ่านเฉพาะที่จำเป็น)
 */
export async function getAllCheckins(
  gameId: string,
  userId: string,
  maxDays?: number
): Promise<Record<number, CheckinData>> {
  try {
    // ✅ ใช้ RTDB เป็น primary source (เร็วกว่าและใช้ real-time listener)
    // ✅ อ่านจาก Firestore เฉพาะเมื่อจำเป็น (เช่น เมื่อเช็คอิน)
    // ✅ สำหรับการแสดงผล ใช้ RTDB listener ที่มีอยู่แล้ว
    
    // ✅ อ่านเฉพาะวันที่จำเป็น (ไม่ต้องอ่านทั้งหมด 30 วัน)
    const checkins: Record<number, CheckinData> = {}
    const daysToCheck = maxDays || 30
    
    // ✅ อ่านแบบ parallel แต่ใช้ cache
    const promises = []
    for (let i = 0; i < daysToCheck; i++) {
      promises.push(
        getCheckinStatus(gameId, userId, i).then(data => {
          if (data && data.checked === true) {
            checkins[i] = data
          }
        })
      )
    }
    
    await Promise.all(promises)
    return checkins
  } catch (error) {
    console.error('Get all checkins error:', error)
    return {}
  }
}

/**
 * Rollback check-in
 * ลบการเช็คอิน (ใช้เมื่อ transaction ล้มเหลว)
 */
export async function rollbackCheckin(
  gameId: string,
  userId: string,
  dayIndex: number
): Promise<void> {
  try {
    const checkinRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    await setDoc(checkinRef, { checked: false }, { merge: true })
    // ✅ หรือลบ document ทั้งหมด
    // await deleteDoc(checkinRef)
  } catch (error) {
    console.error('Rollback checkin error:', error)
  }
}

/**
 * Rollback complete reward claim
 * ลบการเคลมรางวัล (ใช้เมื่อ transaction ล้มเหลว)
 */
export async function rollbackCompleteReward(
  gameId: string,
  userId: string
): Promise<void> {
  try {
    // ✅ Firestore path ต้องมีจำนวน segments เป็นเลขคู่ (collection/document/collection/document)
    // ✅ เดิม: checkins/{gameId}/users/{userId}/completeReward = 5 segments ❌
    // ✅ ใหม่: checkins/{gameId}/users/{userId}/rewards/completeReward = 6 segments ✅
    const claimedRef = doc(firestore, `checkins/${gameId}/users/${userId}/rewards/completeReward`)
    await setDoc(claimedRef, { claimed: false }, { merge: true })
    // ✅ หรือลบ document ทั้งหมด
    // await deleteDoc(claimedRef)
  } catch (error) {
    console.error('Rollback complete reward error:', error)
  }
}

/**
 * Get complete reward status
 * อ่านสถานะ complete reward จาก Firestore
 */
export async function getCompleteRewardStatus(
  gameId: string,
  userId: string
): Promise<CompleteRewardData | null> {
  try {
    const claimedRef = doc(firestore, `checkins/${gameId}/users/${userId}/rewards/completeReward`)
    const claimedDoc = await getDoc(claimedRef)
    
    if (!claimedDoc.exists()) {
      return null
    }
    
    return claimedDoc.data() as CompleteRewardData
  } catch (error) {
    console.error('Get complete reward status error:', error)
    return null
  }
}

