import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Plus, Printer, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { OverflowMenu } from '../components/ui/Menu'
import { ConfirmDialog } from '../components/ui/Modal'
import { DateInput, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatDate } from '../lib/format'
import type { DeliveryNoteRow } from '../types'

export function SuratJalanListPage() {
  const { deliveryNoteRows, loading, error, reload, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState('')
  const [printing, setPrinting] = useState<DeliveryNoteRow[] | null>(null)
  const [deleting, setDeleting] = useState<DeliveryNoteRow | null>(null)

  const customers = useMemo(
    () => Array.from(new Set(deliveryNoteRows.map((n) => n.recipient_name))).sort(),
    [deliveryNoteRows],
  )

  const search = useCallback(
    (n: DeliveryNoteRow, q: string) =>
      matchesQuery(q, n.sj_no, n.sijo, n.recipient_name, n.plate_number, n.destination, n.containers.join(' ')),
    [],
  )
  const extraFilter = useCallback(
    (n: DeliveryNoteRow) =>
      (!dateFrom || n.sj_date >= dateFrom) &&
      (!dateTo || n.sj_date <= dateTo) &&
      (!customer || n.recipient_name === customer) &&
      (!status || (status === 'tercetak' ? !!n.printed_at : !n.printed_at)),
    [dateFrom, dateTo, customer, status],
  )
  const filterActive = Boolean(dateFrom || dateTo || customer || status)
  const table = useTable(deliveryNoteRows, {
    search, extraFilter, extraFilterActive: filterActive,
    initialSortKey: 'sj_date', initialSortDir: 'desc', pageSize: 10,
  })

  const selectedNotes = useMemo(
    () => deliveryNoteRows.filter((n) => selected.has(n.id)),
    [deliveryNoteRows, selected],
  )

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = table.pageRows.map((n) => n.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  function resetFilters() {
    table.reset(); setDateFrom(''); setDateTo(''); setCustomer(''); setStatus('')
  }

  function markPrinted(ids: string[]) {
    const today = new Date().toISOString().slice(0, 10)
    ids.forEach((id) => update('deliveryNotes', id, { printed_at: today }))
  }

  function onDelete() {
    if (!deleting) return
    remove('deliveryNotes', deleting.id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(deleting.id)
      return next
    })
    toast.success('Data berhasil dihapus.')
    setDeleting(null)
  }

  const columns: Column<DeliveryNoteRow>[] = [
    { key: 'sj_date', header: 'Tanggal', sortable: true, width: '104px', render: (n) => <span className="tnum text-ink-2">{formatDate(n.sj_date)}</span> },
    {
      key: 'sj_no', header: 'No. Surat Jalan', sortable: true, width: '132px',
      render: (n) => (
        <Link to={`/transaksi/surat-jalan/${n.id}`} className="tnum font-semibold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {n.sj_no}
        </Link>
      ),
    },
    { key: 'recipient_name', header: 'Kepada Yth', sortable: true, render: (n) => <span className="font-medium">{n.recipient_name}</span> },
    { key: 'plate_number', header: 'No. Polisi', sortable: true, width: '124px', render: (n) => <span className="tnum text-ink-2">{n.plate_number || '—'}</span> },
    {
      key: 'sijo', header: 'SI / BL', sortable: true, width: '108px',
      render: (n) => (
        <Link to={`/pencarian/sijo?sijo=${n.sijo}`} className="tnum text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {n.sijo || '—'}
        </Link>
      ),
    },
    {
      key: 'container_count', header: 'Container', sortable: true, width: '110px',
      render: (n) => (
        <span title={n.containers.join(', ')}>
          <Badge tone={n.container_count > 0 ? 'brand' : 'neutral'}>{n.container_count} cont.</Badge>
        </span>
      ),
    },
    { key: 'destination', header: 'Tujuan', sortable: true, render: (n) => <span className="text-ink-2">{n.destination || '—'}</span> },
    {
      key: 'status', header: 'Status', sortable: true, width: '104px',
      render: (n) => (n.printed_at ? <Badge tone="good">Tercetak</Badge> : <Badge tone="warning">Draft</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '128px',
      render: (n) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Lihat" icon={<Eye size={14} />} onClick={() => navigate(`/transaksi/surat-jalan/${n.id}`)} />
          <IconButton label="Edit" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => navigate(`/transaksi/surat-jalan/${n.id}/edit`)} />
          <IconButton label="Cetak" icon={<Printer size={14} />} onClick={() => setPrinting([n])} />
          <OverflowMenu
            actions={[
              { label: 'Hapus Surat Jalan', icon: <Trash2 size={14} />, tone: 'danger', disabled: !canEdit, onSelect: () => setDeleting(n) },
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Surat Jalan"
        description="Kelola dan cetak Surat Jalan PT Bimajaya Mustika."
        crumbs={[{ label: 'Transaksi' }, { label: 'Surat Jalan' }]}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={() => navigate('/transaksi/surat-jalan/tambah')}>
            Tambah Surat Jalan
          </Button>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput
                value={table.query}
                onChange={table.setQuery}
                width="w-80"
                placeholder="Cari No. Surat Jalan, SI/BL, Container..."
              />
              <FilterField label="Tanggal">
                <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" aria-label="Tanggal dari" />
              </FilterField>
              <span className="text-[12px] text-ink-3">s/d</span>
              <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" aria-label="Tanggal sampai" />
              <Select value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-52" aria-label="Filter customer">
                <option value="">Semua Customer</option>
                {customers.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="Filter status">
                <option value="">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="tercetak">Tercetak</option>
              </Select>
              {(table.isFiltered || filterActive) && (
                <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={resetFilters}>Reset</Button>
              )}
            </>
          }
        />

        {/* Contextual toolbar — hanya muncul saat ada baris terpilih */}
        {selected.size > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">{selected.size} Surat Jalan dipilih</p>
            <div className="flex items-center gap-2">
              <Button size="sm" icon={<Printer size={14} />} onClick={() => setPrinting(selectedNotes)}>Cetak</Button>
              <Button size="sm" icon={<Printer size={14} />} onClick={() => setPrinting(selectedNotes)}>Export PDF</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(n) => n.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterActive}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          empty={
            <EmptyState
              entity="Surat Jalan"
              action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate('/transaksi/surat-jalan/tambah')}>Tambah Surat Jalan</Button>}
            />
          }
          notFound={<NotFoundState onReset={resetFilters} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <SuratJalanPrintFlow
        notes={printing ?? []}
        open={!!printing}
        onClose={() => setPrinting(null)}
        onPrinted={markPrinted}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Hapus Surat Jalan?"
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.sj_no} — {deleting?.recipient_name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
