# 📋 สรุปการทำงานของเกมเช็คอิน (Check-in Game)

## 🎯 ภาพรวม
เกมเช็คอินเป็นระบบที่ให้ผู้ใช้เช็คอินทุกวันเพื่อรับรางวัล (เหรียญหรือโค้ด) โดยต้องเช็คอินตามลำดับวัน (Day 1, Day 2, Day 3, ...) และมีฟีเจอร์เสริม เช่น Mini Slot และ Coupon Shop

---

## 🏗️ สถาปัตยกรรมระบบ

### Frontend (React + TypeScript)
- **Component หลัก**: `CheckinGame.tsx`
- **Components รอง**: `CouponGame.tsx`, `SlotGame.tsx`
- **Real-time Updates**: Socket.io WebSocket
- **State Management**: React Hooks + Local State

### Backend (Node.js + Express + PostgreSQL)
- **Database**: PostgreSQL (3 schemas: heng36, max56, jeed24)
- **Real-time**: Socket.io Server
- **API Routes**: `/api/checkins/:gameId/:userId`

---

## 📊 โครงสร้างข้อมูล

### 1. Game Data (PostgreSQL `games` table)
```javascript
{
  game_id: string,
  game_data: {
    checkin: {
      days: number,              // จำนวนวันเช็คอิน
      rewards: Array<{           // รางวัลแต่ละวัน
        kind: 'coin' | 'code',
        value: number | string
      }>,
      features: {                // ฟีเจอร์ที่เปิด/ปิด
        dailyReward: boolean,
        miniSlot: boolean,
        couponShop: boolean
      },
      startDate: string,         // วันที่เริ่มกิจกรรม (YYYY-MM-DD)
      endDate: string,           // วันที่สิ้นสุดกิจกรรม (YYYY-MM-DD)
      slot: {                    // ตั้งค่า Mini Slot
        startBet: number,
        winRate: number
      },
      coupon: {                  // ตั้งค่า Coupon Shop
        items: Array<{
          title: string,
          rewardCredit: number,
          price: number,
          codes: string[]
        }>
      },
      rewardCodes: {              // โค้ดสำหรับ Daily Reward (code type)
        [dayIndex]: string[]
      },
      completeRewardCodes: {       // โค้ดสำหรับรางวัลครบทุกวัน
        codes: string[]
      }
    }
  }
}
```

### 2. Checkin Data (PostgreSQL `checkins` table)
```sql
CREATE TABLE checkins (
  game_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  day_index INTEGER NOT NULL,
  checked BOOLEAN DEFAULT false,
  checkin_date DATE,              -- วันที่เช็คอิน (YYYY-MM-DD)
  unique_key VARCHAR,             -- Unique key สำหรับป้องกัน duplicate
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (game_id, user_id, day_index)
);
```

