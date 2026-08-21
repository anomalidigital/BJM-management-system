import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100] }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Selalu tampilkan maksimal 5 nomor halaman, dengan halaman aktif di tengah.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const numbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-2.5">
      <div className="flex items-center gap-3">
        <p className="tnum text-[12.5px] text-ink-3">
          Menampilkan <span className="font-semibold text-ink-2">{from}</span>–<span className="font-semibold text-ink-2">{to}</span> dari{' '}
          <span className="font-semibold text-ink-2">{total}</span> data
        </p>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Jumlah baris per halaman"
            className="h-7 cursor-pointer rounded-md border border-hairline bg-surface px-1.5 text-[12px] text-ink-2 focus:outline-none"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex items-center gap-1" aria-label="Navigasi halaman">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hairline text-ink-2 transition hover:bg-sunken disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={15} />
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              'tnum inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[12.5px] font-medium transition',
              n === page ? 'border-brand-500 bg-brand-500 text-white' : 'border-hairline text-ink-2 hover:bg-sunken',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hairline text-ink-2 transition hover:bg-sunken disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight size={15} />
        </button>
      </nav>
    </div>
  )
}
