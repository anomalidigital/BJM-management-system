import { useId } from 'react'
import { Badge } from './Badge'
import { DateInput } from './Field'
import { LampiranInput, LampiranThumbs } from './Lampiran'
import { addDaysISO, formatDate, todayISO } from '../../lib/format'
import { cn } from '../../lib/utils'
import type { DokumenPenting, JenisDokumenPenting } from '../../types'

/** Keadaan masa berlaku dokumen: habis, habis dalam 30 hari, masih berlaku, atau tidak dicatat. */
export function statusBerlaku(tanggal?: string): 'habis' | 'segera' | 'berlaku' | '' {
  if (!tanggal) return ''
  const hariIni = todayISO()
  if (tanggal < hariIni) return 'habis'
  if (tanggal <= addDaysISO(hariIni, 30)) return 'segera'
  return 'berlaku'
}

/** Ringkasan untuk tabel: berapa yang sudah diunggah, dan mana yang habis / segera habis. */
export function ringkasDokumen(jenis: readonly JenisDokumenPenting[], dokumen?: Record<string, DokumenPenting>) {
  const ada = jenis.filter((j) => (dokumen?.[j.kode]?.berkas.length ?? 0) > 0)
  return {
    ada: ada.map((j) => j.label),
    total: jenis.length,
    habis: jenis.filter((j) => statusBerlaku(dokumen?.[j.kode]?.berlaku_sampai) === 'habis').map((j) => j.label),
    segera: jenis.filter((j) => statusBerlaku(dokumen?.[j.kode]?.berlaku_sampai) === 'segera').map((j) => j.label),
  }
}

function LencanaBerlaku({ dok }: { dok?: DokumenPenting }) {
  const s = statusBerlaku(dok?.berlaku_sampai)
  if (!dok?.berlaku_sampai) return null
  if (s === 'habis') return <Badge tone="critical">Habis {formatDate(dok.berlaku_sampai)}</Badge>
  if (s === 'segera') return <Badge tone="warning">Habis {formatDate(dok.berlaku_sampai)}</Badge>
  return <Badge tone="good">s/d {formatDate(dok.berlaku_sampai)}</Badge>
}

/**
 * Upload dokumen penting (revisi 13 Okt 2026) dalam tampilan yang sama dengan "Dokumen lainnya"
 * (Baldy 14 Okt 2026: jangan dipisah dan jangan besar, supaya form tidak perlu di-scroll): satu
 * kotak kecil per jenis (KTP, SIM, ... / STNK, KIR, ...), tanggal berlaku di sampingnya untuk
 * dokumen yang punya masa berlaku, lalu dokumen lainnya di ujung baris yang sama.
 */
export function DokumenPentingInput({ jenis, value, onChange, lainnya }: {
  jenis: readonly JenisDokumenPenting[]
  value: Record<string, DokumenPenting>
  onChange: (v: Record<string, DokumenPenting>) => void
  /** Berkas lain di luar jenis di atas, mis. sertifikat atau foto kendaraan. */
  lainnya?: { value: string[]; onChange: (ids: string[]) => void; label: string }
}) {
  const dasar = useId()
  const ubah = (kode: string, patch: Partial<DokumenPenting>) => {
    const lama = value[kode] ?? { berkas: [] }
    onChange({ ...value, [kode]: { ...lama, ...patch } })
  }
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      {jenis.map((j) => {
        const dok = value[j.kode]
        const s = statusBerlaku(dok?.berlaku_sampai)
        return (
          <div key={j.kode} className="flex items-end gap-2">
            <LampiranInput nama={j.label} value={dok?.berkas ?? []} onChange={(berkas) => ubah(j.kode, { berkas })} />
            {j.berlaku && (
              <div className="w-[168px]">
                <label htmlFor={`${dasar}-${j.kode}-tgl`}
                  className={cn('mb-1 block text-[11px] font-semibold', s === 'habis' ? 'text-[color:var(--color-critical)]' : s === 'segera' ? 'text-[#8a6100]' : 'text-ink-3')}>
                  <span className="sr-only">{j.label} </span>Berlaku s/d{s === 'habis' ? ' · sudah habis' : s === 'segera' ? ' · segera habis' : ''}
                </label>
                <DateInput id={`${dasar}-${j.kode}-tgl`} value={dok?.berlaku_sampai ?? ''} invalid={s === 'habis'}
                  onChange={(e) => ubah(j.kode, { berlaku_sampai: e.target.value })} />
              </div>
            )}
          </div>
        )
      })}
      {lainnya && <LampiranInput label={lainnya.label} value={lainnya.value} onChange={lainnya.onChange} />}
    </div>
  )
}

/** Tampilan dokumen penting + dokumen lainnya di halaman detail (hanya lihat). */
export function DokumenPentingRingkas({ jenis, dokumen, lainnya, kosong }: {
  jenis: readonly JenisDokumenPenting[]
  dokumen?: Record<string, DokumenPenting>
  lainnya: string[]
  kosong: string
}) {
  const adaApa = jenis.some((j) => (dokumen?.[j.kode]?.berkas.length ?? 0) > 0) || lainnya.length > 0
  if (!adaApa) return <p className="text-[12.5px] text-ink-3">{kosong}</p>
  return (
    <div className="space-y-2.5">
      {jenis.map((j) => {
        const dok = dokumen?.[j.kode]
        return (
          <div key={j.kode} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="w-28 shrink-0 text-[12.5px] font-medium text-ink-2">{j.label}</span>
            {(dok?.berkas.length ?? 0) > 0 ? <LampiranThumbs ids={dok!.berkas} ukuran={40} /> : <span className="text-[12px] text-ink-3">Belum ada</span>}
            <LencanaBerlaku dok={dok} />
          </div>
        )
      })}
      {lainnya.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="w-28 shrink-0 text-[12.5px] font-medium text-ink-2">Lainnya</span>
          <LampiranThumbs ids={lainnya} ukuran={40} />
        </div>
      )}
    </div>
  )
}
