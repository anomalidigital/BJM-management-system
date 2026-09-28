import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ban, Pencil, Printer, Trash2 } from 'lucide-react'
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
import { STATUS_LABEL, STATUS_TONE } from './trip/status'
import { KonfirmasiBatalTrip, KonfirmasiHapusTrip } from './trip/KonfirmasiTrip'
import { TripOverview } from './trip/TripOverview'
import { TabUangJalan } from './trip/TabUangJalan'
import { TabBiaya } from './trip/TabBiaya'
import { TabInternal } from './trip/TabInternal'
import { TabLainnya } from './trip/TabLainnya'

const TAB_IDS = ['overview', 'uj', 'biaya', 'internal', 'lainnya'] as const
type TabId = (typeof TAB_IDS)[number]

/**
 * Detail Trip: dokumen Surat Jalan dan seluruh catatan keuangan perjalanan
 * (dulu terpisah di Surat Jalan dan Data Pengeluaran).
 */
export function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { dbAll, transactionRows, loading, update } = useData()
  const { canEdit } = useAuth()

  const awal = params.get('tab')
  const [tab, setTab] = useState<TabId>(TAB_IDS.includes(awal as TabId) ? (awal as TabId) : 'overview')
  const [printing, setPrinting] = useState(false)
  const [membatalkan, setMembatalkan] = useState(false)
  const [menghapus, setMenghapus] = useState(false)

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
        <PageHeader title="Memuat trip..." crumbs={[{ label: 'Transaksi' }, { label: 'Trip' }]} />
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
        <PageHeader title="Trip tidak ditemukan" crumbs={[{ label: 'Transaksi' }, { label: 'Trip' }]} />
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
  const bisaUbah = canEdit && !batal

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
    { label: 'Biaya Operasional', nilai: formatRupiah(angka.biaya), ket: `${hitung.biaya} item${arsip}`, tab: 'biaya' },
    { label: 'Biaya Internal', nilai: formatRupiah(angka.internal), ket: `${hitung.internal} item${arsip}`, tab: 'internal' },
  ]

  return (
    <>
      <PageHeader
        title={`Trip ${trip.transaction_no}`}
        description={`${formatDateLong(trip.transaction_date)} · ${trip.driver_names || 'tanpa sopir'} · ${trip.plate_number || 'tanpa kendaraan'}`}
        crumbs={[{ label: 'Transaksi' }, { label: 'Trip', to: '/transaksi/trip' }, { label: trip.transaction_no }]}
        actions={
          <>
            <Badge tone={STATUS_TONE[trip.status]}>{STATUS_LABEL[trip.status]}</Badge>
            <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/transaksi/trip')}>Kembali</Button>
            <Button icon={<Pencil size={15} />} disabled={!bisaUbah} onClick={() => navigate(`/transaksi/trip/${trip.id}/edit`)}>Edit</Button>
            <Button variant="outlineDanger" icon={<Ban size={15} />} disabled={!bisaUbah} onClick={() => setMembatalkan(true)}>
              Batalkan Trip
            </Button>
            <Button variant="primary" icon={<Printer size={15} />} onClick={() => setPrinting(true)}>Cetak Surat Jalan</Button>
            <OverflowMenu
              actions={[{ label: 'Hapus Trip', icon: <Trash2 size={14} />, tone: 'danger', disabled: !canEdit, onSelect: () => setMenghapus(true) }]}
            />
          </>
        }
      />

      {batal && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#f3d5d5] bg-[#fdf2f2] px-4 py-3 text-[13px] text-[#8a2424]">
          <Ban size={16} className="mt-px shrink-0 text-[#b02c2c]" />
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
      <div className="mb-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
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
        {tab === 'overview' && <TripOverview trip={trip} />}
        {tab === 'uj' && <TabUangJalan trip={trip} bisaUbah={bisaUbah} />}
        {tab === 'biaya' && <TabBiaya trip={trip} bisaUbah={bisaUbah} />}
        {tab === 'internal' && <TabInternal trip={trip} bisaUbah={bisaUbah} />}
        {tab === 'lainnya' && <TabLainnya trip={trip} bisaUbah={bisaUbah} />}
      </Card>

      <SuratJalanPrintFlow
        notes={[trip]}
        open={printing}
        onClose={() => setPrinting(false)}
        onPrinted={(ids) => ids.forEach((i) => update('transactions', i, { printed_at: todayISO() }))}
      />

      <KonfirmasiBatalTrip trip={membatalkan ? trip : null} onClose={() => setMembatalkan(false)} />
      <KonfirmasiHapusTrip
        trip={menghapus ? trip : null}
        onClose={() => setMenghapus(false)}
        onDeleted={() => navigate('/transaksi/trip')}
      />
    </>
  )
}
