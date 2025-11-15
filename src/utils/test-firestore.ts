// ไฟล์ทดสอบการเชื่อมต่อ Firestore
// เรียกใช้ใน console: testFirestoreConnection()

import { firestore } from '../services/firebase'
import { collection, doc, setDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'

export async function testFirestoreConnection() {
  try {
    console.log('🔥 Testing Firestore connection...')
    
    // ✅ ทดสอบ: สร้าง document ชั่วคราว
    const testRef = doc(collection(firestore, '_test'))
    const testId = testRef.id
    
    console.log('📝 Creating test document...')
    await setDoc(testRef, {
      message: 'Hello Firestore!',
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    })
    console.log('✅ Test document created:', testId)
    
    // ✅ ทดสอบ: อ่าน document
    console.log('📖 Reading test document...')
    const testSnap = await getDoc(testRef)
    
    if (testSnap.exists()) {
      const data = testSnap.data()
      console.log('✅ Test document data:', data)
      console.log('✅ Server timestamp:', data.timestamp?.toDate())
      
      // ✅ ลบ document ทดสอบ
      console.log('🗑️ Deleting test document...')
      await deleteDoc(testRef)
      console.log('✅ Test document deleted')
      
      console.log('🎉 Firestore connection test PASSED!')
      return true
    } else {
      console.error('❌ Test document not found')
      return false
    }
  } catch (error: any) {
    console.error('❌ Firestore connection test FAILED:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    if (error.code === 'permission-denied') {
      console.error('⚠️ Permission denied! Please check Firestore Security Rules.')
    }
    
    return false
  }
}

// ✅ ฟังก์ชันทดสอบการดึง server date
export async function testServerTimestamp(): Promise<string | null> {
  try {
    console.log('🕐 Testing serverTimestamp()...')
    
    // ✅ สร้าง temporary document เพื่อดึง server timestamp
    const tempRef = doc(collection(firestore, '_temp'))
    await setDoc(tempRef, { timestamp: serverTimestamp() })
    
    const tempSnap = await getDoc(tempRef)
    const timestamp = tempSnap.data()?.timestamp
    
    // ✅ ลบ temporary document
    await deleteDoc(tempRef)
    
    if (timestamp) {
      const date = timestamp.toDate()
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      
      console.log('✅ Server date:', dateKey)
      console.log('✅ Server timestamp:', date.toISOString())
      return dateKey
    }
    
    return null
  } catch (error: any) {
    console.error('❌ Server timestamp test FAILED:', error)
    return null
  }
}

