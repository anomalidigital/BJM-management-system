import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { formatPrintedAt } from '../../lib/format'

/** Bagi baris menjadi beberapa halaman A4. */
export function chunkRows<T>(rows: T[], perPage: number): T[][] {
  if (rows.length === 0) return [[]]
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += perPage) out.push(rows.slice(i, i + perPage))
  return out
}

/**
 * Pembungkus area cetak. Hanya elemen di dalam .print-root yang ikut tercetak
 * (lihat aturan @media print di index.css), sehingga sidebar, topbar, dan
 * tombol otomatis hilang dari hasil print / PDF.
 */
export function PrintDocument({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('print-root', className)}>{children}</div>
}

interface PrintPageProps {
  title: string
  subtitle?: string
  periode?: string
  /** Nomor halaman ini (mulai 1) dan total halaman. */
  page: number
  totalPages: number
  withLogo?: boolean
  meta?: Array<{ label: string; value: ReactNode }>
  children: ReactNode
}

/**
 * Satu lembar A4. Di layar tampil seperti kertas (preview), saat dicetak
 * mengisi penuh halaman dan memaksa page-break ke lembar berikutnya.
 */
export function PrintPage({ title, subtitle, periode, page, totalPages, withLogo = true, meta, children }: PrintPageProps) {
  return (
    <section
      className={cn(
        'print-sheet mx-auto flex w-[210mm] max-w-full flex-col bg-white p-[14mm] text-[11px] text-black',
        'shadow-card border border-hairline print:border-0 print:shadow-none',
        page < totalPages && 'print-page-break-after',
      )}
      style={{ minHeight: '297mm' }}
    >
      <header className="mb-4 flex items-start justify-between gap-6 border-b-2 border-black pb-2.5">
        <div className="flex items-start gap-3">
          {withLogo && (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded border-2 border-black text-[17px] leading-none font-bold">
              BM
            </div>
          )}
          <div>
            <p className="text-[15px] leading-tight font-bold tracking-tight">PT BIMAJAYA MUSTIKA</p>
            <p className="text-[10.5px] tracking-wide">JAKARTA</p>
            <p className="mt-0.5 text-[9.5px] text-neutral-600">
              Transportation, Driver Commission, Billing &amp; Reporting Management System
            </p>
          </div>
        </div>
        <div className="text-right text-[9.5px] leading-relaxed text-neutral-700">
          <p>Dicetak: {formatPrintedAt()}</p>
          <p>
            Halaman {page} dari {totalPages}
          </p>
        </div>
      </header>

      <div className="mb-3 text-center">
        <h1 className="text-[14px] font-bold tracking-wide uppercase">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[10.5px] text-neutral-700">{subtitle}</p>}
        {periode && <p className="mt-0.5 text-[10.5px] font-medium">Periode: {periode}</p>}
      </div>

      {meta && meta.length > 0 && (
        <dl className="mb-3 grid grid-cols-2 gap-x-8 gap-y-1 border border-neutral-400 p-2.5 text-[10.5px] sm:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label} className="flex gap-1.5">
              <dt className="shrink-0 font-semibold">{m.label}:</dt>
              <dd className="min-w-0 truncate">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex-1">{children}</div>

      <footer className="mt-4 flex items-end justify-between gap-6 border-t border-neutral-400 pt-2 text-[9px] text-neutral-600">
        <p>SIKOTIS — Sistem Komisi Otomatis · Dokumen ini dihasilkan otomatis oleh sistem.</p>
        <p>
          {page} / {totalPages}
        </p>
      </footer>
    </section>
  )
}
