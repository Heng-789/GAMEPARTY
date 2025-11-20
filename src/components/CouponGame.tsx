import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ref, get, query, orderByKey, limitToLast } from 'firebase/database';
import { db } from '../services/firebase';
import '../styles/coupon.css';

// Helper function สำหรับสร้าง dateKey (เหมือนกับ CheckinGame)
const dkey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export type CouponItem = {
  title?: string;
  rewardCredit: number;
  price: number;
  codes?: string[];
};

type RedeemResult = { ok: true; code: string } | { ok: false; message: string };

type CouponHistoryItem = {
  ts: number;
  itemIndex: number;
  code: string;
  price: number;
  title?: string;
};

export type CouponGameProps = {
  items: CouponItem[];
  hengcoin?: number;
  open: boolean;
  onClose: () => void;
  onRedeem: (idx: number) => Promise<RedeemResult>;
  /** กด "กรอกโค้ด HENG36" แล้วให้ทำอะไร (เช่น เปิดหน้า Redeem ของคุณ) – ไม่ส่งมาก็ได้ */
  onGoRedeem?: (code?: string) => void;
  /** Game ID สำหรับดึงประวัติการแลก */
  gameId?: string;
  /** Username สำหรับดึงประวัติการแลก */
  username?: string;
};

export default function CouponGame({
  items, hengcoin = 0, open, onClose, onRedeem, onGoRedeem, gameId, username,
}: CouponGameProps) {
  const { themeName, theme } = useTheme()
  // ✅ รองรับทั้ง 3 ธีม
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'
  const coinLogo = themeName === 'max56' ? '/image/maxcoin_icon.png' : themeName === 'jeed24' ? '/image/jeedcoin_icon.png' : '/image/hengcoin_icon.png'
  const websiteName = themeName === 'max56' ? 'MAX56' : themeName === 'jeed24' ? 'JEED24' : 'HENG36'
  const websiteUrl = themeName === 'max56' 
    ? 'https://max-56.com/' 
    : themeName === 'jeed24' 
    ? 'https://jeed24.party/' 
    : 'https://heng-36z.com/'
  
  // สีตามธีมสำหรับ popup
  const themeStyles = React.useMemo(() => {
    if (themeName === 'max56') {
      return {
        primary: theme.colors.primary,
        primaryLight: theme.colors.primaryLight,
        gradient: theme.gradients.primary,
        bgGradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
        borderColor: 'rgba(220, 38, 38, 0.35)',
        textColor: theme.colors.primaryDark,
        warningBg: 'rgba(245, 158, 11, 0.18)',
        warningBorder: 'rgba(245, 158, 11, 0.45)',
        warningText: '#d97706',
        successBg: 'rgba(16, 185, 129, 0.16)',
        successBorder: 'rgba(16, 185, 129, 0.35)',
      }
    }
    if (themeName === 'jeed24') {
      return {
        primary: theme.colors.primary,
        primaryLight: theme.colors.primaryLight,
        gradient: theme.gradients.primary,
        bgGradient: 'linear-gradient(135deg, rgba(204, 85, 0, 0.12) 0%, rgba(255, 127, 0, 0.08) 100%)',
        borderColor: 'rgba(204, 85, 0, 0.35)',
        textColor: theme.colors.primaryDark,
        warningBg: 'rgba(245, 158, 11, 0.18)',
        warningBorder: 'rgba(245, 158, 11, 0.45)',
        warningText: '#d97706',
        successBg: 'rgba(16, 185, 129, 0.16)',
        successBorder: 'rgba(16, 185, 129, 0.35)',
      }
    }
    // heng36
    return {
      primary: theme.colors.primary,
      primaryLight: theme.colors.primaryLight,
      gradient: theme.gradients.primary,
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.08) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      textColor: theme.colors.primaryDark,
      warningBg: 'rgba(245, 158, 11, 0.18)',
      warningBorder: 'rgba(245, 158, 11, 0.45)',
      warningText: '#d97706',
      successBg: 'rgba(16, 185, 129, 0.16)',
      successBorder: 'rgba(16, 185, 129, 0.35)',
    }
  }, [themeName, theme])
  
  const [busyIdx, setBusyIdx] = React.useState<number | null>(null);
  const [codePopup, setCodePopup] = React.useState<{ open: boolean; code?: string; error?: string }>({ open: false });
  const [copied, setCopied] = React.useState(false);
  const [confirmPopup, setConfirmPopup] = React.useState<{ open: boolean; item?: CouponItem; idx?: number }>({ open: false });
  const [history, setHistory] = React.useState<CouponHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) { setBusyIdx(null); setCopied(false); }
  }, [open]);

  // Normalize username (เหมือนกับ CheckinGame)
  const normalizedUsername = React.useMemo(() => {
    if (!username) return '';
    return username.trim().replace(/\s+/g, '').toUpperCase();
  }, [username]);

  // ดึงประวัติการแลกคูปอง
  React.useEffect(() => {
    if (!open || !gameId || !normalizedUsername) {
      setHistory([]);
      return;
    }

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        // ดึงข้อมูลจาก answers/<gameId>/<date>/* โดยกรอง action === 'coupon-redeem' และ user === normalizedUsername
        // ใช้ sharding ตามวันที่ (format: YYYYMMDD) - ใช้วิธีเดียวกับ logAction
        const today = new Date();
        const dates: string[] = [];
        
        // ดึงข้อมูลย้อนหลัง 60 วัน (เพื่อให้ครอบคลุม)
        // ✅ ใช้ dkey() เพื่อให้ตรงกับ format ที่ logAction ใช้
        for (let i = 0; i < 60; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateKey = dkey(date).replace(/-/g, ''); // ใช้ dkey() แทน toISOString()
          dates.push(dateKey);
        }

        const allHistory: CouponHistoryItem[] = [];

        // ✅ OPTIMIZED: ดึงข้อมูลแบบ parallel สำหรับประสิทธิภาพที่ดีขึ้น (เพิ่ม batch size เป็น 20)
        const batchSize = 20 // เพิ่มจาก 10 เป็น 20 เพื่อลดจำนวน batches;
        for (let i = 0; i < dates.length; i += batchSize) {
          const batch = dates.slice(i, i + batchSize);
          const promises = batch.map(async (dateKey) => {
            try {
              const answersRef = ref(db, `answers/${gameId}/${dateKey}`);
              const snapshot = await get(answersRef);
              
              if (snapshot.exists()) {
                const data = snapshot.val();
                const dayHistory: CouponHistoryItem[] = [];
                
                Object.values(data).forEach((item: any) => {
                  // ตรวจสอบว่า user ตรงกัน (case-insensitive)
                  const itemUser = String(item?.user || '').trim().replace(/\s+/g, '').toUpperCase();
                  if (item?.action === 'coupon-redeem' && itemUser === normalizedUsername && item?.code) {
                    const itemIndex = Number(item.itemIndex ?? -1);
                    const couponItem = items[itemIndex];
                    dayHistory.push({
                      ts: Number(item.ts ?? 0),
                      itemIndex,
                      code: String(item.code),
                      price: Number(item.price ?? 0),
                      title: couponItem?.title || `BONUS ${(Number(item.rewardCredit ?? 0) || couponItem?.rewardCredit || 0).toLocaleString('th-TH')}`,
                    });
                  }
                });
                
                return dayHistory;
              }
              return [];
            } catch (err) {
              // ข้ามวันที่ที่ไม่มีข้อมูล
              return [];
            }
          });

          const results = await Promise.all(promises);
          results.forEach(dayHistory => {
            allHistory.push(...dayHistory);
          });

          // ถ้าพบประวัติมากพอแล้ว (50+ รายการ) ให้หยุดดึงต่อ
          if (allHistory.length >= 50) {
            break;
          }
        }

        // เรียงตาม timestamp ล่าสุดก่อน
        allHistory.sort((a, b) => b.ts - a.ts);
        
        // ✅ กรองรายการซ้ำ (ใช้ code + itemIndex เป็น unique key - ไม่ใช้ ts เพื่อป้องกันการแสดงโค้ดซ้ำ)
        // ✅ สำคัญ: ถ้า user ได้โค้ดเดียวกันหลายครั้ง (แม้ timestamp ต่างกัน) ให้แสดงแค่รายการเดียว (ล่าสุด)
        const uniqueHistory = new Map<string, CouponHistoryItem>();
        for (const item of allHistory) {
          // ✅ ใช้ code + itemIndex เป็น unique key (ไม่ใช้ ts เพื่อป้องกันการแสดงโค้ดซ้ำ)
          const uniqueKey = `${item.code}-${item.itemIndex}`;
          // ✅ ถ้ายังไม่มี หรือ timestamp ใหม่กว่า ให้ใช้รายการใหม่
          // ✅ เพื่อให้แสดงโค้ดล่าสุดที่ user ได้ (กรณีที่ user ได้โค้ดซ้ำ)
          if (!uniqueHistory.has(uniqueKey) || uniqueHistory.get(uniqueKey)!.ts < item.ts) {
            uniqueHistory.set(uniqueKey, item);
          }
        }
        
        // ✅ แปลง Map กลับเป็น Array และเรียงใหม่
        const finalHistory = Array.from(uniqueHistory.values()).sort((a, b) => b.ts - a.ts);
        
        // จำกัดเฉพาะ 50 รายการล่าสุด
        setHistory(finalHistory.slice(0, 50));
      } catch (err) {
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [open, gameId, normalizedUsername, items]);

  // ✅ Ref สำหรับ trigger การโหลดประวัติใหม่หลังจากแลกคูปองสำเร็จ
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = React.useState(0);
  
  // ✅ useEffect สำหรับโหลดประวัติใหม่เมื่อมีการแลกคูปองสำเร็จ
  React.useEffect(() => {
    if (!open || !gameId || !normalizedUsername || historyRefreshTrigger === 0) {
      return;
    }

    const loadHistoryAfterRedeem = async () => {
      try {
        // ✅ โหลดเฉพาะวันนี้ (เพื่อให้ได้ข้อมูลล่าสุด)
        // ✅ ใช้ dkey() เพื่อให้ตรงกับ format ที่ logAction ใช้
        const today = new Date();
        const dateKey = dkey(today).replace(/-/g, '');
        
        const answersRef = ref(db, `answers/${gameId}/${dateKey}`);
        const snapshot = await get(answersRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const newItems: CouponHistoryItem[] = [];
          
          Object.values(data).forEach((item: any) => {
            const itemUser = String(item?.user || '').trim().replace(/\s+/g, '').toUpperCase();
            if (item?.action === 'coupon-redeem' && itemUser === normalizedUsername && item?.code) {
              const itemIndex = Number(item.itemIndex ?? -1);
              const couponItem = items[itemIndex];
              newItems.push({
                ts: Number(item.ts ?? 0),
                itemIndex,
                code: String(item.code),
                price: Number(item.price ?? 0),
                title: couponItem?.title || `BONUS ${(Number(item.rewardCredit ?? 0) || couponItem?.rewardCredit || 0).toLocaleString('th-TH')}`,
              });
            }
          });

          // ✅ เพิ่มรายการใหม่เข้าไปใน history (ถ้ายังไม่มี)
          // ✅ สำคัญ: ใช้ code + itemIndex เป็น unique key (ไม่ใช้ ts เพื่อป้องกันการแสดงโค้ดซ้ำ)
          if (newItems.length > 0) {
            setHistory(prev => {
              // ✅ ใช้ code + itemIndex เป็น unique key (ไม่ใช้ ts เพื่อป้องกันการแสดงโค้ดซ้ำ)
              const existingKeys = new Set(prev.map(h => `${h.code}-${h.itemIndex}`));
              const toAdd = newItems.filter(item => !existingKeys.has(`${item.code}-${item.itemIndex}`));
              
              if (toAdd.length > 0) {
                // ✅ รวมรายการใหม่กับรายการเก่า และกรองรายการซ้ำอีกครั้ง (ใช้ code + itemIndex)
                const combined = [...toAdd, ...prev];
                const uniqueCombined = new Map<string, CouponHistoryItem>();
                for (const item of combined) {
                  const uniqueKey = `${item.code}-${item.itemIndex}`;
                  // ✅ ถ้ายังไม่มี หรือ timestamp ใหม่กว่า ให้ใช้รายการใหม่
                  if (!uniqueCombined.has(uniqueKey) || uniqueCombined.get(uniqueKey)!.ts < item.ts) {
                    uniqueCombined.set(uniqueKey, item);
                  }
                }
                const updated = Array.from(uniqueCombined.values()).sort((a, b) => b.ts - a.ts);
                return updated.slice(0, 50);
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // Silent error handling
      }
    };

    // ✅ รอสักครู่เพื่อให้ Firebase sync เสร็จก่อน
    const timeout = setTimeout(() => {
      loadHistoryAfterRedeem();
    }, 500);

    return () => clearTimeout(timeout);
  }, [historyRefreshTrigger, open, gameId, normalizedUsername, items]);

  if (!open) return null;

  const fmt = (n: number) => n.toLocaleString('th-TH');

  const handleRedeem = async (idx: number) => {
    // ✅ ป้องกันการกดปุ่มหลายครั้งติดกัน (ทั้งรายการเดียวกันและรายการต่างกัน)
    if (busyIdx !== null) {
      return; // กำลังดำเนินการแลกรางวัลอยู่แล้ว
    }
    
    const item = items[idx];
    if (!item) return;
    
    // ✅ ตรวจสอบเงื่อนไขการแลก
    if (hengcoin < item.price) {
      setCodePopup({ open: true, error: `${coinName} ไม่พอสำหรับแลกรางวัลนี้` });
      return;
    }
    
    // ✅ ตรวจสอบว่ามีโค้ดสำหรับรางวัลนี้หรือไม่
    if (!item.codes || item.codes.length === 0) {
      setCodePopup({ open: true, error: 'ไม่มีโค้ดสำหรับรางวัลนี้' });
      return;
    }
    
    // ✅ แสดง popup ยืนยันการแลก
    setConfirmPopup({ open: true, item, idx });
  };

  const handleConfirmRedeem = async () => {
    // ✅ ป้องกันการกดปุ่มยืนยันหลายครั้งติดกัน
    if (!confirmPopup.item || confirmPopup.idx === undefined || busyIdx !== null) {
      return;
    }
    
    const idx = confirmPopup.idx;
    setConfirmPopup({ open: false });
    
    // ✅ ตั้ง busyIdx ทันทีเพื่อป้องกันการกดปุ่มหลายครั้ง
    setBusyIdx(idx);
    
    try {
      const res = await onRedeem(idx);
      if (res.ok) {
        setCodePopup({ open: true, code: res.code });
        // ✅ Trigger การโหลดประวัติใหม่ (รอ Firebase sync แล้วโหลดจาก Firebase)
        setHistoryRefreshTrigger(prev => prev + 1);
      } else {
        setCodePopup({ open: true, error: res.message || 'แลกไม่สำเร็จ' });
      }
    } catch (error) {
      console.error('Error redeeming coupon:', error);
      setCodePopup({ open: true, error: 'เกิดข้อผิดพลาดในการแลกรางวัล' });
    } finally {
      // ✅ Reset busyIdx เมื่อเสร็จสิ้น (ไม่ว่าจะสำเร็จหรือไม่)
      setBusyIdx(null);
    }
  };

  const copyCode = async (code?: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1600); } finally { document.body.removeChild(ta); }
    }
  };

  const copyHistoryCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeIndex(index);
      setTimeout(() => setCopiedCodeIndex(null), 1600);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      try { 
        document.execCommand('copy'); 
        setCopiedCodeIndex(index);
        setTimeout(() => setCopiedCodeIndex(null), 1600);
      } finally { 
        document.body.removeChild(ta); 
      }
    }
  };

  return (
    <div className="coupon-wrap">
      <div className="coupon-grid">
        {items.map((it, i) => {
          const title = it.title || `BONUS ${fmt(it.rewardCredit)}`;
          return (
            <div key={i} className="coupon-card">
              <div className="ccart-icon" aria-hidden>
                <img src="/image/coupon.svg" alt="Coupon" width="72" height="72" />
              </div>
              <div className="ccart-title">{title}</div>
              <div className="ccart-sub">แลกด้วย {coinName}</div>
              <div className="ccart-price" style={{ color: '#dc2626', fontWeight: 800 }}>
                <img src={coinLogo} alt={coinName} width="14" height="14" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                - {fmt(it.price)} {coinName}
              </div>
              <button 
                className="ccart-btn" 
                onClick={() => handleRedeem(i)} 
                disabled={busyIdx !== null || hengcoin < it.price || !it.codes || it.codes.length === 0}
                style={{
                  opacity: (busyIdx !== null || hengcoin < it.price || !it.codes || it.codes.length === 0) ? 0.6 : 1,
                  cursor: (busyIdx !== null || hengcoin < it.price || !it.codes || it.codes.length === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                {busyIdx === i ? 'กำลังแลก…' : 
                 hengcoin < it.price ? `${coinName} ไม่พอ` :
                 !it.codes || it.codes.length === 0 ? 'ไม่มีโค้ด' :
                 'แลกรางวัล'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Popup ยืนยันการแลก - แบบใหม่ตามธีม */}
      {confirmPopup.open && confirmPopup.item && (
        <div className="coupon-code-ol" onClick={() => setConfirmPopup({ open: false })}>
          <div 
            className="coupon-confirm-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
              borderRadius: '24px',
              padding: '32px 28px',
              boxShadow: '0 32px 96px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.3)',
              maxWidth: '520px',
              width: 'min(92vw, 520px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div 
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  background: themeStyles.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                ยืนยันการแลกรางวัล
              </div>
            </div>
            
            {/* รายละเอียดรางวัล */}
            <div 
              style={{
                background: themeStyles.bgGradient,
                border: `2px solid ${themeStyles.borderColor}`,
                borderRadius: '20px',
                padding: '24px',
                marginBottom: '20px',
                boxShadow: `0 8px 32px ${themeStyles.borderColor.replace('0.35', '0.2')}`,
              }}
            >
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <img 
                  src="/image/coupon.svg" 
                  alt="Coupon" 
                  width="80" 
                  height="80" 
                  style={{ 
                    display: 'block',
                    objectFit: 'contain',
                    flexShrink: 0,
                  }} 
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div 
                    style={{
                      fontSize: '20px',
                      fontWeight: 900,
                      color: themeStyles.textColor,
                      marginBottom: '4px',
                      lineHeight: '1.3',
                    }}
                  >
                    {confirmPopup.item.title || `BONUS ${fmt(confirmPopup.item.rewardCredit)}`}
                  </div>
                </div>
              </div>
              
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#dc2626',
                  }}
                >
                  <img src={coinLogo} alt={coinName} width="20" height="20" />
                  <span>- {fmt(confirmPopup.item.price)} {coinName}</span>
                </div>
                
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: themeStyles.textColor,
                  }}
                >
                  <img src={coinLogo} alt={coinName} width="16" height="16" />
                  <span>ยอดคงเหลือ: {fmt(hengcoin)} {coinName}</span>
                </div>
              </div>
            </div>
            
            {/* ข้อความยืนยัน */}
            <div 
              style={{
                background: themeStyles.warningBg,
                border: `1px solid ${themeStyles.warningBorder}`,
                borderRadius: '16px',
                padding: '18px',
                marginBottom: '24px',
                textAlign: 'center',
              }}
            >
              <div 
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: themeStyles.warningText,
                  marginBottom: '8px',
                }}
              >
                ⚠️ คุณต้องการแลกรางวัลนี้หรือไม่?
              </div>
              <div 
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#92400e',
                  lineHeight: '1.5',
                }}
              >
                การแลกไม่สามารถยกเลิกได้ กรุณาตรวจสอบข้อมูลให้ถูกต้อง
              </div>
            </div>
            
            {/* ปุ่ม */}
            <div 
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button 
                onClick={() => setConfirmPopup({ open: false })}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '16px',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
                  color: '#475569',
                  boxShadow: '0 4px 12px rgba(107,114,128,.2), inset 0 1px 0 rgba(255,255,255,.4)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.08)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(107,114,128,.3), inset 0 1px 0 rgba(255,255,255,.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(107,114,128,.2), inset 0 1px 0 rgba(255,255,255,.4)'
                }}
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleConfirmRedeem}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  background: themeStyles.gradient,
                  color: '#ffffff',
                  boxShadow: `0 8px 24px ${themeStyles.borderColor.replace('0.35', '0.4')}, inset 0 1px 0 rgba(255,255,255,.4)`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.05)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = `0 12px 32px ${themeStyles.borderColor.replace('0.35', '0.5')}, inset 0 1px 0 rgba(255,255,255,.5)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 8px 24px ${themeStyles.borderColor.replace('0.35', '0.4')}, inset 0 1px 0 rgba(255,255,255,.4)`
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 4px 16px ${themeStyles.borderColor.replace('0.35', '0.3')}, inset 0 1px 0 rgba(255,255,255,.3)`
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = `0 12px 32px ${themeStyles.borderColor.replace('0.35', '0.5')}, inset 0 1px 0 rgba(255,255,255,.5)`
                }}
              >
                ยืนยันการแลก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup โค้ด/ข้อความผิดพลาด */}
      {codePopup.open && (
        <div className="coupon-code-ol" onClick={() => setCodePopup({ open: false })}>
          <div className="coupon-code-panel" onClick={(e) => e.stopPropagation()}>
            {codePopup.code ? (
              <>
                <div className="ccode-title">🎁 โค้ดของคุณ</div>

                <div className="ccode-value">{codePopup.code}</div>
                <div className="ccode-hint">นำโค้ดนี้ไปใช้กรอกช่องคูปอง แล้วกดรับโบนัส</div>

                <div className="ccode-actions">
                  <button
                    className="btn-copy"
                    onClick={() => copyCode(codePopup.code)}
                    aria-label="คัดลอกโค้ด"
                  >
                    {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกโค้ด'}
                  </button>

                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-fill link-btn"
                  >
                    ไปที่ {websiteName}
                  </a>

                </div>
              </>
            ) : (
              <>
                <div className="ccode-title">ไม่สามารถแลกได้</div>
                <div className="ccode-error">{codePopup.error || 'ลองใหม่อีกครั้ง'}</div>
                <div className="ccode-actions single">
                  <button className="btn-fill" onClick={() => setCodePopup({ open: false })}>ตกลง</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ประวัติการแลกคูปอง */}
      {history.length > 0 && (
        <div className="coupon-history-section">
          <div className="coupon-history-title">📋 ประวัติการแลกคูปอง</div>
          <div className="coupon-history-list">
            {history.map((item, index) => (
              <div key={`${item.ts}-${item.code}-${item.itemIndex}`} className="coupon-history-item">
                <div className="coupon-history-content">
                  <div className="coupon-history-title-text">{item.title || `รางวัล #${item.itemIndex + 1}`}</div>
                  <div className="coupon-history-code">
                    <span className="coupon-history-code-label">โค้ด:</span>
                    <span className="coupon-history-code-value">{item.code}</span>
                  </div>
                  <div className="coupon-history-price">
                    <img src={coinLogo} alt={coinName} width="12" height="12" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {fmt(item.price)} {coinName}
                  </div>
                </div>
                <button
                  className="coupon-history-copy-btn"
                  onClick={() => copyHistoryCode(item.code, index)}
                  aria-label="คัดลอกโค้ด"
                >
                  {copiedCodeIndex === index ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyLoading && (
        <div className="coupon-history-loading">กำลังโหลดประวัติ...</div>
      )}

      {!historyLoading && history.length === 0 && gameId && username && (
        <div className="coupon-history-empty">ยังไม่มีประวัติการแลกคูปอง</div>
      )}
    </div>
  );
}
