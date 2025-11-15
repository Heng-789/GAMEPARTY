/**
 * Check-in Migration Service
 * Migrate ข้อมูลเก่าจาก RTDB ไป Firestore เพื่อรองรับ backward compatibility
 */

import { ref, get } from 'firebase/database'
import { db } from './firebase'
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { firestore } from './firebase'
import { CheckinData, CompleteRewardData } from './checkin-firestore'

/**
 * Migrate check-in data from RTDB to Firestore
 * ย้ายข้อมูลการเช็คอินจาก RTDB ไป Firestore
 */
export async function migrateCheckinFromRTDB(
  gameId: string,
  userId: string,
  dayIndex: number
): Promise<{ migrated: boolean; data?: CheckinData }> {
  try {
    // ✅ ตรวจสอบว่า Firestore มีข้อมูลแล้วหรือไม่
    const firestoreRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    const firestoreDoc = await getDoc(firestoreRef)
    
    if (firestoreDoc.exists()) {
      // ✅ Firestore มีข้อมูลแล้ว ไม่ต้อง migrate
      const data = firestoreDoc.data() as CheckinData
      return { migrated: false, data }
    }
    
    // ✅ อ่านข้อมูลจาก RTDB
    const rtdbRef = ref(db, `checkins/${gameId}/${userId}/${dayIndex}`)
    const rtdbSnap = await get(rtdbRef)
    const rtdbData = rtdbSnap.val()
    
    if (!rtdbData) {
      // ✅ RTDB ไม่มีข้อมูล ไม่ต้อง migrate
      return { migrated: false }
    }
    
    // ✅ ตรวจสอบว่าเป็นข้อมูลที่เช็คอินแล้วหรือไม่
    const isChecked = rtdbData === true || (rtdbData && rtdbData.checked === true)
    
    if (!isChecked) {
      // ✅ ยังไม่เช็คอิน ไม่ต้อง migrate
      return { migrated: false }
    }
    
    // ✅ Migrate ข้อมูลไป Firestore
    // ✅ สำคัญ: ต้องตรวจสอบ timestamp เพื่อดูว่าเช็คอินไปแล้วจริงๆ หรือไม่
    // ✅ ถ้า date เป็นวันปัจจุบัน แต่ timestamp เป็นวันนี้ (เช็คอินไปแล้ว) → checked = true
    // ✅ ถ้า date เป็นวันปัจจุบัน แต่ timestamp เป็นวันอื่น (ข้อมูลเก่า) → checked = false
    // ✅ ถ้า date เป็นวันอื่น → checked = true (เช็คอินไปแล้ว)
    const rtdbDate = rtdbData.date || new Date().toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    const isToday = rtdbDate === today
    
    // ✅ ตรวจสอบ timestamp เพื่อดูว่าเช็คอินไปแล้วจริงๆ หรือไม่
    const rtdbTs = rtdbData.ts 
      ? (typeof rtdbData.ts === 'number' ? rtdbData.ts : Date.now())
      : Date.now()
    const tsDate = new Date(rtdbTs).toISOString().split('T')[0]
    const tsIsToday = tsDate === today
    
    // ✅ ถ้า date เป็นวันนี้ และ timestamp เป็นวันนี้ แสดงว่าเช็คอินไปแล้วในวันนี้ → checked = true
    // ✅ ถ้า date เป็นวันนี้ แต่ timestamp เป็นวันอื่น แสดงว่าเป็นข้อมูลเก่า → checked = false
    // ✅ ถ้า date เป็นวันอื่น แสดงว่าเช็คอินไปแล้ว → checked = true
    const shouldBeChecked = isToday ? tsIsToday : true
    
    const checkinData: CheckinData = {
      checked: shouldBeChecked, // ✅ ตรวจสอบจาก timestamp เพื่อป้องกันการเช็คอินซ้ำ
      date: rtdbDate, // ใช้ date จาก RTDB
      ts: Timestamp.fromMillis(rtdbTs),
      key: rtdbData.key || `${rtdbTs}_migrated`,
      createdAt: Timestamp.now()
    }
    
    await setDoc(firestoreRef, checkinData)
    
    // ✅ Cache migration status
    const { setMigrationCache } = await import('./checkin-cache')
    setMigrationCache(gameId, userId, dayIndex, true)
    
    return { migrated: true, data: checkinData }
  } catch (error) {
    console.error('Error migrating checkin from RTDB to Firestore:', error)
    return { migrated: false }
  }
}

/**
 * Migrate complete reward data from RTDB to Firestore
 * ย้ายข้อมูล complete reward จาก RTDB ไป Firestore
 */
