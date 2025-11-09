// src/utils/firebaseDebug.ts
import { currentTheme, firebaseProjectId } from '../services/firebase-theme'

// Debug Firebase connection
// if (import.meta.env.DEV) {
//   console.log('🔥 Firebase Debug Info:', {
//     currentTheme,
//     firebaseProjectId,
//     viteMode: import.meta.env.MODE,
//     hostname: window.location.hostname,
//     timestamp: new Date().toISOString()
//   })
  
//   // Check if Firebase is properly initialized
//   try {
//     import('../services/firebase').then(({ auth, db }) => {
//       console.log('✅ Firebase services loaded:', {
//         auth: !!auth,
//         db: !!db,
//         authApp: auth.app.name,
//         dbApp: db.app.name
//       })
//     })
//   } catch (error) {
//     console.error('❌ Firebase initialization error:', error)
//   }
// }