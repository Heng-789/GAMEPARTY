import { initializeApp, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// HENG36 Firebase Configuration
const heng36Config = {
  apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
  authDomain: "heng-15023.firebaseapp.com",
  projectId: "heng-15023",
  storageBucket: "heng-15023.appspot.com",
  messagingSenderId: "610549921124",
  appId: "1:610549921124:web:640e4e5b2c427c2d27f671",
  databaseURL: "https://heng-15023-default-rtdb.asia-southeast1.firebasedatabase.app"
}

// MAX56 Firebase Configuration
const max56Config = {
  apiKey: "AIzaSyCq4J3neJr1jSIzOSN8_YeBmsvSChsuIBs",
  authDomain: "max56-98e6f.firebaseapp.com",
  projectId: "max56-98e6f",
  storageBucket: "max56-98e6f.firebasestorage.app",
  messagingSenderId: "698160116437",
  appId: "1:698160116437:web:13f03063724a621ee8e85c",
  databaseURL: "https://max56-98e6f-default-rtdb.asia-southeast1.firebasedatabase.app"
}

// JEED24 Firebase Configuration
const jeed24Config = {
  apiKey: "AIzaSyBBun3l4CW6QQLcNH4KO9mpdse6Sx-Q_fQ",
  authDomain: "jeed24-3c755.firebaseapp.com",
  databaseURL: "https://jeed24-3c755-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jeed24-3c755",
  storageBucket: "jeed24-3c755.firebasestorage.app",
  messagingSenderId: "504735518201",
  appId: "1:504735518201:web:c79167a6805a1bbcae8128",
  measurementId: "G-LQBK9H1EEF"
}

// Get current theme from Vite mode
const getCurrentTheme = () => {
  const viteMode = import.meta.env.MODE
  if (viteMode === 'jeed24') return 'jeed24'
  if (viteMode === 'max56') return 'max56'
  if (viteMode === 'heng36') return 'heng36'
  
  // Fallback to hostname detection
  const hostname = window.location.hostname
  if (hostname.includes('jeed24')) return 'jeed24'
  if (hostname.includes('max56')) return 'max56'
  if (hostname.includes('heng36')) return 'heng36'
  
  return 'heng36' // default
}

// Get Firebase config based on current theme
const getFirebaseConfig = () => {
  const theme = getCurrentTheme()
  if (theme === 'jeed24') return jeed24Config
  if (theme === 'max56') return max56Config
  return heng36Config
}

// Initialize Firebase app with theme-specific config
const firebaseConfig = getFirebaseConfig()
let app
try {
  app = getApp()
} catch (error) {
  app = initializeApp(firebaseConfig)
}

// Get auth and database instances
export { app }
export const auth = getAuth(app)
export const db = getDatabase(app, firebaseConfig.databaseURL)

// Export theme info for debugging
export const currentTheme = getCurrentTheme()
export const firebaseProjectId = firebaseConfig.projectId

// Debug logging in development
// if (import.meta.env.DEV) {
//   console.log('🔥 Firebase initialized:', {
//     theme: currentTheme,
//     projectId: firebaseProjectId,
//     authDomain: firebaseConfig.authDomain,
//     databaseURL: firebaseConfig.databaseURL
//   })
// }
