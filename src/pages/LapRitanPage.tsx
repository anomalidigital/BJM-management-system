import { useCallback, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Printer, Save, Trash2, X, Pencil } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Modal'
import { DateInput, Select } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery, sum } from '../lib/utils'
import { endOfMonthISO, formatDate, formatNumber, formatRupiah, monthLabel, startOfMonthISO, todayISO } from '../lib/format'
import type { TransactionRow } from '../types'

interface Draft {
  bon_date: string | null
  personal_bon: number
}

export function LapRitanPage() {
  const { db, transactionRows, loading, error, reload, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [driverFilter, setDriverFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [preview, setPreview] = useState(false)

  const monthStart = startOfMonthISO()
  const monthEnd = endOfMonthISO()

  const driverCity = useMemo(() => new Map(db.drivers.map((d) => [d.id, d.city])), [db.drivers])
  const cities = useMemo(() => Array.from(new Set(db.drivers.map((d) => d.city))).sort(), [db.drivers])

  const monthRows = useMemo(
    () => transactionRows.filter((t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd),
    [transactionRows, monthStart, monthEnd],
  )

  const search = useCallback(
    (t: TransactionRow, q: string) => matchesQuery(q, t.transaction_no, t.plate_number, t.route_code, t.sijo, t.driver_name, t.driver_code),
    [],
  )
  const extraFilter = useCallback(
    (t: TransactionRow) =>
      (!driverFilter || t.driver_id === driverFilter) &&
      (!cityFilter || driverCity.get(t.driver_id) === cityFilter),
    [driverFilter, cityFilter, driverCity],
  )
  const filterActive = Boolean(driverFilter || cityFilter)
  const table = useTable(monthRows, {
    search, extraFilter, extraFilterActive: filterActive,
    initialSortKey: 'transaction_no', initialSortDir: 'desc', pageSize: 15,
  })

  function draftOf(t: TransactionRow): Draft {
    return drafts[t.id] ?? { bon_date: t.bon_date, personal_bon: t.personal_bon }
  }

  function setDraft(id: string, patch: Partial<Draft>, base: Draft) {
    setDrafts((prev) => ({ ...prev, [id]: { ...base, ...prev[id], ...patch } }))
  }

  function saveDrafts() {
    const entries = Object.entries(drafts)
    entries.forEach(([id, d]) => update('transactions', id, { bon_date: d.bon_date, personal_bon: d.personal_bon }))
    setDrafts({})
    setEditMode(false)
    toast.success(entries.length > 0 ? `${entries.length} baris berhasil diperbarui.` : 'Tidak ada perubahan untuk disimpan.')
  }

  function cancelEdit() {
    setDrafts({}); setEditMode(false)
  }

  function onDelete() {
    const n = remove('transactions', [...selected])
    setSelected(new Set()); setConfirmDelete(false)
    toast.success(`${n} data ritan berhasil dihapus.`)
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = table.pageRows.map((t) => t.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  const totalBon = sum(table.filtered, (t) => draftOf(t).personal_bon)

  const printPages = useMemo(() => chunkRows(table.filtered, 24), [table.filtered])

  if (preview) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {printPages.map((rows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={printPages.length}
              title="Ritan Sopir - Bulan Berjalan"
              subtitle="Transportation Management System - Driver Reports"
              periode={`${formatDate(monthStart)} s/d ${formatDate(monthEnd)}`}
              meta={[
                { label: 'Jumlah ritan', value: formatNumber(table.total) },
                { label: 'Total Bon Pribadi', value: formatRupiah(totalBon) },
                { label: 'Bulan', value: monthLabel(todayISO()) },
              ]}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '5%' },
                  { label: 'NoTrans', width: '12%' },
                  { label: 'Mobil', width: '13%' },
                  { label: 'No.Route', width: '11%' },
                  { label: 'Tgl Bon', width: '10%' },
                  { label: 'Bon Pribadi', align: 'right', width: '13%' },
                  { label: 'SI - JOB ORDER', width: '12%' },
                  { label: 'Sopir' },
                ]}
              >
                {rows.map((t, ri) => (
                  <PRow key={t.id}>
                    <PCell align="right">{i * 24 + ri + 1}</PCell>
                    <PCell>{t.transaction_no}</PCell>
                    <PCell>{t.plate_number}</PCell>
                    <PCell>{t.route_code}</PCell>
                    <PCell>{t.bon_date ? formatDate(t.bon_date) : '-'}</PCell>
                    <PCell align="right">{t.personal_bon ? formatNumber(t.personal_bon) : '-'}</PCell>
                    <PCell>{t.sijo}</PCell>
                    <PCell>{t.driver_name}</PCell>
                  </PRow>
                ))}
                {i === printPages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={5}>TOTAL BON PRIBADI</PCell>
                    <PCell align="right">{formatNumber(totalBon)}</PCell>
                    <PCell colSpan={2} />
                  </PRow>
                )}
              </PrintTable>
              {i === printPages.length - 1 && (
                <p className="mt-3 text-[9px] text-neutral-600">1 transaksi dihitung sebagai 1 ritan (TBD-05).</p>
              )}
            </PrintPage>
          ))}
        </PrintDocument>
      </ReportPreview>
    )
  }

  const columns: Column<TransactionRow>[] = [
    { key: 'transaction_no', header: 'NoTrans', sortable: true, width: '116px', render: (t) => <span className="tnum font-semibold text-ink">{t.transaction_no}</span> },
    { key: 'plate_number', header: 'Mobil', sortable: true, width: '128px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    { key: 'route_code', header: 'No.Route', sortable: true, width: '112px', render: (t) => <span className="tnum text-ink-2">{t.route_code || '—'}</span> },
    {
      key: 'bon_date', header: 'Tgl Bon', sortable: true, width: '150px',
      render: (t) => {
        const d = draftOf(t)
        return editMode ? (
          <DateInput
            value={d.bon_date ?? ''}
            className="h-8"
            onChange={(e) => setDraft(t.id, { bon_date: e.target.value || null }, d)}
            aria-label={`Tgl Bon ${t.transaction_no}`}
          />
        ) : (
          <span className="tnum text-ink-2">{d.bon_date ? formatDate(d.bon_date) : '—'}</span>
        )
      },
    },
    {
      key: 'personal_bon', header: 'Bon Pribadi', sortable: true, align: 'right', width: '158px',
      render: (t) => {
        const d = draftOf(t)
        return editMode ? (
          <CurrencyInput
            value={d.personal_bon}
            className="h-8"
            onValueChange={(v) => setDraft(t.id, { personal_bon: v }, d)}
            aria-label={`Bon Pribadi ${t.transaction_no}`}
          />
        ) : (
          <span className="tnum font-medium text-ink">{d.personal_bon ? formatRupiah(d.personal_bon) : '—'}</span>
        )
      },
    },
    {
      key: 'sijo', header: 'SI - JOB ORDER', sortable: true, width: '136px',
      render: (t) => (
        <Link to={`/pencarian/sijo?sijo=${t.sijo}`} className="tnum font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {t.sijo || '—'}
        </Link>
      ),
    },
    { key: 'driver_name', header: 'Sopir', sortable: true, render: (t) => <span className="font-medium">{t.driver_name || '—'}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Cek Ritan Bulan Ini"
        legacyTitle="Transportation Management System - Driver Reports"
        crumbs={[{ label: 'Lap. Bulan Ini' }, { label: 'Cek Ritan Bulan Ini' }]}
        description={`Ritan Sopir — bulan berjalan (${monthLabel(todayISO())}). Gunakan Sunting untuk mengubah Tgl Bon dan Bon Pribadi langsung di tabel.`}
        actions={
          <>
            <Button icon={<Printer size={15} />} onClick={() => setPreview(true)}>Cetak</Button>
            {editMode ? (
              <>
                <Button icon={<X size={14} />} onClick={cancelEdit}>Batal</Button>
                <Button variant="primary" icon={<Save size={15} />} onClick={saveDrafts}>Simpan</Button>
              </>
            ) : (
              <Button variant="primary" icon={<Pencil size={15} />} disabled={!canEdit} onClick={() => setEditMode(true)}>Sunting</Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>Tutup</Button>
          </>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-72" placeholder="Cari No. Transaksi, mobil, route..." />
              <FilterField label="Sopir">
                <Select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="w-56">
                  <option value="">Semua Sopir</option>
                  {db.drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.driver_code} — {d.driver_name}</option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Kota">
                <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-40">
                  <option value="">Semua Kota</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FilterField>
              {(table.isFiltered || filterActive) && (
                <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => { table.reset(); setDriverFilter(''); setCityFilter('') }}>Reset</Button>
              )}
            </>
          }
          right={
            <span className="tnum text-[12.5px] text-ink-2">
              Total Bon Pribadi: <span className="font-semibold text-ink">{formatRupiah(totalBon)}</span>
            </span>
          }
        />

        {editMode && (
          <p className="border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-[12.5px] font-medium text-brand-800">
            Mode sunting aktif — ubah Tgl Bon dan Bon Pribadi, lalu klik Simpan.
            {Object.keys(drafts).length > 0 && <span className="ml-1">({Object.keys(drafts).length} baris diubah)</span>}
          </p>
        )}

        {selected.size > 0 && !editMode && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">{selected.size} baris dipilih</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setConfirmDelete(true)}>Hapus</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterActive}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={editMode ? undefined : selected}
          onToggleRow={editMode ? undefined : toggleRow}
          onToggleAll={editMode ? undefined : toggleAll}
          maxHeight="560px"
          empty={<EmptyState entity="ritan bulan ini" />}
          notFound={<NotFoundState onReset={() => { table.reset(); setDriverFilter(''); setCityFilter('') }} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <p className="mt-3 text-[11.5px] text-ink-3">
        Kolom mengikuti koreksi dokumen: <span className="font-medium text-ink-2">Tujuan → Tgl Bon</span>,{' '}
        <span className="font-medium text-ink-2">Jam.Brkt → Bon Pribadi</span>,{' '}
        <span className="font-medium text-ink-2">St.Job → SI - JOB ORDER</span>. 1 transaksi = 1 ritan (TBD-05).
      </p>

      <ConfirmDialog
        open={confirmDelete}
        message={`${selected.size} data ritan akan dihapus. Data yang sudah dihapus mungkin tidak dapat dikembalikan.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </>
  )
}
