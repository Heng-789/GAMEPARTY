import React, { useMemo } from 'react'
import '../styles/userbar.css'

export type UserBarProps = {
  username?: string
  credit?: number
  className?: string
}

function formatShort(n: number) {
  const v = Number(n || 0)
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000)         return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function UserBar({
  username = '-',
  credit = 0,
  className = '',
}: UserBarProps) {
  const creditFull = useMemo(() => Number(credit ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }), [credit])
  const creditShort = useMemo(() => formatShort(Number(credit ?? 0)), [credit])

  return (
    <div className={`userbar userbar--brand ${className}`}>
      <div className="userbar__left">
        <span className="userbar__avatar" aria-hidden>👤</span>
        <span className="userbar__name" title={username}>{username}</span>
      </div>

      <div
        className="userbar__credit"
        title={`HENGCOIN ${creditFull}`}
        aria-label={`HENGCOIN ${creditFull}`}
      >
        <span className="ub-lbl">💎 HENGCOIN</span>
        <span className="ub-colon">:</span>
        <span className="ub-amt ub-amt--full ub-amt--short">{creditFull}</span>
      </div>
    </div>
  )
}
