import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, X } from 'lucide-react'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Modal'
import { DateInput, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, NotFoundState } from '../../components/ui/States'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { useTable } from '../../lib/useTable'
import { matchesQuery, sum } from '../../lib/utils'
import { formatDate, formatRupiah } from '../../lib/format'
import type { BillingRow } from '../../types'

/**
 * Browsing Data. Nilai kolom Sijo dapat diklik dan langsung membuka
 * halaman SI / Job Order tanpa perlu menyalin nomornya.
 */
export function BrowsingDataTab() {
  const { billingRows, loading, error, reload, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [costCode, setCostCode] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const costCodes = useMemo(
    () => Array.from(new Set(billingRows.map((b) => b.cost_code))).filter(Boolean).sort(),
    [billingRows],
  )

  const search = useCallback(
    (b: BillingRow, q: string) => matchesQuery(q, b.invoice_no, b.sijo, b.cost_code, b.customer_name),
    [],
  )
  const extraFilter = useCallback(
    (b: BillingRow) =>
      (!dateFrom || b.billing_date >= dateFrom) &&
      (!dateTo || b.billing_date <= dateTo) &&
      (!costCode || b.cost_code === costCode),
    [dateFrom, dateTo, costCode],
  )
  const filterActive = Boolean(dateFrom || dateTo || costCode)
  const table = useTable(billingRows, {
    search, extraFilter, extraFilterActive: filterActive,
    initialSortKey: 'billing_date', initialSortDir: 'desc', pageSize: 10,
  })

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = table.pageRows.map((b) => b.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  function onDelete() {
    const n = remove('billings', [...selected])
    setSelected(new Set()); setConfirmDelete(false)
    toast.success(`${n} data tagihan berhasil dihapus.`)
  }

  function resetFilters() {
    table.reset(); setDateFrom(''); setDateTo(''); setCostCode('')
  }

  const columns: Column<BillingRow>[] = [
    { key: 'invoice_no', header: 'Nofaktur', sortable: true, width: '120px', render: (b) => <span className="tnum font-semibold text-ink">{b.invoice_no}</span> },
    {
      key: 'sijo', header: 'Sijo', sortable: true, width: '112px',
      render: (b) => (
        <Link
          to={`/pencarian/sijo?sijo=${b.sijo}`}
          onClick={(e) => e.stopPropagation()}
          title="Buka detail SI / Job Order"
          className="tnum font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500"
        >
          {b.sijo || '—'}
        </Link>
      ),
    },
    { key: 'cost_code', header: 'Kodecost', sortable: true, width: '112px', render: (b) => <Badge tone="neutral">{b.cost_code || '—'}</Badge> },
    { key: 'customer_name', header: 'Customer', sortable: true, render: (b) => <span className="text-ink-2">{b.customer_name || '—'}</span> },
    { key: 'billing_date', header: 'Tgltagih', sortable: true, width: '106px', render: (b) => <span className="tnum text-ink-2">{formatDate(b.billing_date)}</span> },
    { key: 'withdrawal_date', header: 'Tgltarik', sortable: true, width: '106px', render: (b) => <span className="tnum text-ink-2">{formatDate(b.withdrawal_date)}</span> },
    { key: 'amount', header: 'Jumlah', sortable: true, align: 'right', width: '140px', render: (b) => <span className="tnum font-semibold text-ink">{formatRupiah(b.amount)}</span> },
    { key: 'guarantee_amount', header: 'Jaminan', sortable: true, align: 'right', width: '128px', render: (b) => <span className="tnum text-ink-2">{formatRupiah(b.guarantee_amount)}</span> },
    {
      key: 'status', header: 'Status', width: '116px',
      render: (b) =>
        b.is_rejected ? <Badge tone="critical">DITOLAK</Badge>
          : b.paid_date ? <Badge tone="good">Lunas</Badge>
          : b.is_sunting ? <Badge tone="warning">SUNTING</Badge>
          : <Badge tone="neutral">Belum lunas</Badge>,
    },
  ]

  return (
    <>
      <Toolbar
        left={
          <>
            <SearchInput value={table.query} onChange={table.setQuery} width="w-72" placeholder="Cari faktur, Sijo, Kodecost..." />
            <FilterField label="Tgl Tagih">
              <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" aria-label="Tanggal dari" />
            </FilterField>
            <span className="text-[12px] text-ink-3">s/d</span>
            <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" aria-label="Tanggal sampai" />
            <Select value={costCode} onChange={(e) => setCostCode(e.target.value)} className="w-40" aria-label="Filter Kodecost">
              <option value="">Semua Kodecost</option>
              {costCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            {(table.isFiltered || filterActive) && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={resetFilters}>Reset</Button>}
          </>
        }
      />

      {selected.size > 0 && (
        <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
          <p className="text-[13px] font-semibold text-brand-800">{selected.size} data ditandai</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setConfirmDelete(true)}>Hapus</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={table.pageRows}
        rowKey={(b) => b.id}
        loading={loading}
        error={error}
        onRetry={reload}
        isFiltered={table.isFiltered || filterActive}
        sort={table.sort}
        onSortChange={table.toggleSort}
        selectedKeys={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        maxHeight="560px"
        empty={<EmptyState entity="data tagihan" />}
        notFound={<NotFoundState onReset={resetFilters} />}
        footer={
          table.total > 0 ? (
            <tr>
              <td className="px-3 py-2 text-[12px] text-ink-2" colSpan={7}>Total {table.total} tagihan</td>
              <td className="tnum px-3 py-2 text-right text-[12.5px] text-ink">{formatRupiah(sum(table.filtered, (b) => b.amount))}</td>
              <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (b) => b.guarantee_amount))}</td>
              <td />
            </tr>
          ) : undefined
        }
      />

      {table.total > 0 && (
        <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
      )}

      <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
        Klik nilai pada kolom <span className="font-semibold text-ink-2">Sijo</span> untuk langsung membuka detail
        SI / Job Order — tidak perlu menyalin nomornya secara manual.
      </p>

      <ConfirmDialog
        open={confirmDelete}
        message={`${selected.size} data tagihan akan dihapus. Data yang sudah dihapus mungkin tidak dapat dikembalikan.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </>
  )
}
