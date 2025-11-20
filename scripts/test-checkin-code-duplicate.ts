/**
 * Test Script: ตรวจสอบการแจกโค้ดซ้ำกันเมื่อ USER หลายคนเช็คอินพร้อมกัน
 * 
 * วิธีรัน:
 *   npx tsx scripts/test-checkin-code-duplicate.ts <gameId> <dayIndex> <numUsers>
 * 
 * ตัวอย่าง:
 *   npx tsx scripts/test-checkin-code-duplicate.ts game_123 0 10
 * 
 * หมายเหตุ:
 *   - gameId: ID ของเกมที่ต้องการทดสอบ
 *   - dayIndex: วันที่ต้องการทดสอบ (0 = วันแรก, 1 = วันที่สอง, ...)
 *   - numUsers: จำนวน User ที่จะทดสอบ (แนะนำ: 10-50)
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set, runTransaction } from 'firebase/database'
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getDatabase(app)
const firestore = getFirestore(app)

interface TestResult {
  userId: string
  success: boolean
  code: string | null
  error?: string
  timestamp: number
}

/**
 * จำลองการเช็คอินของ user หนึ่งคน
 */
async function simulateCheckin(
  gameId: string,
  userId: string,
  dayIndex: number,
  serverDate: string
): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    // ✅ 1. ตรวจสอบว่า user เคยเช็คอินแล้วหรือยัง (จาก Firestore)
    const checkinRef = doc(firestore, `checkins/${gameId}/users/${userId}/days/${dayIndex}`)
    const checkinDoc = await getDoc(checkinRef)
    
    if (checkinDoc.exists() && checkinDoc.data()?.checked === true) {
      // ✅ User เคยเช็คอินแล้ว ให้อ่านโค้ดเดิม
      const userCodeRef = ref(db, `checkins/${gameId}/${userId}/dayCodes/${dayIndex}`)
      const userCodeSnap = await get(userCodeRef)
      if (userCodeSnap.exists()) {
        const existingCode = userCodeSnap.val()
        return {
          userId,
          success: true,
          code: existingCode?.code || null,
          timestamp: Date.now() - startTime
        }
      }
    }
    
    // ✅ 2. อ่านโค้ดจาก rewardCodes
    const rewardCodesRef = ref(db, `games/${gameId}/checkin/rewardCodes/${dayIndex}`)
    const rewardCodesSnap = await get(rewardCodesRef)
    const rewardCodesData = rewardCodesSnap.val()
    
    let codes: string[] = []
    if (rewardCodesData) {
      if (Array.isArray(rewardCodesData.codes) && rewardCodesData.codes.length > 0) {
        codes = rewardCodesData.codes.filter((c: any) => c && String(c).trim())
      } else if (typeof rewardCodesData === 'string') {
        codes = rewardCodesData.split('\n').map(c => c.trim()).filter(Boolean)
      }
    }
    
    if (codes.length === 0) {
      return {
        userId,
        success: false,
        code: null,
        error: 'NO_CODES_AVAILABLE',
        timestamp: Date.now() - startTime
      }
    }
    
    // ✅ 3. ใช้ transaction เพื่อแจกโค้ด (จำลองโค้ดใน CheckinGame.tsx)
    const userCodeRef = ref(db, `checkins/${gameId}/${userId}/dayCodes/${dayIndex}`)
    let chosenCode: string | null = null
    
    // ✅ ตรวจสอบว่า user เคยได้โค้ดไปแล้วหรือยัง
    const userCodeSnap = await get(userCodeRef)
    if (userCodeSnap.exists()) {
      const existingCode = userCodeSnap.val()
      if (existingCode && existingCode.code) {
        return {
          userId,
          success: true,
          code: String(existingCode.code),
          timestamp: Date.now() - startTime
        }
      }
    }
    
    // ✅ ใช้ transaction เพื่อแจกโค้ด
    const codeResult = await runTransaction(rewardCodesRef, (cur: any) => {
      const cursor = Number(cur?.cursor ?? 0)
      const storedCodes = Array.isArray(cur?.codes) && cur.codes.length > 0 ? cur.codes : []
      const claimedBy = cur?.claimedBy || {}
      
      // ✅ ตรวจสอบว่า user เคยได้โค้ดไปแล้วหรือยัง
      if (claimedBy[userId] && claimedBy[userId].code) {
        chosenCode = String(claimedBy[userId].code)
        return cur
      }
      
      // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่
      const codesChanged = storedCodes.length === 0 || 
        JSON.stringify(storedCodes) !== JSON.stringify(codes)
      
      const finalCodes = codesChanged ? codes : storedCodes
      const finalCursor = codesChanged ? 0 : cursor
      const finalClaimedBy = codesChanged ? {} : claimedBy
      
      // ✅ ถ้าโค้ดหมดแล้ว
      if (finalCursor >= finalCodes.length) {
        return cur
      }
      
      // ✅ แจกโค้ดตัวถัดไป
      chosenCode = finalCodes[finalCursor]
      
      // ✅ ตรวจสอบว่าโค้ดนี้เคยถูกแจกไปแล้วหรือยัง
      const codeAlreadyClaimed = Object.values(finalClaimedBy).some(
        (claim: any) => claim && claim.code === chosenCode
      )
      
      // ✅ ถ้าโค้ดนี้เคยถูกแจกไปแล้ว ให้ข้ามไปโค้ดถัดไป
      if (codeAlreadyClaimed) {
        let nextIndex = finalCursor + 1
        while (nextIndex < finalCodes.length) {
          const nextCode = finalCodes[nextIndex]
          const nextCodeClaimed = Object.values(finalClaimedBy).some(
            (claim: any) => claim && claim.code === nextCode
          )
          if (!nextCodeClaimed) {
            chosenCode = nextCode
            return {
              cursor: nextIndex + 1,
              codes: finalCodes,
              claimedBy: {
                ...finalClaimedBy,
                [userId]: { code: chosenCode, ts: Date.now() }
              }
            }
          }
          nextIndex++
        }
        return cur
      }
      
      return {
        cursor: finalCursor + 1,
        codes: finalCodes,
        claimedBy: {
          ...finalClaimedBy,
          [userId]: { code: chosenCode, ts: Date.now() }
        }
      }
    }, { applyLocally: false })
    
    if (!codeResult.committed || !chosenCode) {
      return {
        userId,
        success: false,
        code: null,
        error: 'NO_CODE_AVAILABLE',
        timestamp: Date.now() - startTime
      }
    }
    
    // ✅ บันทึกว่า user นี้ได้โค้ดนี้ไปแล้ว
    await set(userCodeRef, {
      code: chosenCode,
      ts: Date.now(),
      date: serverDate
    })
    
    return {
      userId,
      success: true,
      code: chosenCode,
      timestamp: Date.now() - startTime
    }
  } catch (error: any) {
    return {
      userId,
      success: false,
      code: null,
      error: error.message || 'UNKNOWN_ERROR',
      timestamp: Date.now() - startTime
    }
  }
}

