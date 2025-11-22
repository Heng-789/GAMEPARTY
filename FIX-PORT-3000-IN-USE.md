# 🔧 แก้ไข Error: EADDRINUSE (Port 3000 ถูกใช้งานอยู่)

## ❌ ปัญหา

Error: `EADDRINUSE: address already in use :::3000`

**สาเหตุ:** Port 3000 ถูกใช้งานอยู่แล้ว (backend server อาจรันอยู่แล้ว)

---

## ✅ วิธีแก้ไข

### วิธีที่ 1: Kill Process ที่ใช้ Port 3000 (แนะนำ)

**ขั้นตอน:**

1. **หา process ที่ใช้ port 3000:**
   ```powershell
   Get-NetTCPConnection -LocalPort 3000 | Select-Object -Property OwningProcess
   ```

2. **Kill process:**
   ```powershell
   Stop-Process -Id <PID> -Force
   ```
   (แทน `<PID>` ด้วย process ID ที่ได้จากขั้นตอนที่ 1)

3. **รัน backend server ใหม่:**
   ```powershell
   cd backend
   node src/index.js
   ```

---

### วิธีที่ 2: ใช้ Script อัตโนมัติ

**สร้างไฟล์ `kill-port-3000.ps1`:**

```powershell
# Kill process ที่ใช้ port 3000
$process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($process) {
    Stop-Process -Id $process -Force
    Write-Host "✅ Killed process $process on port 3000"
} else {
    Write-Host "ℹ️ No process using port 3000"
}
```

**รัน script:**
```powershell
.\kill-port-3000.ps1
```

---

### วิธีที่ 3: เปลี่ยน Port (ถ้าไม่ต้องการ kill process)

**แก้ไข `backend/.env` หรือ `backend/src/index.js`:**

```javascript
const PORT = process.env.PORT || 3001; // เปลี่ยนเป็น 3001
```

**และแก้ไข frontend `env.heng36`:**
```env
VITE_API_URL=http://localhost:3001
```

---

## 🔍 ตรวจสอบว่า Port ว่างแล้ว

**ทดสอบว่า port 3000 ว่างแล้ว:**

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

**ถ้าไม่มี output → Port ว่างแล้ว ✅**

---

## ✅ Checklist

- [ ] Kill process ที่ใช้ port 3000
- [ ] ตรวจสอบว่า port 3000 ว่างแล้ว
- [ ] รัน backend server ใหม่
- [ ] ตรวจสอบว่า server รันสำเร็จ

---

## 🎯 สรุป

**สาเหตุ:** Port 3000 ถูกใช้งานอยู่แล้ว

**วิธีแก้:** Kill process ที่ใช้ port 3000 แล้วรัน backend server ใหม่

**เวลาที่ใช้:** ~1 นาที

---

**ฉันได้ kill process แล้ว ลองรัน backend server ใหม่ดูครับ!**