### 3. User Data (PostgreSQL `users` table)
```sql
CREATE TABLE users (
  user_id VARCHAR PRIMARY KEY,
  hcoin INTEGER DEFAULT 0,        -- จำนวนเหรียญ
  status VARCHAR,                 -- ACTIVE, INACTIVE, etc.
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 4. Answers Data (PostgreSQL `answers` table)
```sql
CREATE TABLE answers (
  game_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  answer TEXT,                    -- ข้อความหรือ JSON string
  code VARCHAR,                   -- โค้ดที่ได้รับ
  action VARCHAR,                 -- 'checkin', 'coupon-redeem', 'slot', etc.
  itemIndex INTEGER,              -- Index ของรายการ (สำหรับ coupon)
  price INTEGER,                  -- ราคาที่ใช้ (สำหรับ coupon)
  ts BIGINT,                      -- Timestamp
  server_date DATE,               -- วันที่จาก server
  created_at TIMESTAMP
);
```

---

## 🔄 Flow การทำงาน

### 1. การเริ่มต้น (Initialization)

#### Frontend:
1. **โหลด Game Data**: ใช้ `useSocketIOGameData()` เพื่อโหลดข้อมูลเกม
2. **โหลด User Data**: ใช้ `useSocketIOUserData()` เพื่อโหลดข้อมูลผู้ใช้ (เหรียญ, สถานะ)
3. **โหลด Checkin Data**: ใช้ `useSocketIOCheckinData()` เพื่อโหลดสถานะการเช็คอิน
4. **โหลด Answers**: ใช้ `useSocketIOAnswers()` เพื่อโหลดโค้ดที่ได้รับ

#### Backend:
1. **Socket.io Connection**: เชื่อมต่อ WebSocket
2. **Subscribe Events**: 
   - `subscribe:game` → รับข้อมูลเกม
   - `subscribe:user` → รับข้อมูลผู้ใช้
   - `subscribe:checkin` → รับข้อมูลเช็คอิน
   - `subscribe:answers` → รับข้อมูล answers

### 2. การแสดงผล UI

#### หน้าแรก (Main Screen):
- **VIP Cards**: แสดง 3 การ์ด
  - 🟠 **Daily Reward**: เช็คอินเพื่อรับรางวัลประจำวัน
  - 🟢 **Mini Slot**: เล่นสล็อตด้วยเหรียญ
  - 🔵 **Coupon Shop**: แลกคูปองด้วยเหรียญ

#### Daily Reward Popup:
- **Grid Layout**: แสดงรางวัลแต่ละวัน (Day 1, Day 2, ...)
- **สถานะแต่ละวัน**:
  - ✅ **เช็คอินแล้ว**: แสดง ✓ และโค้ด (ถ้ามี)
  - 🟢 **วันนี้เช็คอินได้**: แสดง "วันนี้เช็คอินได้"
  - 🟡 **เช็คอินได้ในวันถัดไป**: แสดง "เช็คอินได้ในวันถัดไป"
  - ⚪ **รอเช็คอินวันก่อนหน้า**: แสดง "รอเช็คอินวันก่อนหน้า"

### 3. การเช็คอิน (Check-in Process)

#### ขั้นตอนการเช็คอิน:

**1. ตรวจสอบเงื่อนไข (Frontend)**
```typescript
// ตรวจสอบว่าเช็คอินได้หรือไม่
const openTodayIndex = useMemo(() => {
  // หาวันแรกที่ยังไม่เช็คอิน
  // Day 1: เช็คได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)
  // Day 2+: ต้องเช็คอินวันก่อนหน้าแล้ว และวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
}, [rewards, checked, serverDateKey, endDate, checkinDates, checkinData])

const canCheckin = useMemo(() => {
  // ตรวจสอบว่า openTodayIndex >= 0 และไม่ busy
  // ตรวจสอบว่าไม่ผ่าน endDate
  // ตรวจสอบว่า Day 1 ไม่เช็คอินในวันนี้แล้ว (ป้องกันการเช็คอิน Day 2 ในวันเดียวกัน)
}, [openTodayIndex, busy, rewards.length, endDate, serverDateKey, checkinDates, checkinData, checked])
```

**2. ส่งคำขอเช็คอิน (Frontend → Backend)**
```typescript
// สร้าง unique key เพื่อป้องกัน duplicate
const uniqueKey = `${ts}_${Math.random().toString(36).substring(2, 9)}`

// เรียก API
await postgresqlAdapter.checkin(
  gameId,
  userId,
  dayIndex,        // 0 = Day 1, 1 = Day 2, ...
  serverDate,      // YYYY-MM-DD
  uniqueKey
)
```

**3. ตรวจสอบและบันทึก (Backend)**
```javascript
// 1. ตรวจสอบวันที่ (ป้องกันการเช็คอินล่วงหน้า)
if (serverDate > currentDate) {
  return { error: 'FUTURE_DATE_NOT_ALLOWED' }
}

// 2. ตรวจสอบ Day ถัดไป (Day 2+)
if (dayIndex > 0) {
  // ต้องเช็คอินวันก่อนหน้าแล้ว
  if (!prevDayChecked) {
    return { error: 'PREVIOUS_DAY_NOT_CHECKED' }
  }
  // ต้องเช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้)
  if (prevDayCheckinDate >= serverDate) {
    return { error: 'PREVIOUS_DAY_CHECKED_IN_TODAY' }
  }
}

// 3. ตรวจสอบว่าเช็คอินวันนี้แล้วหรือไม่
if (alreadyCheckedInToday) {
  return { error: 'ALREADY_CHECKED_IN_TODAY' }
}

// 4. ตรวจสอบว่าเช็คอินวันอื่นในวันนี้แล้วหรือไม่ (ป้องกันการเช็คอินหลายวันในวันเดียวกัน)
if (checkedInOtherDayToday) {
  return { error: 'ALREADY_CHECKED_IN_TODAY' }
}

