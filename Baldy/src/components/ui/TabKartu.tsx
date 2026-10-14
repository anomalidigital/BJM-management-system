import { useRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { IconComponent } from './icons'
import { cn } from '../../lib/utils'

export interface KartuTab {
  id: string
  label: string
  ikon: IconComponent
  /** Angka utama di kartu, mis. total Rupiah periode (ringkas). */
  nilai: ReactNode
  /** Keterangan di bawah angka, mis. "12 trip berangkat". */
  keterangan?: ReactNode
  /** Teks lengkap saat kursor diam di atas kartu, mis. nilai Rupiah penuh. */
  judul?: string
}

const idTab = (awalan: string, id: string) => `${awalan}-tab-${id}`
const idPanel = (awalan: string, id: string) => `${awalan}-panel-${id}`

/** Segitiga di bawah kartu aktif yang menunjuk ke panel isinya. */
const PENUNJUK = {
  left: '50%',
  top: '100%',
  transform: 'translateX(-50%)',
  borderLeft: '10px solid transparent',
  borderRight: '10px solid transparent',
  borderTop: '10px solid var(--color-brand-500)',
} as const

/**
 * Tab berbentuk kartu tombol besar. Permintaan atasan (12 Okt 2026): pemilih bagian dibuat
 * "lebih untuk tampilan BUTTON" dan diberi penanda visual supaya perpindahan halaman disadari.
 * Kartu aktif biru penuh dengan segitiga yang menunjuk ke panel di bawahnya; kartu lain putih
 * bergaris tipis. Latar tetap polos. Tombol panah kiri/kanan, Home, dan End berpindah kartu.
 *
 * Pasangkan dengan <PanelTab> berawalan sama supaya pembaca layar tahu panel milik tab mana.
 */
export function TabKartu({
  items,
  value,
  onChange,
  label,
  awalan = 'tab-kartu',
  className,
}: {
  items: KartuTab[]
  value: string
  onChange: (id: string) => void
  /** Nama deretan tab untuk pembaca layar. */
  label: string
  /** Awalan id elemen; harus sama dengan <PanelTab>. */
  awalan?: string
  className?: string
}) {
  const akar = useRef<HTMLDivElement>(null)

  function tombol(e: KeyboardEvent<HTMLDivElement>) {
    const i = items.findIndex((t) => t.id === value)
    const tujuan = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[e.key]
    if (tujuan === undefined || items.length === 0) return
    e.preventDefault()
    const t = items[(tujuan + items.length) % items.length]
    onChange(t.id)
    akar.current?.querySelector<HTMLButtonElement>(`[data-tab="${t.id}"]`)?.focus()
  }

  return (
    <div ref={akar} role="tablist" aria-label={label} onKeyDown={tombol} className={cn('grid grid-cols-3 gap-2 sm:gap-4', className)}>
      {items.map((t) => {
        const aktif = t.id === value
        const Ikon = t.ikon
        return (
          <button
            key={t.id}
            id={idTab(awalan, t.id)}
            data-tab={t.id}
            type="button"
            role="tab"
            aria-selected={aktif}
            aria-controls={idPanel(awalan, t.id)}
            tabIndex={aktif ? 0 : -1}
            title={t.judul}
            onClick={() => onChange(t.id)}
            // HP: ikon di atas teks (kartu sempit); layar lebar: ikon di kiri teks.
            className={cn(
              'relative block min-w-0 gap-3 rounded-xl border p-3 text-left transition-colors lg:flex',
              aktif
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'shadow-card cursor-pointer border-hairline bg-surface text-ink hover:border-brand-300 hover:bg-brand-50',
            )}
            style={aktif ? { boxShadow: '0 10px 22px -12px color-mix(in srgb, var(--color-brand-500) 80%, transparent)' } : undefined}
          >
            <span
              className={cn('mb-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg', !aktif && 'bg-brand-50 text-brand-600')}
              style={aktif ? { background: 'rgba(255,255,255,.18)' } : undefined}
            >
              <Ikon size={16} />
            </span>
            <span className="block min-w-0">
              <span className={cn('block text-[13px] leading-tight font-semibold', aktif ? 'text-white' : 'text-ink-2')}>{t.label}</span>
              {/* Angka besar memakai angka proporsional; ukurannya mengikuti lebar layar. */}
              <span className="mt-1.5 block leading-none font-semibold tracking-tight whitespace-nowrap" style={{ fontSize: 'clamp(15px, 0.9vw + 9px, 22px)' }}>
                {t.nilai}
              </span>
              {t.keterangan && (
                <span className={cn('mt-1.5 block text-[12px] leading-snug', aktif ? 'text-white/70' : 'text-ink-3')}>{t.keterangan}</span>
              )}
            </span>
            {aktif && <span aria-hidden="true" className="absolute" style={PENUNJUK} />}
          </button>
        )
      })}
    </div>
  )
}

/** Panel isi untuk satu kartu tab; `id` = id kartu yang sedang aktif. */
export function PanelTab({
  id,
  awalan = 'tab-kartu',
  className,
  style,
  children,
}: {
  id: string
  awalan?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div role="tabpanel" id={idPanel(awalan, id)} aria-labelledby={idTab(awalan, id)} className={className} style={style}>
      {children}
    </div>
  )
}

/**
 * Tombol segmen: beberapa pilihan bersebelahan, yang terpilih biru penuh (pola tombol
 * Potret | Lanskap di Preview cetak). `value` kosong = belum ada yang terpilih.
 */
export function TombolSegmen({
  pilihan,
  value,
  onChange,
  label,
  className,
}: {
  pilihan: Array<{ id: string; label: string; judul?: string }>
  value: string | null
  onChange: (id: string) => void
  /** Nama kelompok tombol untuk pembaca layar. */
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex items-center rounded-md border border-hairline bg-surface p-0.5', className)}>
      {pilihan.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.id === value}
          title={p.judul}
          onClick={() => onChange(p.id)}
          className={cn(
            'rounded px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors',
            p.id === value ? 'bg-brand-500 text-white' : 'cursor-pointer text-ink-2 hover:bg-sunken',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
