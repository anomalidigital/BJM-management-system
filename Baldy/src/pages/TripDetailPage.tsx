import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FaArrowLeft, FaBan, FaFlagCheckered, FaPen, FaPrint, FaRoute, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { OverflowMenu } from '../components/ui/Menu'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { formatDate, formatDateLong, formatRupiah, todayISO } from '../lib/format'
import { cn } from '../lib/utils'
import { biayaDitagihkan, dibayarPerusahaan } from '../lib/trip'
import { STATUS_LABEL, STATUS_TONE } from './trip/status'
import { KonfirmasiBatalTrip, KonfirmasiHapusTrip } from './trip/KonfirmasiTrip'
import { TripOverview } from './trip/TripOverview'
import { TabUangJalan } from './trip/TabUangJalan'
import { TabBiaya } from './trip/TabBiaya'
import { TabInternal } from './trip/TabInternal'
import { TabLainnya } from './trip/TabLainnya'
import { TabPerjalanan } from './trip/TabPerjalanan'
import { OverviewKarawang } from './trip/OverviewKarawang'
import { KonfirmasiTutupTrip } from './trip/TutupTrip'

const TAB_IDS = ['overview', 'perjalanan', 'uj', 'biaya', 'internal', 'lainnya'] as const
type TabId = (typeof TAB_IDS)[number]

/**
 * Detail Trip: dokumen Surat Jalan dan seluruh catatan keuangan perjalanan
 * (dulu terpisah di Surat Jalan dan Data Pengeluaran). Trip Karawang punya tab
 * Perjalanan, Tutup Trip (POD & backload), dan Berita Acara sebagai dokumen cetak.
 */
