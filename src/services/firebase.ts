import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
  authDomain: "heng-15023.firebaseapp.com",
  projectId: "heng-15023",
  storageBucket: "heng-15023.appspot.com",
  messagingSenderId: "610549921124",
  appId: "1:610549921124:web:640e4e5b2c427c2d27f671"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app, "https://heng-15023-default-rtdb.asia-southeast1.firebasedatabase.app")
