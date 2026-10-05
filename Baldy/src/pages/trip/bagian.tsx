import type { ReactNode } from 'react'
import { FaPlus } from '../../components/ui/icons'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'

/** Baris keterangan + tombol tambah di atas tabel tiap tab. */
export function KepalaTab({ keterangan, tombol, bisaUbah, onTambah }: {
  keterangan: ReactNode
  tombol: string
  bisaUbah: boolean
  onTambah: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
      <p className="max-w-3xl text-[12.5px] text-ink-3">{keterangan}</p>
      <Button size="sm" variant="primary" icon={<FaPlus size={14} />} disabled={!bisaUbah} onClick={onTambah}>{tombol}</Button>
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

/** Tombol kecil "Pakai ..." untuk mengisi nilai acuan dari route. */
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
