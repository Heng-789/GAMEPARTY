# 🔥 Firestore Check-in Service Guide

## 📋 ภาพรวม

Firestore service สำหรับ check-in system ที่ใช้ Firestore transaction เพื่อป้องกัน race condition ได้ดีกว่า Realtime Database

## 🎯 วัตถุประสงค์

- ✅ ใช้ Firestore transaction สำหรับ critical operations (check-in, complete reward)
- ✅ ใช้ RTDB สำหรับ real-time listeners (backward compatibility)
- ✅ ป้องกัน race condition ได้ดีกว่า RTDB
- ✅ Server timestamp ที่น่าเชื่อถือกว่า

## 📁 ไฟล์ที่เกี่ยวข้อง

- `src/services/checkin-firestore.ts` - Firestore service สำหรับ check-in
- `src/components/CheckinGame.tsx` - Component ที่ใช้ Firestore service

## 🔧 การใช้งาน

### 1. Check-in Transaction

```typescript
import { checkinWithFirestore, verifyCheckin, rollbackCheckin } from '../services/checkin-firestore'

// ทำ check-in transaction
const uniqueKey = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`
const result = await checkinWithFirestore(
  gameId,
  userId,
  dayIndex,
  serverDate,
  uniqueKey
)

if (!result.success) {
  // Handle error
  if (result.error === 'ALREADY_CHECKED_IN') {
    // Already checked in
  }
}

// Verify transaction
const verifyResult = await verifyCheckin(gameId, userId, dayIndex, uniqueKey)
if (!verifyResult.verified) {
  // Rollback
  await rollbackCheckin(gameId, userId, dayIndex)
}
```

### 2. Complete Reward Transaction

```typescript
import { 
  claimCompleteRewardWithFirestore, 
  verifyCompleteReward, 
  rollbackCompleteReward 
} from '../services/checkin-firestore'

// Claim complete reward
const uniqueKey = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`
const result = await claimCompleteRewardWithFirestore(
  gameId,
  userId,
  uniqueKey
)

if (!result.success) {
  // Handle error
}

// Verify transaction
const verifyResult = await verifyCompleteReward(gameId, userId, uniqueKey)
if (!verifyResult.verified) {
  // Rollback
  await rollbackCompleteReward(gameId, userId)
}
```

## 🏗️ Data Structure

### Firestore Structure

```
checkins/
  {gameId}/
    users/
      {userId}/
        days/
          {dayIndex}/
            - checked: boolean
            - date: string
            - ts: Timestamp
            - key: string
            - createdAt: Timestamp
        completeReward/
          - claimed: boolean
          - ts: Timestamp
          - key: string
          - createdAt: Timestamp
```

### RTDB Structure (Backward Compatibility)

```
checkins/
  {gameId}/
    {userId}/
      {dayIndex}/
        - checked: boolean
        - date: string
        - ts: number
        - key: string
```

## ✅ ข้อดี

1. **Transaction ที่ดีกว่า**
   - Firestore transaction มี optimistic locking ที่ดีกว่า RTDB
   - Retry mechanism ที่ดีกว่า
   - ป้องกัน race condition ได้ดีกว่า

2. **Server Timestamp**
   - ใช้ `serverTimestamp()` ที่น่าเชื่อถือกว่า
   - ไม่สามารถ manipulate จาก client ได้

3. **Better Error Handling**
   - Error messages ที่ชัดเจน
   - Rollback mechanism ที่ดีกว่า

## ⚠️ ข้อควรระวัง

1. **Hybrid Approach**
   - ใช้ Firestore สำหรับ transactions
   - ใช้ RTDB สำหรับ real-time listeners
   - ต้อง sync ข้อมูลระหว่าง 2 database

2. **Cost**
   - Firestore: จ่ายตาม read/write operations
   - RTDB: จ่ายตาม bandwidth
   - ต้องคำนวณ cost ใหม่

3. **Migration**
   - ข้อมูลเก่าใน RTDB ยังอยู่
   - ต้อง migrate ข้อมูลถ้าต้องการ

## 🔄 Migration Path

### Phase 1: Hybrid (ปัจจุบัน)
- ✅ ใช้ Firestore สำหรับ transactions
- ✅ ใช้ RTDB สำหรับ real-time listeners
- ✅ Sync ข้อมูลระหว่าง 2 database

### Phase 2: Full Firestore (อนาคต)
- ⏳ Migrate real-time listeners ไป Firestore
- ⏳ ใช้ Firestore onSnapshot แทน RTDB onValue
- ⏳ ลบ RTDB dependencies

## 🧪 Testing

ทดสอบ race condition ด้วย `/test-security`:

1. เปิด `http://localhost:5173/test-security`
2. กรอกข้อมูล
3. กด "เริ่มการทดสอบ"
4. ตรวจสอบผลลัพธ์

**ผลลัพธ์ที่คาดหวัง:**
- ✅ Test 1: Duplicate Check-in Prevention - PASSED
- ✅ Test 4: Complete Reward Race Condition - PASSED

## 📝 API Reference

### `checkinWithFirestore()`
```typescript
function checkinWithFirestore(
  gameId: string,
  userId: string,
  dayIndex: number,
  serverDate: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }>
```

### `verifyCheckin()`
```typescript
function verifyCheckin(
  gameId: string,
  userId: string,
  dayIndex: number,
  uniqueKey: string
): Promise<{ verified: boolean; data?: CheckinData }>
```

### `claimCompleteRewardWithFirestore()`
```typescript
function claimCompleteRewardWithFirestore(
  gameId: string,
  userId: string,
  uniqueKey: string
): Promise<{ success: boolean; error?: string }>
```

### `verifyCompleteReward()`
```typescript
function verifyCompleteReward(
  gameId: string,
  userId: string,
  uniqueKey: string
): Promise<{ verified: boolean; data?: CompleteRewardData }>
```

## 🐛 Troubleshooting

### Error: "ALREADY_CHECKED_IN"
- **สาเหตุ**: มีการเช็คอินแล้ว
- **แก้ไข**: แสดงข้อความว่าเช็คอินแล้ว

### Error: "TRANSACTION_FAILED"
- **สาเหตุ**: Transaction retry แล้วยังล้มเหลว
- **แก้ไข**: ลองใหม่อีกครั้ง

### Error: "verifyResult.verified = false"
- **สาเหตุ**: Transaction อื่นทำไปแล้วก่อน
- **แก้ไข**: Rollback และแสดง error

## 📚 เอกสารเพิ่มเติม

- [Firestore Transaction Documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [FIRESTORE-MIGRATION-ANALYSIS.md](./FIRESTORE-MIGRATION-ANALYSIS.md)

