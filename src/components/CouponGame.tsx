import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/coupon.css';

export type CouponItem = {
  title?: string;
  rewardCredit: number;
  price: number;
  codes?: string[];
};

type RedeemResult = { ok: true; code: string } | { ok: false; message: string };

export type CouponGameProps = {
  items: CouponItem[];
  hengcoin?: number;
  open: boolean;
  onClose: () => void;
  onRedeem: (idx: number) => Promise<RedeemResult>;
  /** กด “กรอกโค้ด HENG36” แล้วให้ทำอะไร (เช่น เปิดหน้า Redeem ของคุณ) – ไม่ส่งมาก็ได้ */
  onGoRedeem?: (code?: string) => void;
};

export default function CouponGame({
  items, hengcoin = 0, open, onClose, onRedeem, onGoRedeem,
}: CouponGameProps) {
  const { themeName } = useTheme()
  // ✅ รองรับทั้ง 3 ธีม
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'
  const websiteName = themeName === 'max56' ? 'MAX56' : themeName === 'jeed24' ? 'JEED24' : 'HENG36'
  const websiteUrl = themeName === 'max56' 
    ? 'https://max-56.com/' 
    : themeName === 'jeed24' 
    ? 'https://jeed24.party/' 
    : 'https://heng-36z.com/'
  
  const [busyIdx, setBusyIdx] = React.useState<number | null>(null);
  const [codePopup, setCodePopup] = React.useState<{ open: boolean; code?: string; error?: string }>({ open: false });
  const [copied, setCopied] = React.useState(false);
  const [confirmPopup, setConfirmPopup] = React.useState<{ open: boolean; item?: CouponItem; idx?: number }>({ open: false });

  React.useEffect(() => {
    if (!open) { setBusyIdx(null); setCopied(false); }
  }, [open]);

  if (!open) return null;

  const fmt = (n: number) => n.toLocaleString('th-TH');

  const handleRedeem = async (idx: number) => {
    if (busyIdx !== null) return;
    const item = items[idx];
    if (!item) return;
    
    // ตรวจสอบเงื่อนไขการแลก
    if (hengcoin < item.price) {
      setCodePopup({ open: true, error: `${coinName} ไม่พอสำหรับแลกรางวัลนี้` });
      return;
    }
    
    // แสดง popup ยืนยันการแลก
    setConfirmPopup({ open: true, item, idx });
  };

  const handleConfirmRedeem = async () => {
    if (!confirmPopup.item || confirmPopup.idx === undefined) return;
    
    setConfirmPopup({ open: false });
    setBusyIdx(confirmPopup.idx);
    
    try {
      const res = await onRedeem(confirmPopup.idx);
      if (res.ok) {
        setCodePopup({ open: true, code: res.code });
      } else {
        setCodePopup({ open: true, error: res.message || 'แลกไม่สำเร็จ' });
      }
    } catch {
      setCodePopup({ open: true, error: 'เกิดข้อผิดพลาด' });
    } finally {
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

  return (
    <div className="coupon-wrap">
      <div className="coupon-grid">
        {items.map((it, i) => {
          const title = it.title || `x${fmt(it.rewardCredit)}`;
          return (
            <div key={i} className="coupon-card">
              <div className="ccart-icon" aria-hidden>
                <img src="/image/bonus.svg" alt="Bonus" width="24" height="24" />
              </div>
              <div className="ccart-title">{title}</div>
              <div className="ccart-sub">แลกด้วย {coinName}</div>
              <div className="ccart-price"> : {fmt(it.price)}</div>
              <button className="ccart-btn" onClick={() => handleRedeem(i)} disabled={busyIdx !== null}>
                {busyIdx === i ? 'กำลังแลก…' : 'แลกรางวัล'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Popup ยืนยันการแลก */}
      {confirmPopup.open && confirmPopup.item && (
        <div className="coupon-code-ol" onClick={() => setConfirmPopup({ open: false })}>
          <div className="coupon-code-panel" onClick={(e) => e.stopPropagation()}>
            <button className="coupon-close-btn" onClick={() => setConfirmPopup({ open: false })}>
              <img src="/image/close.svg" alt="Close" width="20" height="20" />
            </button>
            <div className="ccode-title">ยืนยันการแลกรางวัล</div>
            
            <div className="ccode-item-info">
              <div className="ccode-item-title">{confirmPopup.item.title || `x${fmt(confirmPopup.item.rewardCredit)}`}</div>
              <div className="ccode-item-price">ราคา: {fmt(confirmPopup.item.price)} {coinName}</div>
              <div className="ccode-item-balance">ยอดคงเหลือ: {fmt(hengcoin)} {coinName}</div>
            </div>
            
            <div className="ccode-confirm-message">
              <div className="ccode-confirm-text">⚠️ คุณต้องการแลกรางวัลนี้หรือไม่?</div>
              <div className="ccode-confirm-warning">การแลกไม่สามารถยกเลิกได้ กรุณาตรวจสอบข้อมูลให้ถูกต้อง</div>
            </div>
            
            <div className="ccode-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setConfirmPopup({ open: false })}
              >
                ยกเลิก
              </button>
              <button 
                className="btn-fill" 
                onClick={handleConfirmRedeem}
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
    </div>
  );
}
