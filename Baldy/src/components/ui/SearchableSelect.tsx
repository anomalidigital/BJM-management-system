import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { FaCheck, FaLock, FaMagnifyingGlass, FaPlus, FaXmark } from './icons'
import { cn, matchesQuery } from '../../lib/utils'

export interface Option {
  value: string
  label: string
  /** Baris kedua kecil di bawah label (mis. nama rute / kota supir). Untuk pilihan nonaktif: alasannya. */
  meta?: string
  /** Teks tambahan yang ikut dicari tapi tidak ditampilkan. */
  keywords?: string
  /**
   * Pilihan tampil tapi tidak bisa dipilih (diklik maupun Enter), mis. kendaraan yang masih
   * dipakai trip lain. Tulis alasannya di `meta` supaya pengguna tahu kenapa.
   */
  disabled?: boolean
}

/** Aksi di baris pertama daftar, mis. "Tambah alamat" saat pilihan yang dicari belum ada. */
export interface AksiTambahan {
  /** Teks aksi; boleh fungsi dari ketikan pencarian, mis. (q) => `Tambah alamat "${q}"`. */
  label: string | ((query: string) => string)
  /** Dipanggil dengan ketikan pencarian saat itu (bisa dipakai mengisi form tambah). */
  onClick: (query: string) => void
  disabled?: boolean
  /** Keterangan kecil di bawah label, mis. alasan aksi dinonaktifkan. */
  hint?: string
}

interface Props {
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  id?: string
  /** Selalu tampil paling atas di daftar, juga saat pencarian tidak menemukan apa pun. */
  tambahan?: AksiTambahan
  /** Kotak pencarian di panel. Daftar pendek (mis. pilihan status) cukup tanpa pencarian. */
  cari?: boolean
  ukuran?: 'sm' | 'md'
  /** Kelas pembungkus, mis. lebar di toolbar. */
  className?: string
  'aria-label'?: string
}

/** Pilihan yang cocok dengan ketikan pencarian. */
const saring = (options: Option[], q: string) => options.filter((o) => matchesQuery(q, o.label, o.meta, o.keywords, o.value))
/** Urutan pilihan pertama yang bisa dipilih (0 bila semuanya nonaktif / kosong). */
const pertamaAktif = (list: Option[]) => Math.max(0, list.findIndex((o) => !o.disabled))

const LEBAR_MIN = 220
/** Di atas modal (z-90) dan panel filter, di bawah notifikasi (z-100). */
const Z_PANEL = 96

