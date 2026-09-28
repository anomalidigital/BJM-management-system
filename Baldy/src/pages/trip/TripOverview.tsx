import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { Card, CardHeader, InfoItem } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useData } from '../../store/DataProvider'
import { formatDate, formatRupiah } from '../../lib/format'
import { SERVICE_LABEL } from '../../types'
import type { TransactionRow } from '../../types'
import { STATUS_LABEL } from './status'

const strip = (v: string | null | undefined) => v || '—'

/** Tab Overview: seluruh isi dokumen Surat Jalan dan data trip dalam satu tampilan. */
export function TripOverview({ trip }: { trip: TransactionRow }) {
  const { db, billingRows, transactionRows } = useData()
  const drivers = useMemo(() => new Map(db.drivers.map((d) => [d.id, d])), [db.drivers])
  const tagihan = useMemo(
    () => (trip.job_order_id ? billingRows.filter((b) => b.job_order_id === trip.job_order_id) : []),
    [billingRows, trip.job_order_id],
  )
  const manager = trip.manager_id ? drivers.get(trip.manager_id) : undefined
  const kontrak = trip.contract_id ? db.contracts.find((c) => c.id === trip.contract_id) : undefined
  const terpakaiKontrak = kontrak
    ? transactionRows.filter((t) => t.contract_id === kontrak.id && t.status !== 'batal')
      .reduce((a, t) => a + t.uj_total + t.expense_total + t.internal_total, 0)
    : 0

  const orang = (id: string, utama: boolean): ReactNode => {
    const d = drivers.get(id)
    if (!d) return null
    return (
      <li key={id} className="flex items-center gap-2">
        <Link to={`/master/karyawan/${d.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{d.driver_name}</Link>
        <span className="tnum text-[12px] text-ink-3">{d.driver_code}</span>
        {trip.driver_ids.length > 1 && (utama ? <Badge tone="brand">Utama · penerima komisi</Badge> : <Badge tone="neutral">Tambahan</Badge>)}
      </li>
    )
  }

  const pengiriman: Array<[string, ReactNode, boolean?]> = [
    ['No. Kendaraan', strip(trip.plate_number), true],
    ['Party', strip(trip.party)],
    ['SI / BL', trip.sijo ? <Link to={`/pencarian/sijo?sijo=${trip.sijo}`} className="text-brand-700 hover:underline">{trip.sijo}</Link> : '—', true],
    ['Jenis Brg', strip(trip.goods_type)],
    ['Kosongan', strip(trip.kosongan)],
    ['Lokasi', strip(trip.location)],
    ['Kapal', strip(trip.ship)],
    ['Tujuan', strip(trip.destination_detail)],
  ]

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader
            title="Informasi Dokumen"
            actions={trip.printed_at ? <Badge tone="good">Tercetak {formatDate(trip.printed_at)}</Badge> : <Badge tone="warning">Belum dicetak</Badge>}
          />
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <InfoItem label="Tanggal" value={formatDate(trip.transaction_date)} mono />
            <InfoItem label="Nomor Trip" value={trip.transaction_no} mono />
            <InfoItem label="Nomor Surat Jalan" value={strip(trip.sj_no)} mono />
            <InfoItem
              label="Manager"
              value={manager
                ? <Link to={`/master/karyawan/${manager.id}`} className="hover:text-brand-700 hover:underline">{manager.driver_name}</Link>
                : trip.manager_name || '—'}
            />
            <InfoItem label="Project" value={trip.project_code ? `${trip.project_code} — ${trip.project_name}` : '—'} />
            <InfoItem label="Status" value={STATUS_LABEL[trip.status]} />
            <InfoItem label="Layanan" value={SERVICE_LABEL[trip.service_type ?? 'callout']} />
            {kontrak && <InfoItem label="Kontrak" value={`${kontrak.contract_no} — ${kontrak.client_name}`} />}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Penerima" />
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            <InfoItem label="Kepada Yth" value={strip(trip.recipient_name)} />
            <InfoItem
              label="di"
              value={<>{trip.recipient_address_1 || '—'}{trip.recipient_address_2 && <><br />{trip.recipient_address_2}</>}</>}
            />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Informasi Pengiriman" />
          <div className="p-4">
            <div className="mb-4">
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Sopir</p>
              {trip.driver_ids.length === 0
                ? <p className="mt-0.5 text-[13px] font-medium text-ink">—</p>
                : <ul className="mt-1 space-y-1 text-[13px]">{trip.driver_ids.map((id, i) => orang(id, i === 0))}</ul>}
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pengiriman.map(([label, value, mono]) => <InfoItem key={label} label={label} value={value} mono={mono} />)}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Identifier & Catatan" />
          <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="TR" value={strip(trip.tr_reference)} mono />
            <InfoItem label="No PI" value={strip(trip.pi_number)} mono />
            <InfoItem label="Status PI" value={strip(trip.pi_status)} />
            <InfoItem label="COST" value={trip.cost_value ? formatRupiah(trip.cost_value) : '—'} mono />
            <InfoItem label="Tgl Bon" value={trip.bon_date ? formatDate(trip.bon_date) : '—'} mono />
            <InfoItem label="Bon Pribadi" value={trip.personal_bon ? formatRupiah(trip.personal_bon) : '—'} mono />
          </dl>
          {trip.notes && (
            <div className="border-t border-hairline px-4 py-3">
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Catatan</p>
              <p className="mt-0.5 text-[13px] whitespace-pre-line text-ink">{trip.notes}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="ID Perjalanan/Trip" subtitle={`${trip.trip_ids.length} ID pada trip ini.`} />
          <div className="p-4">
            {trip.trip_ids.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">Belum ada ID Perjalanan/Trip.</p>
            ) : (
              <ol className="space-y-1.5">
                {trip.trip_ids.map((c, i) => (
                  <li key={`${c}-${i}`} className="flex items-center gap-2.5 rounded-md border border-hairline bg-sunken px-3 py-2">
                    <span className="tnum w-5 shrink-0 text-[12px] font-semibold text-ink-3">{i + 1}.</span>
                    <Hash size={14} className="shrink-0 text-ink-3" />
                    <span className="tnum text-[13px] font-medium tracking-wide text-ink">{c}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Rute" subtitle={trip.route_name || 'Belum dipilih'} />
          {trip.route_code ? (
            <dl className="grid grid-cols-2 gap-4 p-4">
              <InfoItem label="No. Route" value={<span className="break-all whitespace-normal">{trip.route_code}</span>} mono />
              <InfoItem label="UJROUTE" value={formatRupiah(trip.ujroute)} mono />
              <InfoItem label="Uang Tol (patokan)" value={formatRupiah(trip.toll)} mono />
              <InfoItem label="Harga" value={formatRupiah(trip.route_price)} mono />
            </dl>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">Trip ini belum memakai route.</p>
          )}
        </Card>

        {kontrak && (
          <Card>
            <CardHeader title="Kontrak Dedicated" subtitle={kontrak.client_name} />
            <dl className="grid grid-cols-2 gap-4 p-4">
              <InfoItem label="No. Kontrak" value={kontrak.contract_no} mono />
              <InfoItem label="Nilai" value={formatRupiah(kontrak.value)} mono />
              <InfoItem label="Terpakai" value={formatRupiah(terpakaiKontrak)} mono />
              <InfoItem label="Sisa (balance)" value={formatRupiah(kontrak.value - terpakaiKontrak)} mono />
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader title="Komisi" subtitle="Dihitung otomatis dari Master → Komisi." />
          <dl className="grid grid-cols-2 gap-4 p-4">
            <InfoItem label="Sopir utama" value={formatRupiah(trip.komisi_sopir)} mono />
            <InfoItem label="Manager" value={trip.manager_id || trip.manager_name ? formatRupiah(trip.komisi_manager) : '—'} mono />
          </dl>
          <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">{trip.komisi_keterangan || 'Belum ada aturan komisi yang cocok.'}</p>
        </Card>

        <Card>
          <CardHeader title="Tagihan terkait" subtitle={trip.sijo ? `Tagihan dengan SI/JO ${trip.sijo}.` : 'Pilih SI / BL untuk menautkan tagihan.'} />
          {tagihan.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">Belum ada tagihan terkait.</p>
          ) : (
            <ul className="divide-y divide-grid">
              {tagihan.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <span className="tnum block text-[13px] font-semibold text-ink">{b.invoice_no}</span>
                    <span className="block text-[12px] text-ink-3">{b.cost_code} · {formatDate(b.billing_date)}</span>
                  </span>
                  <span className="tnum text-[13px] font-semibold text-ink">{formatRupiah(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
