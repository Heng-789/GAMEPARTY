# 🔥 Firestore Localhost Testing Guide

## ✅ สามารถทดสอบใน Localhost ได้ทันที!

**ไม่ต้อง deploy ขึ้น production** - Firestore ทำงานผ่าน Firebase project ที่ตั้งค่าไว้แล้ว

## 🚀 วิธีทดสอบ

### 1. รัน Development Server

```bash
# รัน development server
npm run dev

# หรือตาม theme
npm run dev:heng  # HENG36
npm run dev:max   # MAX56
```

### 2. เปิด Browser

```
http://localhost:5173
```

### 3. ทดสอบ Check-in

1. เปิดหน้าเกมเช็คอิน
2. กดปุ่มเช็คอิน
3. ตรวจสอบ console log
4. ตรวจสอบ Firestore Console

## 🔍 ตรวจสอบ Firestore Setup

### 1. ตรวจสอบ Firestore Database

ไปที่ Firebase Console:
- **HENG36**: https://console.firebase.google.com/project/heng-15023/firestore
- **MAX56**: https://console.firebase.google.com/project/max56-98e6f/firestore
- **JEED24**: https://console.firebase.google.com/project/jeed24-3c755/firestore

**ตรวจสอบ:**
- ✅ Firestore database ถูกสร้างไว้แล้วหรือยัง
- ✅ มี collection `checkins` หรือยัง

### 2. ตรวจสอบ Firestore Security Rules

ไปที่ Firebase Console → Firestore Database → Rules

**Rules ที่แนะนำ (สำหรับ testing):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Check-in rules
    match /checkins/{gameId}/users/{userId}/days/{dayIndex} {
      allow read, write: if true; // ✅ สำหรับ testing (อนุญาตทุกคน)
      // หรือ
      // allow read, write: if request.auth != null; // ✅ สำหรับ production (ต้อง login)
    }
    
    match /checkins/{gameId}/users/{userId}/completeReward {
      allow read, write: if true; // ✅ สำหรับ testing
      // หรือ
      // allow read, write: if request.auth != null; // ✅ สำหรับ production
    }
  }
}
```

**⚠️ หมายเหตุ:** Rules `if true` ใช้สำหรับ testing เท่านั้น! ต้องเปลี่ยนเป็น `if request.auth != null` สำหรับ production

### 3. ตรวจสอบ Console Log

เปิด Browser Console (F12) และดู log:

```javascript
// ควรเห็น log แบบนี้:
✅ Checkin Firestore transaction success
✅ Verify checkin: verified = true
```

หรือถ้ามี error:
```javascript
❌ Checkin Firestore transaction error: ...
```

## 🧪 ทดสอบด้วย Security Test Suite

### 1. เปิดหน้า Test Security

```
http://localhost:5173/test-security
```

### 2. กรอกข้อมูล

- **Game ID**: ID ของเกมที่ต้องการทดสอบ
- **User ID**: User ID ที่ต้องการทดสอบ (ใช้ test user)
- **Day Index**: 0 (Day 1)
- **Coin Amount**: 50

### 3. กด "เริ่มการทดสอบ"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ Test 1: Duplicate Check-in Prevention - **PASSED**
- ✅ Test 4: Complete Reward Race Condition - **PASSED**

## 🔍 ตรวจสอบข้อมูลใน Firestore

### 1. เปิด Firestore Console

```
https://console.firebase.google.com/project/{projectId}/firestore/data
```

### 2. ดู Collection Structure

```
checkins/
  {gameId}/
    users/
      {userId}/
        days/
          {dayIndex}/
            - checked: true
            - date: "2024-11-14"
            - ts: Timestamp
            - key: "1234567890_abc123"
            - createdAt: Timestamp
        completeReward/
          - claimed: true
          - ts: Timestamp
          - key: "1234567890_xyz789"
          - createdAt: Timestamp
```

## 🐛 Troubleshooting

### Error: "Missing or insufficient permissions"

**สาเหตุ:** Firestore Security Rules ไม่อนุญาต

**แก้ไข:**
1. ไปที่ Firebase Console → Firestore → Rules
2. เปลี่ยน rules เป็น:
```javascript
allow read, write: if true; // สำหรับ testing
```

### Error: "Firestore database not found"

**สาเหตุ:** Firestore database ยังไม่ถูกสร้าง

**แก้ไข:**
1. ไปที่ Firebase Console
2. ไปที่ Firestore Database
3. กด "Create database"
4. เลือก "Start in test mode" (สำหรับ testing)

### Error: "Transaction failed"

**สาเหตุ:** 
- Network error
- Firestore rules ไม่อนุญาต
- Transaction conflict

**แก้ไข:**
1. ตรวจสอบ network connection
2. ตรวจสอบ Firestore rules
3. ลองใหม่อีกครั้ง

## 📊 ตรวจสอบการทำงาน

### 1. Browser Console

เปิด Browser Console (F12) และดู:
- ✅ Log messages
- ✅ Error messages
- ✅ Transaction results

### 2. Firestore Console

เปิด Firestore Console และดู:
- ✅ ข้อมูลถูกบันทึกหรือไม่
- ✅ Collection structure ถูกต้องหรือไม่
- ✅ Timestamp ถูกต้องหรือไม่

### 3. Network Tab

เปิด Browser DevTools → Network tab และดู:
- ✅ Firestore requests
- ✅ Response status
- ✅ Request/Response data

## ✅ Checklist

ก่อนทดสอบ ตรวจสอบว่า:

- [ ] Firestore database ถูกสร้างไว้แล้ว
- [ ] Firestore Security Rules อนุญาตให้อ่าน/เขียนได้
- [ ] Development server กำลังรันอยู่
- [ ] Browser console ไม่มี error
- [ ] Firebase project ถูกต้อง (HENG36/MAX56/JEED24)

## 🎯 สรุป

**✅ สามารถทดสอบใน localhost ได้ทันที!**

- ไม่ต้อง deploy ขึ้น production
- ทำงานได้ทันทีที่รัน development server
- ข้อมูลจะถูกบันทึกใน Firebase project จริง
- สามารถดูข้อมูลได้ใน Firestore Console

**⚠️ ระวัง:**
- ข้อมูลที่ทดสอบจะถูกบันทึกใน Firebase project จริง
- ควรใช้ test user สำหรับทดสอบ
- ควรตั้ง Firestore rules ให้เหมาะสม

