import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FaArrowLeft, FaBan, FaClipboardCheck, FaFlagCheckered, FaPen, FaPrint, FaRoute, FaTrashCan, FaWarehouse } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import type { Crumb } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { OverflowMenu } from '../components/ui/Menu'
import type { MenuAction } from '../components/ui/Menu'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { formatDate, formatDateLong, formatRupiah, todayISO } from '../lib/format'
import { cn } from '../lib/utils'
import { biayaDitagihkan, dibayarPerusahaan } from '../lib/trip'
import { STATUS_LABEL, STATUS_TONE, bisaDitutup } from './trip/status'
import { KonfirmasiBatalTrip, KonfirmasiHapusTrip } from './trip/KonfirmasiTrip'
import { TripOverview } from './trip/TripOverview'
import { TabUangJalan } from './trip/TabUangJalan'
import { TabBiaya } from './trip/TabBiaya'
import { TabInternal } from './trip/TabInternal'
import { TabLainnya } from './trip/TabLainnya'
import { TabPerjalanan } from './trip/TabPerjalanan'
import { OverviewKarawang } from './trip/OverviewKarawang'
import { KonfirmasiTutupTrip } from './trip/TutupTrip'
import { ModalRekapTrip } from './trip/RekapTrip'

/** Nama tab di URL (?tab=). Tab "lainnya" berlabel Dokumen, "internal" berlabel Komisi; kuncinya tetap. */
const TAB_IDS = ['overview', 'perjalanan', 'uj', 'biaya', 'internal', 'lainnya'] as const
type TabId = (typeof TAB_IDS)[number]

/** Tab di Laporan -> Pengeluaran yang bisa membuka detail trip ini. */
const TAB_PENGELUARAN = { trip: 'Per Trip', uj: 'Uang Jalan', biaya: 'Biaya Operasional' } as const
type TabPengeluaran = keyof typeof TAB_PENGELUARAN

/** Asal halaman bila dibuka dari Pengeluaran: tab dan periodenya, untuk breadcrumb & tombol Kembali. */
interface AsalPengeluaran {
  tab: TabPengeluaran
  awal: string
  akhir: string
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/** Baca ?dari=pengeluaran&dari_tab=..&awal=yyyy-mm-dd&akhir=yyyy-mm-dd; null bila bukan dari Pengeluaran. */
function bacaAsal(p: URLSearchParams): AsalPengeluaran | null {
  if (p.get('dari') !== 'pengeluaran') return null
  const tab = p.get('dari_tab') ?? ''
  const tanggal = (k: string) => {
    const v = p.get(k) ?? ''
    return POLA_TANGGAL.test(v) ? v : ''
  }
  return { tab: Object.hasOwn(TAB_PENGELUARAN, tab) ? (tab as TabPengeluaran) : 'trip', awal: tanggal('awal'), akhir: tanggal('akhir') }
}

const kunciAsal = (a: AsalPengeluaran) => `${a.tab}|${a.awal}|${a.akhir}`

/** Alamat Pengeluaran di tab (Per Trip tanpa ?tab) dan periode yang sama. */
function alamatPengeluaran(a: AsalPengeluaran, denganTab = true): string {
  const p = new URLSearchParams()
  if (denganTab && a.tab !== 'trip') p.set('tab', a.tab)
  if (a.awal) p.set('awal', a.awal)
  if (a.akhir) p.set('akhir', a.akhir)
  const q = p.toString()
  return `/laporan/pengeluaran${q ? `?${q}` : ''}`
}

/**
 * Detail Trip: dokumen Surat Jalan dan seluruh catatan keuangan perjalanan
 * (dulu terpisah di Surat Jalan dan Data Pengeluaran). Trip Karawang punya tab
 * Perjalanan, Tutup Trip (POD, backload / rute lanjutan, pool), dan Berita Acara
 * sebagai dokumen cetak. Tab yang terbuka selalu mengikuti ?tab= di URL, jadi tab
 * lain bisa memindahkan tab lewat URL (mis. ?tab=uj&tambah=uang_dorong).
 */
export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { dbAll, transactionRows, loading, update, tandaiDiPool } = useData()
  const { bisa } = useAuth()
  const toast = useToast()

  const [printing, setPrinting] = useState(false)
  const [membatalkan, setMembatalkan] = useState(false)
  const [menghapus, setMenghapus] = useState(false)
  const [menutup, setMenutup] = useState(false)
  const [rekap, setRekap] = useState(false)

