import { FaChevronLeft, FaChevronRight } from './icons'
import { cn } from '../../lib/utils'
import { Select } from './Field'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

/** Navigasi halaman tabel (Bootstrap .pagination). */
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
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Jumlah baris per halaman"
            ukuran="sm"
            className="w-36"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </Select>
        )}
      </div>

      <nav aria-label="Navigasi halaman">
        <ul className="pagination pagination-sm">
          <li className={cn('page-item', page <= 1 && 'disabled')}>
            <button type="button" className="page-link" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya">
              <FaChevronLeft size={13} />
            </button>
          </li>
          {numbers.map((n) => (
            <li key={n} className={cn('page-item', n === page && 'active')}>
              <button type="button" className="page-link" onClick={() => onPageChange(n)} aria-current={n === page ? 'page' : undefined}>
                {n}
              </button>
            </li>
          ))}
          <li className={cn('page-item', page >= totalPages && 'disabled')}>
            <button type="button" className="page-link" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Halaman berikutnya">
              <FaChevronRight size={13} />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
