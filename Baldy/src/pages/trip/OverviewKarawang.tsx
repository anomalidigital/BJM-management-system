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
import { formatWaktu, kejadianTrip, muatanTrip } from '../../lib/trip'
import { CLIENT_TYPE_LABEL, GANDENGAN_LABEL, PERJALANAN_LABEL, PI_TAHAP_LABEL } from '../../types'
import type { TitikAlamat, TransactionRow } from '../../types'
import { STATUS_LABEL } from './status'

const strip = (v: string | null | undefined) => v || '—'
/** Isian kosong di kartu Pengirim & Penerima. */
const belumDiisi = <span className="font-normal text-ink-3">Belum diisi</span>
/** Nama sub kendaraan / gandengan mengikuti istilah atasan (LB -> Low Bed). */
const labelGandengan = (kode: string) => GANDENGAN_LABEL[kode.trim().toUpperCase()] ?? kode

/**
 * Overview trip Karawang: yang dibutuhkan alur alat berat & DHL saja (ID Trip, No. Referensi,
 * Pick Up & Destination Details berikut catatannya, Add Items Details, posisi kendaraan, POD,
 * backload / lanjutan, PI). Isian container Priok (Party, SI/BL, Kapal, penerima Surat Jalan,
 * bon) tidak ditampilkan di sini.
 */
