import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader, InfoItem } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { DateInput, Field, Select } from '../components/ui/Field'
import { PanelFilter, Toolbar } from '../components/ui/Toolbar'
import { LampiranThumbs } from '../components/ui/Lampiran'
import { DokumenPentingRingkas } from '../components/ui/DokumenPenting'
import { NilaiPiutang } from '../components/ui/NilaiPiutang'
import { useData } from '../store/DataProvider'
import { jenisPiutang, sisiKaryawan } from '../lib/kasbon'
import { endOfMonthISO, formatDate, formatRupiah, galatRentang, rentangTanggal, startOfMonthISO } from '../lib/format'
import { useFilter } from '../lib/useFilter'
import { cn } from '../lib/utils'
import { DOKUMEN_KARYAWAN, JENIS_PIUTANG_LABEL, KASBON_LABEL, ROLE_LABEL } from '../types'
import type { KasbonEntry } from '../types'

/** Bulan lalu: [awal, akhir]. */
function bulanLalu(): [string, string] {
  const d = new Date()
  const awal = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return [startOfMonthISO(awal), endOfMonthISO(awal)]
}

/**
 * Master -> Supir / Karyawan -> Transaksi {nama} (revisi atasan 13 Okt 2026):
 * - kartu Saldo, Piutang, Pelunasan; nilai dari sisi karyawan (piutang minus merah, pelunasan plus);
 * - tab Transaksi: daftar piutang & pelunasan dengan filter tanggal dari–sampai (saldo awal ikut
 *   dihitung supaya saldo berjalan tetap benar). Transaksinya dicatat di menu Piutang Karyawan;
 * - biaya operasional bukan tab sendiri: tampil di Overview sebagai keterangan trip yang dibawa
 *   (biayanya milik trip, dicatat di trip itu, bukan transaksi karyawan).
 */
