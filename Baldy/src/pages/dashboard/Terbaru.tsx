import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { formatDate, formatNumber, formatRupiah } from '../../lib/format'
import type { BillingRow, JobOrder, TransactionRow } from '../../types'
import { STATUS_LABEL, STATUS_TONE } from '../trip/status'
import { Panel, TautanPanel } from './Panel'

export interface JumlahTerbaru {
  trip: number
  tagihan: number
  belumLunas: number
  ditolak: number
  sijo: number
  komplit: number
}

const baris = 'flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-sunken'

function Kosong({ children }: { children: string }) {
  return <p className="border-t border-hairline px-5 py-6 text-[13px] text-ink-3">{children}</p>
}

/** Catatan terakhir yang masuk: trip, tagihan, dan SI/Job Order berdampingan. */
export function Terbaru({
  trip,
  tagihan,
  sijo,
  jumlah,
}: {
  trip: TransactionRow[]
  tagihan: BillingRow[]
  sijo: JobOrder[]
  jumlah: JumlahTerbaru
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="Trip terbaru"
        subtitle={`${formatNumber(jumlah.trip)} trip tercatat.`}
        actions={<Link to="/transaksi/trip"><TautanPanel>Semua trip</TautanPanel></Link>}
      >
        {trip.length === 0 ? <Kosong>Belum ada trip.</Kosong> : (
          <ul className="divide-y divide-grid border-t border-hairline">
            {trip.map((t) => (
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
                    </span>
                    {t.route_name && <span className="mt-0.5 block truncate text-[12px] text-ink-3">{t.route_name}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {/* Trip Dedicated tidak punya harga sendiri; dibayar lewat nilai kontrak. */}
                    {t.service_type === 'dedicated' && !t.harga
                      ? <span className="block text-[12px] text-ink-3">Dedicated</span>
                      : <span className="tnum block text-[13px] font-semibold text-ink">{formatRupiah(t.harga, { compact: true })}</span>}
                    <Badge tone={STATUS_TONE[t.status]} className="mt-0.5">{STATUS_LABEL[t.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Tagihan terbaru"
        subtitle={`${formatNumber(jumlah.tagihan)} tagihan, ${formatNumber(jumlah.belumLunas)} belum lunas${jumlah.ditolak ? `, ${formatNumber(jumlah.ditolak)} ditolak` : ''}.`}
        actions={<Link to="/transaksi/tagihan"><TautanPanel>Semua tagihan</TautanPanel></Link>}
      >
        {tagihan.length === 0 ? <Kosong>Belum ada tagihan.</Kosong> : (
          <ul className="divide-y divide-grid border-t border-hairline">
            {tagihan.map((b) => (
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
          </ul>
        )}
      </Panel>

      <Panel
        title="SI / Job Order terbaru"
        subtitle={`${formatNumber(jumlah.sijo)} SI/Job Order, ${formatNumber(jumlah.komplit)} sudah komplit.`}
        actions={<Link to="/pencarian/sijo"><TautanPanel>Cari SI/JO</TautanPanel></Link>}
      >
        {sijo.length === 0 ? <Kosong>Belum ada SI/Job Order.</Kosong> : (
          <ul className="divide-y divide-grid border-t border-hairline">
            {sijo.map((j) => (
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
        )}
      </Panel>
    </div>
  )
}
