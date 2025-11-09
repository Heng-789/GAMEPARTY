# 🔥 Real-time User Tracking System

## 📋 ภาพรวมระบบ

ระบบตรวจสอบผู้ใช้ในห้องแบบเรียลไทม์ที่ออกแบบมาสำหรับเกม BINGO โดยใช้ Firebase Realtime Database เพื่อให้ผู้ใช้ใน LOBBY เห็นการเปลี่ยนแปลงของผู้ใช้ในห้องแบบเรียลไทม์

## 🏗️ สถาปัตยกรรมระบบ

### 1. **Presence Service** (`src/services/realtime-presence.ts`)
- จัดการการเชื่อมต่อและอัปเดตสถานะผู้ใช้
- ระบบ Heartbeat เพื่อตรวจสอบผู้ใช้ออนไลน์
- การจัดการการเข้าออกจากห้อง

### 2. **Firebase Database Structure**
```
presence/
  {gameId}/
    rooms/
      {roomId}/
        users/
          {userId}/
            - userId: string
            - username: string
            - status: 'online' | 'away' | 'offline'
            - lastSeen: timestamp
            - joinedAt: timestamp
            - isInRoom: boolean
            - roomId: string
            - gameId: string
```

## 🚀 ฟีเจอร์หลัก

### ✅ **Real-time User Presence**
- แสดงสถานะผู้ใช้แบบเรียลไทม์ (Online/Away/Offline)
- อัปเดตสถานะอัตโนมัติเมื่อผู้ใช้เข้าออกหน้า
- ระบบ Heartbeat เพื่อตรวจสอบการเชื่อมต่อ

### ✅ **Lobby Real-time Updates**
- แสดงจำนวนผู้ใช้ในแต่ละห้องแบบเรียลไทม์
- รายชื่อผู้ใช้ที่อยู่ในห้องพร้อมสถานะ
- อัปเดต UI อัตโนมัติเมื่อมีผู้ใช้เข้าออก

### ✅ **Auto Cleanup**
- ลบผู้ใช้ออกจากระบบเมื่อออกจากหน้า
- ระบบ timeout สำหรับผู้ใช้ที่หายไป
- การจัดการ memory leaks

## 🔧 การใช้งาน

### 1. **Initialize Presence System**
```typescript
import { initializeUserPresence } from '../services/realtime-presence'

// ใน BingoGame component
useEffect(() => {
  if (!gameId || !game.roomId || !userKey || isPresenceInitialized) return

  const initPresence = async () => {
    try {
      await initializeUserPresence(gameId, game.roomId, userKey, username)
      setIsPresenceInitialized(true)
    } catch (error) {
      console.error('Failed to initialize presence:', error)
    }
  }

  initPresence()
}, [gameId, game.roomId, userKey, username, isPresenceInitialized])
```

### 2. **Listen to Real-time Updates**
```typescript
import { listenToGamePresence, getRoomUserCount } from '../services/realtime-presence'

// ใน BingoLobby component
useEffect(() => {
  if (!gameId) return

  const unsubscribe = listenToGamePresence(gameId, (presence) => {
    setRoomsPresence(presence)
    console.log('🏠 Real-time presence updated:', presence)
  })

  return unsubscribe
}, [gameId])
```

