import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, InfoItem } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { formatDate, formatRupiah, todayISO } from '../../lib/format'
import { formatWaktu, kejadianTrip } from '../../lib/trip'
import { PERJALANAN_LABEL, PI_TAHAP_LABEL, SERVICE_LABEL } from '../../types'
import type { TransactionRow } from '../../types'
import { STATUS_LABEL } from './status'

const strip = (v: string | null | undefined) => v || '—'

/**
 * Overview trip Karawang: yang dibutuhkan alur alat berat & DHL saja (TR, lokasi
 * muat & bongkar, posisi, POD, backload, PI). Isian container Priok (Party, SI/BL,
 * Kapal, penerima Surat Jalan, bon) tidak ditampilkan di sini.
 */
export function OverviewKarawang({ trip }: { trip: TransactionRow }) {
  const { db, dbAll, transactionRows, update } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  /** Ditutup dengan foto dulu: begitu sopir menyerahkan hardcopy di pool, ditandai di sini. */
  const fisikMenyusul = trip.status === 'selesai' && trip.pod_fisik === false
  function tandaiFisik() {
    update('transactions', trip.id, { pod_fisik: true, pod_fisik_at: todayISO() })
    toast.success(`Dokumen fisik POD Trip ${trip.transaction_no} diterima.`)
  }
  const drivers = useMemo(() => new Map(db.drivers.map((d) => [d.id, d])), [db.drivers])
  const manager = trip.manager_id ? drivers.get(trip.manager_id) : undefined
  const kontrak = trip.contract_id ? db.contracts.find((c) => c.id === trip.contract_id) : undefined
  const terpakaiKontrak = kontrak
    ? transactionRows.filter((t) => t.contract_id === kontrak.id && t.status !== 'batal').reduce((a, t) => a + t.uj_total + t.expense_total + t.internal_total, 0)
    : 0
  const induk = trip.backload_dari ? transactionRows.find((t) => t.id === trip.backload_dari) : undefined
  const anak = transactionRows.filter((t) => t.backload_dari === trip.id)
  const fotoBongkar = kejadianTrip(dbAll.tripEvents ?? [], trip.id).filter((e) => e.jenis === 'bongkar').flatMap((e) => e.attachments ?? [])
  const fotoPod = [...(trip.pod_attachments ?? []), ...fotoBongkar]
  const vehicle = db.vehicles.find((v) => v.id === trip.vehicle_id)
  const batal = trip.status === 'batal'
  const dedicated = trip.service_type === 'dedicated'
  const totalTagihan = batal ? trip.cancel_fee ?? 0 : trip.harga + trip.biaya_ditagihkan

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

  const pod: ReactNode = trip.status !== 'selesai'
    ? <span className="text-ink-3">Belum ditutup</span>
    : trip.pod_fisik === false
      ? <Badge tone="warning">Foto dulu, fisik menyusul</Badge>
      : trip.pod_fisik ? <Badge tone="good">Fisik diterima{trip.pod_fisik_at ? ` ${formatDate(trip.pod_fisik_at)}` : ''}</Badge> : <span className="text-ink-3">Data lama</span>

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader
            title="Trip"
            actions={trip.printed_at ? <Badge tone="good">BA tercetak {formatDate(trip.printed_at)}</Badge> : <Badge tone="warning">Berita Acara belum dicetak</Badge>}
          />
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <InfoItem label="Tanggal Order" value={trip.order_date ? formatDate(trip.order_date) : '—'} mono />
            <InfoItem label="Tanggal Berangkat" value={formatDate(trip.transaction_date)} mono />
            <InfoItem label="Nomor Trip" value={trip.transaction_no} mono />
            <InfoItem label="ID Perjalanan" value={<span className="break-all whitespace-normal">{strip(trip.trip_ids[0])}</span>} mono />
            <InfoItem label="Klien" value={trip.project_code ? `${trip.project_code} — ${trip.project_name}` : '—'} />
            <InfoItem label="Layanan" value={SERVICE_LABEL[trip.service_type ?? 'callout']} />
            {trip.service_type !== 'dedicated' && (
              <InfoItem
                label="Harga"
                mono
                value={<>
                  {formatRupiah(trip.harga)}
                  {trip.harga > 0 && trip.harga === trip.route_price && <span className="ml-1.5 font-sans text-[11.5px] font-normal text-ink-3">ikut Harga route</span>}
                  {trip.override_note && <span className="mt-0.5 block font-sans text-[11.5px] font-normal text-ink-3">Alasan: {trip.override_note}</span>}
                </>}
              />
            )}
            <InfoItem
              label="Manager"
              value={manager ? <Link to={`/master/karyawan/${manager.id}`} className="hover:text-brand-700 hover:underline">{manager.driver_name}</Link> : trip.manager_name || '—'}
            />
            <InfoItem label="Status" value={`${STATUS_LABEL[trip.status]}${trip.closed_at ? ` · ditutup ${formatDate(trip.closed_at)}` : ''}`} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Muatan & Lokasi" />
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            <InfoItem
              label="TR"
              value={trip.tr_list.length
                ? <span className="flex flex-wrap gap-1.5">{trip.tr_list.map((tr) => <span key={tr} className="tnum rounded border border-hairline bg-sunken px-1.5 py-0.5 text-[12.5px]">{tr}</span>)}</span>
                : '—'}
            />
            <InfoItem label="Posisi terakhir" value={trip.posisi ? `${PERJALANAN_LABEL[trip.posisi.jenis]} · ${formatWaktu(trip.posisi.waktu)}` : 'Belum ada catatan perjalanan'} />
            <InfoItem label="Lokasi Muat" value={strip(trip.muat)} />
            <InfoItem label="Lokasi Bongkar" value={strip(trip.bongkar)} />
            <InfoItem label="Tiba di tujuan (ATA)" value={trip.ata ? formatWaktu(trip.ata) : '—'} mono />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Kendaraan & Sopir" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <InfoItem label="No. Kendaraan" value={vehicle ? `${vehicle.plate_number}${vehicle.configuration ? ` · ${vehicle.configuration}` : ''}` : '—'} mono />
            <div>
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Sopir</p>
              {trip.driver_ids.length === 0
                ? <p className="mt-0.5 text-[13px] font-medium text-ink">—</p>
                : <ul className="mt-1 space-y-1 text-[13px]">{trip.driver_ids.map((id, i) => orang(id, i === 0))}</ul>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Penutupan & POD"
            subtitle={fisikMenyusul ? 'POD baru difoto. Tandai setelah sopir menyerahkan dokumen fisiknya di pool.' : 'Trip ditutup setelah bukti dokumen (POD) diterima.'}
            actions={fisikMenyusul && <Button size="sm" variant="primary" disabled={!bisa('trip')} onClick={tandaiFisik}>Tandai fisik diterima</Button>}
          />
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <InfoItem label="POD" value={pod} />
            <InfoItem label="Backload" value={trip.status !== 'selesai' && !trip.ada_backload ? '—' : trip.ada_backload ? 'Ada muatan balik' : 'Tidak ada'} />
            <InfoItem label="Ditutup" value={trip.closed_at ? formatDate(trip.closed_at) : '—'} mono />
          </dl>
          {fotoPod.length > 0 && (
            <div className="border-t border-hairline px-4 py-3">
              <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Foto POD</p>
              <LampiranThumbs ids={fotoPod} ukuran={56} />
            </div>
          )}
          {trip.notes && (
            <div className="border-t border-hairline px-4 py-3">
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Catatan</p>
              <p className="mt-0.5 text-[13px] whitespace-pre-line text-ink">{trip.notes}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        {(induk || anak.length > 0) && (
          <Card>
            <CardHeader title="Backload" subtitle="Trip yang membawa muatan balik dengan mobil dan sopir yang sama." />
            <ul className="divide-y divide-grid">
              {induk && (
                <li className="px-4 py-2.5 text-[13px]">
                  <span className="text-ink-3">Backload dari </span>
                  <Link to={`/transaksi/trip/${induk.id}`} className="font-semibold text-brand-700 hover:underline">Trip {induk.transaction_no}</Link>
                  <span className="block text-[12px] text-ink-3">{induk.muat || '?'} → {induk.bongkar || '?'}</span>
                </li>
              )}
              {anak.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-[13px]">
                  <span className="text-ink-3">Backload: </span>
                  <Link to={`/transaksi/trip/${a.id}`} className="font-semibold text-brand-700 hover:underline">Trip {a.transaction_no}</Link>
                  <span className="block text-[12px] text-ink-3">{a.muat || '?'} → {a.bongkar || '?'} · {STATUS_LABEL[a.status]}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Rute" subtitle={trip.route_name || 'Belum dipilih'} />
          {trip.route_code ? (
            <dl className="grid grid-cols-2 gap-4 p-4">
              <InfoItem label="No. Route" value={<span className="break-all whitespace-normal">{trip.route_code}</span>} mono />
              <InfoItem label="UJROUTE" value={formatRupiah(trip.ujroute)} mono />
              <InfoItem label="Uang Tol (patokan)" value={formatRupiah(trip.toll)} mono />
              <InfoItem label="Harga route" value={formatRupiah(trip.route_price)} mono />
            </dl>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">Trip ini belum memakai rute.</p>
          )}
        </Card>

        {kontrak && (
          <Card>
            <CardHeader
              title="Kontrak Dedicated"
              subtitle={trip.client_name || 'Klien tidak ditemukan'}
              actions={kontrak.project_id && <Link to={`/master/klien/${kontrak.project_id}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">Lihat klien</Link>}
            />
            <dl className="grid grid-cols-2 gap-4 p-4">
              <InfoItem label="No. Kontrak" value={kontrak.contract_no} mono />
              <InfoItem label="Nilai" value={formatRupiah(kontrak.value)} mono />
              <InfoItem label="Terpakai" value={formatRupiah(terpakaiKontrak)} mono />
              <InfoItem label="Sisa (balance)" value={formatRupiah(kontrak.value - terpakaiKontrak)} mono />
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Tagihan (PI)"
            subtitle={batal ? (trip.cancel_fee ? 'Trip batal dengan biaya cancel ditagihkan.' : 'Trip batal tidak ditagihkan.')
              : dedicated && !trip.pi_tahap ? 'Dedicated: ditagihkan lewat kontrak, bukan PI per trip.' : 'Harga + biaya yang ditagihkan ke klien.'}
            actions={<Link to="/transaksi/tagihan" className="text-[12.5px] font-medium text-brand-700 hover:underline">Buka Tagihan</Link>}
          />
          <dl className="grid grid-cols-2 gap-4 p-4">
            <InfoItem label="No PI" value={strip(trip.pi_number)} mono />
            <InfoItem label="Tahap" value={trip.pi_tahap ? PI_TAHAP_LABEL[trip.pi_tahap] : dedicated ? 'Lewat kontrak' : trip.status === 'selesai' || (batal && trip.cancel_fee) ? 'Siap dibuatkan PI' : 'Menunggu trip ditutup'} />
            {!batal && <InfoItem label="Biaya ditagihkan" value={formatRupiah(trip.biaya_ditagihkan)} mono />}
            <InfoItem label={batal ? 'Biaya cancel' : 'Total tagihan'} value={dedicated && !batal ? '—' : formatRupiah(totalTagihan)} mono />
          </dl>
          {(trip.pi_attachments?.length ?? 0) > 0 && (
            <div className="border-t border-hairline px-4 py-3">
              <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Bukti PI</p>
              <LampiranThumbs ids={trip.pi_attachments!} ukuran={48} />
            </div>
          )}
          {trip.pi_note && <p className="border-t border-hairline px-4 py-2.5 text-[12px] whitespace-pre-line text-ink-3">Catatan PI: {trip.pi_note}</p>}
          {trip.pi_status && <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">Catatan lama: {trip.pi_status}</p>}
        </Card>

        <Card>
          <CardHeader title="Komisi" subtitle="Dihitung otomatis dari Aturan Komisi." />
          <dl className="grid grid-cols-2 gap-4 p-4">
            <InfoItem label="Sopir utama" value={formatRupiah(trip.komisi_sopir)} mono />
            <InfoItem label="Manager" value={trip.manager_id || trip.manager_name ? formatRupiah(trip.komisi_manager) : '—'} mono />
          </dl>
          <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">{trip.komisi_keterangan || 'Belum ada aturan komisi yang cocok.'}</p>
        </Card>
      </div>
    </div>
  )
}