export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { dbAll, transactionRows, loading, update } = useData()
  const { bisa } = useAuth()

  const awal = params.get('tab')
  const [tab, setTab] = useState<TabId>(TAB_IDS.includes(awal as TabId) ? (awal as TabId) : 'overview')
  const [printing, setPrinting] = useState(false)
  const [membatalkan, setMembatalkan] = useState(false)
  const [menghapus, setMenghapus] = useState(false)
  const [menutup, setMenutup] = useState(false)

  const trip = transactionRows.find((t) => t.id === id)

  // Datang dari "Simpan & Cetak" -> langsung buka pengaturan cetak.
  useEffect(() => {
    if (params.get('print') === '1' && trip) {
      setPrinting(true)
      params.delete('print')
      setParams(params, { replace: true })
    }
  }, [params, trip, setParams])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat trip..." crumbs={[{ label: 'Trip / Job Order' }]} />
        <div className="mb-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!trip) {
    return (
      <>
        <PageHeader title="Trip tidak ditemukan" crumbs={[{ label: 'Trip / Job Order' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Trip mungkin sudah dihapus, atau milik workspace lain.</p>
            <Button className="mt-4" onClick={() => navigate('/transaksi/trip')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  const batal = trip.status === 'batal'
  const karawang = trip.workspace === 'karawang'
  const bisaUbah = bisa('trip') && !batal
  /** Tutup Trip: trip yang sedang jalan. Backload: mobil & sopir trip ini membawa muatan balik. */
  const bisaTutup = karawang && bisaUbah && trip.status === 'aktif'
  const sudahBackload = transactionRows.some((t) => t.backload_dari === trip.id)
  /** Biaya tambahan (operasional & internal) hanya Owner & Manager. */
  const bisaBiaya = bisa('biaya') && !batal

  // Catatan dibaca dari seluruh data: untuk trip batal, ini arsipnya.
  const termin = dbAll.ujPayments.filter((p) => p.trip_id === trip.id)
  const biaya = dbAll.expenses.filter((e) => e.trip_id === trip.id)
  const internal = dbAll.internalCosts.filter((c) => c.trip_id === trip.id)
  const jumlah = (xs: Array<{ amount: number }>) => xs.reduce((a, x) => a + x.amount, 0)
  const angka = {
    uj: termin.reduce((a, p) => a + p.uj_amount, 0),
    kasbon: termin.reduce((a, p) => a + p.kasbon_deduction, 0),
    tol: jumlah(biaya.filter((e) => e.expense_type === 'Tol')),
    biaya: jumlah(biaya),
    tagih: jumlah(biaya.filter(biayaDitagihkan)),
    prsh: jumlah(biaya.filter(dibayarPerusahaan)),
    internal: jumlah(internal),
  }
  const hitung = {
    uj: termin.length,
    biaya: biaya.length,
    internal: internal.length,
    lainnya: dbAll.tripNotes.filter((n) => n.trip_id === trip.id).length,
  }
  const sisaUj = trip.ujroute - angka.uj
  const namaSopir = (id: string) => dbAll.drivers.find((d) => d.id === id)?.driver_name ?? 'sopir'
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(karawang ? [{ id: 'perjalanan', label: 'Perjalanan', badge: (dbAll.tripEvents ?? []).filter((e) => e.trip_id === trip.id).length }] : []),
    { id: 'uj', label: 'Uang Jalan', badge: hitung.uj },
    { id: 'biaya', label: 'Biaya Operasional', badge: hitung.biaya },
    { id: 'internal', label: 'Biaya Internal', badge: hitung.internal },
    { id: 'lainnya', label: 'Lainnya', badge: hitung.lainnya },
  ]

  function gantiTab(t: string) {
    setTab(t as TabId)
    const p = new URLSearchParams(params)
    if (t === 'overview') p.delete('tab')
    else p.set('tab', t)
    setParams(p, { replace: true })
  }

  const arsip = batal ? ' · arsip' : ''
  const kartu: Array<{ label: string; nilai: string; ket: string; tab?: TabId; acuan?: boolean }> = [
    {
      label: 'Total UJ', nilai: formatRupiah(angka.uj), tab: 'uj',
      ket: trip.ujroute > 0 && !batal
        ? (sisaUj >= 0 ? `patokan ${formatRupiah(trip.ujroute)} · sisa ${formatRupiah(sisaUj)}` : `lebih ${formatRupiah(-sisaUj)} dari patokan`)
        : `${hitung.uj} termin${arsip}`,
    },
    {
      label: 'Tol', nilai: formatRupiah(angka.tol), tab: 'biaya', acuan: true,
      ket: trip.toll > 0 ? `patokan route ${formatRupiah(trip.toll)}` : 'dari biaya operasional jenis Tol',
    },
    { label: 'Potong Kasbon', nilai: formatRupiah(angka.kasbon), ket: `dari kasbon sopir${arsip}`, tab: 'uj' },
    { label: 'TF ke Sopir', nilai: formatRupiah(angka.uj - angka.kasbon), ket: `UJ − Potong Kasbon${arsip}`, tab: 'uj' },
    {
      label: 'Biaya Operasional', nilai: formatRupiah(angka.biaya), tab: 'biaya',
      ket: karawang
        ? `${angka.prsh > 0 ? `${formatRupiah(angka.prsh)} oleh perusahaan` : 'dari uang jalan'} · ${formatRupiah(angka.tagih)} ke klien${arsip}`
        : `${hitung.biaya} item${arsip}`,
    },
    { label: 'Biaya Internal', nilai: formatRupiah(angka.internal), ket: `${hitung.internal} item${arsip}`, tab: 'internal' },
  ]

  return (
    <>
      <PageHeader
        title={`Trip ${trip.transaction_no}`}
        description={`Berangkat ${formatDateLong(trip.transaction_date)} · ${trip.driver_names || 'tanpa sopir'} · ${trip.plate_number || 'tanpa kendaraan'}`}
        crumbs={[{ label: 'Trip / Job Order', to: '/transaksi/trip' }, { label: trip.transaction_no }]}
        actions={
          <>
            <Badge tone={STATUS_TONE[trip.status]}>{STATUS_LABEL[trip.status]}</Badge>
            <Button icon={<FaArrowLeft size={15} />} onClick={() => navigate('/transaksi/trip')}>Kembali</Button>
            <Button icon={<FaPen size={15} />} disabled={!bisaUbah} onClick={() => navigate(`/transaksi/trip/${trip.id}/edit`)}>Edit</Button>
            <Button variant="outlineDanger" icon={<FaBan size={15} />} disabled={!bisa('batal') || batal} onClick={() => setMembatalkan(true)}>
              Batalkan Trip
            </Button>
            <Button variant={bisaTutup ? 'secondary' : 'primary'} icon={<FaPrint size={15} />} onClick={() => setPrinting(true)}>
              {karawang ? 'Cetak Berita Acara' : 'Cetak Surat Jalan'}
            </Button>
            {bisaTutup && <Button variant="primary" icon={<FaFlagCheckered size={15} />} onClick={() => setMenutup(true)}>Tutup Trip</Button>}
            <OverflowMenu
              actions={[
                ...(karawang ? [{
                  label: sudahBackload ? 'Buat backload lagi' : 'Buat Backload', icon: <FaRoute size={14} />,
                  disabled: !bisaUbah || !trip.vehicle_id, onSelect: () => navigate(`/transaksi/trip/tambah?backload=${trip.id}`),
                }] : []),
                { label: 'Hapus Trip', icon: <FaTrashCan size={14} />, tone: 'danger' as const, disabled: !bisa('hapus'), onSelect: () => setMenghapus(true) },
              ]}
            />
          </>
        }
      />

      {batal && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#f3d5d5] bg-[#fdf2f2] px-4 py-3 text-[13px] text-[#8a2424]">
          <FaBan size={16} className="mt-px shrink-0 text-[#b02c2c]" />
          <div>
            <p>
              <span className="font-semibold text-[#b02c2c]">
                Trip ini dibatalkan{trip.cancelled_at ? ` pada ${formatDate(trip.cancelled_at)}` : ''}.
              </span>{' '}
              Catatannya tetap disimpan sebagai arsip (dicoret) dan tidak dihitung di laporan. Trip tidak bisa diubah lagi.
            </p>
            {trip.cancel_reason && <p className="mt-1">Alasan: {trip.cancel_reason}</p>}
            {(trip.cancel_settlement ?? []).length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-[12.5px]">
                {trip.cancel_settlement.map((x) => (
                  <li key={x.uj_payment_id}>
                    TF {formatRupiah(x.tf)} {namaSopir(x.driver_id)}: {x.cara === 'kasbon' ? 'dijadikan kasbon' : 'dikembalikan tunai'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Ringkasan finansial trip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {kartu.map((k) => (
          <button
            key={k.label}
            type="button"
            disabled={!k.tab}
            onClick={() => k.tab && gantiTab(k.tab)}
            className={cn(
              'shadow-card rounded-xl border bg-surface p-4 text-left transition-colors',
              k.acuan ? 'border-dashed border-brand-200 bg-brand-50/40' : 'border-hairline',
              k.tab && 'hover:border-brand-200',
            )}
          >
            <p className="text-[12.5px] font-medium text-ink-3">{k.label}</p>
            <p className="tnum mt-1.5 text-[19px] leading-none font-semibold tracking-tight text-ink">{k.nilai}</p>
            <p className="mt-2 truncate text-[11.5px] text-ink-3">{k.ket}</p>
          </button>
        ))}
      </div>

      <Card>
        <Tabs items={tabs} value={tab} onChange={gantiTab} className="px-2" />
        {tab === 'overview' && (karawang ? <OverviewKarawang trip={trip} /> : <TripOverview trip={trip} />)}
        {tab === 'perjalanan' && karawang && <TabPerjalanan trip={trip} bisaUbah={bisaUbah} />}
        {tab === 'uj' && <TabUangJalan trip={trip} bisaUbah={bisaUbah} />}
        {tab === 'biaya' && <TabBiaya trip={trip} bisaUbah={bisaBiaya} />}
        {tab === 'internal' && <TabInternal trip={trip} bisaUbah={bisaBiaya} />}
        {tab === 'lainnya' && <TabLainnya trip={trip} bisaUbah={bisaUbah} />}
      </Card>

      <SuratJalanPrintFlow
        notes={[trip]}
        open={printing}
        onClose={() => setPrinting(false)}
        onPrinted={(ids) => ids.forEach((i) => update('transactions', i, { printed_at: todayISO() }))}
      />

      <KonfirmasiBatalTrip trip={membatalkan ? trip : null} onClose={() => setMembatalkan(false)} />
      <KonfirmasiTutupTrip
        trip={menutup ? trip : null}
        onClose={() => setMenutup(false)}
        onClosed={(adaBackload) => adaBackload && navigate(`/transaksi/trip/tambah?backload=${trip.id}`)}
      />
      <KonfirmasiHapusTrip
        trip={menghapus ? trip : null}
        onClose={() => setMenghapus(false)}
        onDeleted={() => navigate('/transaksi/trip')}
      />
    </>
  )
}
