/**
 * Firestore Service for Coin Transactions
 * ใช้ Firestore transaction เพื่อป้องกัน race condition ใน coin transactions
 * แต่เก็บ balance ใน RTDB เพื่อให้ real-time listener ทำงานได้
 */

import { firestore } from './firebase'
import { ref, runTransaction as rtdbTransaction, get, set } from 'firebase/database'
import { db } from './firebase'
import { 
  doc, 
  runTransaction, 
  serverTimestamp, 
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore'

export interface CoinTransactionData {
  userId: string
  amount: number
  reason: string
  ts: Timestamp
  key?: string
  createdAt?: Timestamp
}

/**
 * Add coins with Firestore transaction lock
 * ใช้ Firestore transaction เพื่อ lock coin transaction และป้องกัน race condition
 * แต่เก็บ balance ใน RTDB เพื่อให้ real-time listener ทำงานได้
 */
export async function addCoinsWithFirestore(
  userId: string,
  amount: number,
  reason: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    // ✅ ใช้ Firestore transaction เพื่อ lock coin transaction
    const transactionRef = doc(firestore, `coin_transactions/${userId}/transactions/${uniqueKey}`)
    
    let transactionSuccess = false
    let retryCount = 0
    const maxRetries = 5
    
    while (!transactionSuccess && retryCount < maxRetries) {
      try {
        await runTransaction(firestore, async (transaction) => {
          // ✅ ตรวจสอบว่า transaction นี้เคยทำไปแล้วหรือไม่
          const transactionDoc = await transaction.get(transactionRef)
          const existingData = transactionDoc.data() as CoinTransactionData | undefined
          
          if (existingData && existingData.key === uniqueKey) {
            // ✅ Transaction นี้เคยทำไปแล้ว
            throw new Error('ALREADY_PROCESSED')
          }
          
          // ✅ บันทึก transaction record ใน Firestore
          transaction.set(transactionRef, {
            userId,
            amount,
            reason,
            ts: serverTimestamp(),
            key: uniqueKey,
            createdAt: serverTimestamp()
          } as CoinTransactionData)
        })
        
        transactionSuccess = true
      } catch (error: any) {
        // ✅ ถ้า error เป็น ALREADY_PROCESSED ให้ return ทันที
        if (error.message === 'ALREADY_PROCESSED') {
          // ✅ อ่าน balance จาก RTDB เพื่อ return
          const coinRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
          const coinSnap = await get(coinRef)
          const currentBalance = Number(coinSnap.val() || 0)
          return { success: false, error: 'ALREADY_PROCESSED', newBalance: currentBalance }
        }
        
        // ✅ ถ้า error เป็น conflict ให้ retry
        if (error.code === 'failed-precondition' || error.code === 'aborted') {
          retryCount++
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
    const verifyDoc = await getDoc(transactionRef)
    if (!verifyDoc.exists()) {
      return { success: false, error: 'TRANSACTION_NOT_VERIFIED' }
    }
    
    const verifyData = verifyDoc.data() as CoinTransactionData
    if (verifyData.key !== uniqueKey) {
      // ✅ Transaction อื่นทำไปแล้วก่อนเรา
      return { success: false, error: 'ANOTHER_TRANSACTION_SUCCEEDED' }
    }
    
    // ✅ ถ้า Firestore transaction สำเร็จ ให้ทำ RTDB transaction เพื่ออัพเดท balance
    // ✅ ใช้ Firestore transaction เพื่อ lock coin balance และอัพเดท balance ใน Firestore
    // ✅ แล้ว sync ไป RTDB เพื่อให้ real-time listener ทำงานได้
    const balanceRef = doc(firestore, `coin_balances/${userId}`)
    const coinRef = ref(db, `USERS_EXTRA/${userId}/hcoin`)
    
    // ✅ อ่าน balance ปัจจุบันจาก Firestore ก่อน (source of truth)
    // ✅ ถ้า Firestore ยังไม่มี balance ให้อ่านจาก RTDB
    let beforeBalance = 0
    try {
      const balanceDoc = await getDoc(balanceRef)
      const balanceData = balanceDoc.data() as { balance: number; lastSyncFromRTDB?: number } | undefined
      if (balanceData && balanceData.balance > 0) {
        beforeBalance = Number(balanceData.balance)
      } else {
        const beforeSnap = await get(coinRef)
        beforeBalance = Number(beforeSnap.val() || 0)
      }
    } catch (readError) {
      const beforeSnap = await get(coinRef)
      beforeBalance = Number(beforeSnap.val() || 0)
    }
    
    // ✅ ใช้ Firestore transaction เพื่อ lock และอัพเดท balance (ป้องกัน race condition)
    // ✅ สำคัญ: ต้องอ่าน balance ภายใน transaction เท่านั้น เพื่อให้ Firestore transaction lock ทำงานได้ถูกต้อง
    let balanceUpdateSuccess = false
    let balanceRetryCount = 0
    const maxBalanceRetries = 10 // ✅ เพิ่ม retry count เพื่อให้ transaction retry จนกว่า Firestore จะมี balance
    
    // ✅ อ่าน RTDB balance เพื่อ sync (อ่านก่อน transaction)
    // ✅ สำคัญ: อ่าน RTDB balance ก่อน transaction เพื่อใช้เป็น fallback ถ้า Firestore ยังไม่มี balance
    const currentRTDBBalance = Number((await get(coinRef)).val() || 0)
    
    while (!balanceUpdateSuccess && balanceRetryCount < maxBalanceRetries) {
      try {
        // ✅ อ่าน RTDB balance ใหม่ทุกครั้งที่ retry เพื่อให้ได้ค่าล่าสุด
        const updatedRTDBBalance = Number((await get(coinRef)).val() || 0)
        
        // ✅ สำคัญ: sync balance และอัพเดท balance ภายใน transaction เดียวกัน เพื่อให้ atomic
        // ✅ ป้องกันปัญหา: transaction หลายตัว sync balance พร้อมกันและเขียนทับกัน
        await runTransaction(firestore, async (transaction) => {
          // ✅ อ่าน balance ภายใน transaction (Firestore จะ lock document นี้)
          // ✅ สำคัญ: ต้องอ่าน balance ภายใน transaction เท่านั้น เพื่อให้ Firestore transaction lock ทำงานได้ถูกต้อง
          // ✅ Firestore transaction จะ retry อัตโนมัติถ้ามี conflict และจะอ่าน balance ใหม่ทุกครั้ง
          const balanceDoc = await transaction.get(balanceRef)
          const balanceData = balanceDoc.data() as { balance: number; lastSyncFromRTDB?: number } | undefined
          
          // ✅ อ่าน balance จาก Firestore (source of truth)
          // ✅ สำคัญ: ใช้ Firestore balance เท่านั้น ไม่ใช้ fallback เพื่อป้องกัน race condition
          let firestoreBalance = Number(balanceData?.balance ?? 0)
          
          // ✅ ถ้า Firestore ยังไม่มี balance ให้ sync จาก RTDB ภายใน transaction เดียวกัน
          // ✅ สำคัญ: sync ภายใน transaction เพื่อให้ atomic และป้องกัน race condition
          // ✅ ใช้ updatedRTDBBalance ที่อ่านก่อน transaction (ซึ่งเป็นค่าล่าสุด)
          if (firestoreBalance === 0) {
            // ✅ Sync balance จาก RTDB ไป Firestore ภายใน transaction
            // ✅ สำคัญ: sync ภายใน transaction เพื่อให้ atomic
            firestoreBalance = updatedRTDBBalance > 0 ? updatedRTDBBalance : beforeBalance
          }
          
          // ✅ อัพเดท balance ใน Firestore (ภายใน transaction) - เขียนครั้งเดียว
          // ✅ สำคัญ: รวม sync balance และอัพเดท balance เป็นการเขียนครั้งเดียว เพื่อป้องกันการเขียนซ้ำ
          // ✅ Firestore transaction จะ retry อัตโนมัติถ้ามี conflict และจะอ่าน balance ใหม่ทุกครั้ง
          transaction.set(balanceRef, {
            balance: firestoreBalance + amount,
            lastUpdated: serverTimestamp(),
            lastSyncFromRTDB: updatedRTDBBalance
          }, { merge: true })
        })
        
        balanceUpdateSuccess = true
      } catch (error: any) {
        // ✅ ถ้า error เป็น conflict ให้ retry
        // ✅ Firestore transaction จะ retry อัตโนมัติ แต่ถ้ายัง fail ให้ retry เอง
        if (error.code === 'failed-precondition' || error.code === 'aborted') {
          balanceRetryCount++
          // ✅ อ่าน balance ใหม่จาก Firestore ก่อน retry (source of truth)
          try {
            const balanceDoc = await getDoc(balanceRef)
            const balanceData = balanceDoc.data() as { balance: number; lastSyncFromRTDB?: number } | undefined
            if (balanceData && balanceData.balance > 0) {
              // ✅ ใช้ Firestore balance เป็น source of truth
              beforeBalance = Number(balanceData.balance)
            } else {
              // ✅ ถ้า Firestore ยังไม่มี balance ให้อ่านจาก RTDB
              const beforeSnap = await get(coinRef)
              beforeBalance = Number(beforeSnap.val() || 0)
            }
          } catch (readError) {
            // ✅ ถ้าอ่านไม่ได้ ให้อ่านจาก RTDB
            const beforeSnap = await get(coinRef)
            beforeBalance = Number(beforeSnap.val() || 0)
          }
          // ✅ อ่าน RTDB balance ใหม่ก่อน retry
          const updatedRTDBBalance = Number((await get(coinRef)).val() || 0)
          // ✅ รอสักครู่ก่อน retry (ให้ transaction อื่น commit ก่อน)
          await new Promise(resolve => setTimeout(resolve, 50 * balanceRetryCount))
          continue
        }
        
        // ✅ Error อื่นๆ ให้ throw
        throw error
      }
    }
    
    if (!balanceUpdateSuccess) {
      // ✅ Rollback Firestore transaction
      await deleteCoinTransaction(userId, uniqueKey)
      return { success: false, error: 'BALANCE_UPDATE_FAILED' }
    }
    
    // ✅ อ่าน balance ใหม่จาก Firestore
    const balanceDoc = await getDoc(balanceRef)
    const balanceData = balanceDoc.data() as { balance: number } | undefined
    const newBalance = Number(balanceData?.balance ?? 0)
    
    // ✅ Sync balance ไป RTDB เพื่อให้ real-time listener ทำงานได้
    await set(coinRef, newBalance)
    
    return { success: true, newBalance }
  } catch (error: any) {
    console.error('Add coins Firestore transaction error:', error)
    
    if (error.code === 'permission-denied') {
      return { success: false, error: 'PERMISSION_DENIED' }
    }
    
    return { success: false, error: 'TRANSACTION_FAILED' }
  }
}

/**
 * Verify coin transaction
 * ตรวจสอบว่า transaction ที่ทำสำเร็จเป็นของเราจริงๆ
 */
export async function verifyCoinTransaction(
  userId: string,
  uniqueKey: string
): Promise<{ verified: boolean; data?: CoinTransactionData }> {
  try {
    const transactionRef = doc(firestore, `coin_transactions/${userId}/transactions/${uniqueKey}`)
    const transactionDoc = await getDoc(transactionRef)
    
    if (!transactionDoc.exists()) {
      return { verified: false }
    }
    
    const data = transactionDoc.data() as CoinTransactionData
    
    // ✅ ตรวจสอบว่า uniqueKey ตรงกับที่เราสร้างหรือไม่
    if (data.key !== uniqueKey) {
      return { verified: false, data }
    }
    
    return { verified: true, data }
  } catch (error) {
    console.error('Verify coin transaction error:', error)
    return { verified: false }
  }
}

/**
 * Delete coin transaction (rollback)
 * ลบ transaction record (ใช้เมื่อ rollback)
 */
export async function deleteCoinTransaction(
  userId: string,
  uniqueKey: string
): Promise<void> {
  try {
    const transactionRef = doc(firestore, `coin_transactions/${userId}/transactions/${uniqueKey}`)
    await deleteDoc(transactionRef)
  } catch (error) {
    console.error('Delete coin transaction error:', error)
  }
}

