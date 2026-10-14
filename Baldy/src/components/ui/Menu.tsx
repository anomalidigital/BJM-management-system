import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FaEllipsis } from './icons'
import { cn } from '../../lib/utils'

export interface MenuAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Alasan aksi tidak bisa dipakai, tampil kecil di bawah labelnya (mis. "Sudah ditagih lewat PI 0473"). */
  alasan?: string
}

const LEBAR = 216

/**
 * Menu overflow ringkas untuk aksi sekunder pada baris tabel.
 * Panelnya dirender lewat portal dengan posisi tetap di layar, supaya tidak
 * terpotong area gulir tabel (tabel pendek memotong menu di baris terakhir).
 * Bila ruang di bawah kurang, panel membuka ke atas.
 */
export function OverflowMenu({ actions, label = 'Aksi lainnya' }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const tombolRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [posisi, setPosisi] = useState<CSSProperties>({ top: -9999, left: -9999 })

  // Letak panel dihitung dari tombol; dihitung ulang saat halaman digulir atau diubah ukurannya.
  useLayoutEffect(() => {
    if (!open) return
    const hitung = () => {
      const r = tombolRef.current?.getBoundingClientRect()
      if (!r) return
      const tinggi = panelRef.current?.offsetHeight ?? 0
      const keAtas = r.bottom + tinggi + 8 > window.innerHeight && r.top - tinggi - 4 > 0
      setPosisi({
        top: keAtas ? r.top - tinggi - 4 : r.bottom + 4,
        left: Math.max(8, Math.min(r.right - LEBAR, window.innerWidth - LEBAR - 8)),
      })
    }
    hitung()
    window.addEventListener('scroll', hitung, true)
    window.addEventListener('resize', hitung)
    return () => {
      window.removeEventListener('scroll', hitung, true)
      window.removeEventListener('resize', hitung)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!tombolRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative inline-block">
      <button
        ref={tombolRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="btn btn-icon"
      >
        <FaEllipsis size={15} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{ ...posisi, width: LEBAR, position: 'fixed', zIndex: 85 }}
          // Di atas isi halaman dan popup biasa, di bawah modal (z-90) dan notifikasi.
          className="dropdown-menu show"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={() => {
                setOpen(false)
                a.onSelect()
              }}
              className={cn('dropdown-item', a.tone === 'danger' && 'dropdown-item-danger')}
            >
              {a.icon}
              {a.disabled && a.alasan
                ? <span className="min-w-0"><span className="block">{a.label}</span><span className="block text-[11px] leading-snug font-normal">{a.alasan}</span></span>
                : a.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
