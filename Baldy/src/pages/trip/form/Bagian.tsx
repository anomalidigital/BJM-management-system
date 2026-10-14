import type { ReactNode } from 'react'
import { FaTriangleExclamation } from '../../../components/ui/icons'
import { Card, CardHeader } from '../../../components/ui/Card'
import { cn } from '../../../lib/utils'

/**
 * Satu bagian form trip: kartu selebar halaman, disusun dari atas ke bawah ("format
 * sebelumnya" yang dipilih atasan). Nomor urut membantu admin mengikuti urutan isian.
 */
export function Bagian({ nomor, judul, keterangan, aksi, children }: {
  nomor?: number
  judul: string
  keterangan?: ReactNode
  aksi?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader
        title={(
          <span className="flex items-center gap-2">
            {nomor !== undefined && (
              <span aria-hidden className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-brand-50 px-1 text-[11px] font-semibold text-brand-700">
                {nomor}
              </span>
            )}
            {judul}
          </span>
        )}
        subtitle={keterangan && <span className={cn('block', nomor !== undefined && 'sm:pl-7')}>{keterangan}</span>}
        actions={aksi}
      />
      <div className="p-4">{children}</div>
    </Card>
  )
}

/** Kotak keterangan nilai acuan (rute, kontrak): biru muda polos. */
export function KotakInfo({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3', className)}>{children}</div>
}

/** Pasangan label + nominal di dalam KotakInfo. */
export function NilaiInfo({ label, children, merah }: { label: string; children: ReactNode; merah?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-brand-700/80">{label}</dt>
      <dd className={cn('tnum text-[13px] font-semibold', merah ? 'text-[color:var(--color-critical)]' : 'text-brand-900')}>{children}</dd>
    </div>
  )
}

/** Peringatan kecil yang tidak memblokir simpan (kuning). */
export function Peringatan({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-[#8a6100]', className)}>
      <FaTriangleExclamation size={14} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Tombol teks kecil bergaris bawah, untuk aksi ringan di dalam keterangan. */
export function TombolTeks({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500 disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
    >
      {children}
    </button>
  )
}
