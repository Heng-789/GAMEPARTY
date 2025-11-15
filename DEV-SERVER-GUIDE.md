# 🚀 Dev Server Guide

## ❌ ปัญหา: รัน dev servers ใน terminal cursor ไม่ได้

ใน terminal cursor เมื่อใช้ `&` หรือ background jobs ใน PowerShell อาจจะไม่ทำงานได้ดี เพราะ:
- Background jobs อาจจะไม่แสดง output
- Process อาจจะไม่รันต่อเนื่อง
- Terminal cursor อาจจะไม่รองรับ background processes

## ✅ วิธีแก้ไข

### วิธีที่ 1: รันแต่ละตัวแยกกัน (แนะนำสำหรับ terminal cursor)

เปิด terminal ใหม่ 3 หน้าต่าง แล้วรันแต่ละตัว:

```bash
# Terminal 1: HENG36
npm run dev:heng36

# Terminal 2: MAX56  
npm run dev:max56

# Terminal 3: JEED24
npm run dev:jeed24
```

### วิธีที่ 2: ใช้ script เปิดทั้ง 3 ตัวพร้อมกัน

```bash
# ใช้ PowerShell script
npm run dev:all

# หรือรันโดยตรง
.\run-dev-all.ps1

# หรือใช้ batch file
.\run-dev-all.bat
```

Script จะเปิดหน้าต่าง PowerShell/CMD ใหม่ 3 หน้าต่าง แต่ละหน้าต่างรัน dev server ตัวหนึ่ง

### วิธีที่ 3: ใช้ Start-Process ใน PowerShell

```powershell
# HENG36
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:heng36"

# MAX56
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:max56"

# JEED24
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:jeed24"
```

## 📋 Dev Server URLs

หลังจากรัน dev servers แล้ว จะสามารถเข้าถึงได้ที่:

- **HENG36**: http://localhost:5173
- **MAX56**: http://localhost:5174
- **JEED24**: http://localhost:5175

## 🔧 Troubleshooting

### Port ถูกใช้งานแล้ว

ถ้าเจอ error "port already in use":

```bash
# ตรวจสอบว่า port ถูกใช้งานอยู่หรือไม่
netstat -ano | findstr "5173 5174 5175"

# หยุด process ที่ใช้ port
# Windows: ใช้ Task Manager หรือ
taskkill /PID <process_id> /F
```

### ตรวจสอบไฟล์ env

ตรวจสอบว่ามีไฟล์ env ครบถ้วน:
- `env.heng36`
- `env.max56`
- `env.jeed24`

### ตรวจสอบ dependencies

```bash
# ติดตั้ง dependencies
npm install

# ตรวจสอบว่า node_modules มีอยู่
Test-Path node_modules
```

## 💡 Tips

1. **สำหรับ terminal cursor**: แนะนำให้รันแต่ละตัวแยกกันใน terminal แยกกัน
2. **สำหรับ development**: ใช้ script `run-dev-all.ps1` หรือ `run-dev-all.bat` เพื่อเปิดทั้ง 3 ตัวพร้อมกัน
3. **ตรวจสอบ logs**: ดู output ในแต่ละ terminal window เพื่อดูว่ามี error หรือไม่

