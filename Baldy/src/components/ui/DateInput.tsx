import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, InputHTMLAttributes, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { FaCalendarDays, FaChevronLeft, FaChevronRight } from './icons'
import { cn } from '../../lib/utils'
import { todayISO } from '../../lib/format'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Senin dulu: minggu kerja depo. Minggu di ujung, merah seperti tanggal merah di kalender dinding. */
const HARI_KOLOM = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** Nama bulan yang dikenali saat mengetik, termasuk ejaan Inggris yang sering terbawa. */
const KATA_BULAN: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, peb: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12,
}

const LEBAR_PANEL = 296
const pad = (n: number) => String(n).padStart(2, '0')
const keIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const pecah = (iso: string) => iso.split('-').map(Number) as [number, number, number]

function sahTanggal(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1) return null
  const t = new Date(y, m - 1, d)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? keIso(y, m, d) : null
}

function geser(iso: string, hari: number): string {
  const [y, m, d] = pecah(iso)
  const t = new Date(y, m - 1, d + hari)
  return keIso(t.getFullYear(), t.getMonth() + 1, t.getDate())
}

function geserBulan(iso: string, bulan: number): string {
  const [y, m, d] = pecah(iso)
  const awal = new Date(y, m - 1 + bulan, 1)
  const akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0).getDate()
  return keIso(awal.getFullYear(), awal.getMonth() + 1, Math.min(d, akhir))
}

const hariKe = (iso: string) => { const [y, m, d] = pecah(iso); return new Date(y, m - 1, d).getDay() }

/** "2026-10-06" -> "Sel, 6 Okt 2026" */
export function tulisTanggal(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = pecah(iso)
  return `${HARI_SINGKAT[hariKe(iso)]}, ${d} ${BULAN_SINGKAT[m - 1]} ${y}`
}

const tulisPanjang = (iso: string) => {
  const [y, m, d] = pecah(iso)
  return `${HARI[hariKe(iso)]}, ${d} ${BULAN[m - 1]} ${y}`
}

/**
 * Baca ketikan tanggal: "6/10/2026", "6-10-26", "6/10" (tahun ikut acuan), "06102026",
 * "6 okt 2026", "2026-10-06", atau tampilan kolom itu sendiri ("Sel, 6 Okt 2026").
 * Hasil: ISO, '' bila dikosongkan, null bila tidak terbaca.
 */
export function bacaTanggal(teks: string, acuanTahun: number): string | null {
  const s = teks.trim().toLowerCase().replace(/^[a-z]+,\s*/, '')
  if (!s) return ''
  const tahun = (t?: string) => (!t ? acuanTahun : t.length <= 2 ? 2000 + Number(t) : Number(t))
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return sahTanggal(Number(m[1]), Number(m[2]), Number(m[3]))
  m = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})(?:[/.\-\s](\d{2}|\d{4}))?$/)
  if (m) return sahTanggal(tahun(m[3]), Number(m[2]), Number(m[1]))
  m = s.match(/^(\d{1,2})\s*([a-z]+)\.?(?:\s+(\d{2}|\d{4}))?$/)
  if (m && KATA_BULAN[m[2]]) return sahTanggal(tahun(m[3]), KATA_BULAN[m[2]], Number(m[1]))
  m = s.match(/^(\d{2})(\d{2})(\d{2}|\d{4})?$/)
  if (m) return sahTanggal(tahun(m[3]), Number(m[2]), Number(m[1]))
  return null
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value?: string | null
  /** Dipanggil seperti input biasa: `e.target.value` berisi tanggal ISO, atau '' bila dikosongkan. */
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  invalid?: boolean
  /** Jumlah penanda per tanggal (mis. trip berangkat), tampil sebagai kotak kecil di bawah angka. */
  penanda?: (iso: string) => number
  /** Arti penanda untuk keterangan, mis. "trip berangkat". */
  penandaLabel?: string
}

/**
 * Kolom tanggal SIKOTIS: bisa diketik bebas, atau dipilih di papan kalender bergaya
 * jadwal depo (kepala gelap polos, marka kuning untuk hari ini, Minggu merah).
 */
