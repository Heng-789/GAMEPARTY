// ตัวอย่างการใช้งาน Firestore
// ไฟล์นี้เป็นตัวอย่างเท่านั้น ไม่ได้ถูกใช้งานจริง

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { firestore } from './firebase-theme'

// ============================================
// ตัวอย่าง: บันทึกข้อมูลด้วย serverTimestamp()
// ============================================
export async function saveCheckinWithServerTime(
  gameId: string, 
  userId: string, 
  dayIndex: number
) {
  try {
    const checkinRef = doc(firestore, 'checkins', `${gameId}_${userId}_${dayIndex}`)
    
    await setDoc(checkinRef, {
      gameId,
      userId,
      dayIndex,
      checked: true,
      // ✅ ใช้ serverTimestamp() เพื่อป้องกันการปรับเวลา
      checkinDate: serverTimestamp(),
      createdAt: serverTimestamp()
    })
    
    console.log('Checkin saved with server timestamp')
  } catch (error) {
    console.error('Error saving checkin:', error)
    throw error
  }
}

// ============================================
// ตัวอย่าง: อ่านข้อมูล
// ============================================
export async function getCheckinData(
  gameId: string, 
  userId: string, 
  dayIndex: number
) {
  try {
    const checkinRef = doc(firestore, 'checkins', `${gameId}_${userId}_${dayIndex}`)
    const checkinSnap = await getDoc(checkinRef)
    
    if (checkinSnap.exists()) {
      const data = checkinSnap.data()
      // ✅ แปลง Timestamp เป็น Date
      const checkinDate = data.checkinDate?.toDate()
      return {
        ...data,
        checkinDate
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting checkin:', error)
    throw error
  }
}

// ============================================
// ตัวอย่าง: Query ข้อมูล
// ============================================
export async function getCheckinsByUser(
  gameId: string, 
  userId: string
) {
  try {
    const checkinsRef = collection(firestore, 'checkins')
    const q = query(
      checkinsRef,
      where('gameId', '==', gameId),
      where('userId', '==', userId),
      orderBy('dayIndex', 'asc')
    )
    
    const querySnapshot = await getDocs(q)
    const checkins: any[] = []
    
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      checkins.push({
        id: doc.id,
        ...data,
        checkinDate: data.checkinDate?.toDate()
      })
    })
    
    return checkins
  } catch (error) {
    console.error('Error getting checkins:', error)
    throw error
  }
}

// ============================================
// ตัวอย่าง: ใช้ serverTimestamp() เพื่อตรวจสอบวันที่
// ============================================
export async function getServerDate(): Promise<string> {
  try {
    // ✅ วิธีที่ 1: สร้าง temporary document เพื่อดึง server timestamp
    const tempRef = doc(collection(firestore, '_temp'))
    await setDoc(tempRef, { timestamp: serverTimestamp() })
    
    const tempSnap = await getDoc(tempRef)
    const timestamp = tempSnap.data()?.timestamp as Timestamp
    
    // ✅ ลบ temporary document
    await deleteDoc(tempRef)
    
    if (timestamp) {
      const date = timestamp.toDate()
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    throw new Error('Failed to get server timestamp')
  } catch (error) {
    console.error('Error getting server date:', error)
    throw error
  }
}

// ============================================
// ตัวอย่าง: อัพเดทข้อมูล
// ============================================
export async function updateCheckin(
  gameId: string, 
  userId: string, 
  dayIndex: number,
  updates: any
) {
  try {
    const checkinRef = doc(firestore, 'checkins', `${gameId}_${userId}_${dayIndex}`)
    await updateDoc(checkinRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating checkin:', error)
    throw error
  }
}

// ============================================
// ตัวอย่าง: ลบข้อมูล
// ============================================
export async function deleteCheckin(
  gameId: string, 
  userId: string, 
  dayIndex: number
) {
  try {
    const checkinRef = doc(firestore, 'checkins', `${gameId}_${userId}_${dayIndex}`)
    await deleteDoc(checkinRef)
  } catch (error) {
    console.error('Error deleting checkin:', error)
    throw error
  }
}