  // Asal dari Pengeluaran diingat per trip: bila URL diganti tab lain tanpa ?dari=,
  // breadcrumb dan tombol Kembali tetap menuju Pengeluaran yang sama.
  const asalUrl = bacaAsal(params)
  const [ingatAsal, setIngatAsal] = useState<{ id: string; asal: AsalPengeluaran } | null>(null)
  if (asalUrl && id && (ingatAsal?.id !== id || kunciAsal(ingatAsal.asal) !== kunciAsal(asalUrl))) setIngatAsal({ id, asal: asalUrl })
  const asal = asalUrl ?? (ingatAsal && ingatAsal.id === id ? ingatAsal.asal : null)
  const kembaliKe = asal ? alamatPengeluaran(asal) : '/transaksi/trip'
  const crumbs = (label?: string): Crumb[] => [
    ...(asal
      ? [{ label: 'Laporan' }, { label: 'Pengeluaran', to: alamatPengeluaran(asal, false) }, { label: TAB_PENGELUARAN[asal.tab], to: alamatPengeluaran(asal) }]
      : [{ label: 'Trip / Job Order', to: '/transaksi/trip' }]),
    ...(label ? [{ label }] : []),
  ]

  const trip = transactionRows.find((t) => t.id === id)

  // Datang dari "Simpan & Cetak" -> langsung buka pengaturan cetak.
  useEffect(() => {
    if (params.get('print') === '1' && trip) {
      setPrinting(true)
      const p = new URLSearchParams(params)
      p.delete('print')
      setParams(p, { replace: true })
    }
  }, [params, trip, setParams])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat trip..." crumbs={crumbs()} />
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
        <PageHeader title="Trip tidak ditemukan" crumbs={crumbs()} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Trip mungkin sudah dihapus, atau milik workspace lain.</p>
            <Button className="mt-4" onClick={() => navigate(kembaliKe)}>{asal ? 'Kembali ke Pengeluaran' : 'Kembali ke daftar'}</Button>
          </div>
        </Card>
      </>
    )
  }

  const batal = trip.status === 'batal'
  const karawang = trip.workspace === 'karawang'
  const bisaUbah = bisa('trip') && !batal
  /** Tutup Trip: trip yang masih jalan. Backload / rute lanjutan: mobil & supir trip ini lanjut dari lokasi bongkar. */
  const bisaTutup = karawang && bisaUbah && bisaDitutup(trip.status)
  /** Trip sudah selesai tetapi mobilnya belum tercatat kembali di pool: mobil belum bisa dipakai trip lain. */
  const belumDiPool = karawang && trip.status === 'selesai' && trip.menahan_kendaraan
  /** Biaya tambahan (operasional & internal) hanya Owner & Manager. */
  const bisaBiaya = bisa('biaya') && !batal

  // Catatan dibaca dari seluruh data: untuk trip batal, ini arsipnya.
  const termin = dbAll.ujPayments.filter((p) => p.trip_id === trip.id)
  const biaya = dbAll.expenses.filter((e) => e.trip_id === trip.id)
  const internal = dbAll.internalCosts.filter((c) => c.trip_id === trip.id)
  const jumlah = (xs: Array<{ amount: number }>) => xs.reduce((a, x) => a + x.amount, 0)
  const biayaTagih = biaya.filter(biayaDitagihkan)
  const angka = {
    uj: termin.reduce((a, p) => a + p.uj_amount, 0),
    kasbon: termin.reduce((a, p) => a + p.kasbon_deduction, 0),
    tol: jumlah(biaya.filter((e) => e.expense_type === 'Tol')),
    biaya: jumlah(biaya),
    tagih: jumlah(biayaTagih),
    prsh: jumlah(biaya.filter(dibayarPerusahaan)),
    internal: jumlah(internal),
    /** Pembayaran komisi yang sudah dicatat (jenis Komisi) dan biaya internal lain (uang makan, kernet, ...). */
    komisiDibayar: jumlah(internal.filter((c) => c.cost_type === 'Komisi')),
    internalLain: jumlah(internal.filter((c) => c.cost_type !== 'Komisi')),
  }
  const hitung = {
    uj: termin.length,
    biaya: biaya.length,
    internal: internal.length,
    lainnya: dbAll.tripNotes.filter((n) => n.trip_id === trip.id).length,
  }
  // Patokan UJ Rute hanya dibandingkan dengan termin jenis uang jalan biasa; uang dorong,
  // uang pulang, dan tambahan memang di luar patokan (sama dengan aturan tab Uang Jalan).
  const ujBiasa = termin.filter((p) => (p.jenis ?? 'uj') === 'uj').reduce((a, p) => a + p.uj_amount, 0)
  const sisaUj = trip.ujroute - ujBiasa
  const namaSupir = (id: string) => dbAll.drivers.find((d) => d.id === id)?.driver_name ?? 'supir'
  const tabs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: 'overview', label: 'Overview' },
    ...(karawang ? [{ id: 'perjalanan' as const, label: 'Perjalanan', badge: (dbAll.tripEvents ?? []).filter((e) => e.trip_id === trip.id).length }] : []),
    { id: 'uj', label: 'Uang Jalan', badge: hitung.uj },
    { id: 'biaya', label: 'Biaya Operasional', badge: hitung.biaya },
    // Atasan 13 Okt 2026: "biaya internal diubah ke Komisi" (komisi supir & manager + biaya internal lain).
    { id: 'internal', label: 'Komisi', badge: hitung.internal },
    { id: 'lainnya', label: 'Dokumen', badge: hitung.lainnya },
  ]
  // Tab mengikuti URL; nama tab yang tidak dikenal (atau Perjalanan di trip Priok) kembali ke Overview.
  const tabUrl = params.get('tab')
  const tab: TabId = tabs.find((t) => t.id === tabUrl)?.id ?? 'overview'

  function gantiTab(t: string) {
    const p = new URLSearchParams(params)
    if (t === 'overview') p.delete('tab')
    else p.set('tab', t)
    // "tambah" adalah perintah sekali pakai untuk tab tujuannya, jangan terbawa ke tab lain.
    p.delete('tambah')
    setParams(p, { replace: true })
  }

  function tandaiPool() {
    if (!trip) return
    tandaiDiPool(trip.id)
    toast.success(`Mobil ${trip.plate_number || `Trip ${trip.id_tampil}`} tercatat kembali di pool dan bisa dipakai trip lain.`)
  }

  const arsip = batal ? ' · arsip' : ''
  const kartu: Array<{ label: string; nilai: string; ket: string; tab?: TabId; acuan?: boolean }> = [
    {
      label: 'Total UJ', nilai: formatRupiah(angka.uj), tab: 'uj',
      ket: trip.ujroute > 0 && !batal
        ? (sisaUj >= 0 ? `patokan ${formatRupiah(trip.ujroute)} · sisa ${formatRupiah(sisaUj)}` : `lebih ${formatRupiah(-sisaUj)} dari patokan`)
        : `${hitung.uj} termin${arsip}`,
    },
    karawang
      // Karawang: biaya operasional yang ikut ditagihkan ke klien (biaya tambahan di PI).
      ? {
        label: 'Ditagihkan ke klien', nilai: formatRupiah(trip.biaya_ditagihkan), tab: 'biaya',
        ket: batal
          ? (angka.tagih > 0 ? `arsip ${formatRupiah(angka.tagih)}, tidak ditagihkan` : 'trip batal tidak ditagihkan')
          : biayaTagih.length ? `${biayaTagih.length} biaya ikut ke PI` : 'belum ada biaya yang ditagihkan',
      }
      : {
        label: 'Tol', nilai: formatRupiah(angka.tol), tab: 'biaya', acuan: true,
        ket: trip.toll > 0 ? `patokan rute ${formatRupiah(trip.toll)}` : 'dari biaya operasional jenis Tol',
      },
    { label: 'Potong Kasbon', nilai: formatRupiah(angka.kasbon), ket: `dari kasbon supir${arsip}`, tab: 'uj' },
    { label: 'TF ke Supir', nilai: formatRupiah(angka.uj - angka.kasbon), ket: `UJ − Potong Kasbon${arsip}`, tab: 'uj' },
    {
      label: 'Biaya Operasional', nilai: formatRupiah(angka.biaya), tab: 'biaya',
      ket: karawang
        ? `${angka.prsh > 0 ? `${formatRupiah(angka.prsh)} oleh perusahaan` : 'dari uang jalan'} · ${formatRupiah(angka.tagih)} ke klien${arsip}`
        : `${hitung.biaya} item${arsip}`,
    },
    {
      label: 'Komisi', nilai: formatRupiah(batal ? 0 : trip.komisi_sopir + trip.komisi_manager), tab: 'internal',
      // Pembayaran komisi dan biaya internal lain disebut terpisah supaya uang makan / kernet tidak terbaca sebagai komisi.
      ket: batal ? 'trip batal' : [
        angka.komisiDibayar > 0 ? `dibayar ${formatRupiah(angka.komisiDibayar)}` : 'dari Aturan Komisi',
        angka.internalLain > 0 ? `biaya internal lain ${formatRupiah(angka.internalLain)}` : '',
      ].filter(Boolean).join(' · ') + arsip,
    },
  ]

  const menuLain: MenuAction[] = [
    ...(karawang ? [
      { label: 'Rekap Trip', icon: <FaClipboardCheck size={14} />, onSelect: () => setRekap(true) },
      {
        label: 'Ada Backload / Lanjutan', icon: <FaRoute size={14} />,
        disabled: !bisaUbah || !trip.vehicle_id, onSelect: () => navigate(`/transaksi/trip/tambah?backload=${trip.id}`),
      },
    ] : []),
    ...(belumDiPool ? [{ label: 'Tandai mobil di pool', icon: <FaWarehouse size={14} />, disabled: !bisa('trip'), onSelect: tandaiPool }] : []),
    { label: 'Hapus Trip', icon: <FaTrashCan size={14} />, tone: 'danger', disabled: !bisa('hapus'), onSelect: () => setMenghapus(true) },
  ]

  return (
    <>
      <PageHeader
        title={`Trip ${trip.id_tampil}`}
        description={`Berangkat ${formatDateLong(trip.transaction_date)} · ${trip.driver_names || 'tanpa supir'} · ${trip.plate_number || 'tanpa kendaraan'}`}
        crumbs={crumbs(trip.id_tampil)}
        actions={
          <>
            <Badge tone={STATUS_TONE[trip.status]}>{STATUS_LABEL[trip.status]}</Badge>
            <Button icon={<FaArrowLeft size={15} />} onClick={() => navigate(kembaliKe)}>Kembali</Button>
            <Button icon={<FaPen size={15} />} disabled={!bisaUbah} onClick={() => navigate(`/transaksi/trip/${trip.id}/edit`)}>Edit</Button>
            <Button variant="outlineDanger" icon={<FaBan size={15} />} disabled={!bisa('batal') || batal || !!trip.pi_number} onClick={() => setMembatalkan(true)}
              title={trip.pi_number && !batal ? `Sudah ditagih lewat PI ${trip.pi_number}: trip yang sudah ditagih tidak bisa dibatalkan.` : undefined}>
              Batalkan Trip
            </Button>
            <Button variant={bisaTutup ? 'secondary' : 'primary'} icon={<FaPrint size={15} />} onClick={() => setPrinting(true)}>
              {karawang ? 'Cetak Berita Acara' : 'Cetak Surat Jalan'}
            </Button>
            {bisaTutup && <Button variant="primary" icon={<FaFlagCheckered size={15} />} onClick={() => setMenutup(true)}>Tutup Trip</Button>}
            <OverflowMenu actions={menuLain} />
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
                    TF {formatRupiah(x.tf)} {namaSupir(x.driver_id)}: {x.cara === 'kasbon' ? 'dijadikan kasbon' : 'dikembalikan tunai'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {belumDiPool && (
        // Aturan 12 Okt 2026: mobil baru bisa dipilih trip lain setelah tercatat kembali di pool.
        // Trip yang ditutup "ada backload" tetapi trip lanjutannya belum dibuat juga masih menahan mobilnya.
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-4 py-3 text-[13px] text-[#8a6100]">
          <p className="flex min-w-0 items-start gap-2.5">
            <FaWarehouse size={16} className="mt-px shrink-0" />
            <span>
              <span className="font-semibold">Mobil belum tercatat kembali di pool, jadi belum bisa dipakai trip lain.</span>
              {trip.ada_backload
                ? <span className="block text-[12.5px]">Trip ini ditandai ada backload / lanjutan: buat tripnya dengan mobil yang sama, atau tandai sudah di pool bila tidak jadi.</span>
                : trip.plate_number && <span className="block text-[12.5px]">{trip.plate_number} masih tertahan di trip ini sejak ditutup{trip.closed_at ? ` ${formatDate(trip.closed_at)}` : ''}.</span>}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<FaRoute size={14} />} disabled={!bisaUbah || !trip.vehicle_id} onClick={() => navigate(`/transaksi/trip/tambah?backload=${trip.id}`)}>
              Ada Backload / Lanjutan
            </Button>
            <Button size="sm" variant="primary" icon={<FaWarehouse size={14} />} disabled={!bisa('trip')} onClick={tandaiPool}>
              Tandai sudah di pool
            </Button>
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
            <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-ink-3" title={k.ket}>{k.ket}</p>
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
      <KonfirmasiTutupTrip trip={menutup ? trip : null} onClose={() => setMenutup(false)} />
      <ModalRekapTrip trip={rekap ? trip : null} onClose={() => setRekap(false)} />
      <KonfirmasiHapusTrip
        trip={menghapus ? trip : null}
        onClose={() => setMenghapus(false)}
        onDeleted={() => navigate(kembaliKe)}
      />
    </>
  )
}
