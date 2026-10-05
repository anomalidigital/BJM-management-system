import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Skeleton } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { deltaPersen, komisiTransaksi, pendapatanTransaksi, ringkas, tripDihitung } from '../lib/calculations'
import { formatRupiah, monthLabel, todayISO } from '../lib/format'
import { groupBy } from '../lib/utils'
import { periodeAktif, periodeSebelumnya } from '../lib/periode'
import { HeroDepo, URUT_TUMPUK } from './dashboard/HeroDepo'
import type { HariPapan, StatusPapan } from './dashboard/HeroDepo'
import { PerluDitindak } from './dashboard/PerluDitindak'
import type { ItemTindak } from './dashboard/PerluDitindak'
import { JembatanUang } from './dashboard/JembatanUang'
import { LayananKlien } from './dashboard/LayananKlien'
import type { KontrakBerjalan } from './dashboard/LayananKlien'
import { PapanRitan } from './dashboard/PapanRitan'
import { Terbaru } from './dashboard/Terbaru'
import { TrenHarian } from './dashboard/TrenHarian'

const labelHari = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Dashboard "papan depo": trip bulan ini sebagai tumpukan kontainer di pelat baja,
 * lalu yang perlu ditindak, jalannya uang, layanan & klien, tren harian, ritan,
 * dan catatan terbaru.
 */
