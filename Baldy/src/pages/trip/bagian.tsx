import type { ReactNode } from 'react'
import { FaCircleInfo, FaPlus, FaTriangleExclamation } from '../../components/ui/icons'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'

/**
 * Baris judul / keterangan + tombol tambah di atas tabel tiap tab.
 * Judul dan tombol boleh kosong: tanpa `tombol` / `onTambah` tidak ada tombol tambah.
 */
export function KepalaTab({ judul, keterangan, tombol, bisaUbah = false, onTambah, className }: {
  /** Judul bagian, mis. "Komisi & biaya internal lain". */
  judul?: ReactNode
  keterangan: ReactNode
  tombol?: string
  bisaUbah?: boolean
  onTambah?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3', className)}>
      <div className="max-w-3xl min-w-0">
        {judul && <h3 className="text-[13.5px] font-semibold text-ink">{judul}</h3>}
        <div className={cn('text-[12.5px] text-ink-3', judul ? 'mt-0.5' : undefined)}>{keterangan}</div>
      </div>
      {tombol && onTambah && (
        <Button size="sm" variant="primary" icon={<FaPlus size={14} />} disabled={!bisaUbah} onClick={onTambah}>{tombol}</Button>
      )}
    </div>
  )
}

/** Tab tanpa isi: cukup pesan. Tombol tambah hanya satu, di KepalaTab kanan atas. */
export function KosongTab({ judul, keterangan }: { judul: string; keterangan: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[14px] font-semibold text-ink">{judul}</p>
      <p className="mt-1 text-[13px] text-ink-3">{keterangan}</p>
    </div>
  )
}

export interface Kolom {
  label: string
  kanan?: boolean
}

/** Kepala tabel sederhana untuk tab-tab trip. */
export function KepalaTabel({ kolom }: { kolom: Kolom[] }) {
  return (
    <thead className="bg-sunken">
      <tr className="border-b border-hairline">
        {kolom.map((k) => (
          <th key={k.label} className={cn('px-3 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase', k.kanan ? 'text-right' : 'text-left')}>
            {k.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/** Tombol kecil "Pakai ..." untuk mengisi nilai acuan dari rute. */
export function PakaiNilai({ label, onClick }: { label: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500">
      {label}
    </button>
  )
}

export function PesanGalat({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="text-[12px] font-medium text-[color:var(--color-critical)]">{children}</p>
}

/**
 * Kotak penjelasan kecil di dalam tab atau form. Nada "peringatan" untuk hal yang
 * belum bisa disimpan tanpa persetujuan Manager / Owner.
 */
export function KotakInfo({ nada = 'info', children, className }: {
  nada?: 'info' | 'peringatan'
  children: ReactNode
  className?: string
}) {
  const Ikon = nada === 'peringatan' ? FaTriangleExclamation : FaCircleInfo
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[12.5px] leading-relaxed',
        nada === 'peringatan' ? 'border-[#f6e2ac] bg-[#fff8e6] text-[#8a6100]' : 'border-brand-100 bg-brand-50 text-brand-800',
        className,
      )}
    >
      <Ikon size={14} className="mt-[3px] shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