export function DateInput({
  value, onChange, invalid, penanda, penandaLabel = 'data', className, disabled, readOnly,
  min, max, id, placeholder = 'Pilih tanggal', onBlur, onFocus, ...rest
}: Props) {
  const iso = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  const hariIni = todayISO()
  const terkunci = disabled || readOnly
  const batasBawah = typeof min === 'string' ? min : ''
  const batasAtas = typeof max === 'string' ? max : ''

  const [buka, setBuka] = useState(false)
  const [mode, setMode] = useState<'hari' | 'bulan'>('hari')
  const [aktif, setAktif] = useState(iso || hariIni)
  const [ketik, setKetik] = useState<string | null>(null)
  const [posisi, setPosisi] = useState<CSSProperties>({ top: -9999, left: -9999 })
  const akarRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fokusKeGrid = useRef(false)
  /** Fokus dari klik mouse tidak menyorot seluruh teks; dari Tab ya, supaya langsung bisa diketik ulang. */
  const lewatMouse = useRef(false)

  const kirim = (baru: string) => {
    if (baru === iso) return
    onChange?.({ target: { value: baru }, currentTarget: { value: baru } } as unknown as ChangeEvent<HTMLInputElement>)
  }
  const diLuarBatas = (t: string) => (!!batasBawah && t < batasBawah) || (!!batasAtas && t > batasAtas)

  function bukaPanel(keGrid: boolean) {
    if (terkunci) return
    setAktif(iso || hariIni)
    setMode('hari')
    fokusKeGrid.current = keGrid
    setBuka(true)
  }
  function tutup(kembaliKeInput: boolean) {
    setBuka(false)
    if (kembaliKeInput) inputRef.current?.focus()
  }
  function pilih(t: string) {
    if (diLuarBatas(t)) return
    kirim(t)
    setKetik(null)
    tutup(true)
  }

  // Posisi panel: di bawah kolom, naik ke atas bila ruang di bawah tidak cukup.
  useLayoutEffect(() => {
    if (!buka) return
    const atur = () => {
      const r = akarRef.current?.getBoundingClientRect()
      if (!r) return
      const tinggi = panelRef.current?.offsetHeight ?? 360
      const bawah = window.innerHeight - r.bottom
      const top = bawah < tinggi + 12 && r.top > bawah ? r.top - tinggi - 6 : r.bottom + 6
      const left = Math.max(8, Math.min(r.left, window.innerWidth - LEBAR_PANEL - 8))
      setPosisi({ top, left })
    }
    atur()
    window.addEventListener('resize', atur)
    window.addEventListener('scroll', atur, true)
    return () => { window.removeEventListener('resize', atur); window.removeEventListener('scroll', atur, true) }
  }, [buka, mode])

  // Klik di luar kolom & panel menutup panel.
  useEffect(() => {
    if (!buka) return
    const tekan = (e: MouseEvent) => {
      const t = e.target as Node
      if (!akarRef.current?.contains(t) && !panelRef.current?.contains(t)) setBuka(false)
    }
    document.addEventListener('mousedown', tekan)
    return () => document.removeEventListener('mousedown', tekan)
  }, [buka])

  // Saat dibuka lewat keyboard / ikon, fokus pindah ke tanggal aktif.
  useEffect(() => {
    if (!buka || mode !== 'hari' || !fokusKeGrid.current) return
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${aktif}"]`)?.focus()
  }, [buka, mode, aktif])

  const [ty, tm] = pecah(aktif)
  const hariGrid = useMemo(() => {
    const geserAwal = (new Date(ty, tm - 1, 1).getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, i) => {
      const t = new Date(ty, tm - 1, 1 - geserAwal + i)
      return keIso(t.getFullYear(), t.getMonth() + 1, t.getDate())
    })
  }, [ty, tm])

  function tombolGrid(e: KeyboardEvent<HTMLDivElement>) {
    const langkah: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let baru: string | null = null
    if (langkah[e.key] !== undefined) baru = geser(aktif, langkah[e.key])
    else if (e.key === 'PageUp') baru = geserBulan(aktif, e.shiftKey ? -12 : -1)
    else if (e.key === 'PageDown') baru = geserBulan(aktif, e.shiftKey ? 12 : 1)
    else if (e.key === 'Home') baru = geser(aktif, -((hariKe(aktif) + 6) % 7))
    else if (e.key === 'End') baru = geser(aktif, 6 - ((hariKe(aktif) + 6) % 7))
    else if (e.key === 'Escape') { e.preventDefault(); tutup(true); return }
    if (baru) { e.preventDefault(); fokusKeGrid.current = true; setAktif(baru) }
  }

  function tombolInput(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (ketik !== null) simpanKetikan()
      else if (!buka) bukaPanel(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (buka) { fokusKeGrid.current = true; panelRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${aktif}"]`)?.focus() }
      else bukaPanel(true)
    } else if (e.key === 'Escape' && buka) {
      e.preventDefault()
      tutup(false)
    }
  }

  /** Ketikan disimpan begitu terbaca; yang tidak terbaca dikembalikan ke nilai semula. */
  function simpanKetikan() {
    if (ketik === null) return
    const hasil = bacaTanggal(ketik, iso ? pecah(iso)[0] : pecah(hariIni)[0])
    if (hasil !== null && !(hasil && diLuarBatas(hasil))) kirim(hasil)
    setKetik(null)
  }

  const tampil = ketik ?? (iso ? tulisTanggal(iso) : '')
  // Lebar dari pemanggil (mis. filter w-[150px]) untuk pembungkus; tinggi (mis. h-8) untuk kolomnya.
  const kelas = (className ?? '').split(/\s+/).filter(Boolean)
  const kelasLebar = kelas.filter((k) => /^(min-|max-)?w-/.test(k)).join(' ')
  const kelasKolom = kelas.filter((k) => !/^(min-|max-)?w-/.test(k))
  const adaTinggi = kelasKolom.some((k) => /^h-/.test(k))

  return (
    <div ref={akarRef} className={cn('relative', kelasLebar || 'w-full')}>
      <input
        {...rest}
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        value={tampil}
        placeholder={terkunci ? '—' : placeholder}
        aria-haspopup="dialog"
        aria-expanded={buka}
        className={cn(
          !adaTinggi && 'h-9',
          'w-full rounded-md border bg-surface pr-9 pl-2.5 text-[13px] text-ink tnum placeholder:text-ink-3/70 transition-colors',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 read-only:bg-sunken read-only:text-ink-2',
          invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline',
          !terkunci && 'cursor-pointer',
          kelasKolom.join(' '),
        )}
        onChange={(e) => {
          setKetik(e.target.value)
          // Tanggal lengkap langsung tersimpan; yang belum lengkap (mis. "6/10") saat keluar dari kolom.
          const hasil = bacaTanggal(e.target.value, iso ? pecah(iso)[0] : pecah(hariIni)[0])
          if (hasil && /\d{4}/.test(e.target.value) && !diLuarBatas(hasil)) kirim(hasil)
        }}
        onMouseDown={() => { lewatMouse.current = true }}
        onClick={() => { if (!buka) bukaPanel(false) }}
        onFocus={(e) => {
          if (!lewatMouse.current) e.currentTarget.select()
          lewatMouse.current = false
          onFocus?.(e)
        }}
        onBlur={(e) => {
          simpanKetikan()
          // Fokus pindah ke luar kolom & panel (mis. Tab) = panel ditutup.
          if (buka && !panelRef.current?.contains(e.relatedTarget as Node)) setBuka(false)
          onBlur?.(e)
        }}
        onKeyDown={tombolInput}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={terkunci}
        aria-label="Buka kalender"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (buka ? tutup(true) : bukaPanel(true))}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-3 transition-colors hover:text-brand-700 disabled:pointer-events-none"
      >
        <FaCalendarDays size={14} />
      </button>

      {buka && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Pilih tanggal"
          style={{ ...posisi, width: LEBAR_PANEL }}
          // Di atas popup (z-90), di bawah notifikasi (z-100).
          className="animate-in-pop fixed z-[95] overflow-hidden rounded-lg border border-[color:var(--color-nav-900)] bg-surface shadow-pop"
          // Klik di panel tidak memindahkan fokus dari kolom, jadi ketikan tetap jalan.
          onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault() }}
          onBlur={(e) => {
            const ke = e.relatedTarget as Node | null
            if (!panelRef.current?.contains(ke) && ke !== inputRef.current) setBuka(false)
          }}
        >
          {/* Kepala: latar polos senada sidebar, bulan berhuruf stensil. */}
          <div className="flex items-center gap-1 bg-nav-900 px-2 py-2 text-white">
            <button
              type="button"
              onClick={() => { setMode(mode === 'hari' ? 'bulan' : 'hari') }}
              className="flex min-w-0 flex-1 items-baseline gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-white/10"
              aria-label={mode === 'hari' ? 'Pilih bulan dan tahun' : 'Kembali ke tanggal'}
            >
              {mode === 'hari' && <span className="font-stencil text-[22px] leading-none font-bold tracking-[.02em]">{BULAN[tm - 1]}</span>}
              <span className={cn('tnum font-rail leading-none font-semibold', mode === 'hari' ? 'text-[15px] text-nav-ink' : 'font-stencil text-[22px] text-white')}>{ty}</span>
            </button>
            {[[-1, 'sebelumnya', FaChevronLeft], [1, 'berikutnya', FaChevronRight]].map(([arah, kata, Ikon]) => {
              const Ic = Ikon as typeof FaChevronLeft
              return (
                <button
                  key={kata as string}
                  type="button"
                  aria-label={mode === 'hari' ? `Bulan ${kata}` : `Tahun ${kata}`}
                  onClick={() => { fokusKeGrid.current = false; setAktif(geserBulan(aktif, (arah as number) * (mode === 'hari' ? 1 : 12))) }}
                  className="grid size-8 place-items-center rounded text-nav-ink transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Ic size={13} />
                </button>
              )
            })}
          </div>

          {mode === 'hari' ? (
            <div className="px-2.5 pt-2 pb-2.5">
              <div className="grid grid-cols-7 gap-[3px]" aria-hidden="true">
                {HARI_KOLOM.map((h, i) => (
                  <span key={h} className={cn('pb-1 text-center font-rail text-[12px] font-semibold', i === 6 ? 'text-[color:var(--color-critical)]' : 'text-ink-3')}>{h}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[3px]" onKeyDown={tombolGrid}>
                {hariGrid.map((t) => {
                  const [, mm, dd] = pecah(t)
                  const luarBulan = mm !== tm
                  const dipilih = t === iso
                  const sekarang = t === hariIni
                  const minggu = hariKe(t) === 0
                  const terlarang = diLuarBatas(t)
                  const n = penanda?.(t) ?? 0
                  return (
                    <button
                      key={t}
                      type="button"
                      data-iso={t}
                      tabIndex={t === aktif ? 0 : -1}
                      disabled={terlarang}
                      aria-pressed={dipilih}
                      aria-current={sekarang ? 'date' : undefined}
                      aria-label={`${tulisPanjang(t)}${n ? `, ${n} ${penandaLabel}` : ''}${sekarang ? ', hari ini' : ''}`}
                      title={n ? `${n} ${penandaLabel}` : undefined}
                      onClick={() => pilih(t)}
                      onFocus={() => setAktif(t)}
                      className={cn(
                        'relative flex h-9 flex-col items-center justify-center rounded-[3px] font-rail text-[14px] leading-none font-semibold tnum transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                        dipilih ? 'bg-[color:var(--color-nav-800)] text-white'
                          : luarBulan ? 'text-ink-3/45 hover:bg-sunken'
                          : minggu ? 'text-[color:var(--color-critical)] hover:bg-sunken'
                          : 'text-ink hover:bg-sunken',
                        !dipilih && !luarBulan && 'bg-[#f4f6f9]',
                        terlarang && 'cursor-not-allowed opacity-35 hover:bg-transparent',
                      )}
                    >
                      {dd}
                      {/* Penanda: satu kotak kecil per data, paling banyak tiga. */}
                      {n > 0 && (
                        <span className="mt-[3px] flex gap-[2px]" aria-hidden="true">
                          {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                            <span key={i} className={cn('h-[3px] w-[5px] rounded-[1px]', dipilih ? 'bg-white/70' : 'bg-[color:var(--color-nav-700)]')} />
                          ))}
                        </span>
                      )}
                      {/* Hari ini: marka kuning sinyal, sama dengan menu aktif di rel. */}
                      {sekarang && <span className="absolute inset-x-[7px] bottom-[2px] h-[3px] rounded-full bg-[color:var(--color-signal)]" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[3px] p-2.5">
              {BULAN_SINGKAT.map((b, i) => {
                const ini = i + 1 === tm
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { fokusKeGrid.current = true; setAktif(keIso(ty, i + 1, 1)); setMode('hari') }}
                    className={cn(
                      'h-11 rounded-[3px] font-rail text-[15px] font-semibold transition-colors',
                      ini ? 'bg-[color:var(--color-nav-800)] text-white' : 'bg-[#f4f6f9] text-ink hover:bg-sunken',
                    )}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-hairline px-2.5 py-2">
            <button
              type="button"
              disabled={diLuarBatas(hariIni)}
              onClick={() => pilih(hariIni)}
              className="rounded px-2 py-1 text-[12.5px] font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-40"
            >
              Hari ini
            </button>
            {penanda && <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3"><span className="h-[3px] w-[5px] rounded-[1px] bg-[color:var(--color-nav-700)]" aria-hidden="true" />{penandaLabel}</span>}
            {iso && (
              <button
                type="button"
                onClick={() => { kirim(''); setKetik(null); tutup(true) }}
                className="rounded px-2 py-1 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
              >
                Kosongkan
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
