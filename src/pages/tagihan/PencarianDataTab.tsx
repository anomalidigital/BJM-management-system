import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, Input, DateInput, Select, Checkbox } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { NotFoundState } from '../../components/ui/States'
import { useData } from '../../store/DataProvider'
import { formatDate, formatRupiah } from '../../lib/format'
import { norm, sum } from '../../lib/utils'
import type { BillingRow } from '../../types'

interface Criteria {
  invoice_no: string
  sijo: string
  cost_code: string
  customer: string
  from: string
  to: string
  minAmount: number
  maxAmount: number
  status: string
  onlySunting: boolean
  onlyRejected: boolean
}

const BLANK: Criteria = {
  invoice_no: '', sijo: '', cost_code: '', customer: '', from: '', to: '',
  minAmount: 0, maxAmount: 0, status: '', onlySunting: false, onlyRejected: false,
}

/** Pencarian lanjutan multi-kriteria untuk data tagihan. */
export function PencarianDataTab() {
  const { billingRows, loading } = useData()
  const [draft, setDraft] = useState<Criteria>(BLANK)
  const [applied, setApplied] = useState<Criteria | null>(null)

  const costCodes = useMemo(
    () => Array.from(new Set(billingRows.map((b) => b.cost_code))).filter(Boolean).sort(),
    [billingRows],
  )

  const results = useMemo(() => {
    if (!applied) return []
    return billingRows.filter((b) => {
      if (applied.invoice_no && !norm(b.invoice_no).includes(norm(applied.invoice_no))) return false
      if (applied.sijo && !norm(b.sijo).includes(norm(applied.sijo))) return false
      if (applied.cost_code && b.cost_code !== applied.cost_code) return false
      if (applied.customer && !norm(b.customer_name).includes(norm(applied.customer))) return false
      if (applied.from && b.billing_date < applied.from) return false
      if (applied.to && b.billing_date > applied.to) return false
      if (applied.minAmount && b.amount < applied.minAmount) return false
      if (applied.maxAmount && b.amount > applied.maxAmount) return false
      if (applied.status === 'lunas' && !b.paid_date) return false
      if (applied.status === 'belum' && (b.paid_date || b.is_rejected)) return false
      if (applied.onlySunting && !b.is_sunting) return false
      if (applied.onlyRejected && !b.is_rejected) return false
      return true
    })
  }, [applied, billingRows])

  const columns: Column<BillingRow>[] = [
    { key: 'invoice_no', header: 'Nofaktur', sortable: true, width: '118px', render: (b) => <span className="tnum font-semibold text-ink">{b.invoice_no}</span> },
    {
      key: 'sijo', header: 'Sijo', width: '110px',
      render: (b) => <Link to={`/pencarian/sijo?sijo=${b.sijo}`} className="tnum font-semibold text-brand-700 hover:underline">{b.sijo || '—'}</Link>,
    },
    { key: 'cost_code', header: 'Kodecost', width: '104px', render: (b) => <Badge tone="neutral">{b.cost_code}</Badge> },
    { key: 'customer_name', header: 'Customer', render: (b) => <span className="text-ink-2">{b.customer_name}</span> },
    { key: 'billing_date', header: 'Tgltagih', width: '104px', render: (b) => <span className="tnum text-ink-2">{formatDate(b.billing_date)}</span> },
    { key: 'amount', header: 'Jumlah', align: 'right', width: '138px', render: (b) => <span className="tnum font-semibold text-ink">{formatRupiah(b.amount)}</span> },
    {
      key: 'status', header: 'Status', width: '116px',
      render: (b) => b.is_rejected ? <Badge tone="critical">DITOLAK</Badge> : b.paid_date ? <Badge tone="good">Lunas</Badge> : <Badge tone="warning">Belum lunas</Badge>,
    },
  ]

  return (
    <>
      <form
        className="border-b border-hairline p-4"
        onSubmit={(e) => { e.preventDefault(); setApplied(draft) }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="No Faktur">
            {(id) => <Input id={id} value={draft.invoice_no} placeholder="INV-001" onChange={(e) => setDraft({ ...draft, invoice_no: e.target.value })} />}
          </Field>
          <Field label="Sijo">
            {(id) => <Input id={id} value={draft.sijo} placeholder="3252209" onChange={(e) => setDraft({ ...draft, sijo: e.target.value })} />}
          </Field>
          <Field label="Kodecost">
            {(id) => (
              <Select id={id} value={draft.cost_code} onChange={(e) => setDraft({ ...draft, cost_code: e.target.value })}>
                <option value="">Semua</option>
                {costCodes.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Customer">
            {(id) => <Input id={id} value={draft.customer} placeholder="PT ..." onChange={(e) => setDraft({ ...draft, customer: e.target.value })} />}
          </Field>
          <Field label="Tgl Tagih dari">
            {(id) => <DateInput id={id} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />}
          </Field>
          <Field label="Tgl Tagih sampai">
            {(id) => <DateInput id={id} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />}
          </Field>
          <Field label="Jumlah minimal">
            {(id) => <CurrencyInput id={id} value={draft.minAmount} onValueChange={(v) => setDraft({ ...draft, minAmount: v })} />}
          </Field>
          <Field label="Jumlah maksimal">
            {(id) => <CurrencyInput id={id} value={draft.maxAmount} onValueChange={(v) => setDraft({ ...draft, maxAmount: v })} />}
          </Field>
          <Field label="Status pembayaran">
            {(id) => (
              <Select id={id} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="">Semua</option>
                <option value="lunas">Sudah lunas</option>
                <option value="belum">Belum lunas</option>
              </Select>
            )}
          </Field>
          <div className="flex items-end gap-5 pb-1 sm:col-span-2">
            <Checkbox label="Hanya SUNTING" checked={draft.onlySunting} onChange={(e) => setDraft({ ...draft, onlySunting: e.target.checked })} />
            <Checkbox label="Hanya DITOLAK" checked={draft.onlyRejected} onChange={(e) => setDraft({ ...draft, onlyRejected: e.target.checked })} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button type="submit" variant="primary" icon={<Search size={15} />}>Cari</Button>
          <Button icon={<RotateCcw size={14} />} onClick={() => { setDraft(BLANK); setApplied(null) }}>Reset</Button>
        </div>
      </form>

      {applied === null ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-sunken text-ink-3">
            <Search size={20} />
          </div>
          <p className="text-[14px] font-semibold text-ink">Isi kriteria lalu klik Cari.</p>
          <p className="mt-1 text-[13px] text-ink-3">Kriteria yang dikosongkan akan diabaikan.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-sunken px-4 py-2.5">
            <p className="text-[12.5px] text-ink-2">
              Ditemukan <span className="font-semibold text-ink">{results.length}</span> data tagihan
            </p>
            <p className="tnum text-[12.5px] text-ink-2">
              Total Jumlah: <span className="font-semibold text-ink">{formatRupiah(sum(results, (b) => b.amount))}</span>
            </p>
          </div>
          <DataTable
            columns={columns}
            rows={results}
            rowKey={(b) => b.id}
            loading={loading}
            isFiltered
            maxHeight="520px"
            notFound={<NotFoundState onReset={() => { setDraft(BLANK); setApplied(null) }} />}
          />
        </>
      )}
    </>
  )
}
