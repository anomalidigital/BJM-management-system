import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SortDir } from '../../lib/utils'
import { ErrorState, TableSkeleton } from './States'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Isi kolom untuk tiap baris. */
  render: (row: T, index: number) => ReactNode
  /** Diisi bila kolom bisa di-sort (nilai dipakai sebagai kunci sort). */
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  headerClassName?: string
  cellClassName?: string
}

export interface SortState {
  key: string | null
  dir: SortDir
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Tampil saat memang belum ada data sama sekali. */
  empty?: ReactNode
  /** Tampil saat data ada tapi filter/pencarian tidak menemukan hasil. */
  notFound?: ReactNode
  isFiltered?: boolean
  sort?: SortState
  onSortChange?: (key: string) => void
  selectedKeys?: Set<string>
  onToggleRow?: (key: string) => void
  onToggleAll?: () => void
  onRowClick?: (row: T) => void
  activeKey?: string | null
  /** Aktifkan sticky header + area scroll vertikal. */
  maxHeight?: string
  dense?: boolean
  /** Baris total di bagian bawah tabel. */
  footer?: ReactNode
  skeletonCols?: number
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  notFound,
  isFiltered,
  sort,
  onSortChange,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  onRowClick,
  activeKey,
  maxHeight,
  dense,
  footer,
  skeletonCols,
}: Props<T>) {
  if (loading) return <TableSkeleton cols={skeletonCols ?? Math.min(columns.length, 7)} />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (rows.length === 0) return <>{isFiltered ? notFound : empty}</>

  const selectable = Boolean(selectedKeys && onToggleRow)
  const allChecked = selectable && rows.length > 0 && rows.every((r) => selectedKeys!.has(rowKey(r)))
  const cellPad = dense ? 'px-3 py-1.5' : 'px-3 py-2.5'

  return (
    <div className={cn('w-full overflow-x-auto', maxHeight && 'overflow-y-auto')} style={maxHeight ? { maxHeight } : undefined}>
      <table className="print-table w-full min-w-max border-collapse text-[13px]">
        <thead className={cn('bg-sunken', maxHeight && 'sticky top-0 z-10')}>
          <tr className="border-b border-hairline">
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  aria-label="Pilih semua baris"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-hairline accent-[color:var(--color-brand-500)]"
                />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    'px-3 py-2 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-ink-2 uppercase',
                    ALIGN[c.align ?? 'left'],
                    c.headerClassName,
                  )}
                >
                  {c.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-brand-600',
                        c.align === 'right' && 'flex-row-reverse',
                        active && 'text-brand-700',
                      )}
                    >
                      {c.header}
                      {active ? (
                        sort!.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = rowKey(row)
            const checked = selectable && selectedKeys!.has(key)
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-grid transition-colors last:border-b-0',
                  onRowClick && 'cursor-pointer',
                  activeKey === key ? 'bg-brand-50' : checked ? 'bg-brand-50/45' : 'bg-surface hover:bg-sunken',
                )}
              >
                {selectable && (
                  <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRow!(key)}
                      aria-label="Pilih baris"
                      className="h-3.5 w-3.5 cursor-pointer rounded border-hairline accent-[color:var(--color-brand-500)]"
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn(cellPad, 'align-middle text-ink', ALIGN[c.align ?? 'left'], c.cellClassName)}>
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {footer && (
          <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  )
}