/**
 * ฟังก์ชันหลักสำหรับทดสอบ
 */
async function runTest(gameId: string, dayIndex: number, numUsers: number) {
  console.log('\n🧪 เริ่มทดสอบการแจกโค้ดซ้ำกัน...\n')
  console.log(`📋 ข้อมูลการทดสอบ:`)
  console.log(`   - Game ID: ${gameId}`)
  console.log(`   - Day Index: ${dayIndex}`)
  console.log(`   - จำนวน User: ${numUsers}`)
  console.log(`   - โหมด: เช็คอินพร้อมกัน (Parallel)\n`)
  
  // ✅ สร้าง user IDs
  const userIds = Array.from({ length: numUsers }, (_, i) => `test_user_${i + 1}`)
  
  // ✅ ตรวจสอบว่า game มีโค้ดหรือไม่
  const rewardCodesRef = ref(db, `games/${gameId}/checkin/rewardCodes/${dayIndex}`)
  const rewardCodesSnap = await get(rewardCodesRef)
  const rewardCodesData = rewardCodesSnap.val()
  
  let codes: string[] = []
  if (rewardCodesData) {
    if (Array.isArray(rewardCodesData.codes) && rewardCodesData.codes.length > 0) {
      codes = rewardCodesData.codes.filter((c: any) => c && String(c).trim())
    } else if (typeof rewardCodesData === 'string') {
      codes = rewardCodesData.split('\n').map(c => c.trim()).filter(Boolean)
    }
  }
  
  if (codes.length === 0) {
    console.error('❌ ไม่พบโค้ดใน game นี้ กรุณาตั้งค่าโค้ดก่อนทดสอบ')
    process.exit(1)
  }
  
  console.log(`📦 จำนวนโค้ดที่มี: ${codes.length}`)
  console.log(`👥 จำนวน User ที่จะทดสอบ: ${numUsers}\n`)
  
  if (numUsers > codes.length) {
    console.warn(`⚠️  จำนวน User มากกว่าจำนวนโค้ด (${numUsers} > ${codes.length})`)
    console.warn(`   บาง User อาจไม่ได้โค้ด\n`)
  }
  
  // ✅ รับ server date
  const tempRef = doc(firestore, '_temp/serverDate')
  await setDoc(tempRef, { ts: serverTimestamp() })
  const tempDoc = await getDoc(tempRef)
  const tempData = tempDoc.data()
  let serverDate = ''
  if (tempData?.ts) {
    const serverTs = tempData.ts as any
    const serverDateObj = serverTs.toDate()
    const y = serverDateObj.getFullYear()
    const m = String(serverDateObj.getMonth() + 1).padStart(2, '0')
    const dd = String(serverDateObj.getDate()).padStart(2, '0')
    serverDate = `${y}-${m}-${dd}`
  }
  await setDoc(tempRef, { ts: null }, { merge: true })
  
  console.log(`📅 Server Date: ${serverDate}\n`)
  console.log('🚀 เริ่มทดสอบการเช็คอินพร้อมกัน...\n')
  
  // ✅ จำลองการเช็คอินพร้อมกัน (Parallel)
  const startTime = Date.now()
  const results = await Promise.all(
    userIds.map(userId => simulateCheckin(gameId, userId, dayIndex, serverDate))
  )
  const totalTime = Date.now() - startTime
  
  // ✅ วิเคราะห์ผลลัพธ์
  const successfulResults = results.filter(r => r.success && r.code)
  const failedResults = results.filter(r => !r.success)
  const codesReceived = successfulResults.map(r => r.code).filter(Boolean) as string[]
  const uniqueCodes = new Set(codesReceived)
  const duplicateCodes = codesReceived.filter((code, index) => codesReceived.indexOf(code) !== index)
  
  // ✅ แสดงผลลัพธ์
  console.log('📊 ผลลัพธ์การทดสอบ:\n')
  console.log(`   ✅ สำเร็จ: ${successfulResults.length}/${numUsers}`)
  console.log(`   ❌ ล้มเหลว: ${failedResults.length}/${numUsers}`)
  console.log(`   ⏱️  เวลาที่ใช้: ${totalTime}ms`)
  console.log(`   📦 โค้ดที่ได้รับ: ${codesReceived.length}`)
  console.log(`   🔢 โค้ดที่ไม่ซ้ำ: ${uniqueCodes.size}`)
  console.log(`   🔁 โค้ดที่ซ้ำ: ${duplicateCodes.length}\n`)
  
  // ✅ แสดงรายละเอียด
  console.log('📋 รายละเอียดผลลัพธ์:\n')
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌'
    const code = result.code || 'N/A'
    const error = result.error || ''
    const time = result.timestamp
    console.log(`   ${status} User ${index + 1} (${result.userId}): ${code} ${error ? `(${error})` : ''} [${time}ms]`)
  })
  
  // ✅ ตรวจสอบการซ้ำกัน
  console.log('\n🔍 ตรวจสอบการซ้ำกัน:\n')
  if (duplicateCodes.length === 0) {
    console.log('   ✅ ไม่พบโค้ดซ้ำกัน - ระบบทำงานถูกต้อง!')
  } else {
    console.log('   ❌ พบโค้ดซ้ำกัน:')
    const duplicateMap = new Map<string, string[]>()
    results.forEach(result => {
      if (result.code) {
        if (!duplicateMap.has(result.code)) {
          duplicateMap.set(result.code, [])
        }
        duplicateMap.get(result.code)!.push(result.userId)
      }
    })
    duplicateMap.forEach((userIds, code) => {
      if (userIds.length > 1) {
        console.log(`      - โค้ด "${code}" ได้รับโดย: ${userIds.join(', ')}`)
      }
    })
  }
  
  // ✅ สรุปผล
  console.log('\n📝 สรุปผล:\n')
  if (duplicateCodes.length === 0 && successfulResults.length === numUsers) {
    console.log('   ✅ ทดสอบผ่าน: ไม่พบโค้ดซ้ำกัน และทุก User ได้รับโค้ด')
  } else if (duplicateCodes.length === 0) {
    console.log('   ⚠️  ทดสอบผ่านบางส่วน: ไม่พบโค้ดซ้ำกัน แต่บาง User ไม่ได้รับโค้ด')
  } else {
    console.log('   ❌ ทดสอบล้มเหลว: พบโค้ดซ้ำกัน')
  }
  
  console.log('\n')
}

// ✅ รับ arguments จาก command line
const args = process.argv.slice(2)
if (args.length < 3) {
  console.error('❌ ใช้ผิด: npx ts-node scripts/test-checkin-code-duplicate.ts <gameId> <dayIndex> <numUsers>')
  console.error('   ตัวอย่าง: npx ts-node scripts/test-checkin-code-duplicate.ts game_123 0 10')
  process.exit(1)
}

const [gameId, dayIndexStr, numUsersStr] = args
const dayIndex = parseInt(dayIndexStr, 10)
const numUsers = parseInt(numUsersStr, 10)

if (isNaN(dayIndex) || isNaN(numUsers) || numUsers < 1) {
  console.error('❌ ข้อมูลไม่ถูกต้อง: dayIndex และ numUsers ต้องเป็นตัวเลข')
  process.exit(1)
}

// ✅ รันทดสอบ
runTest(gameId, dayIndex, numUsers)
  .then(() => {
    console.log('✅ ทดสอบเสร็จสิ้น')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ เกิดข้อผิดพลาด:', error)
    process.exit(1)
  })

