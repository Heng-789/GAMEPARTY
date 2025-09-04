// src/services/games.ts
import { db } from './firebase'
import { ref, push, set } from 'firebase/database'

// ไม่พึ่งไฟล์ types ภายนอก เพื่อตัด error ตอนนี้
export async function createGame(input: any) {
  const pushRef = push(ref(db, 'games'))
  const rawKey = pushRef.key!
  // บังคับ prefix ให้เป็น game_
  const id = rawKey.startsWith('game_') ? rawKey : `game_${rawKey}`

  await set(ref(db, `games/${id}`), { id, createdAt: Date.now(), ...input })

  const o = location.origin
  return {
    id,
    adminLink: `${o}/games/${id}`, // สำหรับแอดมิน
    playerLink: `${o}/?id=${id}`,  // สำหรับลูกค้า (ไม่ต้องล็อกอิน)
  }
}
