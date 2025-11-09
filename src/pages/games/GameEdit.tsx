import React from 'react'
import CreateGame from '../CreateGame'

// Wrapper สำหรับโหมด "แก้ไขเกม"
// ใช้หน้าเดิมภายใน แต่เป็นทางเข้าเฉพาะ /games/:id เพื่อแยก concerns ชัดเจน
export default function GameEdit() {
  return <CreateGame />
}