export function KaryawanTransaksiPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, dbAll, loading } = useData()

  const [tab, setTab] = useState('overview')
  const filter = useFilter({ dari: '', sampai: '', jenis: '' })
  const { dari, sampai, jenis } = filter.nilai
  const d = filter.draf

  const orang = db.drivers.find((d) => d.id === id)
  const tripMap = useMemo(() => new Map(dbAll.transactions.map((t) => [t.id, t])), [dbAll.transactions])
  const routeMap = useMemo(() => new Map(dbAll.routes.map((r) => [r.id, r])), [dbAll.routes])

  /** Trip yang pernah dibawa karyawan ini (lintas workspace), terbaru dulu. */
  const tripSaya = useMemo(
    () => dbAll.transactions
      .filter((t) => (t.driver_ids?.length ? t.driver_ids : [t.driver_id]).includes(id ?? ''))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [dbAll.transactions, id],
  )
  /** Trip tempat karyawan ini menjadi supir utama (biaya operasionalnya dihitung untuknya). */
  const utamaDi = useMemo(() => new Set(tripSaya.filter((t) => (t.driver_ids?.[0] ?? t.driver_id) === id).map((t) => t.id)), [tripSaya, id])
  const perTrip = useMemo(() => {
    const uj = new Map<string, number>()
    const biaya = new Map<string, number>()
    for (const p of dbAll.ujPayments) uj.set(p.trip_id, (uj.get(p.trip_id) ?? 0) + p.uj_amount)
    for (const e of dbAll.expenses) biaya.set(e.trip_id, (biaya.get(e.trip_id) ?? 0) + e.amount)
    return { uj, biaya }
  }, [dbAll.ujPayments, dbAll.expenses])

  /** Seluruh mutasi karyawan ini, urut waktu. */
  const semua = useMemo(
    () => db.kasbonEntries.filter((e) => e.employee_id === id)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)),
    [db.kasbonEntries, id],
  )

  /** Mutasi dalam rentang tanggal, saldo awal (sebelum rentang), dan saldo berjalan; semua dari sisi karyawan. */
  const buku = useMemo(() => {
    let saldoAwal = 0
    const isi: Array<KasbonEntry & { nilai: number; saldo: number }> = []
    let saldo = 0
    let mulai = false
    // Mutasi urut tanggal: semua yang sebelum rentang selesai dihitung dulu sebagai saldo awal.
    for (const e of semua) {
      const nilai = sisiKaryawan(e.amount)
      if (dari && e.entry_date < dari) { saldoAwal += nilai; continue }
      if (sampai && e.entry_date > sampai) continue
      if (!mulai) { saldo = saldoAwal; mulai = true }
      saldo += nilai
      if (jenis && jenisPiutang(e) !== jenis) continue
      isi.push({ ...e, nilai, saldo })
    }
    const piutang = isi.filter((e) => e.nilai < 0).reduce((a, e) => a + e.nilai, 0)
    const lunas = isi.filter((e) => e.nilai > 0).reduce((a, e) => a + e.nilai, 0)
    // Saldo akhir rentang: semua mutasi sampai tanggal akhir (tanpa saringan jenis).
    const saldoAkhir = semua.filter((e) => !sampai || e.entry_date <= sampai).reduce((a, e) => a + sisiKaryawan(e.amount), 0)
    return { saldoAwal, isi, piutang, lunas, saldoAkhir }
  }, [semua, dari, sampai, jenis])

  if (loading) {
    return (
      <>
        <PageHeader title="Memuat karyawan..." crumbs={[{ label: 'Master Data' }, { label: 'Supir / Karyawan', to: '/master/karyawan' }]} />
        <div className="skeleton h-64 rounded-xl" />
      </>
    )
  }

  if (!orang) {
    return (
      <>
        <PageHeader title="Karyawan tidak ditemukan" crumbs={[{ label: 'Master Data' }, { label: 'Supir / Karyawan', to: '/master/karyawan' }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Karyawan mungkin sudah dihapus.</p>
            <Button className="mt-4" onClick={() => navigate('/master/karyawan')}>Kembali ke daftar</Button>
          </div>
        </Card>
      </>
    )
  }

  const adaRentang = !!(dari || sampai)
  const chips = [
    adaRentang && { label: `Tanggal ${rentangTanggal(dari, sampai)}`, lepas: () => filter.lepas('dari', 'sampai') },
    jenis && { label: jenis === 'piutang' ? 'Piutang saja' : 'Lunas saja', lepas: () => filter.lepas('jenis') },
  ]
  const teksRentang = adaRentang ? `${dari ? formatDate(dari) : 'awal'} s/d ${sampai ? formatDate(sampai) : 'hari ini'}` : 'seluruh waktu'
  const kartu = [
    {
      label: 'Saldo', nilai: buku.saldoAkhir,
      ket: buku.saldoAkhir < 0 ? `sisa piutang${sampai ? ` per ${formatDate(sampai)}` : ''}` : buku.saldoAkhir > 0 ? 'lebih bayar' : 'tidak ada piutang',
    },
    { label: 'Piutang', nilai: buku.piutang, ket: `kasbon & pembatalan trip · ${teksRentang}` },
    { label: 'Pelunasan', nilai: buku.lunas, ket: `potong uang jalan & dibayar langsung · ${teksRentang}` },
  ]

  /** Keterangan satu mutasi: sumbernya, trip yang terkait, dan catatan. */
  function keterangan(e: KasbonEntry) {
    const t = e.trip_id ? tripMap.get(e.trip_id) : undefined
    return (
      <span className="block leading-snug">
        <span className="text-ink-2">{KASBON_LABEL[e.kind] ?? e.kind}</span>
        {t ? (
          <>
            {' · '}
            <Link to={`/transaksi/trip/${t.id}${e.kind === 'trip' ? '?tab=uj' : ''}`} className="tnum font-medium text-brand-700 hover:underline">Trip {t.transaction_no}</Link>
          </>
        ) : e.trip_id ? <span className="text-ink-3"> · trip sudah dihapus</span> : null}
        {e.notes && <span className="block text-[12px] text-ink-3">{e.notes}</span>}
      </span>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'transaksi', label: 'Transaksi', badge: semua.length },
  ]
  const tripTerakhir = tripSaya.slice(0, 8)
  const biayaUtama = tripSaya.filter((t) => utamaDi.has(t.id) && t.status !== 'batal').reduce((a, t) => a + (perTrip.biaya.get(t.id) ?? 0), 0)

  return (
    <>
      <PageHeader
        title={orang.driver_name}
        description={`${orang.driver_code} · ${ROLE_LABEL[orang.role ?? 'sopir']} · ${orang.city || 'kota belum diisi'}`}
        crumbs={[{ label: 'Master Data' }, { label: 'Supir / Karyawan', to: '/master/karyawan' }, { label: orang.driver_name }]}
        actions={<Button icon={<FaArrowLeft size={15} />} onClick={() => navigate('/master/karyawan')}>Kembali</Button>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {kartu.map((k) => (
          <div key={k.label} className="shadow-card rounded-xl border border-hairline bg-surface p-4">
            <p className="text-[12.5px] font-medium text-ink-3">{k.label}</p>
            <p className="mt-1.5 text-[19px] leading-none font-semibold tracking-tight"><NilaiPiutang nilai={k.nilai} /></p>
            <p className="mt-2 text-[11.5px] text-ink-3">{k.ket}</p>
          </div>
        ))}
      </div>

      <Card>
        <Tabs items={tabs} value={tab} onChange={setTab} className="px-2" />

        {tab === 'overview' && (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-lg border border-hairline">
                <CardHeader title="Profil" />
                <dl className="grid gap-4 p-4 sm:grid-cols-2">
                  <InfoItem label="Kode" value={orang.driver_code} mono />
                  <InfoItem label="Peran" value={ROLE_LABEL[orang.role ?? 'sopir']} />
                  <InfoItem label="Telepon" value={orang.phone || '—'} mono />
                  <InfoItem label="Status" value={orang.status === 'aktif' ? 'Aktif' : 'Nonaktif'} />
                  <InfoItem label="Alamat" value={[orang.address_1, orang.address_2].filter(Boolean).join(', ') || '—'} />
                  <InfoItem label="Kota" value={orang.city || '—'} />
                </dl>
              </div>
              <div className="rounded-lg border border-hairline">
                <CardHeader title="Dokumen" subtitle="KTP, SIM, KK, NPWP, dan dokumen lainnya. Diubah lewat Ubah di Supir / Karyawan." />
                <div className="p-4">
                  <DokumenPentingRingkas jenis={DOKUMEN_KARYAWAN} dokumen={orang.dokumen} lainnya={orang.attachments ?? []}
                    kosong="Belum ada dokumen. Tambahkan lewat Ubah di Supir / Karyawan." />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-hairline">
              <CardHeader
                title="Trip & biaya operasional"
                subtitle={`${tripSaya.length} trip tercatat. Biaya operasional dicatat di trip masing-masing, bukan di sini.`}
              />
              {tripSaya.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-ink-3">Belum pernah membawa trip.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr><th>Trip</th><th className="text-right">Uang Jalan</th><th className="text-right">Biaya Operasional</th></tr>
                      </thead>
                      <tbody>
                        {tripTerakhir.map((t) => (
                          <tr key={t.id} className="cursor-pointer" onClick={() => navigate(`/transaksi/trip/${t.id}`)}>
                            <td>
                              <span className="tnum block font-semibold text-brand-700">{t.transaction_no}</span>
                              <span className="block max-w-[260px] truncate text-[12px] text-ink-3">
                                {formatDate(t.transaction_date)} · {routeMap.get(t.route_id)?.route_name ?? t.destination_detail ?? '—'}
                                {!utamaDi.has(t.id) && ' · pendamping'}
                                {t.status === 'batal' && ' · dibatalkan'}
                              </span>
                            </td>
                            <td className="tnum text-right text-ink-2">{formatRupiah(perTrip.uj.get(t.id) ?? 0)}</td>
                            <td className={cn('tnum text-right', utamaDi.has(t.id) && t.status !== 'batal' ? 'text-ink' : 'text-ink-3')}>
                              {(perTrip.biaya.get(t.id) ?? 0) ? formatRupiah(perTrip.biaya.get(t.id) ?? 0) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="text-[12px] text-ink-2">Total biaya operasional sebagai supir utama ({tripSaya.length} trip)</td>
                          <td className="tnum text-right">{formatRupiah(biayaUtama)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {tripSaya.length > tripTerakhir.length && (
                    <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">
                      Menampilkan {tripTerakhir.length} trip terakhir. Lihat semuanya di{' '}
                      <Link to={`/transaksi/trip?q=${encodeURIComponent(orang.driver_name)}`} className="font-medium text-brand-700 hover:underline">Trip / Job Order</Link>.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'transaksi' && (
          <div>
            <Toolbar
              left={
                <>
                  <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.dari, d.sampai)}>
                    <div>
                      <p className="form-label">Tanggal</p>
                      <div className="grid grid-cols-2 gap-2">
                        <DateInput value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} aria-label="Dari tanggal" />
                        <DateInput value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} aria-label="Sampai tanggal" />
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => filter.ubah({ dari: startOfMonthISO(), sampai: endOfMonthISO() })}>Bulan ini</Button>
                        <Button size="sm" variant="ghost" onClick={() => { const [a, b] = bulanLalu(); filter.ubah({ dari: a, sampai: b }) }}>Bulan lalu</Button>
                        <Button size="sm" variant="ghost" onClick={() => filter.ubah({ dari: '', sampai: '' })}>Semua</Button>
                      </div>
                    </div>
                    <Field label="Jenis">
                      {(fid) => (
                        <Select id={fid} value={d.jenis} onChange={(e) => filter.ubah({ jenis: e.target.value })}>
                          <option value="">Piutang & Lunas</option>
                          <option value="piutang">Piutang saja</option>
                          <option value="lunas">Lunas saja</option>
                        </Select>
                      )}
                    </Field>
                  </PanelFilter>
                  {!adaRentang && <span className="text-[12.5px] text-ink-3">Seluruh waktu</span>}
                </>
              }
              right={
                <Link to={`/laporan/piutang-karyawan?karyawan=${orang.id}&tambah=1`} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline">
                  Catat piutang / pelunasan di Piutang Karyawan <FaArrowRight size={11} />
                </Link>
              }
            />
            {semua.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-semibold text-ink">Belum ada transaksi piutang.</p>
                <p className="mt-1 text-[13px] text-ink-3">Piutang dan pelunasan {orang.driver_name} dicatat di menu Piutang Karyawan; potongan uang jalan tercatat otomatis dari trip.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table min-w-max">
                  <thead>
                    <tr>
                      <th>Tanggal</th><th>Jenis</th><th>Keterangan</th>
                      <th className="text-right">Piutang</th><th className="text-right">Lunas</th><th className="text-right">Saldo</th><th>Bukti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dari && (
                      <tr>
                        <td className="tnum text-ink-3">{formatDate(dari)}</td>
                        <td colSpan={4} className="text-[12.5px] text-ink-3">Saldo awal (seluruh transaksi sebelum {formatDate(dari)})</td>
                        <td className="text-right"><NilaiPiutang nilai={buku.saldoAwal} tebal /></td>
                        <td />
                      </tr>
                    )}
                    {buku.isi.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-[13px] text-ink-3">Tidak ada transaksi pada {teksRentang}.</td></tr>
                    )}
                    {buku.isi.map((e) => {
                      const j = jenisPiutang(e)
                      return (
                        <tr key={e.id} className="align-top">
                          <td className="tnum text-ink-2">{formatDate(e.entry_date)}</td>
                          <td><Badge tone={j === 'piutang' ? 'critical' : 'good'}>{JENIS_PIUTANG_LABEL[j]}</Badge></td>
                          <td className="max-w-[380px]">{keterangan(e)}</td>
                          <td className="text-right">{e.nilai < 0 ? <NilaiPiutang nilai={e.nilai} /> : ''}</td>
                          <td className="text-right">{e.nilai > 0 ? <NilaiPiutang nilai={e.nilai} /> : ''}</td>
                          <td className="text-right"><NilaiPiutang nilai={e.saldo} tebal /></td>
                          <td><LampiranThumbs ids={e.attachments ?? []} ukuran={30} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-[12px] text-ink-2">Total {buku.isi.length} transaksi · {teksRentang}</td>
                      <td className="text-right"><NilaiPiutang nilai={buku.piutang} /></td>
                      <td className="text-right"><NilaiPiutang nilai={buku.lunas} /></td>
                      <td className="text-right"><NilaiPiutang nilai={buku.saldoAkhir} tebal /></td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="border-t border-hairline px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">
              Piutang (minus) = utang karyawan bertambah, mis. kasbon. Lunas (plus) = pelunasan: dipotong dari uang jalan trip atau dibayar langsung.
              Saldo minus berarti karyawan masih punya piutang.
            </p>
          </div>
        )}
      </Card>
    </>
  )
}