/**
 * Dropdown pilihan SIKOTIS — satu tampilan untuk semua dropdown (permintaan Baldy 13 Okt 2026).
 * Tombolnya bergaya `.form-select` Bootstrap, daftarnya `.dropdown-menu` yang dirender di
 * atas halaman (portal), jadi tidak terpotong modal atau tabel, dan membuka ke atas bila ruang
 * di bawah tidak cukup. Dipakai langsung untuk Supir / Rute / Kendaraan, dan lewat <Select>.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyText = 'Tidak ada pilihan yang cocok.',
  disabled,
  invalid,
  clearable = true,
  id,
  tambahan,
  cari = true,
  ukuran = 'md',
  className,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [posisi, setPosisi] = useState<CSSProperties>({ position: 'fixed', top: -9999, left: -9999, width: LEBAR_MIN })
  const rootRef = useRef<HTMLDivElement>(null)
  const tombolRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const daftarRef = useRef<HTMLDivElement>(null)

  const nilai = value ?? ''
  const selected = options.find((o) => o.value === nilai) ?? null
  const filtered = useMemo(() => saring(options, query), [options, query])
  const nonaktif = useMemo(() => options.filter((o) => o.disabled).length, [options])
  const labelTambahan = tambahan ? (typeof tambahan.label === 'function' ? tambahan.label(query.trim()) : tambahan.label) : ''

  function tutup(kembaliFokus: boolean) {
    setOpen(false)
    if (kembaliFokus) tombolRef.current?.focus()
  }

  // Letak panel mengikuti tombol: di bawahnya, atau di atasnya bila ruang bawah tidak cukup.
  useLayoutEffect(() => {
    if (!open) return
    const hitung = () => {
      const r = tombolRef.current?.getBoundingClientRect()
      if (!r) return
      const lebar = Math.min(Math.max(r.width, LEBAR_MIN), window.innerWidth - 16)
      const tinggi = panelRef.current?.offsetHeight ?? 320
      const ruangBawah = window.innerHeight - r.bottom
      const keAtas = ruangBawah < tinggi + 12 && r.top > ruangBawah
      const left = Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8))
      setPosisi(keAtas
        ? { position: 'fixed', left, width: lebar, bottom: window.innerHeight - r.top + 4 }
        : { position: 'fixed', left, width: lebar, top: r.bottom + 4 })
    }
    hitung()
    window.addEventListener('scroll', hitung, true)
    window.addEventListener('resize', hitung)
    return () => {
      window.removeEventListener('scroll', hitung, true)
      window.removeEventListener('resize', hitung)
    }
  }, [open, query, filtered.length])

  // Klik di luar tombol dan panel menutup daftar.
  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const terpilih = options.findIndex((o) => o.value === nilai && !o.disabled)
    setActive(terpilih >= 0 ? terpilih : pertamaAktif(options))
    window.setTimeout(() => (cari ? inputRef.current : daftarRef.current)?.focus(), 10)
    // Hanya saat daftar dibuka; daftar yang berubah sesudahnya ditangani saat mengetik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Pilihan yang disorot keyboard selalu terlihat di daftar.
  useEffect(() => {
    if (!open) return
    daftarRef.current?.querySelector('[data-aktif="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function commit(o: Option) {
    // Pilihan nonaktif hanya ditampilkan (dengan alasannya), tidak bisa dipilih.
    if (o.disabled) return
    onChange(o.value)
    tutup(true)
  }

  /** Pindah sorotan ke pilihan aktif berikutnya / sebelumnya; pilihan nonaktif dilewati. */
  function geser(arah: 1 | -1) {
    setActive((i) => {
      for (let j = i + arah; j >= 0 && j < filtered.length; j += arah) if (!filtered[j].disabled) return j
      return i
    })
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      geser(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      geser(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) commit(filtered[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      tutup(true)
    } else if (e.key === 'Tab') {
      tutup(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={tombolRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? tutup(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn('form-select', ukuran === 'sm' && 'form-select-sm', invalid && 'is-invalid', open && 'terbuka')}
      >
        <span className={cn('isi-pilihan', !selected && 'kosong')}>{selected ? selected.label : placeholder}</span>
        {clearable && selected && selected.value !== '' && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Kosongkan pilihan"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            className="shrink-0 rounded p-0.5 text-ink-3 hover:bg-black/5 hover:text-ink"
          >
            <FaXmark size={13} />
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="dropdown-menu show"
          data-lapis-atas=""
          style={{ ...posisi, zIndex: Z_PANEL }}
        >
          {cari && (
            <div className="px-2 pt-1 pb-2">
              <div className="kotak-cari">
                <FaMagnifyingGlass size={13} className="ikon-cari" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(pertamaAktif(saring(options, e.target.value)))
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="form-control form-control-sm"
                />
              </div>
            </div>
          )}
          {/* Di luar listbox: bukan pilihan, jadi tidak ikut navigasi panah & Enter. */}
          {tambahan && (
            <>
              <button
                type="button"
                disabled={tambahan.disabled}
                onClick={() => {
                  const q = query.trim()
                  tutup(false)
                  tambahan.onClick(q)
                }}
                className="dropdown-item aksi-tambah"
              >
                <FaPlus size={13} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{labelTambahan}</span>
                  {tambahan.hint && <span className="block text-[11.5px] font-normal text-ink-3">{tambahan.hint}</span>}
                </span>
              </button>
              <hr className="dropdown-divider" />
            </>
          )}
          <div ref={daftarRef} role="listbox" tabIndex={-1} className="pilihan-daftar outline-none" onKeyDown={cari ? undefined : onKeyDown}>
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-3">{emptyText}</div>}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === nilai}
                aria-disabled={o.disabled || undefined}
                data-aktif={i === active ? 'true' : undefined}
                title={o.disabled ? o.meta : undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => commit(o)}
                className={cn('dropdown-item', i === active && !o.disabled && 'active')}
              >
                {o.disabled && <FaLock size={12} className="shrink-0 text-ink-3" />}
                <span className="min-w-0 flex-1">
                  <span className="label-opsi">{o.label}</span>
                  {o.meta && <span className="meta-opsi">{o.meta}</span>}
                </span>
                {o.value === nilai && <FaCheck size={14} className="shrink-0 text-brand-600" />}
              </button>
            ))}
          </div>
          {cari && (
            <div className="dropdown-footer">
              {filtered.length} dari {options.length} data{nonaktif > 0 && ` · ${nonaktif} tidak bisa dipilih`}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