// 5. บันทึกลง database (ใช้ transaction)
INSERT INTO checkins (game_id, user_id, day_index, checked, checkin_date, unique_key)
VALUES ($1, $2, $3, true, $4, $5)
ON CONFLICT (game_id, user_id, day_index)
DO UPDATE SET checked = true, checkin_date = $4, unique_key = $5
```

**4. ให้รางวัล (Backend → Frontend)**
```typescript
if (reward.type === 'coin') {
  // เพิ่มเหรียญ
  await postgresqlAdapter.addUserCoins(userId, reward.amount)
} else if (reward.type === 'code') {
  // แจกโค้ด (ใช้ cursor system)
  const code = await postgresqlAdapter.claimDailyRewardCode(gameId, userId, dayIndex)
}
```

**5. อัพเดท UI (Real-time)**
```typescript
// Backend ส่ง WebSocket update
socket.emit('checkin:updated', {
  gameId,
  userId,
  checkins: {
    0: { checked: true, date: '2025-01-25', ... },
    1: { checked: true, date: '2025-01-26', ... }
  }
})

// Frontend รับ update
useSocketIOCheckinData() → อัพเดท checkinData → อัพเดท UI
```

### 4. Mini Slot Game

#### การทำงาน:
1. **ผู้ใช้กดปุ่ม "Mini Slot"**
2. **เลือกจำนวนเหรียญที่จะเดิมพัน** (startBet ขึ้นไป)
3. **กดปุ่ม "เล่น"** → ระบบสุ่มผล
4. **คำนวณผลลัพธ์**:
   - ชนะ: ได้เหรียญกลับ (ตาม winRate)
   - แพ้: เสียเหรียญที่เดิมพัน
5. **บันทึกประวัติ**: บันทึกลง `answers` table (action: 'slot')

### 5. Coupon Shop

#### การทำงาน:
1. **ผู้ใช้กดปุ่ม "Coupon Shop"**
2. **เลือกรางวัลที่ต้องการแลก**
3. **ยืนยันการแลก** → ระบบตรวจสอบ:
   - เหรียญพอหรือไม่
   - มีโค้ดเหลือหรือไม่
4. **ตัดเหรียญและแจกโค้ด**:
   ```typescript
   // 1. จองโค้ด (ใช้ cursor system)
   const code = await postgresqlAdapter.claimCouponCode(gameId, userId, itemIndex)
   
   // 2. ตัดเหรียญ
   await postgresqlAdapter.addUserCoins(userId, -price)
   
   // 3. บันทึกประวัติ
   await logAction(gameId, userId, {
     action: 'coupon-redeem',
     itemIndex,
     price,
     code,
     balanceBefore,
     balanceAfter
   })
   ```
5. **แสดงโค้ดและประวัติ**: แสดงโค้ดที่ได้รับและประวัติการแลก

---

## 🔐 ระบบความปลอดภัย

### 1. การป้องกันการเช็คอินซ้ำ
- ✅ **Unique Key**: ใช้ `unique_key` เพื่อป้องกัน duplicate transaction
- ✅ **Database Transaction**: ใช้ `FOR UPDATE` เพื่อป้องกัน race condition
- ✅ **Date Validation**: ตรวจสอบวันที่จาก server (ป้องกันการปรับเวลา)
- ✅ **One Check-in Per Day**: อนุญาตให้เช็คอินได้วันละ 1 ครั้งเท่านั้น

### 2. การป้องกันการเช็คอินล่วงหน้า
- ✅ **Server Date Check**: ตรวจสอบวันที่จาก server (ไม่ใช้ client time)
- ✅ **Future Date Block**: ป้องกันการเช็คอินวันที่อนาคต
- ✅ **Date Consistency**: ตรวจสอบความสอดคล้องของวันที่หลายครั้ง

### 3. การป้องกันการเช็คอินข้ามวัน
- ✅ **Sequential Check-in**: ต้องเช็คอินตามลำดับ (Day 1 → Day 2 → Day 3)
- ✅ **Previous Day Validation**: ตรวจสอบว่าวันก่อนหน้าเช็คอินแล้ว
- ✅ **Date Comparison**: ตรวจสอบว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน

---

## 📡 Real-time Updates (Socket.io)

### Events ที่ใช้:

**1. Game Updates**
```javascript
socket.on('game:updated', (gameData) => {
  // อัพเดทข้อมูลเกม
})
```

**2. User Updates**
```javascript
socket.on('user:updated', (payload) => {
  // อัพเดทเหรียญและสถานะผู้ใช้
})
```

**3. Checkin Updates**
```javascript
socket.on('checkin:updated', (payload) => {
  // อัพเดทสถานะการเช็คอิน
  // payload: { gameId, userId, checkins: { 0: {...}, 1: {...} } }
})
```

**4. Answers Updates**
```javascript
socket.on('answer:updated', (payload) => {
  // อัพเดทโค้ดที่ได้รับ
})
```

---

## 🗄️ Database Schema

### Tables ที่เกี่ยวข้อง:

**1. `games` table**
- เก็บข้อมูลเกมทั้งหมด
- `game_data` เป็น JSONB field เก็บข้อมูล checkin config

**2. `checkins` table**
- เก็บสถานะการเช็คอินของแต่ละ user
- Primary Key: `(game_id, user_id, day_index)`
- Indexes: `game_id`, `user_id`, `checkin_date`

**3. `users` table**
- เก็บข้อมูลผู้ใช้ (เหรียญ, สถานะ)
- Primary Key: `user_id`

**4. `answers` table**
- เก็บประวัติการกระทำ (เช็คอิน, แลกคูปอง, เล่นสล็อต)
- เก็บโค้ดที่ได้รับ
- Indexes: `game_id`, `user_id`, `ts`, `action`

---

## 🎨 UI Components

### 1. CheckinGame Component
- **Main Component**: จัดการการเช็คอินทั้งหมด
- **VIP Cards**: แสดงการ์ดสำหรับ Daily Reward, Mini Slot, Coupon Shop
- **Daily Reward Grid**: แสดงรางวัลแต่ละวัน
- **Overlays**: Popup สำหรับแสดงผลและยืนยัน

### 2. CouponGame Component
- **Coupon Grid**: แสดงรายการคูปองที่แลกได้
- **History Section**: แสดงประวัติการแลกคูปอง
- **Confirmation Popup**: ยืนยันการแลก
- **Code Popup**: แสดงโค้ดที่ได้รับ

### 3. SlotGame Component
- **Slot Machine UI**: แสดงสล็อต
- **Bet Selection**: เลือกจำนวนเหรียญที่จะเดิมพัน
- **Result Display**: แสดงผลการเล่น

---

## 🔄 State Management

### Local State (React Hooks):
```typescript
const [checked, setChecked] = useState<Record<number, boolean>>({})
const [checkinDates, setCheckinDates] = useState<Record<number, string>>({})
const [dayCodes, setDayCodes] = useState<Record<number, string>>({})
const [hcoin, setHcoin] = useState(0)
const [openCheckin, setOpenCheckin] = useState(false)
const [openSlot, setOpenSlot] = useState(false)
const [openCoupon, setOpenCoupon] = useState(false)
```

### Real-time Data (Socket.io Hooks):
```typescript
const { data: checkinData } = useSocketIOCheckinData(gameId, userId)
const { data: userData } = useSocketIOUserData(userId)
const { data: answersData } = useSocketIOAnswers(gameId, 100)
```

---

## 📝 Logging & History

### 1. Check-in History
- บันทึกลง `checkins` table
- เก็บ `day_index`, `checkin_date`, `unique_key`

### 2. Coupon Redemption History
- บันทึกลง `answers` table
- เก็บ `action: 'coupon-redeem'`, `itemIndex`, `price`, `code`
- แสดงใน Coupon Shop → "📋 ประวัติการแลกคูปอง"

### 3. Slot Play History
- บันทึกลง `answers` table
- เก็บ `action: 'slot'`, `bet`, `balanceBefore`, `balanceAfter`

---

## 🎯 Business Rules

### 1. การเช็คอิน
- ✅ **Day 1**: เช็คได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)
- ✅ **Day 2+**: ต้องเช็คอินวันก่อนหน้าแล้ว และวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
- ✅ **One Per Day**: เช็คอินได้วันละ 1 ครั้งเท่านั้น
- ✅ **Sequential**: ต้องเช็คอินตามลำดับ (ไม่สามารถข้ามวันได้)

### 2. รางวัล
- ✅ **Coin Reward**: เพิ่มเหรียญทันที
- ✅ **Code Reward**: แจกโค้ดจาก cursor system (ไม่ซ้ำ)
- ✅ **Complete Reward**: รางวัลเมื่อเช็คอินครบทุกวัน

### 3. Coupon Shop
- ✅ **Multiple Redemptions**: แลกได้หลายครั้ง (ไม่จำกัด)
- ✅ **Code Cursor**: ใช้ cursor system เพื่อแจกโค้ดไม่ซ้ำ
- ✅ **Balance Check**: ตรวจสอบเหรียญก่อนแลก

### 4. Mini Slot
- ✅ **Win Rate**: ใช้ winRate ที่ตั้งค่าไว้ (default: 30%)
- ✅ **Bet Amount**: ต้อง >= startBet
- ✅ **Balance Update**: อัพเดทเหรียญทันที

---

## 🚀 Performance Optimizations

### 1. Caching
- ✅ **Game Data Cache**: Cache 2 นาที
- ✅ **User Data Cache**: Cache 10 นาที
- ✅ **Checkin Data Cache**: Cache 2 นาที
- ✅ **Answers Cache**: Cache 1 นาที

### 2. Real-time Updates
- ✅ **WebSocket**: ใช้ Socket.io สำหรับ real-time updates
- ✅ **Snapshot Engine**: ใช้ snapshot เพื่อลด payload size
- ✅ **Diff Engine**: ใช้ diff เพื่อส่งเฉพาะข้อมูลที่เปลี่ยน

### 3. Database
- ✅ **Indexes**: มี indexes สำหรับ query ที่ใช้บ่อย
- ✅ **Connection Pooling**: ใช้ connection pool เพื่อลด overhead
- ✅ **Query Timeout**: มี timeout protection (30 วินาที)

---

## 🐛 Error Handling

### 1. Frontend
- ✅ **Try-Catch**: ครอบคลุมทุก async operations
- ✅ **User Feedback**: แสดงข้อความ error ที่เข้าใจง่าย
- ✅ **Fallback**: ใช้ client time เป็น fallback ถ้า server time ไม่ได้

### 2. Backend
- ✅ **Transaction Rollback**: Rollback เมื่อเกิด error
- ✅ **Error Logging**: Log error พร้อม context
- ✅ **Graceful Degradation**: Return empty object แทน error (บางกรณี)

---

## 📊 Monitoring & Debugging

### 1. Console Logs
- ✅ **Checkin Status**: Log สถานะการเช็คอินแต่ละวัน
- ✅ **Data Loading**: Log การโหลดข้อมูล
- ✅ **Error Logging**: Log error พร้อม stack trace

### 2. Database Queries
- ✅ **Query Logging**: Log query ที่สำคัญ
- ✅ **Performance Monitoring**: ตรวจสอบ query time
- ✅ **Connection Health**: ตรวจสอบ connection pool

---

## 🎓 สรุป

### ระบบเกมเช็คอินประกอบด้วย:

1. **Daily Reward System**: เช็คอินทุกวันเพื่อรับรางวัล
2. **Mini Slot Game**: เล่นสล็อตด้วยเหรียญ
3. **Coupon Shop**: แลกคูปองด้วยเหรียญ
4. **Real-time Updates**: อัพเดทข้อมูลแบบ real-time ผ่าน WebSocket
5. **History Tracking**: บันทึกประวัติการกระทำทั้งหมด
6. **Security**: มีระบบป้องกันการโกงหลายชั้น

### เทคโนโลยีที่ใช้:
- **Frontend**: React, TypeScript, Socket.io Client
- **Backend**: Node.js, Express, PostgreSQL, Socket.io Server
- **Real-time**: WebSocket (Socket.io)
- **Database**: PostgreSQL (3 schemas)

### ฟีเจอร์หลัก:
- ✅ เช็คอินตามลำดับวัน
- ✅ ป้องกันการเช็คอินซ้ำ
- ✅ Real-time updates
- ✅ ประวัติการแลกคูปอง
- ✅ Mini Slot Game
- ✅ Coupon Shop

---

*อัพเดทล่าสุด: 2025-01-25*