### 3. **Display Real-time Data**
```typescript
// แสดงจำนวนผู้ใช้แบบเรียลไทม์
<span className="bingo-room-count">
  {getRoomUserCount(roomsPresence[room.roomId] || {})} / {room.maxUsers}
</span>

// แสดงรายชื่อผู้ใช้ในห้อง
{roomsPresence[room.roomId] && Object.keys(roomsPresence[room.roomId]).length > 0 && (
  <div className="bingo-room-users">
    <span className="bingo-room-label">ผู้เล่นในห้อง:</span>
    <div className="bingo-room-users-list">
      {Object.values(roomsPresence[room.roomId]).map((user) => (
        <div key={user.userId} className="bingo-room-user">
          <span className={`bingo-room-user-status ${user.status}`}>
            {user.status === 'online' ? '🟢' : '🟡'}
          </span>
          <span className="bingo-room-username">{user.username}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

## 🎨 UI Components

### **Room Card with Real-time Data**
- แสดงจำนวนผู้ใช้แบบเรียลไทม์
- รายชื่อผู้ใช้พร้อมสถานะ (🟢 Online, 🟡 Away)
- อัปเดตปุ่ม "เข้าห้อง" ตามจำนวนผู้ใช้จริง

### **User Status Indicators**
- 🟢 **Online**: ผู้ใช้กำลังใช้งานอยู่
- 🟡 **Away**: ผู้ใช้ไม่อยู่ในหน้า (แต่ยังเชื่อมต่อ)
- ⚫ **Offline**: ผู้ใช้ตัดการเชื่อมต่อ

## ⚡ Performance Features

### **Optimized Updates**
- ใช้ Firebase Realtime Database listeners
- อัปเดตเฉพาะเมื่อมีการเปลี่ยนแปลง
- ระบบ cleanup อัตโนมัติ

### **Heartbeat System**
- อัปเดตสถานะทุก 10 วินาที
- ตรวจสอบการเชื่อมต่อแบบเรียลไทม์
- ลดการใช้ bandwidth

### **Memory Management**
- ลบ listeners เมื่อ component unmount
- ระบบ timeout สำหรับผู้ใช้ที่หายไป
- การจัดการ cleanup events

## 🔒 Security Features

### **Data Validation**
- ตรวจสอบข้อมูลก่อนบันทึก
- ป้องกันการเข้าถึงข้อมูลที่ไม่ได้รับอนุญาต
- การจัดการ errors

### **User Authentication**
- ใช้ Firebase Authentication
- ตรวจสอบสิทธิ์การเข้าถึง
- การจัดการ session

## 📱 Responsive Design

### **Mobile Support**
- รองรับหน้าจอขนาดเล็ก
- การแสดงผลที่เหมาะสมกับมือถือ
- Touch-friendly interface

### **Real-time Indicators**
- แสดงสถานะผู้ใช้แบบเรียลไทม์
- Animation effects สำหรับการอัปเดต
- Visual feedback สำหรับผู้ใช้

## 🚀 การใช้งานจริง

### **ใน BINGO Lobby**
1. ผู้ใช้เข้าหน้า Lobby
2. ระบบแสดงห้องที่มีอยู่พร้อมจำนวนผู้ใช้แบบเรียลไทม์
3. ผู้ใช้เห็นรายชื่อผู้ใช้ที่อยู่ในแต่ละห้อง
4. อัปเดตแบบเรียลไทม์เมื่อมีผู้ใช้เข้าออก

### **ใน BINGO Game Room**
1. ผู้ใช้เข้าห้องเกม
2. ระบบ initialize presence
3. แสดงสถานะผู้ใช้แบบเรียลไทม์
4. อัปเดตเมื่อผู้ใช้เปลี่ยนสถานะ

## 🔧 Configuration

### **Environment Variables**
```env
# Firebase Configuration
VITE_THEME=heng36
VITE_DOMAIN=heng36.party
VITE_PORT=5173
```

### **Firebase Rules**
```json
{
  "rules": {
    "presence": {
      "$gameId": {
        "rooms": {
          "$roomId": {
            "users": {
              "$userId": {
                ".write": "auth != null && auth.uid == $userId",
                ".read": "auth != null"
              }
            }
          }
        }
      }
    }
  }
}
```

## 📊 Monitoring & Analytics

### **Real-time Metrics**
- จำนวนผู้ใช้ออนไลน์ในแต่ละห้อง
- การเข้าออกของผู้ใช้
- สถานะการเชื่อมต่อ

### **Performance Monitoring**
- Response time ของ Firebase
- การใช้ bandwidth
- Error rates

## 🎯 Benefits

### ✅ **User Experience**
- ข้อมูลแบบเรียลไทม์
- การแสดงผลที่แม่นยำ
- การอัปเดตที่รวดเร็ว

### ✅ **Developer Experience**
- ระบบที่ง่ายต่อการใช้งาน
- TypeScript support
- Error handling ที่ดี

### ✅ **Scalability**
- รองรับผู้ใช้จำนวนมาก
- ระบบที่ยืดหยุ่น
- การจัดการ resources ที่ดี

## 🚀 Future Enhancements

### **Planned Features**
- [ ] User activity tracking
- [ ] Advanced presence states
- [ ] Push notifications
- [ ] Analytics dashboard
- [ ] Multi-language support

### **Performance Improvements**
- [ ] Connection pooling
- [ ] Caching strategies
- [ ] Offline support
- [ ] Background sync

---

## 📝 สรุป

ระบบ Real-time User Tracking นี้ให้ความสามารถในการติดตามผู้ใช้แบบเรียลไทม์ในเกม BINGO โดยใช้ Firebase Realtime Database ทำให้ผู้ใช้ใน LOBBY เห็นการเปลี่ยนแปลงของผู้ใช้ในห้องแบบเรียลไทม์ พร้อมกับ UI ที่สวยงามและ responsive design ที่รองรับการใช้งานบนอุปกรณ์ต่างๆ
