import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'
import { formatDate, formatNumber, formatRupiah } from '../../lib/format'
import type { BillingRow, JobOrder, TransactionRow } from '../../types'
import { STATUS_LABEL, STATUS_TONE } from '../trip/status'
import { Panel, TautanPanel } from './Panel'

type Tab = 'trip' | 'tagihan' | 'sijo'

/** Catatan terakhir yang masuk, dalam satu panel bertab supaya halaman tidak penuh daftar. */
export function Terbaru({
  trip,
  tagihan,
  sijo,
  jumlah,
}: {
  trip: TransactionRow[]
  tagihan: BillingRow[]
  sijo: JobOrder[]
  jumlah: Record<Tab, number>
}) {
  const [tab, setTab] = useState<Tab>('trip')
  const tabs: Array<{ id: Tab; label: string; semua: string; ke: string }> = [
    { id: 'trip', label: 'Trip', semua: 'Semua trip', ke: '/transaksi/trip' },
    { id: 'tagihan', label: 'Tagihan', semua: 'Semua tagihan', ke: '/transaksi/tagihan' },
    { id: 'sijo', label: 'SI / Job Order', semua: 'Cari SI/JO', ke: '/pencarian/sijo' },
  ]
  const aktif = tabs.find((t) => t.id === tab)!
  const baris = 'flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-sunken'

  return (
    <Panel title="Terbaru" actions={<Link to={aktif.ke}><TautanPanel>{aktif.semua}</TautanPanel></Link>}>
      <div role="tablist" aria-label="Jenis catatan" className="flex gap-1 border-b border-hairline px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
              tab === t.id ? 'border-brand-600 text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t.label} <span className="tnum text-[12px] text-ink-3">{formatNumber(jumlah[t.id])}</span>
          </button>
        ))}
      </div>

      <ul role="tabpanel" className="divide-y divide-grid">
        {tab === 'trip' && trip.map((t) => (
          <li key={t.id}>
            <Link to={`/transaksi/trip/${t.id}`} className={baris}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="tnum text-[13px] font-semibold text-ink">{t.transaction_no}</span>
                  <span className="tnum text-[12px] text-ink-3">{formatDate(t.transaction_date)}</span>
                </span>
                <span className="mt-0.5 flex min-w-0 gap-3 text-[12px] text-ink-3">
                  <span className="truncate">{t.driver_name || 'Sopir belum dipilih'}</span>
                  {t.plate_number && <span className="shrink-0">{t.plate_number}</span>}
                  {t.route_name && <span className="truncate">{t.route_name}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-[13px] font-semibold text-ink">{formatRupiah(t.harga, { compact: true })}</span>
                <Badge tone={STATUS_TONE[t.status]} className="mt-0.5">{STATUS_LABEL[t.status]}</Badge>
              </span>
            </Link>
          </li>
        ))}
        {tab === 'tagihan' && tagihan.map((b) => (
          <li key={b.id}>
            <Link to="/transaksi/tagihan" className={baris}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="tnum text-[13px] font-semibold text-ink">{b.invoice_no}</span>
                  <span className="tnum text-[12px] text-ink-3">SI/JO {b.sijo}</span>
                </span>
                <span className="mt-0.5 flex gap-3 text-[12px] text-ink-3">
                  <span>{b.cost_code}</span>
                  <span className="tnum">{formatDate(b.billing_date)}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-[13px] font-semibold text-ink">{formatRupiah(b.amount, { compact: true })}</span>
                {b.is_rejected
                  ? <Badge tone="critical" className="mt-0.5">DITOLAK</Badge>
                  : b.paid_date ? <Badge tone="good" className="mt-0.5">Lunas</Badge> : <Badge tone="warning" className="mt-0.5">Belum lunas</Badge>}
              </span>
            </Link>
          </li>
        ))}
        {tab === 'sijo' && sijo.map((j) => (
          <li key={j.id}>
            <Link to={`/pencarian/sijo?sijo=${j.sijo}`} className={baris}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="tnum text-[13px] font-semibold text-brand-700">{j.sijo}</span>
                  <span className="text-[12px] text-ink-3">{j.customer_code}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-3">{j.customer_name}</span>
              </span>
              {j.is_complete ? <Badge tone="good">Komplit</Badge> : <Badge tone="neutral">Belum komplit</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
