import React from 'react'
import CreateGame from '../CreateGame'

// Wrapper สำหรับโหมด "สร้างเกมใหม่"
// ปัจจุบันใช้หน้าเดิมภายใน แต่แยกไฟล์หน้าเพื่อให้จัดโครงสร้าง route และเตรียมแยกโค้ดภายหลังได้ง่าย
export default function GameCreate() {
  return <CreateGame />
}


