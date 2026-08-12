import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

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
    <div className={cn('relative', width, className)}>
      <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-[13px] text-ink transition-colors placeholder:text-ink-3/80 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-3 transition hover:bg-black/5 hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/** Baris berisi search + filter di kiri, tombol aksi di kanan. */
export function Toolbar({ left, right, className }: { left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('no-print flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3', className)}>
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  )
}

/** Filter berlabel kecil di atas kontrolnya. */
export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex items-center gap-2', className)}>
      <span className="text-[12px] font-medium whitespace-nowrap text-ink-3">{label}</span>
      {children}
    </label>
  )
}

/** Chip ringkas untuk menampilkan filter aktif. */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 py-0.5 pr-1 pl-2.5 text-[12px] font-medium text-brand-700">
      {children}
      <button type="button" onClick={onClear} aria-label="Hapus filter" className="rounded-full p-0.5 hover:bg-brand-100">
        <X size={12} />
      </button>
    </span>
  )
}
