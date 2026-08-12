import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeDollarSign, CircleAlert, FileText, Receipt, TrendingUp, Truck, Users, Wallet,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Badge, DotLabel } from '../components/ui/Badge'
import { CardSkeleton, Skeleton } from '../components/ui/States'
import { ColumnChart } from '../components/charts/ColumnChart'
import { LineChart } from '../components/charts/LineChart'
import { RankingBars } from '../components/charts/RankingBars'
import { VIZ } from '../components/charts/chartUtils'
import { useData } from '../store/DataProvider'
import { deltaPersen, komisiTransaksi, pendapatanTransaksi, ringkas } from '../lib/calculations'
import { endOfMonthISO, formatDate, formatDateShort, formatNumber, formatRupiah, monthLabel, startOfMonthISO, todayISO } from '../lib/format'
import { groupBy } from '../lib/utils'

export function DashboardPage() {
  const { db, transactionRows, billingRows, deliveryNoteRows, loading } = useData()

  const model = useMemo(() => {
    const today = todayISO()
    const monthStart = startOfMonthISO()
    const monthEnd = endOfMonthISO()
    const prevRef = new Date()
    prevRef.setMonth(prevRef.getMonth() - 1)
    const prevStart = startOfMonthISO(prevRef)
    const prevEnd = endOfMonthISO(prevRef)

    const thisMonth = transactionRows.filter((t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd)
    const lastMonth = transactionRows.filter((t) => t.transaction_date >= prevStart && t.transaction_date <= prevEnd)
    const now = ringkas(thisMonth)
    const prev = ringkas(lastMonth)

    // Deret harian dari tanggal 1 s/d hari ini.
    const byDate = groupBy(thisMonth, (t) => t.transaction_date)
    const days: string[] = []
    for (let d = 1; d <= Number(today.slice(8, 10)); d++) {
      days.push(`${monthStart.slice(0, 8)}${String(d).padStart(2, '0')}`)
    }
    const daily = days.map((iso) => ({
      label: String(Number(iso.slice(8, 10))),
      fullLabel: formatDate(iso),
      value: (byDate[iso] ?? []).length,
    }))
    const revenue = days.map((iso) => (byDate[iso] ?? []).reduce((a, r) => a + pendapatanTransaksi(r), 0))
    const commission = days.map((iso) => (byDate[iso] ?? []).reduce((a, r) => a + komisiTransaksi(r), 0))

    // Top sopir berdasarkan jumlah ritan bulan ini.
    const perDriver = groupBy(thisMonth, (t) => t.driver_id)
    const topDrivers = Object.entries(perDriver)
      .map(([id, rows]) => ({
        id,
        label: rows[0].driver_name || 'Tanpa nama',
        meta: `${formatRupiah(rows.reduce((a, r) => a + komisiTransaksi(r), 0), { compact: true })} komisi`,
        value: rows.length,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // Data yang butuh perhatian.
    const attention = [
      {
        id: 'kont',
        label: 'Transaksi tanpa nomor container',
        count: thisMonth.filter((t) => !t.container_no).length,
        to: '/transaksi/komisi',
      },
      {
        id: 'belum-selesai',
        label: 'Transaksi belum ditandai Selesai',
        count: thisMonth.filter((t) => !t.is_done).length,
        to: '/transaksi/komisi',
      },
      {
        id: 'ditolak',
        label: 'Tagihan berstatus DITOLAK',
        count: billingRows.filter((b) => b.is_rejected).length,
        to: '/transaksi/tagihan',
      },
      {
        id: 'belum-lunas',
        label: 'Tagihan belum ada Tanggal Lunas',
        count: billingRows.filter((b) => !b.paid_date && !b.is_rejected).length,
        to: '/transaksi/tagihan',
      },
      {
        id: 'sijo-belum-komplit',
        label: 'SI / Job Order belum Komplit',
        count: db.jobOrders.filter((j) => !j.is_complete).length,
        to: '/pencarian/sijo',
      },
      {
        id: 'sj-draft',
        label: 'Surat Jalan masih Draft (belum dicetak)',
        count: deliveryNoteRows.filter((n) => !n.printed_at).length,
        to: '/transaksi/surat-jalan',
      },
    ].filter((a) => a.count > 0)

    return { now, prev, daily, days, revenue, commission, topDrivers, attention, thisMonth }
  }, [transactionRows, billingRows, deliveryNoteRows, db.jobOrders])

  const recentTrx = useMemo(
    () => [...transactionRows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.transaction_no.localeCompare(a.transaction_no)).slice(0, 6),
    [transactionRows],
  )
  const recentBilling = useMemo(
    () => [...billingRows].sort((a, b) => b.billing_date.localeCompare(a.billing_date)).slice(0, 6),
    [billingRows],
  )
  const recentSijo = useMemo(() => [...db.jobOrders].slice(-6).reverse(), [db.jobOrders])

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Ringkasan aktivitas SIKOTIS bulan berjalan." />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} height="h-[104px]" />)}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-xl xl:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </>
    )
  }

  const { now, prev, daily, days, revenue, commission, topDrivers, attention } = model

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan aktivitas operasional PT Bimajaya Mustika — periode ${monthLabel(todayISO())}.`}
        actions={
          <Link to="/laporan/komisi">
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline bg-surface px-3.5 text-[13px] font-medium text-ink transition hover:bg-sunken">
              Buka laporan bulan ini
              <ArrowRight size={14} />
            </span>
          </Link>
        }
      />

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Transaksi Bulan Ini"
          value={formatNumber(now.transaksi)}
          icon={<Truck size={15} />}
          delta={deltaPersen(now.transaksi, prev.transaksi)}
        />
        <StatCard
          label="Total Komisi Bulan Ini"
          value={formatRupiah(now.komisi, { compact: true })}
          icon={<BadgeDollarSign size={15} />}
          delta={deltaPersen(now.komisi, prev.komisi)}
        />
        <StatCard
          label="Total Pendapatan"
          value={formatRupiah(now.pendapatan, { compact: true })}
          icon={<Wallet size={15} />}
          delta={deltaPersen(now.pendapatan, prev.pendapatan)}
        />
        <StatCard
          label="Pendapatan Netto"
          value={formatRupiah(now.netto, { compact: true })}
          icon={<TrendingUp size={15} />}
          delta={deltaPersen(now.netto, prev.netto)}
        />
        <StatCard
          label="Total Sopir Aktif"
          value={formatNumber(db.drivers.filter((d) => d.status === 'aktif').length)}
          icon={<Users size={15} />}
          hint={`dari ${db.drivers.length} sopir terdaftar`}
        />
        <StatCard
          label="Total SI / Job Order"
          value={formatNumber(db.jobOrders.length)}
          icon={<FileText size={15} />}
          hint={`${db.jobOrders.filter((j) => j.is_complete).length} sudah Komplit`}
        />
      </div>

      {/* Grafik */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Jumlah transaksi per hari"
            subtitle={`${monthLabel(todayISO())} — tanggal 1 s/d hari ini`}
            actions={<Badge tone="brand">{formatNumber(now.transaksi)} transaksi</Badge>}
          />
          <div className="px-3 pt-3 pb-2">
            <ColumnChart data={daily} height={208} valueSuffix=" transaksi" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Top Sopir — jumlah ritan"
            subtitle="Bulan berjalan"
            actions={
              <Link to="/laporan/ritan" className="text-[12px] font-medium text-brand-600 hover:underline">
                Cek Ritan
              </Link>
            }
          />
          <div className="p-4">
            {topDrivers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-ink-3">Belum ada transaksi bulan ini.</p>
            ) : (
              <RankingBars rows={topDrivers} unit="ritan" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Pendapatan dan komisi harian"
            subtitle="Keduanya dalam Rupiah pada satu sumbu"
            actions={
              <div className="flex items-center gap-3">
                <DotLabel color={VIZ.series1}>Pendapatan</DotLabel>
                <DotLabel color={VIZ.series2}>Komisi</DotLabel>
              </div>
            }
          />
          <div className="px-3 pt-3 pb-2">
            <LineChart
              labels={days.map((d) => formatDateShort(d))}
              series={[
                { name: 'Pendapatan', color: VIZ.series1, values: revenue },
                { name: 'Komisi', color: VIZ.series2, values: commission },
              ]}
              height={214}
            />
          </div>
          <p className="border-t border-hairline px-4 py-2 text-[11.5px] text-ink-3">
            Angka memakai formula sementara <span className="font-semibold text-ink-2">TBD-02</span> dan{' '}
            <span className="font-semibold text-ink-2">TBD-01</span> — lihat halaman Tools.
          </p>
        </Card>

        <Card>
          <CardHeader title="Perlu perhatian" subtitle="Data yang belum lengkap atau tertahan" />
          <div className="p-2">
            {attention.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-3">Semua data sudah lengkap.</p>
            ) : (
              <ul className="space-y-1">
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={a.to}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-sunken"
                    >
                      <CircleAlert size={15} className="shrink-0 text-[color:var(--color-warning)]" />
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{a.label}</span>
                      <span className="tnum shrink-0 rounded-full bg-[#fff8e6] px-2 py-0.5 text-[12px] font-semibold text-[#8a6100]">
                        {a.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Daftar terbaru */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Transaksi terbaru"
            actions={<Link to="/transaksi/komisi" className="text-[12px] font-medium text-brand-600 hover:underline">Lihat semua</Link>}
          />
          <ul className="divide-y divide-grid">
            {recentTrx.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="tnum text-[12.5px] font-semibold text-ink">{t.transaction_no}</span>
                    <span className="text-[11.5px] text-ink-3">{formatDate(t.transaction_date)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {t.driver_name} &middot; {t.plate_number} &middot; {t.route_code}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[12.5px] font-semibold text-ink">{formatRupiah(t.route_price, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Tagihan terbaru"
            actions={<Link to="/transaksi/tagihan" className="text-[12px] font-medium text-brand-600 hover:underline">Lihat semua</Link>}
          />
          <ul className="divide-y divide-grid">
            {recentBilling.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                <Receipt size={15} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="tnum text-[12.5px] font-semibold text-ink">{b.invoice_no}</span>
                    <span className="tnum text-[11.5px] text-ink-3">Sijo {b.sijo}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                    {b.cost_code} &middot; {formatDate(b.billing_date)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[12.5px] font-semibold text-ink">{formatRupiah(b.amount, { compact: true })}</span>
                  {b.is_rejected ? (
                    <Badge tone="critical" className="mt-0.5">DITOLAK</Badge>
                  ) : b.paid_date ? (
                    <Badge tone="good" className="mt-0.5">Lunas</Badge>
                  ) : (
                    <Badge tone="warning" className="mt-0.5">Belum lunas</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="SI / Job Order terbaru"
            actions={<Link to="/pencarian/sijo" className="text-[12px] font-medium text-brand-600 hover:underline">Cari SI/JO</Link>}
          />
          <ul className="divide-y divide-grid">
            {recentSijo.map((j) => (
              <li key={j.id}>
                <Link to={`/pencarian/sijo?sijo=${j.sijo}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="tnum text-[12.5px] font-semibold text-brand-700">{j.sijo}</span>
                      <span className="text-[11.5px] text-ink-3">{j.customer_code}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-3">{j.customer_name}</span>
                  </span>
                  {j.is_complete ? <Badge tone="good">Komplit</Badge> : <Badge tone="neutral">Belum</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-4 text-[11.5px] text-ink-3">
        Seluruh angka pada dashboard berasal dari data dummy dan formula sementara. Ganti implementasi di{' '}
        <code className="rounded bg-sunken px-1 py-0.5 text-[11px]">src/lib/calculations.ts</code> setelah formula resmi tersedia.
      </p>
    </>
  )
}
