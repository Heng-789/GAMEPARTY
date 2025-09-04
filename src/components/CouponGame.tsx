import React from 'react';
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
  const [busyIdx, setBusyIdx] = React.useState<number | null>(null);
  const [codePopup, setCodePopup] = React.useState<{ open: boolean; code?: string; error?: string }>({ open: false });
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setBusyIdx(null); setCopied(false); }
  }, [open]);

  if (!open) return null;

  const fmt = (n: number) => n.toLocaleString('th-TH');

  const handleRedeem = async (idx: number) => {
    if (busyIdx !== null) return;
    setBusyIdx(idx);
    try {
      const res = await onRedeem(idx);
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
              <div className="ccart-icon" aria-hidden>💰</div>
              <div className="ccart-title">{title}</div>
              <div className="ccart-sub">แลกด้วย HENGCOIN</div>
              <div className="ccart-price"> : {fmt(it.price)}</div>
              <button className="ccart-btn" onClick={() => handleRedeem(i)} disabled={busyIdx !== null}>
                {busyIdx === i ? 'กำลังแลก…' : 'แลกรางวัล'}
              </button>
            </div>
          );
        })}
      </div>

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
                    href="https://heng-36z.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-fill link-btn"
                  >
                    ไปที่ HENG36
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
