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
          // ✅ PHASE 3: อ่าน balance จาก Firestore (ไม่ใช้ RTDB)
          const { getUserData } = await import('./users-firestore')
          const userData = await getUserData(userId, {
            preferFirestore: true,
            fallbackRTDB: false // Phase 3: ใช้ Firestore 100%
          })
          const currentBalance = Number(userData?.hcoin || 0)
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
    
    // ✅ PHASE 3: ใช้ Firestore 100% (ไม่ sync ไป RTDB)
    // ✅ ใช้ Firestore transaction เพื่อ lock coin balance และอัพเดท balance ใน Firestore
    const balanceRef = doc(firestore, `coin_balances/${userId}`)
    
    // ✅ อ่าน balance ปัจจุบันจาก Firestore (source of truth)
    let beforeBalance = 0
    try {
      const balanceDoc = await getDoc(balanceRef)
      const balanceData = balanceDoc.data() as { balance: number; lastSyncFromRTDB?: number } | undefined
      if (balanceData && balanceData.balance > 0) {
        beforeBalance = Number(balanceData.balance)
      } else {
        // ✅ PHASE 3: ถ้า Firestore ยังไม่มี balance ให้อ่านจาก users collection
        const { getUserData } = await import('./users-firestore')
        const userData = await getUserData(userId, {
          preferFirestore: true,
          fallbackRTDB: false // Phase 3: ใช้ Firestore 100%
        })
        beforeBalance = Number(userData?.hcoin || 0)
      }
    } catch (readError) {
      // ✅ PHASE 3: ถ้าอ่าน Firestore ไม่ได้ ให้อ่านจาก users collection
      const { getUserData } = await import('./users-firestore')
      const userData = await getUserData(userId, {
        preferFirestore: true,
        fallbackRTDB: false // Phase 3: ใช้ Firestore 100%
      })
      beforeBalance = Number(userData?.hcoin || 0)
    }
    
    // ✅ PHASE 3: ใช้ Firestore transaction เพื่อ lock และอัพเดท balance (ไม่ใช้ RTDB)
    let balanceUpdateSuccess = false
    let balanceRetryCount = 0
    const maxBalanceRetries = 10
    
    while (!balanceUpdateSuccess && balanceRetryCount < maxBalanceRetries) {
      try {
        // ✅ PHASE 3: ใช้ Firestore transaction เท่านั้น (ไม่ใช้ RTDB)
        await runTransaction(firestore, async (transaction) => {
          // ✅ อ่าน balance ภายใน transaction (Firestore จะ lock document นี้)
          const balanceDoc = await transaction.get(balanceRef)
          const balanceData = balanceDoc.data() as { balance: number } | undefined
          
          // ✅ อ่าน balance จาก Firestore (source of truth)
          let firestoreBalance = Number(balanceData?.balance ?? 0)
          
          // ✅ ถ้า Firestore ยังไม่มี balance ให้อ่านจาก users collection
          if (firestoreBalance === 0) {
            // ✅ ภายใน transaction ไม่สามารถเรียก async function ได้
            // ✅ ใช้ beforeBalance ที่อ่านไว้แล้วแทน
            firestoreBalance = beforeBalance
          }
          
          // ✅ อัพเดท balance ใน Firestore (ภายใน transaction)
          transaction.set(balanceRef, {
            balance: firestoreBalance + amount,
            lastUpdated: serverTimestamp()
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
              // ✅ PHASE 3: ถ้า Firestore ยังไม่มี balance ให้อ่านจาก users collection
              const { getUserData } = await import('./users-firestore')
              const userData = await getUserData(userId, {
                preferFirestore: true,
                fallbackRTDB: false // Phase 3: ใช้ Firestore 100%
              })
              beforeBalance = Number(userData?.hcoin || 0)
            }
          } catch (readError) {
            // ✅ PHASE 3: ถ้าอ่านไม่ได้ ให้อ่านจาก users collection
            const { getUserData } = await import('./users-firestore')
            const userData = await getUserData(userId, {
              preferFirestore: true,
              fallbackRTDB: false // Phase 3: ใช้ Firestore 100%
            })
            beforeBalance = Number(userData?.hcoin || 0)
          }
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
    
    // ✅ PHASE 3: อ่าน balance ใหม่จาก Firestore (ไม่ sync ไป RTDB)
    const balanceDoc = await getDoc(balanceRef)
    const balanceData = balanceDoc.data() as { balance: number } | undefined
    const newBalance = Number(balanceData?.balance ?? 0)
    
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