export function DashboardPage() {
  const { db, transactionRows, billingRows, loading } = useData()

  const model = useMemo(() => {
    const periode = periodeAktif(transactionRows.map((t) => t.transaction_date))
    const sebelum = periodeSebelumnya(periode)
    const hariIni = todayISO()
    const dalam = (t: { transaction_date: string }, p: { start: string; end: string }) =>
      t.transaction_date >= p.start && t.transaction_date <= p.end

    // Trip batal hanya arsip: tidak dihitung di ringkasan mana pun.
    const bulanIni = transactionRows.filter((t) => tripDihitung(t) && dalam(t, periode))
    const bulanLalu = transactionRows.filter((t) => tripDihitung(t) && dalam(t, sebelum))
    const batal = transactionRows.filter((t) => t.status === 'batal' && dalam(t, periode)).length
    const now = ringkas(bulanIni)
    const prev = ringkas(bulanLalu)

    const perStatus = Object.fromEntries(URUT_TUMPUK.map((s) => [s, bulanIni.filter((t) => t.status === s).length])) as Record<StatusPapan, number>

    // Satu kolom per tanggal sebulan penuh; hari yang belum terjadi tampil kosong.
    const perTanggal = groupBy(bulanIni, (t) => t.transaction_date)
    const jumlahHari = Number(periode.end.slice(8, 10))
    const hari: HariPapan[] = Array.from({ length: jumlahHari }, (_, i) => {
      const iso = `${periode.start.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
      const trip = (perTanggal[iso] ?? [])
        .map((t) => ({ id: t.id, status: t.status as StatusPapan }))
        .sort((a, b) => URUT_TUMPUK.indexOf(a.status) - URUT_TUMPUK.indexOf(b.status))
      return { iso, tanggal: i + 1, label: labelHari(iso), trip, mendatang: iso > hariIni, hariIni: iso === hariIni }
    })

    // Pendapatan & komisi per hari, dari tanggal 1 sampai hari ini (atau trip terakhir
    // bila tanggalnya sudah lewat hari ini).
    const tglAkhir = [hariIni, ...bulanIni.map((t) => t.transaction_date)]
      .filter((d) => d >= periode.start && d <= periode.end)
      .sort()
      .at(-1) ?? periode.end
    const tanggalTren = hari.slice(0, Number(tglAkhir.slice(8, 10))).map((h) => h.iso)
    const tren = {
      hari: tanggalTren,
      pendapatan: tanggalTren.map((iso) => (perTanggal[iso] ?? []).reduce((a, t) => a + pendapatanTransaksi(t), 0)),
      komisi: tanggalTren.map((iso) => (perTanggal[iso] ?? []).reduce((a, t) => a + komisiTransaksi(t), 0)),
    }

    const sopirBertugas = new Set(bulanIni.flatMap((t) => t.driver_ids)).size
    const sopirAktif = db.drivers.filter((d) => (d.role ?? 'sopir') === 'sopir' && d.status === 'aktif').length
    const karyawanAktif = db.drivers.filter((d) => d.status === 'aktif').length
    const mobilTerpakai = new Set(bulanIni.map((t) => t.vehicle_id).filter(Boolean)).size
    const mobilTotal = db.vehicles.filter((v) => v.status === 'aktif').length

    // Yang perlu ditindak, urut dari yang paling mendesak.
    const tindak: ItemTindak[] = ([
      {
        id: 'menunggu-sopir', nada: 'perhatian', to: '/transaksi/trip',
        label: 'Trip menunggu sopir', keterangan: 'Pilih sopir supaya trip bisa jalan.',
        jumlah: perStatus.menunggu_sopir,
      },
      {
        id: 'sj-draft', nada: 'perhatian', to: '/transaksi/trip',
        label: 'Surat Jalan belum dicetak', keterangan: 'Trip sudah bernomor Surat Jalan tapi belum dicetak.',
        jumlah: transactionRows.filter((t) => t.sj_no && !t.printed_at && t.status !== 'batal').length,
      },
      {
        id: 'ditolak', nada: 'masalah', to: '/transaksi/tagihan',
        label: 'Tagihan ditolak', keterangan: 'Perlu diperbaiki lalu diajukan ulang.',
        jumlah: billingRows.filter((b) => b.is_rejected).length,
      },
      {
        id: 'belum-selesai', nada: 'info', to: '/transaksi/trip',
        label: 'Trip belum ditandai Selesai', keterangan: 'Tandai setelah mobil kembali ke pool.',
        jumlah: bulanIni.filter((t) => t.status !== 'selesai').length,
      },
      {
        id: 'belum-lunas', nada: 'info', to: '/transaksi/tagihan',
        label: 'Tagihan belum lunas', keterangan: 'Belum ada tanggal lunas.',
        jumlah: billingRows.filter((b) => !b.paid_date && !b.is_rejected).length,
      },
      {
        id: 'sijo-belum-komplit', nada: 'info', to: '/pencarian/sijo',
        label: 'SI / Job Order belum komplit',
        jumlah: db.jobOrders.filter((j) => !j.is_complete).length,
      },
      {
        id: 'id-trip', nada: 'info', to: '/transaksi/trip',
        label: 'Trip tanpa ID Perjalanan/Trip',
        jumlah: bulanIni.filter((t) => (t.trip_ids ?? []).length === 0).length,
      },
    ] satisfies ItemTindak[]).filter((a) => a.jumlah > 0)

    const uang = {
      uj: bulanIni.reduce((a, t) => a + t.uj_total, 0),
      kasbon: bulanIni.reduce((a, t) => a + t.kasbon_total, 0),
      tf: bulanIni.reduce((a, t) => a + t.tf_total, 0),
      biaya: bulanIni.reduce((a, t) => a + t.expense_total, 0),
      termin: bulanIni.reduce((a, t) => a + t.termin_count, 0),
    }
    const uangLalu = {
      uj: bulanLalu.reduce((a, t) => a + t.uj_total, 0),
      biaya: bulanLalu.reduce((a, t) => a + t.expense_total, 0),
    }

    // Callout = klien tetap, Dedicated = klien kontrak.
    const callout = bulanIni.filter((t) => (t.service_type ?? 'callout') === 'callout')
    const layanan = {
      callout: { trip: callout.length, pendapatan: callout.reduce((a, t) => a + pendapatanTransaksi(t), 0) },
      dedicated: { trip: bulanIni.length - callout.length },
    }
    const terpakai = new Map<string, number>()
    for (const t of transactionRows) {
      if (!t.contract_id || t.status === 'batal') continue
      terpakai.set(t.contract_id, (terpakai.get(t.contract_id) ?? 0) + t.uj_total + t.expense_total + t.internal_total)
    }
    const klien = new Map(db.projects.map((p) => [p.id, p]))
    const kontrak: KontrakBerjalan[] = db.contracts
      .filter((c) => c.status === 'aktif')
      .map((c) => ({
        id: c.id,
        nomor: c.contract_no,
        klienId: c.project_id,
        klien: klien.get(c.project_id)?.project_name ?? 'Klien tidak ditemukan',
        nilai: c.value,
        sisa: c.value - (terpakai.get(c.id) ?? 0),
      }))
      .sort((a, b) => a.sisa / Math.max(1, a.nilai) - b.sisa / Math.max(1, b.nilai))

    // Ritan per sopir utama.
    const ritan = Object.entries(groupBy(bulanIni, (t) => t.driver_id))
      .filter(([id]) => id)
      .map(([id, rows]) => {
        const komisi = rows.reduce((a, r) => a + komisiTransaksi(r), 0)
        const uj = rows.reduce((a, r) => a + r.uj_total, 0)
        return {
          id,
          nama: rows[0].driver_name || 'Tanpa nama',
          keterangan: komisi > 0 ? `komisi ${formatRupiah(komisi, { compact: true })}` : uj > 0 ? `UJ ${formatRupiah(uj, { compact: true })}` : '',
          ritan: rows.length,
        }
      })
      .sort((a, b) => b.ritan - a.ritan)
      .slice(0, 6)

    return {
      periode, sebelum, now, prev, batal, perStatus, hari, tren, sopirBertugas, sopirAktif, karyawanAktif,
      mobilTerpakai, mobilTotal, tindak, uang, uangLalu, layanan, kontrak, ritan,
    }
  }, [transactionRows, billingRows, db.drivers, db.vehicles, db.jobOrders, db.contracts, db.projects])

  const terbaru = useMemo(() => ({
    trip: [...transactionRows]
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.transaction_no.localeCompare(a.transaction_no))
      .slice(0, 6),
    tagihan: [...billingRows].sort((a, b) => b.billing_date.localeCompare(a.billing_date)).slice(0, 6),
    sijo: [...db.jobOrders].slice(-6).reverse(),
    jumlah: {
      trip: transactionRows.length,
      tagihan: billingRows.length,
      belumLunas: billingRows.filter((b) => !b.paid_date && !b.is_rejected).length,
      ditolak: billingRows.filter((b) => b.is_rejected).length,
      sijo: db.jobOrders.length,
      komplit: db.jobOrders.filter((j) => j.is_complete).length,
    },
  }), [transactionRows, billingRows, db.jobOrders])

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Memuat ringkasan operasional..." />
        <div className="grid gap-4 xl:grid-cols-12">
          <Skeleton className="h-[340px] rounded-xl xl:col-span-8" />
          <Skeleton className="h-[340px] rounded-xl xl:col-span-4" />
          <Skeleton className="h-64 rounded-xl xl:col-span-8" />
          <Skeleton className="h-64 rounded-xl xl:col-span-4" />
        </div>
      </>
    )
  }

  const { periode, sebelum, now, prev, uang, uangLalu } = model
  const bulan = monthLabel(periode.start)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan operasional ${bulan}${periode.dariData ? ', bulan terakhir yang punya data' : ''}.`}
        actions={
          <Link
            to="/laporan/komisi"
            className="inline-flex h-9 items-center rounded-md border border-hairline bg-surface px-3.5 text-[13px] font-medium text-ink transition hover:bg-sunken"
          >
            Buka laporan komisi
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <HeroDepo
            bulan={bulan}
            bulanLalu={monthLabel(sebelum.start)}
            jumlah={now.transaksi}
            jumlahLalu={prev.transaksi}
            deltaTrip={deltaPersen(now.transaksi, prev.transaksi)}
            perStatus={model.perStatus}
            batal={model.batal}
            hari={model.hari}
            sopirBertugas={model.sopirBertugas}
            sopirAktif={model.sopirAktif}
            karyawanAktif={model.karyawanAktif}
            karyawanTotal={db.drivers.length}
            mobilTerpakai={model.mobilTerpakai}
            mobilTotal={model.mobilTotal}
          />
        </div>
        <div className="xl:col-span-4">
          <PerluDitindak items={model.tindak} />
        </div>

        <div className="xl:col-span-8">
          <JembatanUang
            bulanLalu={monthLabel(sebelum.start)}
            pendapatan={now.pendapatan}
            ujroute={now.ujroute}
            komisi={now.komisi}
            netto={now.netto}
            deltaPendapatan={deltaPersen(now.pendapatan, prev.pendapatan)}
            deltaUjroute={deltaPersen(now.ujroute, prev.ujroute)}
            deltaKomisi={deltaPersen(now.komisi, prev.komisi)}
            deltaNetto={deltaPersen(now.netto, prev.netto)}
            deltaUj={deltaPersen(uang.uj, uangLalu.uj)}
            deltaBiaya={deltaPersen(uang.biaya, uangLalu.biaya)}
            uj={uang.uj}
            kasbon={uang.kasbon}
            tf={uang.tf}
            termin={uang.termin}
            biaya={uang.biaya}
          />
        </div>
        <div className="xl:col-span-4">
          <LayananKlien callout={model.layanan.callout} dedicated={model.layanan.dedicated} kontrak={model.kontrak} />
        </div>

        <div className="xl:col-span-8">
          <TrenHarian bulan={bulan} hari={model.tren.hari} pendapatan={model.tren.pendapatan} komisi={model.tren.komisi} />
        </div>
        <div className="xl:col-span-4">
          <PapanRitan rows={model.ritan} bulan={bulan} />
        </div>

        <div className="xl:col-span-12">
          <Terbaru trip={terbaru.trip} tagihan={terbaru.tagihan} sijo={terbaru.sijo} jumlah={terbaru.jumlah} />
        </div>
      </div>
    </>
  )
}