export function OverviewKarawang({ trip }: { trip: TransactionRow }) {
  const { db, dbAll, transactionRows, update } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  /** Ditutup dengan foto dulu: begitu supir menyerahkan hardcopy di pool, ditandai di sini. */
  const fisikMenyusul = trip.status === 'selesai' && trip.pod_fisik === false
  function tandaiFisik() {
    update('transactions', trip.id, { pod_fisik: true, pod_fisik_at: todayISO() })
    toast.success(`Dokumen fisik POD Trip ${trip.id_tampil} diterima.`)
  }
  const drivers = useMemo(() => new Map(db.drivers.map((d) => [d.id, d])), [db.drivers])
  const manager = trip.manager_id ? drivers.get(trip.manager_id) : undefined
  const kontrak = trip.contract_id ? db.contracts.find((c) => c.id === trip.contract_id) : undefined
  const terpakaiKontrak = kontrak
    ? transactionRows.filter((t) => t.contract_id === kontrak.id && t.status !== 'batal').reduce((a, t) => a + t.uj_total + t.expense_total + t.internal_total, 0)
    : 0
  const induk = trip.backload_dari ? transactionRows.find((t) => t.id === trip.backload_dari) : undefined
  const anak = transactionRows.filter((t) => t.backload_dari === trip.id)
  const kejadian = kejadianTrip(dbAll.tripEvents ?? [], trip.id)
  const fotoBongkar = kejadian.filter((e) => e.jenis === 'bongkar').flatMap((e) => e.attachments ?? [])
  const fotoPod = [...(trip.pod_attachments ?? []), ...fotoBongkar]
  const vehicle = db.vehicles.find((v) => v.id === trip.vehicle_id)
  const batal = trip.status === 'batal'
  const dedicated = trip.service_type === 'dedicated'
  const totalTagihan = batal ? trip.cancel_fee ?? 0 : trip.harga + trip.biaya_ditagihkan
  const muatan = muatanTrip(trip)

  const orang = (id: string, utama: boolean): ReactNode => {
    const d = drivers.get(id)
    if (!d) return null
    return (
      <li key={id} className="flex flex-wrap items-center gap-2">
        <Link to={`/master/karyawan/${d.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{d.driver_name}</Link>
        <span className="tnum text-[12px] text-ink-3">{d.driver_code}</span>
        {trip.driver_ids.length > 1 && (utama ? <Badge tone="brand">Utama · penerima komisi</Badge> : <Badge tone="neutral">Pendamping</Badge>)}
      </li>
    )
  }

  /** Sub kendaraan / gandengan trip ini; kosong = ikut konfigurasi kendaraannya. */
  const gandengan: ReactNode = trip.gandengan
    ? labelGandengan(trip.gandengan)
    : vehicle?.configuration
      ? <>{labelGandengan(vehicle.configuration)} <span className="font-normal text-ink-3">(ikut kendaraan)</span></>
      : '—'

  // Posisi kendaraan: masih dipakai trip ini, sudah kembali di pool, atau pindah ke trip lanjutan.
  const lanjutan = anak.filter((a) => a.status !== 'batal')
  const waktuPool = trip.pool_at || kejadian.filter((e) => e.jenis === 'pool').at(-1)?.waktu || ''
  const posisiKendaraan: ReactNode = !trip.vehicle_id
    ? <span className="text-ink-3">Belum ada kendaraan</span>
    : batal
      ? <span className="text-ink-3">Dilepas, trip dibatalkan</span>
      : lanjutan.length > 0
        ? (
          <span className="flex flex-wrap items-center gap-1.5 whitespace-normal">
            <Badge tone="brand">Dilanjutkan trip lanjutan</Badge>
            <Link to={`/transaksi/trip/${lanjutan.at(-1)!.id}`} className="tnum font-semibold break-all text-brand-700 hover:underline">
              Trip {lanjutan.at(-1)!.id_tampil}
            </Link>
          </span>
        )
        : waktuPool
          ? <Badge tone="good">Sudah di pool · {formatWaktu(waktuPool)}</Badge>
          : trip.menahan_kendaraan
            ? <Badge tone={trip.status === 'selesai' ? 'warning' : 'brand'}>Masih dipakai trip ini</Badge>
            : <span className="text-ink-3">Tidak ditahan (trip lama)</span>

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
            actions={trip.printed_at ? <Badge tone="good">Berita Acara tercetak {formatDate(trip.printed_at)}</Badge> : <Badge tone="warning">Berita Acara belum dicetak</Badge>}
          />
          {/* ID Trip = Kode Trip (atasan 13 Okt 2026); ID Perjalanan ada di Add Items Details. */}
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">ID Trip</p>
            <p className="tnum mt-0.5 text-[18px] leading-tight font-semibold tracking-tight break-all text-ink">{strip(trip.transaction_no)}</p>
          </div>
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <InfoItem label="Tanggal Order" value={trip.order_date ? formatDate(trip.order_date) : '—'} mono />
            <InfoItem label="Tanggal Berangkat" value={formatDate(trip.transaction_date)} mono />
            <InfoItem label="Klien" value={trip.project_code ? `${trip.project_code} — ${trip.project_name}` : '—'} />
            <InfoItem label="Tipe Layanan" value={CLIENT_TYPE_LABEL[trip.service_type ?? 'callout']} />
            {trip.service_type !== 'dedicated' && (
              <InfoItem
                label="Harga"
                mono
                value={<>
                  {formatRupiah(trip.harga)}
                  {trip.harga > 0 && trip.harga === trip.route_price && <span className="ml-1.5 font-sans text-[11.5px] font-normal text-ink-3">ikut Harga Rute</span>}
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
          <CardHeader title="Informasi Pengiriman" subtitle="Pick up, destinasi, dan barang yang dibawa." />
          <div className="grid divide-y divide-hairline border-b border-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <TitikTrip judul="Pick Up Details" titik={trip.pengirim} />
            <TitikTrip judul="Destination Details" titik={trip.penerima} />
          </div>
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            <InfoItem
              label="No. Referensi"
              value={trip.tr_list.length
                ? <span className="flex flex-wrap gap-1.5">{trip.tr_list.map((tr) => <span key={tr} className="tnum rounded border border-hairline bg-sunken px-1.5 py-0.5 text-[12.5px]">{tr}</span>)}</span>
                : '—'}
            />
            <InfoItem label="Kosongan" value={strip(trip.kosongan)} />
            <div className="min-w-0 sm:col-span-2">
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Add Items Details</p>
              {muatan.length === 0 ? <p className="mt-0.5 text-[13px] text-ink-3">Belum diisi</p> : (
                <ul className="mt-1 space-y-1 text-[13px]">
                  {muatan.map((m, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="tnum font-semibold text-ink">{m.id_perjalanan || 'Tanpa ID Perjalanan'}</span>
                      {m.keterangan && <span className="text-ink-2">{m.keterangan}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <InfoItem label="Lokasi Muat → Bongkar" value={`${strip(trip.muat)} → ${strip(trip.bongkar)}`} />
            <InfoItem label="Tiba di tujuan (ATA)" value={trip.ata ? formatWaktu(trip.ata) : '—'} mono />
            <InfoItem label="Posisi terakhir" value={trip.posisi ? `${PERJALANAN_LABEL[trip.posisi.jenis]} · ${formatWaktu(trip.posisi.waktu)}` : 'Belum ada catatan perjalanan'} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Kendaraan & Supir" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <InfoItem label="No. Kendaraan" value={vehicle ? `${vehicle.plate_number}${vehicle.configuration ? ` · ${vehicle.configuration}` : ''}` : '—'} mono />
            <InfoItem label="Sub Kendaraan / Gandengan" value={gandengan} />
            <InfoItem label="Posisi kendaraan" value={posisiKendaraan} />
            <div>
              <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Supir</p>
              {trip.driver_ids.length === 0
                ? <p className="mt-0.5 text-[13px] font-medium text-ink">—</p>
                : <ul className="mt-1 space-y-1 text-[13px]">{trip.driver_ids.map((id, i) => orang(id, i === 0))}</ul>}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Penutupan & POD"
            subtitle={fisikMenyusul ? 'POD baru difoto. Tandai setelah supir menyerahkan dokumen fisiknya di pool.' : 'Trip ditutup setelah bukti dokumen (POD) diterima.'}
            actions={fisikMenyusul && <Button size="sm" variant="primary" disabled={!bisa('trip')} onClick={tandaiFisik}>Tandai fisik diterima</Button>}
          />
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <InfoItem label="POD" value={pod} />
            <InfoItem label="Backload / lanjutan" value={lanjutan.length ? `Ada, ${lanjutan.map((a) => a.id_tampil).join(', ')}` : trip.ada_backload ? 'Ditandai ada, belum dibuat' : '—'} />
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
            <CardHeader title="Backload / Lanjutan" subtitle="Trip lanjutan dari lokasi bongkar, dengan mobil dan supir yang sama." />
            <ul className="divide-y divide-grid">
              {induk && (
                <li className="px-4 py-2.5 text-[13px]">
                  <span className="text-ink-3">Lanjutan dari </span>
                  <Link to={`/transaksi/trip/${induk.id}`} className="tnum font-semibold break-all text-brand-700 hover:underline">Trip {induk.id_tampil}</Link>
                  <span className="block text-[12px] text-ink-3">{induk.muat || '?'} → {induk.bongkar || '?'}</span>
                </li>
              )}
              {anak.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-[13px]">
                  <span className="text-ink-3">Dilanjutkan: </span>
                  <Link to={`/transaksi/trip/${a.id}`} className="tnum font-semibold break-all text-brand-700 hover:underline">Trip {a.id_tampil}</Link>
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
              <InfoItem label="No. Rute" value={<span className="break-all whitespace-normal">{trip.route_code}</span>} mono />
              <InfoItem label="Uang Jalan Rute" value={formatRupiah(trip.ujroute)} mono />
              <InfoItem label="Uang Tol (patokan)" value={formatRupiah(trip.toll)} mono />
              <InfoItem label="Harga Rute" value={formatRupiah(trip.route_price)} mono />
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
          <CardHeader title="Komisi" subtitle="Dihitung otomatis dari Aturan Komisi; pembayaran dicatat di tab Komisi." />
          <dl className="grid grid-cols-2 gap-4 p-4">
            <InfoItem label="Supir utama" value={formatRupiah(trip.komisi_sopir)} mono />
            <InfoItem label="Manager" value={trip.manager_id || trip.manager_name ? formatRupiah(trip.komisi_manager) : '—'} mono />
          </dl>
          <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">{trip.komisi_keterangan || 'Belum ada aturan komisi yang cocok.'}</p>
        </Card>
      </div>
    </div>
  )
}

/** Satu sisi kartu Pengirim & Penerima: salinan alamat yang tersimpan di trip. */
function TitikTrip({ judul, titik }: { judul: string; titik?: TitikAlamat }) {
  const isi = (v: string | undefined): ReactNode => (v?.trim() ? <span className="break-words whitespace-normal">{v}</span> : belumDiisi)
  const telepon = titik?.telepon?.trim()
  return (
    <div className="min-w-0 p-4">
      <p className="mb-3 text-[12.5px] font-semibold text-ink-2">{judul}</p>
      <dl className="grid gap-3">
        <InfoItem label="Nama" value={isi(titik?.nama)} />
        <InfoItem label="Alamat" value={isi(titik?.alamat)} />
        {titik?.catatan && <InfoItem label="Catatan" value={<span className="break-words whitespace-normal">{titik.catatan}</span>} />}
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label="Kontak" value={isi(titik?.kontak)} />
          <InfoItem
            label="Telepon"
            mono
            value={telepon
              ? <a href={`tel:${telepon.replace(/[^\d+]/g, '')}`} className="break-words whitespace-normal hover:text-brand-700 hover:underline">{telepon}</a>
              : belumDiisi}
          />
        </div>
      </dl>
    </div>
  )
}
