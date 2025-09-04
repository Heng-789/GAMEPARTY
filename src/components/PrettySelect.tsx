import React from 'react'

export type PrettyOption = { label: string; value: string }

type Props = {
  options: (PrettyOption | string)[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function PrettySelect({
  options,
  value,
  onChange,
  placeholder = 'เลือก…',
  className = '',
}: Props) {
  const opts: PrettyOption[] = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o
  )

  const [open, setOpen] = React.useState(false)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const currentIndex = Math.max(
    0,
    opts.findIndex((o) => o.value === value)
  )

  // ปิดเมื่อคลิกนอก
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // คีย์บอร์ด
  const [hoverIndex, setHoverIndex] = React.useState(currentIndex)
  React.useEffect(() => setHoverIndex(currentIndex), [open])

  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); setOpen(true); return
    }
    if (!open) return
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIndex((i) => Math.min(i + 1, opts.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHoverIndex((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter')     { e.preventDefault(); onChange(opts[hoverIndex].value); setOpen(false); return }
  }

  const selLabel = opts.find(o => o.value === value)?.label ?? placeholder

  return (
    <div className={`psel ${open ? 'open' : ''} ${className}`}>
      <button
        type="button"
        className="psel-btn"
        ref={btnRef}
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`psel-text ${value ? '' : 'muted'}`}>{selLabel}</span>
        <span className="psel-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="psel-menu" ref={menuRef} role="listbox" tabIndex={-1}>
          {opts.map((o, i) => {
            const selected = o.value === value
            const active = i === hoverIndex
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={selected}
                className={`psel-item ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o.value); setOpen(false) }}
              >
                {o.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
