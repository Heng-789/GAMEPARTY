/**
 * Migration Script: Migrate USERS_EXTRA from RTDB to Firestore
 * Phase 3: Batch Migration for 600,000+++ users
 * 
 * Usage:
 * 1. Install dependencies: npm install
 * 2. Build: npm run build
 * 3. Run: node dist/scripts/migrate-users-to-firestore.js
 * 
 * Or run with ts-node:
 * npx ts-node scripts/migrate-users-to-firestore.ts
 */

import { initializeApp, getApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'
import { getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

// Get theme from environment or default to heng36
const getCurrentTheme = () => {
  const theme = process.env.VITE_THEME || process.env.MODE || 'heng36'
  if (theme === 'jeed24') return 'jeed24'
  if (theme === 'max56') return 'max56'
  return 'heng36' // default
}

// Firebase Configuration (adjust based on your project)
const getFirebaseConfig = () => {
  const theme = getCurrentTheme()
  
  if (theme === 'jeed24') {
    return {
      apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBBun3l4CW6QQLcNH4KO9mpdse6Sx-Q_fQ",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "jeed24-3c755.firebaseapp.com",
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "jeed24-3c755",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "jeed24-3c755.firebasestorage.app",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "504735518201",
      appId: process.env.VITE_FIREBASE_APP_ID || "1:504735518201:web:c79167a6805a1bbcae8128",
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://jeed24-3c755-default-rtdb.asia-southeast1.firebasedatabase.app"
    }
  }
  
  if (theme === 'max56') {
    return {
      apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCq4J3neJr1jSIzOSN8_YeBmsvSChsuIBs",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "max56-98e6f.firebaseapp.com",
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "max56-98e6f",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "max56-98e6f.firebasestorage.app",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "698160116437",
      appId: process.env.VITE_FIREBASE_APP_ID || "1:698160116437:web:13f03063724a621ee8e85c",
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://max56-98e6f-default-rtdb.asia-southeast1.firebasedatabase.app"
    }
  }
  
  // Default: heng36
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "heng-15023.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "heng-15023",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "heng-15023.appspot.com",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "610549921124",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:610549921124:web:640e4e5b2c427c2d27f671",
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://heng-15023-default-rtdb.asia-southeast1.firebasedatabase.app"
  }
}

// Get Firestore database name based on theme
const getFirestoreDatabaseName = () => {
  const theme = getCurrentTheme()
  if (theme === 'heng36') return 'hengparty'
  if (theme === 'max56') return 'maxparty'
  // JEED24 และอื่นๆ ใช้ default database
  return undefined
}

const firebaseConfig = getFirebaseConfig()
const currentTheme = getCurrentTheme()

// Initialize Firebase
let app
try {
  app = getApp()
} catch (error) {
  app = initializeApp(firebaseConfig)
}

const db = getDatabase(app, firebaseConfig.databaseURL)
const firestoreDatabaseName = getFirestoreDatabaseName()
const firestore = firestoreDatabaseName 
  ? getFirestore(app, firestoreDatabaseName)
  : getFirestore(app)

console.log('🔥 Firebase initialized:', {
  theme: currentTheme,
  projectId: firebaseConfig.projectId,
  firestoreDatabase: firestoreDatabaseName || 'default'
})

interface UserData {
  password?: string
  hcoin?: number
  status?: string
  createdAt?: number
  updatedAt?: number
  [key: string]: any
}

interface MigrationStats {
  total: number
  migrated: number
  failed: number
  skipped: number
  errors: Array<{ userId: string; error: string }>
}

/**
 * Migrate single user from RTDB to Firestore
 */
async function migrateUser(userId: string, userData: UserData): Promise<boolean> {
  try {
    const firestoreRef = doc(firestore, 'users', userId)
    
    // Check if user already exists in Firestore
    const { getDoc } = await import('firebase/firestore')
    const existingDoc = await getDoc(firestoreRef)
    
    if (existingDoc.exists()) {
      console.log(`⏭️  User ${userId} already exists in Firestore, skipping`)
      return false // Skip, already migrated
    }

    // Prepare Firestore data
    const firestoreData: any = {
      userId,
      ...userData,
      // Convert number timestamp to Timestamp
      createdAt: userData.createdAt
        ? Timestamp.fromMillis(userData.createdAt)
        : serverTimestamp(),
      updatedAt: userData.updatedAt
        ? Timestamp.fromMillis(userData.updatedAt)
        : serverTimestamp()
    }

    // Write to Firestore
    await setDoc(firestoreRef, firestoreData, { merge: true })
    return true
  } catch (error: any) {
    console.error(`❌ Error migrating user ${userId}:`, error.message)
    throw error
  }
}

/**
 * Migrate users in batches
 */
async function migrateUsersBatch(
  userIds: string[],
  batchSize: number = 500,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n📦 Processing batch of ${userIds.length} users (batch size: ${batchSize})`)

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const batchPromises = batch.map(async (userId) => {
      try {
        // Read from RTDB
        const rtdbRef = ref(db, `USERS_EXTRA/${userId}`)
        const rtdbSnap = await get(rtdbRef)

        if (!rtdbSnap.exists()) {
          stats.skipped++
          return
        }

        const userData = rtdbSnap.val() as UserData
        const migrated = await migrateUser(userId, userData)

        if (migrated) {
          stats.migrated++
        } else {
          stats.skipped++
        }
      } catch (error: any) {
        stats.failed++
        stats.errors.push({ userId, error: error.message })
        console.error(`❌ Failed to migrate user ${userId}:`, error.message)
      }
    })

    await Promise.all(batchPromises)

    // Progress update
    const progress = Math.min(i + batchSize, userIds.length)
    const percentage = ((progress / userIds.length) * 100).toFixed(2)
    console.log(
      `✅ Progress: ${progress}/${userIds.length} users (${percentage}%) | ` +
      `Migrated: ${stats.migrated} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`
    )

    // Small delay to avoid rate limits
    if (i + batchSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting USERS_EXTRA migration from RTDB to Firestore\n')

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }

  try {
    // 1. Read all users from RTDB
    console.log('📖 Reading all users from RTDB...')
    const rtdbRef = ref(db, 'USERS_EXTRA')
    const rtdbSnap = await get(rtdbRef)

    if (!rtdbSnap.exists()) {
      console.error('❌ No users found in RTDB')
      return
    }

    const allUsers = rtdbSnap.val() as Record<string, UserData>
    const userIds = Object.keys(allUsers)
    stats.total = userIds.length

    console.log(`✅ Found ${stats.total} users in RTDB\n`)

    // 2. Migrate in batches
    const BATCH_SIZE = 500 // Adjust based on your needs
    await migrateUsersBatch(userIds, BATCH_SIZE, stats)

    // 3. Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Migration Summary')
    console.log('='.repeat(60))
    console.log(`Total users: ${stats.total}`)
    console.log(`✅ Migrated: ${stats.migrated}`)
    console.log(`⏭️  Skipped (already exists): ${stats.skipped}`)
    console.log(`❌ Failed: ${stats.failed}`)

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (first 10):`)
      stats.errors.slice(0, 10).forEach(({ userId, error }) => {
        console.log(`  - ${userId}: ${error}`)
      })
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`)
      }
    }

    console.log('\n✅ Migration completed!')
  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration (always run when script is executed)
main()
  .then(() => {
    console.log('\n✅ Migration script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })

export { migrateUser, migrateUsersBatch, main }

