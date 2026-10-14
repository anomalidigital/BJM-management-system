import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FaCheck, FaFilter, FaRotateLeft, FaXmark } from './icons'
import { cn } from '../../lib/utils'
import { FieldError } from './Field'
import type { KendaliFilter } from '../../lib/useFilter'

/** Satu tanda filter aktif di samping tombol Filter. Tanpa `lepas` = keterangan saja (mis. periode bawaan). */
export interface ChipFilter {
  label: string
  lepas?: () => void
}

/** Deretan chip filter yang berlaku, dengan "Hapus semua" bila lebih dari satu bisa dilepas. */
export function DaftarChipFilter<T>({ filter, chips, className }: {
  filter: KendaliFilter<T>
  chips: Array<ChipFilter | false | null | undefined | ''>
  className?: string
}) {
  const daftar = chips.filter((c): c is ChipFilter => !!c)
  const bisaLepas = daftar.filter((c) => c.lepas).length
  if (daftar.length === 0) return null
  return (
    <div className={cn('flex max-w-full flex-wrap items-center gap-1.5', className)} aria-label="Filter yang berlaku">
      {daftar.map((c) => (
        <span key={c.label} className={cn('badge chip-filter', c.lepas ? 'badge-brand' : 'badge-neutral')}>
          {c.label}
          {c.lepas && (
            <button type="button" onClick={c.lepas} aria-label={`Lepas filter ${c.label}`} className="lepas-chip">
              <FaXmark size={10} />
            </button>
          )}
        </span>
      ))}
      {bisaLepas > 1 && (
        <button type="button" onClick={filter.lepasSemua} className="text-[12px] font-semibold text-brand-700 hover:underline">
          Hapus semua
        </button>
      )}
    </div>
  )
}

/**
 * Satu tombol "Filter" untuk seluruh filter di sebuah halaman (Baldy 13 Okt 2026: "filter di semua
 * page dijadikan satu icon aja"). Isian di panel adalah draf dan baru berlaku setelah Terapkan
 * (Baldy 14 Okt 2026), jadi tabel tidak berganti-ganti selama filter diatur; Batal / klik di luar
 * membuang perubahan. Filter yang berlaku tampil sebagai chip di samping tombol, masing-masing bisa
 * dilepas (×), ditambah "Hapus semua".
 *
 * Isian di dalam panel boleh memakai dropdown / kalender: panel tidak tertutup saat pengguna
 * memilih di daftar mereka (ditandai `data-lapis-atas`).
 */
export function PanelFilter<T>({
  filter,
  chips = [],
  tampilChips = true,
  galat,
  children,
  label = 'Filter',
  lebar = 340,
  className,
}: {
  filter: KendaliFilter<T>
  /** Tanda filter yang berlaku; nilai kosong / false dilewati. */
  chips?: Array<ChipFilter | false | null | undefined | ''>
  /** false = chip ditampilkan sendiri oleh halaman (DaftarChipFilter), mis. saat tombol ada di kepala halaman. */
  tampilChips?: boolean
  /** Isian panel belum bisa diterapkan (mis. rentang tanggal terbalik): pesan tampil, Terapkan nonaktif. */
  galat?: string | null
  /** Isian filter: tulis ke `filter.draf` lewat `filter.ubah`. */
  children: ReactNode
  label?: string
  /** Lebar panel di layar lebar (px). */
  lebar?: number
  className?: string
}) {
  const [buka, setBuka] = useState(false)
  const [posisi, setPosisi] = useState<CSSProperties>({ position: 'fixed', top: -9999, left: -9999 })
  const tombolRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const daftar = chips.filter((c): c is ChipFilter => !!c)
  const aktif = daftar.filter((c) => c.lepas).length

  function bukaPanel() {
    filter.mulai()
    setBuka(true)
  }
  function tutup() {
    setBuka(false)
  }
  function terapkan() {
    if (galat) return
    filter.terapkan()
    setBuka(false)
    tombolRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (!buka) return
    const hitung = () => {
      const r = tombolRef.current?.getBoundingClientRect()
      if (!r) return
      const w = Math.min(lebar, window.innerWidth - 16)
      // Rata kiri dengan tombol; geser ke kiri bila menabrak tepi kanan layar.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      const top = r.bottom + 6
      setPosisi({ position: 'fixed', top, left, width: w, maxHeight: Math.max(240, window.innerHeight - top - 12) })
    }
    hitung()
    window.addEventListener('scroll', hitung, true)
    window.addEventListener('resize', hitung)
    return () => {
      window.removeEventListener('scroll', hitung, true)
      window.removeEventListener('resize', hitung)
    }
  }, [buka, lebar])

  useEffect(() => {
    if (!buka) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element
      if (tombolRef.current?.contains(t) || panelRef.current?.contains(t)) return
      // Daftar dropdown / kalender milik isian di dalam panel.
      if (t.closest?.('[data-lapis-atas]')) return
      setBuka(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-lapis-atas]')) {
        setBuka(false)
        tombolRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [buka])

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={buka}
        onClick={() => (buka ? tutup() : bukaPanel())}
        className={cn('btn btn-outline-secondary', aktif > 0 && 'border-brand-300 text-brand-700', className)}
      >
        <FaFilter size={13} />
        {label}
        {aktif > 0 && <span className="badge badge-brand">{aktif}</span>}
      </button>

      {tampilChips && <DaftarChipFilter filter={filter} chips={daftar} />}

      {buka && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Filter"
          className="panel-filter flex flex-col overflow-hidden"
          style={{ ...posisi, zIndex: 85 }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="text-[13.5px] font-semibold text-ink">Filter</p>
              <p className={cn('text-[12px]', filter.belumDiterapkan ? 'font-medium text-[#8a6100]' : 'text-ink-3')}>
                {filter.belumDiterapkan ? 'Ada perubahan, klik Terapkan untuk memakainya.' : aktif > 0 ? `${aktif} filter berlaku` : 'Belum ada filter yang berlaku'}
              </p>
            </div>
            <button type="button" className="btn-close" aria-label="Tutup filter" onClick={tutup} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {children}
            {galat && <div role="alert"><FieldError>{galat}</FieldError></div>}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-hairline bg-sunken px-4 py-2.5">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!filter.drafTerisi} onClick={filter.kosongkan}>
              <FaRotateLeft size={12} />
              Kosongkan
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={tutup}>Batal</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!!galat} onClick={terapkan}>
                <FaCheck size={12} />
                Terapkan
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
