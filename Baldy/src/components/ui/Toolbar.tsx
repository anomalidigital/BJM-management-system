import type { ReactNode } from 'react'
import { FaMagnifyingGlass, FaXmark } from './icons'
import { cn } from '../../lib/utils'

export { DaftarChipFilter, PanelFilter } from './PanelFilter'

/** Kotak pencarian instan — memfilter tanpa reload halaman. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari...',
  className,
  width = 'w-72',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  width?: string
}) {
  return (
    <div className={cn('kotak-cari max-w-full', width, className)}>
      <FaMagnifyingGlass size={14} className="ikon-cari" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="form-control"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="hapus-cari rounded p-0.5 text-ink-3 transition hover:bg-black/5 hover:text-ink"
        >
          <FaXmark size={14} />
        </button>
      )}
    </div>
  )
}

/**
 * Baris berisi search + satu tombol Filter (PanelFilter) di kiri, tombol aksi di kanan.
 * Seluruh filter halaman dikumpulkan di PanelFilter (revisi 13 Okt 2026).
 */
export function Toolbar({ left, right, className }: { left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('no-print flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3', className)}>
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  )
}