export async function migrateCompleteRewardFromRTDB(
  gameId: string,
  userId: string
): Promise<{ migrated: boolean; data?: CompleteRewardData }> {
  try {
    // ✅ ตรวจสอบว่า Firestore มีข้อมูลแล้วหรือไม่
    const firestoreRef = doc(firestore, `checkins/${gameId}/users/${userId}/rewards/completeReward`)
    const firestoreDoc = await getDoc(firestoreRef)
    
    if (firestoreDoc.exists()) {
      // ✅ Firestore มีข้อมูลแล้ว ไม่ต้อง migrate
      const data = firestoreDoc.data() as CompleteRewardData
      return { migrated: false, data }
    }
    
    // ✅ อ่านข้อมูลจาก RTDB
    const rtdbRef = ref(db, `checkins/${gameId}/${userId}/completeRewardClaimed`)
    const rtdbSnap = await get(rtdbRef)
    const rtdbData = rtdbSnap.val()
    
    if (!rtdbData) {
      // ✅ RTDB ไม่มีข้อมูล ไม่ต้อง migrate
      return { migrated: false }
    }
    
    // ✅ ตรวจสอบว่าเป็นข้อมูลที่ claim แล้วหรือไม่
    const isClaimed = rtdbData === true || (rtdbData && rtdbData.claimed === true)
    
    if (!isClaimed) {
      // ✅ ยังไม่ claim ไม่ต้อง migrate
      return { migrated: false }
    }
    
    // ✅ Migrate ข้อมูลไป Firestore
    const completeRewardData: CompleteRewardData = {
      claimed: true,
      ts: rtdbData.ts 
        ? Timestamp.fromMillis(typeof rtdbData.ts === 'number' ? rtdbData.ts : Date.now())
        : Timestamp.now(),
      key: rtdbData.key || `${rtdbData.ts || Date.now()}_migrated`,
      createdAt: Timestamp.now()
    }
    
    await setDoc(firestoreRef, completeRewardData)
    
    return { migrated: true, data: completeRewardData }
  } catch (error) {
    console.error('Error migrating complete reward from RTDB to Firestore:', error)
    return { migrated: false }
  }
}

/**
 * Migrate all check-in data for a user
 * Migrate ข้อมูลการเช็คอินทั้งหมดของ user
 */
export async function migrateAllCheckinsForUser(
  gameId: string,
  userId: string,
  maxDays: number = 30
): Promise<{ migrated: number; total: number }> {
  let migratedCount = 0
  let totalChecked = 0
  
  try {
    // ✅ ตรวจสอบ cache ก่อน เพื่อลดการอ่าน Firestore
    const { isMigrationCached } = await import('./checkin-cache')
    
    // ✅ Migrate แต่ละวัน (เฉพาะที่ยังไม่ได้ migrate)
    for (let dayIndex = 0; dayIndex < maxDays; dayIndex++) {
      // ✅ ตรวจสอบ cache ก่อน
      if (isMigrationCached(gameId, userId, dayIndex)) {
        // ✅ มี cache แล้ว ไม่ต้อง migrate
        continue
      }
      
      const result = await migrateCheckinFromRTDB(gameId, userId, dayIndex)
      if (result.migrated) {
        migratedCount++
      }
      if (result.data?.checked === true) {
        totalChecked++
      }
    }
    
    // ✅ Migrate complete reward (ตรวจสอบ cache ก่อน)
    // TODO: เพิ่ม cache สำหรับ complete reward
    
    return { migrated: migratedCount, total: totalChecked }
  } catch (error) {
    console.error('Error migrating all checkins for user:', error)
    return { migrated: migratedCount, total: totalChecked }
  }
}

/**
 * Check if migration is needed
 * ตรวจสอบว่าต้อง migrate หรือไม่ (ใช้ cache เพื่อลดการอ่าน Firestore)
 */
export async function checkMigrationNeeded(
  gameId: string,
  userId: string,
  dayIndex: number
): Promise<boolean> {
  try {
    // ✅ ตรวจสอบ cache ก่อน
    const { isMigrationCached, setMigrationCache } = await import('./checkin-cache')
    if (isMigrationCached(gameId, userId, dayIndex)) {
      // ✅ มี cache แล้ว ไม่ต้องตรวจสอบอีก (ถ้า migrate แล้วจะไม่ต้อง migrate ซ้ำ)
      return false
    }
    
    // ✅ ตรวจสอบว่า Firestore มีข้อมูลแล้วหรือไม่
    const firestoreRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    const firestoreDoc = await getDoc(firestoreRef)
    
    if (firestoreDoc.exists()) {
      // ✅ Firestore มีข้อมูลแล้ว ไม่ต้อง migrate
      setMigrationCache(gameId, userId, dayIndex, false)
      return false
    }
    
    // ✅ ตรวจสอบว่า RTDB มีข้อมูลหรือไม่
    const rtdbRef = ref(db, `checkins/${gameId}/${userId}/${dayIndex}`)
    const rtdbSnap = await get(rtdbRef)
    const rtdbData = rtdbSnap.val()
    
    if (!rtdbData) {
      // ✅ RTDB ไม่มีข้อมูล ไม่ต้อง migrate
      setMigrationCache(gameId, userId, dayIndex, false)
      return false
    }
    
    // ✅ ตรวจสอบว่าเป็นข้อมูลที่เช็คอินแล้วหรือไม่
    const isChecked = rtdbData === true || (rtdbData && rtdbData.checked === true)
    
    if (!isChecked) {
      setMigrationCache(gameId, userId, dayIndex, false)
      return false
    }
    
    // ✅ ต้อง migrate
    return true
  } catch (error) {
    console.error('Error checking migration needed:', error)
    return false
  }
}

