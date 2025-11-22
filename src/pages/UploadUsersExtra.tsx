// src/pages/UploadUsersExtra.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { useThemeBranding, useThemeAssets } from '../contexts/ThemeContext'
import * as postgresqlAdapter from '../services/postgresql-adapter'

import '../styles/upload-users.css'

type Row = { user: string; password: string }
type Stats = { total: number; valid: number; dup: number; invalid: number; existing?: number }

const colToIndex = (s: string) => {
  const t = s.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(t)) return 0
  let n = 0
  for (let i = 0; i < t.length; i++) n = n * 26 + (t.charCodeAt(i) - 64)
  return Math.max(0, n - 1)
}

const DB_PATH = 'USERS_EXTRA'
const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '').toUpperCase()

const mask = (pw: string) => (pw ? pw : '—')

// ฟังก์ชันสำหรับเพิ่มเลข 0 ด้านหน้ารหัสผ่านให้ครบ 4 ตัว
const padPassword = (password: string): string => {
  if (!password) return ''
  const digitsOnly = String(password).replace(/\D+/g, '')
  if (!digitsOnly) return ''
  const lastFour = digitsOnly.slice(-4)
  return lastFour.padStart(4, '0')
}

export default function UploadUsersExtra() {
  const nav = useNavigate()
  const branding = useThemeBranding()
  const assets = useThemeAssets()

  const fileRef = React.useRef<HTMLInputElement>(null)

  const [busy, setBusy] = React.useState(false)
  const [toast, setToast] = React.useState<string | null>(null)
  const [openUploadPopup, setOpenUploadPopup] = React.useState(false)
  const [openEditPopup, setOpenEditPopup] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<{ userKey: string; userData: any } | null>(null)
  const [showUploadHistory, setShowUploadHistory] = React.useState(false)
  const [showRightPanel, setShowRightPanel] = React.useState(true)
  const [allUsersData, setAllUsersData] = React.useState<Record<string, any>>({})
  const [filteredUsers, setFilteredUsers] = React.useState<Record<string, any>>({})
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [usersPerPage] = React.useState(20) // ลดจำนวนรายการต่อหน้าเพื่อประสิทธิภาพที่ดีขึ้น
  
  // ✅ Ref สำหรับเก็บ unsubscribe functions ของ real-time listeners
  const unsubscribesRef = React.useRef<Array<() => void>>([])

  // คำนวณ pagination
  const totalUsers = Object.keys(filteredUsers).length
  const totalPages = Math.ceil(totalUsers / usersPerPage)
  const startIndex = (currentPage - 1) * usersPerPage
  const endIndex = startIndex + usersPerPage
  const currentUsers = Object.entries(filteredUsers).slice(startIndex, endIndex)

  // ฟังก์ชันเปลี่ยนหน้า
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // ฟังก์ชันไปหน้าถัดไป
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  // ฟังก์ชันไปหน้าก่อนหน้า
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  // พรีวิว
  const [rows, setRows] = React.useState<Row[]>([])
  const [invalids, setInvalids] = React.useState<string[]>([])
  const [stats, setStats] = React.useState<Stats>({ total: 0, valid: 0, dup: 0, invalid: 0 })

  // ฟอร์มแมนนวล
  const [mUser, setMUser] = React.useState('')
  const [mPass, setMPass] = React.useState('')

  // ประวัติการอัพโหลด
  const [uploadHistory, setUploadHistory] = React.useState<Array<{
    id: string
    userCount: number
    timestamp: number
    type: 'manual' | 'csv' | 'status'
    users?: Array<{ user: string; password: string }> // เก็บข้อมูล USER
    statusType?: string // เก็บประเภทสถานะ (ACTIVE)
  }>>(() => {
    // โหลดข้อมูลจาก localStorage เมื่อ component mount
    try {
      const saved = localStorage.getItem('uploadHistory')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // รายการที่เลือกแสดง
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string | null>(null)


  // ระบบแก้ไข USER
  const [editPassword, setEditPassword] = React.useState('')
  const [editHcoin, setEditHcoin] = React.useState('')

  const [colUser, setColUser]   = React.useState('A')
  const [colPass, setColPass]   = React.useState('B')
  const [startRow, setStartRow] = React.useState(1)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1600)
  }

  // บันทึก uploadHistory ลง localStorage ทุกครั้งที่เปลี่ยนแปลง
  React.useEffect(() => {
    try {
      localStorage.setItem('uploadHistory', JSON.stringify(uploadHistory))
    } catch (error) {
      console.error('Error saving upload history to localStorage:', error)
    }
  }, [uploadHistory])

  // ✅ เก็บ userIds เพื่อใช้เป็น dependency (แทน filteredUsers object)
  const userIdsRef = React.useRef<string[]>([])
  const userIds = React.useMemo(() => {
    const keys = Object.keys(filteredUsers)
    // ✅ เปรียบเทียบกับ userIdsRef เพื่อดูว่ามีการเปลี่ยนแปลงหรือไม่
    const keysStr = keys.sort().join(',')
    const prevKeysStr = userIdsRef.current.sort().join(',')
    if (keysStr !== prevKeysStr) {
      userIdsRef.current = keys
    }
    return userIdsRef.current
  }, [filteredUsers])

  // ✅ Real-time listener สำหรับอัพเดต hcoin เมื่อมีการเปลี่ยนแปลง (เฉพาะเมื่อแสดงรายการ USER)
  React.useEffect(() => {
    if (!showRightPanel || showUploadHistory || userIds.length === 0) {
      return
    }

    // ✅ Clear previous subscriptions
    unsubscribesRef.current.forEach(unsub => unsub())
    unsubscribesRef.current = []
    
    let isMounted = true
    
      // ✅ ใช้ PostgreSQL adapter - polling แทน real-time listener
      // เนื่องจาก PostgreSQL ไม่มี real-time listener เหมือน Firebase
      // ใช้ polling ทุก 2 วินาทีเพื่ออัพเดต hcoin
      const pollUsers = async () => {
        if (!isMounted) return
        
        try {
          // ✅ ดึงข้อมูล users ปัจจุบันจาก PostgreSQL
          const currentUserIds = userIds.join(',')
          if (!currentUserIds) return
          
          // ✅ ดึงข้อมูล users ทั้งหมดที่แสดงอยู่ (ใช้ search เพื่อดึงเฉพาะ users ที่ต้องการ)
          // เนื่องจากไม่มี endpoint สำหรับดึงหลาย users พร้อมกัน ให้ใช้ getAllUsers แล้ว filter
          const result = await postgresqlAdapter.getAllUsers(1, 1000, '')
          const usersMap = new Map(result.users.map(u => [u.userId.toLowerCase(), u]))
          
          // ✅ อัพเดต hcoin สำหรับ users ที่แสดงอยู่
          setFilteredUsers(prev => {
            let updated = false
            const newFiltered: Record<string, any> = { ...prev }
            
            for (const userId of userIds) {
              const userLower = userId.toLowerCase()
              const dbUser = usersMap.get(userLower)
              if (dbUser && prev[userId]) {
                const newHcoin = Number(dbUser.hcoin ?? 0)
                const currentHcoin = Number(prev[userId].hcoin ?? 0)
                if (currentHcoin !== newHcoin) {
                  newFiltered[userId] = {
                    ...prev[userId],
                    hcoin: newHcoin
                  }
                  updated = true
                }
              }
            }
            
            return updated ? newFiltered : prev
          })
          
          // ✅ อัพเดต allUsersData ด้วย
          setAllUsersData(prev => {
            let updated = false
            const newAllUsers: Record<string, any> = { ...prev }
            
            for (const userId of userIds) {
              const userLower = userId.toLowerCase()
              const dbUser = usersMap.get(userLower)
              if (dbUser && prev[userId]) {
                const newHcoin = Number(dbUser.hcoin ?? 0)
                const currentHcoin = Number(prev[userId].hcoin ?? 0)
                if (currentHcoin !== newHcoin) {
                  newAllUsers[userId] = {
                    ...prev[userId],
                    hcoin: newHcoin
                  }
                  updated = true
                }
              }
            }
            
            return updated ? newAllUsers : prev
          })
        } catch (error) {
          console.error('Error polling users:', error)
        }
      }
      
      // Poll immediately
      pollUsers()
      
      // Poll every 2 seconds
      const interval = setInterval(pollUsers, 2000)
      
      // ✅ เก็บ interval ใน ref เพื่อ cleanup
      unsubscribesRef.current.push(() => clearInterval(interval))

    return () => {
      isMounted = false
      unsubscribesRef.current.forEach(unsub => unsub())
      unsubscribesRef.current = []
    }
  }, [showRightPanel, showUploadHistory, userIds.join(',')]) // ✅ ใช้ userIds.join(',') แทน filteredUsers object

  // ฟังก์ชันค้นหา USER (ค้นหาตามตัวอักษรที่พิมพ์ในช่องค้นหาเท่านั้น)
  const searchUsers = async () => {
    setIsLoading(true)
    try {
      // ✅ ใช้ PostgreSQL adapter 100%
      const MAX_USERS_DISPLAY = 100 // แสดงเฉพาะ 100 users แรก
      let users: Array<{ userId: string; [key: string]: any }> = []
      
      // ถ้าไม่กรอกเงื่อนไขใดๆ ให้แสดงข้อมูล top 100 users (ตาม hcoin)
      if (!searchTerm.trim()) {
        // ✅ Query top 100 users จาก PostgreSQL
        users = await postgresqlAdapter.getTopUsers(MAX_USERS_DISPLAY)
        showToast(`แสดงข้อมูล top ${users.length} USER (เรียงตาม hcoin)`)
      } else {
        // ✅ Search users จาก PostgreSQL (ตาม username/userId)
        users = await postgresqlAdapter.searchUsers(searchTerm.trim(), MAX_USERS_DISPLAY)
        showToast(`พบ ${users.length} USER (แสดง 100 users แรกที่ match)`)
      }
      
      // แปลงเป็น filtered format (Record<string, any>)
      const filtered: Record<string, any> = {}
      users.forEach(user => {
        filtered[user.userId] = {
          password: user.password,
          hcoin: user.hcoin,
          status: user.status,
          ...user
        }
      })
      
      setFilteredUsers(filtered)
      // ✅ เก็บ allUsersData เฉพาะส่วนที่ filter แล้ว (ลด memory usage)
      setAllUsersData(filtered)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error searching users:', error)
      showToast('เกิดข้อผิดพลาดในการค้นหา')
    } finally {
      setIsLoading(false)
    }
  }


  /** ตรวจความถูกต้องพื้นฐาน */
  const isValid = (u: string, p: string) => {
    const userOk = !!u && /^[0-9a-zA-Z_]+$/.test(u)
    const passOk = !!p
    return userOk && passOk
  }

  /** คำนวณสถิติ */
  const recomputeStats = React.useCallback((list: Row[], bads: string[], existing: number = 0) => {
    const total = list.length + bads.length + existing
    const invalid = bads.length
    const seen = new Set<string>()
    let dup = 0
    list.forEach(r => {
      const k = r.user.toLowerCase()
      if (seen.has(k)) dup += 1
      else seen.add(k)
    })
    const valid = list.length - dup
    setStats({ total, valid, dup, invalid, existing })
  }, [])

  /** เพิ่มแมนนวล -> ลงพรีวิว */
  // แทนที่ addManual เดิม
  const addManual = async () => {
  const u = normalizeUser(mUser)
  const p = padPassword(mPass) // ใช้ฟังก์ชัน padding รหัสผ่าน
  if (!isValid(u, p)) { showToast('รูปแบบ USER/PASSWORD ไม่ถูกต้อง'); return }

  setBusy(true)
  try {
    // Use PostgreSQL adapter
    try {
      // ✅ ใช้ PostgreSQL adapter 100%
      await postgresqlAdapter.bulkUpdateUsers([{ userId: u, password: p }])
      showToast('เพิ่มผู้ใช้สำเร็จ')
    } catch (error) {
      console.error('Error updating user via PostgreSQL:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(`เกิดข้อผิดพลาดในการเพิ่มผู้ใช้: ${errorMessage}`)
      return
    }
    // อัปเดตพรีวิวให้เห็นทันที
    const next = [...rows, { user: u, password: p }]
    setRows(next); recomputeStats(next, invalids)
    
    // บันทึกประวัติการอัพโหลด
    const historyItem = {
      id: Date.now().toString(),
      userCount: 1,
      timestamp: Date.now(),
      type: 'manual' as const,
      users: [{ user: u, password: p }]
    }
    setUploadHistory(prev => [historyItem, ...prev])
    
    setMUser(''); setMPass('')
  } finally {
    setBusy(false)
  }
}


  /** เลือกไฟล์ CSV */
  const pickCSV = () => fileRef.current?.click()

  /** parse CSV -> rows */
  /** parse CSV -> rows (รองรับไฟล์ไม่มี header, map จากคอลัมน์ A/B และแถวเริ่มต้น) */
  const onPickCSV: React.ChangeEventHandler<HTMLInputElement> = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  setBusy(true)
  setParseProgress({ isParsing: true, current: 0, total: 0 })
  
  // ตั้งค่า total ตามขนาดไฟล์ (ประมาณ)
  const fileSize = file.size
  const estimatedRows = Math.floor(fileSize / 50) // ประมาณ 50 bytes ต่อแถว
  setParseProgress({ isParsing: true, current: 0, total: estimatedRows })

  const userIdx = colToIndex(colUser || 'A')
  const passIdx = colToIndex(colPass || 'B')
  const start   = Math.max(0, (Number(startRow) || 1) - 1)

  Papa.parse(file, {
    header: false,                 // ← อ่านเป็นแถวๆ ไม่มีชื่อคอลัมน์
    skipEmptyLines: true,
    chunkSize: 500,               // จำกัดขนาด chunk เป็น 500 แถว
    chunk: (results, parser) => {
      // ใช้ chunk แทน step เพื่อลดการอัปเดต state
      const data = results.data as any[]
      if (data && data.length > 0) {
        const good: Row[] = []
        const bad: string[] = []
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          if (!row) continue
          const u = normalizeUser(String(row[userIdx] ?? ''))
          const p = padPassword(String(row[passIdx] ?? '')) // ใช้ฟังก์ชัน padding รหัสผ่าน
          if (isValid(u, p)) good.push({ user: u, password: p })
          else bad.push(`แถวที่ ${tempRowsRef.current.length + tempInvalidsRef.current.length + i + 1}`)
        }
        
        // เก็บข้อมูลใน ref
        tempRowsRef.current.push(...good)
        tempInvalidsRef.current.push(...bad)
        updateCounterRef.current += data.length
        
        // อัปเดต UI ตามการตั้งค่า showPreview
        if (updateCounterRef.current % 1000 === 0) {
          setTimeout(() => {
            if (showPreview) {
              setRows([...tempRowsRef.current])
              setInvalids([...tempInvalidsRef.current])
            }
            setParseProgress(prev => ({
              ...prev,
              current: updateCounterRef.current
            }))
          }, 0)
        }
      }
    },
    complete: async (res) => {
      // ใช้ setTimeout เพื่อป้องกัน infinite recursion
      setTimeout(async () => {
        try {
          // ✅ ใช้ PostgreSQL adapter - ดึงข้อมูล USER ที่มีอยู่ในฐานข้อมูลเพื่อเช็คซ้ำ
          const result = await postgresqlAdapter.getAllUsers(1, 10000, '')
          const existingUserKeys = new Set((result.users || []).map(u => u.userId.toLowerCase()))
          
          // ตรวจสอบซ้ำในไฟล์ CSV และกับฐานข้อมูล
          const seenInFile = new Set<string>()
          const duplicates: string[] = []
          const existingInDB: string[] = []
          const uniqueRows: Row[] = []
          
          for (const row of tempRowsRef.current) {
            const userKey = row.user.toLowerCase()
            
            // เช็คซ้ำในไฟล์
            if (seenInFile.has(userKey)) {
              duplicates.push(row.user)
              continue
            }
            seenInFile.add(userKey)
            
            // เช็คซ้ำกับฐานข้อมูล
            if (existingUserKeys.has(userKey)) {
              existingInDB.push(row.user)
              continue
            }
            
            uniqueRows.push(row)
          }
          
          // อัปเดตข้อมูลสุดท้าย (ถ้าเปิด showPreview)
          if (showPreview) {
            setRows([...uniqueRows])
            setInvalids([...tempInvalidsRef.current, ...duplicates, ...existingInDB])
          }
          
          // คำนวณ stats จากข้อมูลที่ประมวลผลแล้ว
          recomputeStats(uniqueRows, [...tempInvalidsRef.current, ...duplicates], existingInDB.length)
          
          // บันทึกประวัติการอัพโหลด
          if (uniqueRows.length > 0) {
            const historyItem = {
              id: Date.now().toString(),
              userCount: uniqueRows.length,
              timestamp: Date.now(),
              type: 'csv' as const,
              users: uniqueRows
            }
            setUploadHistory(prev => [historyItem, ...prev])
          }
          
          // แสดงผลการตรวจสอบ
          let message = `โหลดไฟล์แล้ว: ใช้คอลัมน์ ${colUser}/${colPass}, เริ่มแถว ${start + 1}`
          if (uniqueRows.length > 0) message += ` (${uniqueRows.length} แถว OK)`
          if (duplicates.length > 0) message += `, ซ้ำในไฟล์: ${duplicates.length}`
          if (existingInDB.length > 0) message += `, มีในฐานข้อมูลแล้ว: ${existingInDB.length}`
          
          showToast(message)
          
        } catch (error) {
          console.error('Error checking duplicates:', error)
          showToast('เกิดข้อผิดพลาดในการตรวจสอบซ้ำ')
        } finally {
          // รีเซ็ต refs
          tempRowsRef.current = []
          tempInvalidsRef.current = []
          updateCounterRef.current = 0
          
          setBusy(false)
          setParseProgress({ isParsing: false, current: 0, total: 0 })
          
          if (fileRef.current) fileRef.current.value = '' // เลือกไฟล์เดิมซ้ำได้
        }
      }, 0)
    },
    error: () => {
      setBusy(false)
      showToast('อ่านไฟล์ไม่สำเร็จ')
    },
  })
}


  /** ดึงทั้งหมดจาก DB -> ลงพรีวิว */
  const loadAll = async () => {
    setBusy(true)
    try {
      // Use PostgreSQL adapter
      let allUsers: Row[] = []
      let page = 1
      const limit = 100
      
      while (true) {
        try {
          const result = await postgresqlAdapter.getAllUsers(page, limit, '')
          allUsers = allUsers.concat(
            result.users.map((u) => ({
              user: u.userId,
              password: u.password || '',
            }))
          )
          
          if (result.users.length < limit || allUsers.length >= result.total) {
            break
          }
          page++
        } catch (error) {
          console.error('Error fetching users from PostgreSQL:', error)
          showToast('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้')
          break
        }
      }
      
      setRows(allUsers)
      setInvalids([])
      recomputeStats(allUsers, [])
      
      // เพิ่มประวัติการอัพโหลด
      if (allUsers.length > 0) {
        const historyItem = {
          id: Date.now().toString(),
          userCount: allUsers.length,
          timestamp: Date.now(),
          type: 'csv' as const,
          users: allUsers
        }
        setUploadHistory(prev => [historyItem, ...prev])
      }
      
      showToast(`ดึงทั้งหมดแล้ว (${allUsers.length})`)
    } finally {
      setBusy(false)
    }
  }

  // State for progress tracking
  const [uploadProgress, setUploadProgress] = React.useState({
    isUploading: false,
    current: 0,
    total: 0,
    currentUser: '',
    batch: 0,
    totalBatches: 0
  })

  const [parseProgress, setParseProgress] = React.useState({
    isParsing: false,
    current: 0,
    total: 0
  })

  // ใช้ ref เพื่อเก็บข้อมูลชั่วคราว
  const tempRowsRef = React.useRef<Row[]>([])
  const tempInvalidsRef = React.useRef<string[]>([])
  const updateCounterRef = React.useRef(0)
  
  // ตัวเลือกการแสดงพรีวิว
  const [showPreview, setShowPreview] = React.useState(true)

  /** บันทึก (อัปเดตทับ) — ใช้ update ทีละก้อนแบบ merge พร้อมแสดงความคืบหน้า */
  const saveAll = async () => {
    if (rows.length === 0) { showToast('ยังไม่มีข้อมูลพรีวิว'); return }
    
    // ข้อมูลใน rows ผ่านการตรวจสอบซ้ำแล้ว ไม่ต้องเช็คซ้ำอีก
    const unique = rows

    const BATCH_SIZE = 50 // จำนวน USER ต่อ batch
    const totalBatches = Math.ceil(unique.length / BATCH_SIZE)
    
    setUploadProgress({
      isUploading: true,
      current: 0,
      total: unique.length,
      currentUser: '',
      batch: 0,
      totalBatches
    })

    setBusy(true)
    try {
      // แบ่งข้อมูลเป็น batch
      for (let i = 0; i < unique.length; i += BATCH_SIZE) {
        const batch = unique.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        
        setUploadProgress(prev => ({
          ...prev,
          batch: batchNumber,
          currentUser: batch[0]?.user || ''
        }))

        // Use PostgreSQL adapter for bulk update
        try {
          const usersToUpdate = batch.map(r => ({
            userId: r.user,
            password: r.password,
            // ไม่ส่ง hcoin เพราะจะใช้ค่าเดิมในฐานข้อมูล (ถ้ามี)
            // ไม่ส่ง status เพราะจะใช้ค่าเดิมในฐานข้อมูล (ถ้ามี)
          }))
          await postgresqlAdapter.bulkUpdateUsers(usersToUpdate)
        } catch (error) {
          console.error(`[UploadUsersExtra] Error bulk updating batch ${batchNumber}/${totalBatches}:`, error)
          const errorMessage = error instanceof Error ? error.message : String(error)
          throw new Error(`เกิดข้อผิดพลาดใน batch ${batchNumber}/${totalBatches}: ${errorMessage}`)
        }
        
        // อัปเดตความคืบหน้า
        setUploadProgress(prev => ({
          ...prev,
          current: Math.min(i + BATCH_SIZE, unique.length)
        }))

        // หน่วงเวลาเล็กน้อยเพื่อให้ UI อัปเดต
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      showToast(`บันทึกสำเร็จ! อัปโหลด ${unique.length} USER เรียบร้อย`)
      
      // ✅ Clear preview หลังจากบันทึกสำเร็จ
      setRows([])
      setInvalids([])
      recomputeStats([], [])
      
      // ✅ Refresh ข้อมูล USER ทั้งหมด
      await searchUsers()
    } catch (error) {
      console.error('Error in saveAll:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(`เกิดข้อผิดพลาด: ${errorMessage}`)
    } finally {
      setBusy(false)
      setUploadProgress({
        isUploading: false,
        current: 0,
        total: 0,
        currentUser: '',
        batch: 0,
        totalBatches: 0
      })
    }
  }

  /** Export USERS_EXTRA ทั้งหมดเป็น CSV */
  const exportAll = async () => {
    setBusy(true)
    try {
      // Use PostgreSQL adapter
      let allUsers: Array<{ user: string; password: string }> = []
      try {
        let page = 1
        const limit = 100
        while (true) {
          const result = await postgresqlAdapter.getAllUsers(page, limit, '')
          allUsers = allUsers.concat(
            result.users.map((u) => ({
              user: u.userId,
              password: u.password || '',
            }))
          )
          if (result.users.length < limit || allUsers.length >= result.total) {
            break
          }
          page++
        }
      } catch (error) {
        console.error('Error fetching users from PostgreSQL:', error)
        showToast('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้')
        return
      }
      
      const data = allUsers
      const csv = Papa.unparse(data, { header: true })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'USERS_EXTRA.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Export ${data.length} รายการแล้ว`)
    } finally {
      setBusy(false)
    }
  }

  /** ลบประวัติการอัพโหลดและลบ USER ที่เกี่ยวข้อง */
  const deleteHistoryItem = async (id: string) => {
    const historyItem = uploadHistory.find(item => item.id === id)
    if (!historyItem) return

    const typeLabel = historyItem.type === 'manual' ? 'Manual' : 
                     historyItem.type === 'csv' ? 'CSV' : 
                     'เพิ่มสถานะ'
    
    if (!confirm(`ยืนยันลบรายการอัปโหลดนี้?\n\nรายการ: ${typeLabel}${historyItem.statusType ? ` (${historyItem.statusType})` : ''}\nจำนวน USER: ${historyItem.userCount}\nวันที่: ${new Date(historyItem.timestamp).toLocaleString('th-TH')}\n\nการลบจะทำให้ USER ทั้งหมดในรายการนี้ถูกลบออกจากฐานข้อมูลด้วย`)) {
      return
    }

    setBusy(true)
    try {
      // ลบ USER ทั้งหมดในรายการนี้จากฐานข้อมูล
      if (historyItem.users && historyItem.users.length > 0) {
        // Use PostgreSQL adapter
        try {
          await Promise.all(
            historyItem.users.map(user => postgresqlAdapter.deleteUser(user.user))
          )
          showToast(`ลบรายการอัปโหลดและ USER ทั้งหมด (${historyItem.users.length} รายการ) เรียบร้อย`)
        } catch (error) {
          console.error('Error deleting users via PostgreSQL:', error)
          showToast('เกิดข้อผิดพลาดในการลบผู้ใช้')
          return
        }
      } else {
        showToast('ลบรายการประวัติแล้ว')
      }

      // ลบรายการจากประวัติ
      setUploadHistory(prev => prev.filter(item => item.id !== id))
      
      // รีเฟรชข้อมูล USER ทั้งหมด
      searchUsers()
    } catch (error) {
      showToast(`เกิดข้อผิดพลาดในการลบ: ${error}`)
    } finally {
      setBusy(false)
    }
  }


  /** เปิด popup แก้ไข USER */
  const openEditUser = (userKey: string, userData: any) => {
    setEditingUser({ userKey, userData })
    setEditPassword(userData.password || '')
    setEditHcoin(String(userData.hcoin || 0))
    setOpenEditPopup(true)
  }

  /** บันทึกการแก้ไข USER */
  const saveEditUser = async () => {
    if (!editingUser) return

    setBusy(true)
    try {
      const updates = {
        password: padPassword(editPassword), // ใช้ฟังก์ชัน padding รหัสผ่าน
        hcoin: Number(editHcoin) || 0,
      }

      // ✅ ใช้ PostgreSQL adapter 100%
      await postgresqlAdapter.updateUserData(editingUser.userKey, updates)

      showToast('แก้ไขข้อมูล USER สำเร็จ')
      setOpenEditPopup(false)
      setEditingUser(null)
      
      // รีเฟรชข้อมูล
      searchUsers()
    } catch (error) {
      showToast(`เกิดข้อผิดพลาด: ${error}`)
    } finally {
      setBusy(false)
    }
  }


  /** ล้างประวัติการอัปโหลดทั้งหมด */
  const clearUploadHistory = () => {
    if (!confirm('ยืนยันล้างประวัติการอัปโหลดทั้งหมด?\n\nการล้างจะไม่ส่งผลต่อข้อมูล USER ในฐานข้อมูล')) return
    setUploadHistory([])
    localStorage.removeItem('uploadHistory')
    showToast('ล้างประวัติการอัปโหลดเรียบร้อย')
  }

  return (
    <div className="page-wrap upload-users">
      {!!toast && <div className="toast">{toast}</div>}

      <div className={`grid ${showRightPanel ? 'show-history' : ''}`}>
        {/* ============ LEFT SIDEBAR ============ */}
        <div className="sidebar">
          {/* Header */}
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span className="sidebar-icon">👤</span>
              <span>จัดการผู้ใช้</span>
            </div>
          </div>


          <div className="sidebar-section">
            <div className="sidebar-section-title">อัพโหลดข้อมูล</div>
            <button className="sidebar-btn sidebar-btn-secondary btn-info" onClick={() => setOpenUploadPopup(true)} disabled={busy}>
              <span className="sidebar-btn-icon">📤</span>
              <span className="sidebar-btn-text">อัพโหลด USER ทั้งหมด</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-section-title">การจัดการ</div>
            <button className="sidebar-btn sidebar-btn-info btn-view" onClick={() => {
              setShowUploadHistory(false)
              setShowRightPanel(true)
            }} disabled={busy}>
              <span className="sidebar-btn-icon">👥</span>
              <span className="sidebar-btn-text">แสดง USER ทั้งหมด</span>
            </button>
            <button className="sidebar-btn sidebar-btn-neutral btn-view" onClick={() => {
              setShowUploadHistory(true)
              setShowRightPanel(true)
            }} disabled={busy}>
              <span className="sidebar-btn-icon">📋</span>
              <span className="sidebar-btn-text">รายการอัพโหลด</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <button className="sidebar-btn sidebar-btn-back btn-back" onClick={()=>nav(-1)} disabled={busy}>
              <span className="sidebar-btn-icon">↩️</span>
              <span className="sidebar-btn-text">กลับไปหน้าแรก</span>
            </button>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        {showRightPanel && (
          <div className="card right">
          {showUploadHistory ? (
            <>
              <div className="right-head">
                <span className="tag">ประวัติการอัพโหลด USER</span>
                <div className="meta">
                  <span>ทั้งหมด: <b>{uploadHistory.length}</b></span>
                  <span>Manual: <b className="ok">{uploadHistory.filter(h => h.type === 'manual').length}</b></span>
                  <span>CSV: <b className="ok">{uploadHistory.filter(h => h.type === 'csv').length}</b></span>
                  <span>สถานะ: <b className="ok">{uploadHistory.filter(h => h.type === 'status').length}</b></span>
                  {uploadHistory.length > 0 && (
                    <button 
                      className="clear-history-btn"
                      onClick={clearUploadHistory}
                      disabled={busy}
                      title="ล้างประวัติการอัปโหลดทั้งหมด"
                    >
                      🗑️ ล้างประวัติ
                    </button>
                  )}
                </div>
              </div>

              {uploadHistory.length === 0 ? (
                <div className="empty">ประวัติการอัพโหลดจะปรากฏที่นี่…</div>
              ) : (
                <div className="upload-history-list" role="table" aria-label="ประวัติการอัพโหลด">
                  {uploadHistory.map((item) => (
                    <div key={item.id}>
                      <div 
                        className={`upload-history-item ${selectedHistoryId === item.id ? 'selected' : ''}`}
                        onClick={() => setSelectedHistoryId(selectedHistoryId === item.id ? null : item.id)}
                      >
                        <div className="upload-history-info">
                          <div className="upload-history-header">
                            <div className="upload-history-type">
                              {item.type === 'manual' ? '📝 Manual' : 
                               item.type === 'csv' ? '📄 CSV' : 
                               '🔑 สถานะ'}
                            </div>
                            <div className="upload-history-count">
                              {item.userCount} USER
                            </div>
                            {item.type === 'status' && item.statusType && (
                              <div className="upload-history-status">
                                {item.statusType}
                              </div>
                            )}
                          </div>
                          <div className="upload-history-time">
                            {new Date(item.timestamp).toLocaleString('th-TH')}
                          </div>
                          <div className="upload-history-id">
                            ID: {item.id}
                          </div>
                        </div>
                        <div className="upload-history-actions">
                          <button 
                            className="upload-history-delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteHistoryItem(item.id)
                            }}
                            disabled={busy}
                            title="ลบรายการนี้และ USER ทั้งหมดในรายการ"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </div>
                      
                      {/* แสดงรายการ USER เมื่อเลือก */}
                      {selectedHistoryId === item.id && item.users && (
                        <div className="upload-history-details">
                          <div className="upload-history-details-header">
                            <div className="upload-history-details-title">
                              รายการ USER ({item.users.length} รายการ)
                            </div>
                            <div className="upload-history-details-actions">
                              <button 
                                className="upload-history-delete-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteHistoryItem(item.id)
                                }}
                                disabled={busy}
                                title="ลบรายการนี้และ USER ทั้งหมด"
                              >
                                🗑️ ลบทั้งหมด
                              </button>
                            </div>
                          </div>
                          <div className="upload-history-users">
                            {item.users.map((user, index) => (
                              <div className="upload-history-user-item" key={`${user.user}-${index}`}>
                                <div className="upload-history-user-index">{index + 1}</div>
                                <div className="upload-history-user-name">
                                  <b>{user.user}</b>
                                </div>
                                <div className="upload-history-user-password">
                                  — {mask(user.password)}
                                </div>
                                <div className="upload-history-user-actions">
                                  <button 
                                    className="upload-history-delete-single"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm(`ยืนยันลบ USER: ${user.user}?`)) {
                                        // ลบ USER เดียว
                                        // Use PostgreSQL adapter
                                        postgresqlAdapter.deleteUser(user.user)
                                          .then(() => {
                                            showToast(`ลบ USER ${user.user} เรียบร้อย`)
                                            // อัปเดตประวัติ
                                            setUploadHistory(prev => prev.map(historyItem => 
                                              historyItem.id === item.id 
                                                ? { ...historyItem, users: historyItem.users?.filter(u => u.user !== user.user) || [], userCount: (historyItem.userCount || 0) - 1 }
                                                : historyItem
                                            ))
                                            // รีเฟรชข้อมูล
                                            searchUsers()
                                          })
                                          .catch((error) => {
                                            console.error('Error deleting user via PostgreSQL:', error)
                                            showToast(`เกิดข้อผิดพลาดในการลบ USER ${user.user}`)
                                          })
                                      }
                                    }}
                                    disabled={busy}
                                    title={`ลบ USER: ${user.user}`}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="right-head">
                <span className="tag">USER ทั้งหมดในระบบ</span>
                <div className="meta">
                  <span>ทั้งหมด: <b>{totalUsers}</b></span>
                  <span>หน้า: <b>{currentPage}/{totalPages}</b></span>
                  <span>แสดง: <b>{startIndex + 1}-{Math.min(endIndex, totalUsers)}</b></span>
                </div>
              </div>

              {/* ส่วนค้นหา */}
              <div className="search-section">
                <div className="search-container">
                  <div className="search-title">🔍 ค้นหา USER</div>
                  <div className="search-input-group">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="ค้นหา USER..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                      disabled={isLoading}
                    />
                    <button
                      className="search-btn btn-search"
                      onClick={searchUsers}
                      disabled={isLoading}
                    >
                      {isLoading ? '⏳' : '🔍'} ค้นหา
                    </button>
                  </div>
                </div>
              </div>


              {totalUsers === 0 && !isLoading ? (
                <div className="empty">
                  {Object.keys(allUsersData).length === 0 
                    ? 'กรุณาค้นหาหรือโหลดข้อมูล USER' 
                    : 'ไม่พบ USER ตามเงื่อนไขที่ค้นหา'
                  }
                </div>
              ) : (
                <>
                  <div className="user-table-container">
                    {/* หัวตาราง */}
                    <div className="user-table-header">
                      <div className="user-table-col-index">#</div>
                      <div className="user-table-col-name">USER</div>
                      <div className="user-table-col-password">PASSWORD</div>
                      <div className="user-table-col-hcoin">HCOIN</div>
                      <div className="user-table-col-actions">แก้ไข</div>
                    </div>
                    
                    {/* รายการ USER (แสดงเฉพาะหน้าที่เลือก) */}
                    <div className="user-table-body">
                      {currentUsers.map(([userKey, userData], index) => {
                        const globalIndex = startIndex + index + 1
                        
                        return (
                          <div className="user-table-row" key={`${userKey}-${globalIndex}`}>
                            <div className="user-table-col-index">{globalIndex}</div>
                            <div className="user-table-col-name">
                              <b>{userKey}</b>
                            </div>
                            <div className="user-table-col-password">
                              {mask(userData.password || '')}
                            </div>
                            <div className="user-table-col-hcoin">
                              <span className="hcoin-amount">{userData.hcoin || 0}</span>
                            </div>
                            <div className="user-table-col-actions">
                              <button 
                                className="edit-btn-inline btn-edit"
                                onClick={() => openEditUser(userKey, userData)}
                                disabled={busy}
                                title="แก้ไขข้อมูล USER"
                              >
                                <span className="edit-icon">✏️</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        แสดง {startIndex + 1}-{Math.min(endIndex, totalUsers)} จาก {totalUsers} รายการ
                      </div>
                      <div className="pagination-controls">
                        <button 
                          className="pagination-btn primary"
                          onClick={prevPage}
                          disabled={currentPage === 1 || isLoading}
                        >
                          ← ก่อนหน้า
                        </button>
                        
                        <div className="pagination-pages">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                                onClick={() => goToPage(pageNum)}
                                disabled={isLoading}
                              >
                                {pageNum}
                              </button>
                            )
                          })}
                        </div>
                        
                        <button 
                          className="pagination-btn primary"
                          onClick={nextPage}
                          disabled={currentPage === totalPages || isLoading}
                        >
                          ถัดไป →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          </div>
        )}
      </div>

      {/* ===== Popup: อัพโหลด USER ทั้งหมด ===== */}
      {openUploadPopup && (
        <div className="upload-popup-overlay" onClick={() => setOpenUploadPopup(false)}>
          <div className="upload-popup" onClick={(e) => e.stopPropagation()}>
            <div className="upload-popup-header">
              <div className="upload-popup-title">
                <img src="/image/user.svg" alt="User" width="24" height="24" />
                <span>อัพโหลด USER ทั้งหมด</span>
              </div>
              <button className="upload-popup-close" onClick={() => setOpenUploadPopup(false)}>
                <img src="/image/close.svg" alt="Close" width="20" height="20" />
              </button>
            </div>

            <div className="upload-popup-left">
              {/* ส่วนเพิ่มผู้ใช้ด้วยตนเอง */}
              <div className="upload-section">
                <div className="upload-section-title">เพิ่มผู้ใช้ด้วยตนเอง (Manual)</div>
                <div className="upload-form">
                  <input
                    className="upload-input"
                    placeholder="USER (อักษร/ตัวเลข, เว้นวรรคไม่ได้)"
                    value={mUser}
                    onChange={(e) => setMUser(e.target.value)}
                    disabled={busy}
                  />
                  <input
                    className="upload-input"
                    placeholder="PASSWORD (เก็บตามที่กรอก ไม่แปลงตัวพิมพ์)"
                    value={mPass}
                    onChange={(e) => setMPass(e.target.value)}
                    disabled={busy}
                  />
                  <button 
                    className="upload-btn upload-btn-green btn-add" 
                    onClick={addManual} 
                    disabled={busy || !mUser || !mPass}
                  >
                    <span className="upload-btn-icon">➕</span> เพิ่มผู้ใช้ (USER + PASSWORD)
                  </button>
                </div>
              </div>


              {/* ส่วนนำเข้า/บันทึก */}
              <div className="upload-section">
                <div className="upload-section-title">นำเข้า / บันทึก</div>
                <div className="upload-form">
                  <button className="upload-btn upload-btn-blue btn-info" onClick={pickCSV} disabled={busy}>
                    <span className="upload-btn-icon">📂</span> เลือกไฟล์ CSV
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickCSV} hidden />

                  <button 
                    className="upload-btn upload-btn-green btn-save" 
                    onClick={saveAll} 
                    disabled={busy || rows.length === 0}
                  >
                    <span className="upload-btn-icon">💾</span> 
                    {uploadProgress.isUploading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล (อัปเดตได้)'}
                  </button>
                </div>
              </div>
            </div>

            {/* ส่วนพรีวิว USER */}
            <div className="upload-popup-right">
              <div className="upload-preview-header">
                <div className="upload-preview-title">พรีวิว USER + PASSWORD</div>
                <button 
                  className="upload-clear-btn" 
                  onClick={() => {
                    setRows([])
                    setInvalids([])
                    recomputeStats([], [])
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  disabled={busy || (rows.length === 0 && invalids.length === 0)}
                >
                  <span className="upload-clear-icon">🗑️</span> CLEAR
                </button>
              </div>
              
               <div className="upload-preview-stats">
                 <div className="upload-stat">
                   ทั้งหมด: <b>{stats.total}</b>
                 </div>
                 <div className="upload-stat ok">
                   ใช้ได้: <b>{stats.valid}</b>
                 </div>
                 <div className="upload-stat">
                   ซ้ำในไฟล์: <b>{stats.dup}</b>
                 </div>
                 <div className="upload-stat">
                   มีในฐานข้อมูลแล้ว: <b>{stats.existing || 0}</b>
                 </div>
                 <div className="upload-stat bad">
                   ไม่ผ่าน: <b>{stats.invalid}</b>
                 </div>
               </div>

              {/* Parse Progress Display */}
              {parseProgress.isParsing && (
                <div className="upload-progress-container">
                  <div className="upload-progress-header">
                    <div className="upload-progress-title">
                      📄 กำลังประมวลผลไฟล์ CSV...
                    </div>
                    <div className="upload-progress-percentage">
                      {parseProgress.total > 0 ? Math.round((parseProgress.current / parseProgress.total) * 100) : 0}%
                    </div>
                  </div>
                  
                  <div className="upload-progress-bar">
                    <div 
                      className="upload-progress-fill"
                      style={{ 
                        width: parseProgress.total > 0 ? `${(parseProgress.current / parseProgress.total) * 100}%` : '0%'
                      }}
                    />
                  </div>
                  
                  <div className="upload-progress-details">
                    <span>กำลังประมวลผล: <b>{parseProgress.current.toLocaleString()}</b> แถว</span>
                  </div>
                </div>
              )}

              {/* Upload Progress Display */}
              {uploadProgress.isUploading && (
                <div className="upload-progress-container">
                  <div className="upload-progress-header">
                    <div className="upload-progress-title">
                      📤 กำลังบันทึกข้อมูล USER เข้า PostgreSQL
                    </div>
                    <div className="upload-progress-percentage">
                      {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                    </div>
                  </div>
                  
                  <div className="upload-progress-bar">
                    <div 
                      className="upload-progress-fill"
                      style={{ 
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  
                  <div className="upload-progress-details">
                    <div className="upload-progress-info">
                      <span>กำลังบันทึก: <b>{uploadProgress.currentUser}</b></span>
                      <span>Batch: {uploadProgress.batch}/{uploadProgress.totalBatches}</span>
                    </div>
                    <div className="upload-progress-count">
                      {uploadProgress.current} / {uploadProgress.total} USER
                    </div>
                  </div>
                </div>
              )}

              {!showPreview ? (
                <div className="upload-preview-empty" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    🚀 โหมดความเร็ว
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    ปิดการแสดงพรีวิวเพื่อความเร็วในการประมวลผลไฟล์ขนาดใหญ่
                  </div>
                </div>
              ) : rows.length === 0 && invalids.length === 0 ? (
                <div className="upload-preview-empty">พรีวิวรายชื่อจะปรากฏที่นี่หลังเลือกไฟล์…</div>
              ) : (
                <div className="upload-preview-list">
                  {rows.map((r, i) => (
                    <div className="upload-preview-item" key={`${r.user}-${i}`}>
                      <div className="upload-preview-index">{i + 1}</div>
                      <div className="upload-preview-name">
                        <b>{r.user}</b>
                      </div>
                      <div className="upload-preview-password">
                        — {mask(r.password)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showPreview && invalids.length > 0 && (
                <div style={{marginTop: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px'}}>
                  <div style={{fontSize: '12px', fontWeight: '600', color: '#dc2626', marginBottom: '8px'}}>
                    แถวที่ไม่ผ่าน ({invalids.length})
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                    {invalids.slice(0, 10).map((u, i) => (
                      <span key={`${u}-${i}`} style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '4px'
                      }}>
                        {u || '(ว่าง)'}
                      </span>
                    ))}
                    {invalids.length > 10 && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        borderRadius: '4px'
                      }}>
                        +{invalids.length - 10} รายการ
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ===== Popup: แก้ไข USER ===== */}
      {openEditPopup && editingUser && (
        <div className="upload-popup-overlay" onClick={() => setOpenEditPopup(false)}>
          <div className="upload-popup edit-popup" onClick={(e) => e.stopPropagation()}>
            <div className="upload-popup-header">
              <div className="upload-popup-title">
                <img src="/image/user.svg" alt="Edit User" width="24" height="24" />
                <span>แก้ไขข้อมูล USER: {editingUser.userKey}</span>
              </div>
              <button className="upload-popup-close" onClick={() => setOpenEditPopup(false)}>
                <img src="/image/close.svg" alt="Close" width="20" height="20" />
              </button>
            </div>

            <div className="edit-form-container">
              <div className="edit-form-section">
                <div className="edit-form-group">
                  <label className="edit-form-label">PASSWORD</label>
                  <input
                    type="text"
                    className="edit-form-input"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    disabled={busy}
                  />
                </div>

                <div className="edit-form-group">
                  <label className="edit-form-label">HCOIN</label>
                  <input
                    type="number"
                    className="edit-form-input"
                    value={editHcoin}
                    onChange={(e) => setEditHcoin(e.target.value)}
                    placeholder="กรอกจำนวน HCOIN"
                    disabled={busy}
                    min="0"
                  />
                </div>
              </div>

              <div className="edit-form-actions">
                <button 
                  className="edit-cancel-btn btn-cancel"
                  onClick={() => setOpenEditPopup(false)}
                  disabled={busy}
                >
                  ยกเลิก
                </button>
                <button 
                  className="edit-save-btn btn-save"
                  onClick={saveEditUser}
                  disabled={busy || !editPassword.trim()}
                >
                  {busy ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
