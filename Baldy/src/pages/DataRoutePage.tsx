import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { FaArrowRight, FaPen, FaPlus, FaPrint, FaTrashCan, FaTriangleExclamation, FaWandMagicSparkles, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Modal'
import { Field, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { cn, matchesQuery, sum } from '../lib/utils'
import { formatNumber, formatRupiah } from '../lib/format'
import { kodeAreaRute } from '../lib/trip'
import type { Route } from '../types'
import { FEET_OPTIONS, ModalRute } from './master/FormRute'
import { ModalRapikanKode } from './master/RapikanKodeArea'
import { bacaBukanSalahKetik, kelompokKodeMirip, pemakaianKodeArea, simpanBukanSalahKetik, sudahDitandai } from '../lib/kodeArea'

/** Baris tabel rute: rute beserta area pick up & destinasinya (dipilih di form rute, atau turunan nama lama). */
type BarisRute = Route & {
  area_asal: string
  area_tujuan: string
  /** Kunci urut kolom Kode Area, mis. "CIB → DURI". */
  area: string
  /** Area berbeda dari turunan nama rute (dipilih sendiri di form rute). */
  area_sendiri: boolean
}

const FILTER_KOSONG = { kode: '', feet: '', kira: '' }

/** Nominal rute; yang masih perkiraan diberi keterangan kecil di bawahnya. */
function Nominal({ nilai, kira, tebal }: { nilai: number; kira?: boolean; tebal?: boolean }) {
  return (
    <span className="block leading-tight">
      <span className={tebal ? 'tnum font-semibold text-ink' : 'tnum'}>{formatRupiah(nilai)}</span>
      {kira && (
        <span className="mt-0.5 block text-[11px] text-ink-3" title="Belum ada di data trip. Ganti lewat Ubah bila sudah tahu nilai sebenarnya.">
          perkiraan
        </span>
      )}
    </span>
  )
}

/** Satu kode area di kolom tabel; yang mungkin salah ketik diberi tanda kuning. */
function KodeArea({ kode, curiga }: { kode: string; curiga: boolean }) {
  if (!kode) return <span className="text-ink-3">—</span>
  if (!curiga) return <span className="text-ink">{kode}</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-[#8a6100]" title="Mirip kode area lain, mungkin salah ketik">
      <FaTriangleExclamation size={10} />
      {kode}
    </span>
  )
}

/**
 * Master Data -> Rute (revisi 13 Okt 2026): area pick up & destinasi dari Master Alamat, nama rute
 * kesimpulan keduanya, No. Rute tetap. Klien tidak lagi di rute: dipilih di form trip.
 */
export function DataRoutePage() {
  const { db, loading, error, reload, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  /** Feet = ukuran container, hanya untuk rute container Priok. Rute Karawang (alat berat) tidak memakainya. */
  const pakaiFeet = useWorkspace().workspace === 'priok'

  const [editing, setEditing] = useState<Route | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Route | null>(null)
  /** Kelompok kode area mirip yang sedang dirapikan. */
  const [rapikan, setRapikan] = useState<string[] | null>(null)
  const filter = useFilter(FILTER_KOSONG)
  const { kode: kodeFilter, feet: feetFilter, kira: kiraFilter } = filter.nilai
  const d = filter.draf
  const [preview, setPreview] = useState(false)

  const barisRute = useMemo<BarisRute[]>(() => db.routes.map((r) => {
    const k = kodeAreaRute(r)
    const dariNama = kodeAreaRute({ route_name: r.route_name })
    return {
      ...r, area_asal: k.asal, area_tujuan: k.tujuan, area: `${k.asal} → ${k.tujuan}`,
      area_sendiri: k.asal !== dariNama.asal || k.tujuan !== dariNama.tujuan,
    }
  }), [db.routes])

  /** Jumlah rute per kode area: pilihan filter dan bahan pemeriksaan salah ketik. */
  const pakai = useMemo(() => pemakaianKodeArea(db.routes), [db.routes])
  /** Pemakaian di rute & Master Alamat, untuk pilihan penulisan yang benar saat merapikan. */
  const pakaiLengkap = useMemo(() => pemakaianKodeArea(db.routes, db.alamat ?? []), [db.routes, db.alamat])
  const kodeOpsi = useMemo(() => [...pakai.entries()].sort((a, b) => a[0].localeCompare(b[0])), [pakai])
  // Kode yang sudah tidak dipakai rute mana pun (mis. baru dirapikan lewat Ubah Rute) dilepas dari filter.
  useEffect(() => {
    if (kodeFilter && !pakai.has(kodeFilter)) filter.lepas('kode')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kodeFilter, pakai])

  // Kode area yang mirip (mungkin salah ketik); kelompok yang ditandai "bukan salah ketik" disembunyikan.
  const [tanda, setTanda] = useState(bacaBukanSalahKetik)
  const semuaKelompok = useMemo(() => kelompokKodeMirip(pakai), [pakai])
  const kelompok = useMemo(() => semuaKelompok.filter((g) => !sudahDitandai(g, tanda)), [semuaKelompok, tanda])
  const jumlahDisembunyikan = semuaKelompok.length - kelompok.length
  /** Kode yang kemungkinan salah ketik: bukan kode terbanyak di kelompoknya. */
  const kodeCuriga = useMemo(() => new Set(kelompok.flatMap((g) => g.slice(1))), [kelompok])
  /** Panel kode mirip terbuka di layar lebar; di HP cukup judulnya supaya daftar rute tidak terdorong jauh ke bawah. */
  const [panelBuka, setPanelBuka] = useState(() => {
    try {
      return window.matchMedia('(min-width: 640px)').matches
    } catch {
      return true
    }
  })

  function tandaiBukanSalahKetik(g: string[]) {
    const baru = [...tanda, g]
    setTanda(baru)
    simpanBukanSalahKetik(baru)
    toast.info(`${g.join(' / ')} ditandai bukan salah ketik dan disembunyikan.`)
  }
  function tampilkanLagi() {
    setTanda([])
    simpanBukanSalahKetik([])
  }

  const search = useCallback(
    (r: BarisRute, q: string) => matchesQuery(q, r.route_code, r.route_code_lama ?? '', r.route_name, r.feet, r.area_asal, r.area_tujuan),
    [],
  )
  const extraFilter = useCallback(
    (r: BarisRute) => (!feetFilter || (feetFilter === '-' ? !r.feet : r.feet === feetFilter))
      && (!kodeFilter || r.area_asal === kodeFilter || r.area_tujuan === kodeFilter)
      && (!kiraFilter || (kiraFilter === 'ya') === (r.estimated_fields?.length ?? 0) > 0),
    [feetFilter, kodeFilter, kiraFilter],
  )
  const jumlahFilter = [feetFilter, kodeFilter, kiraFilter].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
  const table = useTable(barisRute, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'route_code', pageSize: 10,
  })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const chips = [
    kodeFilter && { label: `Area: ${kodeFilter}`, lepas: () => filter.lepas('kode') },
    pakaiFeet && feetFilter && { label: `Feet: ${feetFilter === '-' ? 'belum diisi' : feetFilter}`, lepas: () => filter.lepas('feet') },
    kiraFilter && { label: kiraFilter === 'ya' ? 'Nominal masih perkiraan' : 'Nominal sudah pasti', lepas: () => filter.lepas('kira') },
  ]

  /** Klik kode di panel kode mirip: tampilkan rutenya (klik lagi untuk melepas). Langsung berlaku. */
  function pilihKode(k: string) {
    filter.atur({ kode: kodeFilter === k ? '' : k })
    table.setPage(1)
  }

  function openCreate() {
    setEditing(null); setFormOpen(true)
  }

  function openEdit(r: BarisRute) {
    // Form menerima rute aslinya, tanpa kolom bantu tabel.
    setEditing(db.routes.find((x) => x.id === r.id) ?? r); setFormOpen(true)
  }

  function onDelete() {
    if (!deleting) return
    const used = db.transactions.filter((t) => t.route_id === deleting.id).length
    remove('routes', deleting.id)
    toast.success(used > 0 ? `Data berhasil dihapus. ${used} trip terkait kehilangan referensi rute.` : 'Data berhasil dihapus.')
    setDeleting(null)
  }

  const printRows = table.filtered
  const jumlahKira = db.routes.filter((r) => (r.estimated_fields?.length ?? 0) > 0).length

  const columns: Column<BarisRute>[] = [
    {
      key: 'route_code', header: 'No. Rute', sortable: true, width: '150px',
      render: (r) => (
        <span className="block leading-tight">
          <span className="tnum font-semibold break-all text-ink">{r.route_code}</span>
          {r.route_code_lama && (
            <span className="tnum mt-0.5 block text-[11px] text-ink-3" title="No. Rute dari aplikasi lama, sebelum dirapikan supaya tidak mirip rute lain. Masih bisa dicari.">
              dulu {r.route_code_lama}
            </span>
          )}
        </span>
      ),
    },
    { key: 'route_name', header: 'Nama Rute', sortable: true, render: (r) => <span className="font-medium">{r.route_name}</span> },
    {
      key: 'area', header: 'Area Pick Up → Destinasi', sortable: true, width: '200px',
      render: (r) => (
        <span className="block leading-tight">
          <span className="inline-flex flex-wrap items-center gap-1 text-[12.5px] font-medium">
            <KodeArea kode={r.area_asal} curiga={kodeCuriga.has(r.area_asal)} />
            <FaArrowRight size={10} className="text-ink-3" />
            <KodeArea kode={r.area_tujuan} curiga={kodeCuriga.has(r.area_tujuan)} />
          </span>
          {r.area_sendiri && (
            <span className="mt-0.5 block text-[11px] text-ink-3" title="Area dipilih di form rute dan berbeda dari nama rute.">
              beda dari nama rute
            </span>
          )}
        </span>
      ),
    },
    ...(pakaiFeet ? [{ key: 'feet', header: 'Feet', sortable: true, width: '86px', render: (r: BarisRute) => (r.feet ? <Badge tone="neutral">{r.feet}</Badge> : <span className="text-ink-3">—</span>) }] : []),
    { key: 'ujroute', header: 'UJ Rute', sortable: true, align: 'right', width: '128px', render: (r) => <Nominal nilai={r.ujroute} kira={r.estimated_fields?.includes('ujroute')} /> },
    { key: 'toll', header: 'Uang Tol', sortable: true, align: 'right', width: '128px', render: (r) => <Nominal nilai={r.toll ?? 0} kira={r.estimated_fields?.includes('toll')} /> },
    { key: 'price', header: 'Harga', sortable: true, align: 'right', width: '134px', render: (r) => <Nominal nilai={r.price} kira={r.estimated_fields?.includes('price')} tebal /> },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(r)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(r)} />
        </div>
      ),
    },
  ]
  /** Baris total: label menutup semua kolom sebelum UJ Rute, supaya jumlahnya tepat di bawah kolomnya. */
  const kolomSebelumUj = columns.findIndex((c) => c.key === 'ujroute')

  if (preview) {
    const kolomCetak = ['No.', 'No. Rute', 'Nama Rute', 'Area', ...(pakaiFeet ? ['Feet'] : []), 'UJ Rute', 'Uang Tol', 'Harga']
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const printPages = chunkRows(printRows, barisPerLembar(orientasi, 24))
          return (
        <PrintDocument>
          {printPages.map((rows, i) => (
            <PrintPage
              key={i}
              page={i + 1}
              totalPages={printPages.length}
              title="Daftar Rute"
              subtitle={[
                pakaiFeet && feetFilter ? `Feet: ${feetFilter}` : '',
                kodeFilter ? `Area: ${kodeFilter}` : '',
              ].filter(Boolean).join(' · ') || 'Seluruh rute terdaftar'}
              meta={[
                { label: 'Jumlah rute', value: `${formatNumber(printRows.length)} rute` },
                { label: 'Total Harga', value: formatRupiah(sum(printRows, (r) => r.price)) },
                { label: 'Total Uang Tol', value: formatRupiah(sum(printRows, (r) => r.toll ?? 0)) },
              ]}
            >
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-neutral-100">
                    {kolomCetak.map((h) => (
                      <th key={h} className={`border border-neutral-400 px-1.5 py-1 font-semibold ${['UJ Rute', 'Uang Tol', 'Harga'].includes(h) ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={r.id}>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{i * 24 + ri + 1}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 font-medium">{r.route_code}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{r.route_name}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 whitespace-nowrap">{r.area_asal || '—'} → {r.area_tujuan || '—'}</td>
                      {pakaiFeet && <td className="border border-neutral-400 px-1.5 py-1">{r.feet || '—'}</td>}
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.ujroute)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.toll ?? 0)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.price)}</td>
                    </tr>
                  ))}
                  {i === printPages.length - 1 && (
                    <tr className="bg-neutral-100 font-bold">
                      <td className="border border-neutral-400 px-1.5 py-1 text-right" colSpan={kolomCetak.length - 3}>TOTAL</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.ujroute))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.toll ?? 0))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.price))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </PrintPage>
          ))}
        </PrintDocument>
          )
        }}
      </ReportPreview>
    )
  }

  return (
    <>
      <PageHeader
        title="Rute"
        crumbs={[{ label: 'Master Data' }, { label: 'Rute' }]}
        description="Area pick up & destinasi diambil dari Master Alamat; nama rute kesimpulan keduanya. Klien dipilih di form trip. Nominal yang belum ada di data trip bertanda perkiraan."
        actions={
          <>
            <Button icon={<FaPrint size={15} />} onClick={() => setPreview(true)}>Cetak</Button>
            <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Rute</Button>
          </>
        }
      />

      {!loading && !error && kelompok.length > 0 && (
        <section aria-label="Kode area mirip" className="mb-4 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] text-[#8a6100]">
          <div className="flex items-start gap-2">
            <FaTriangleExclamation size={15} className="mt-px shrink-0" />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">Kode area mirip, mungkin salah ketik</span> ({kelompok.length} kelompok).
              {panelBuka && (
                <>
                  {canEdit
                    ? ' Klik Rapikan untuk menyatukan penulisannya di semua rute & alamat sekaligus, atau klik kode untuk melihat rutenya.'
                    : ' Klik kode untuk melihat rutenya. Perapian dilakukan Manager atau Owner.'}
                </>
              )}
            </p>
            <button type="button" aria-expanded={panelBuka} onClick={() => setPanelBuka((b) => !b)}
              className="shrink-0 font-semibold underline underline-offset-2 hover:text-ink">
              {panelBuka ? 'Sembunyikan' : 'Lihat'}
            </button>
          </div>
          {panelBuka && (
            <>
              <ul className="mt-2 flex flex-wrap gap-1.5 sm:pl-[23px]">
                {kelompok.map((g) => (
                  <li key={g.join('|')} className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-[#f6e2ac] bg-surface py-0.5 pr-0.5 pl-1">
                    {g.map((k, i) => (
                      <Fragment key={k}>
                        {i > 0 && <span aria-hidden className="text-[#c9a650]">/</span>}
                        <button
                          type="button"
                          onClick={() => pilihKode(k)}
                          aria-pressed={kodeFilter === k}
                          title={`Tampilkan rute dengan kode area ${k}`}
                          className={cn('rounded px-1.5 py-0.5 font-semibold text-ink transition-colors hover:bg-[#fff8e6]', kodeFilter === k && 'bg-[#fdecc0]')}
                        >
                          {k} <span className="tnum font-normal text-ink-3">{pakai.get(k)?.rute ?? 0}</span>
                        </button>
                      </Fragment>
                    ))}
                    {canEdit && (
                      <button type="button" onClick={() => setRapikan(g)} title={`Satukan penulisan ${g.join(' / ')}`}
                        className="ml-0.5 inline-flex items-center gap-1 rounded bg-[#fdecc0] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#6b4b00] transition-colors hover:bg-[#f9df9c]">
                        <FaWandMagicSparkles size={11} />
                        Rapikan
                      </button>
                    )}
                    {canEdit && (
                      <IconButton
                        label={`Bukan salah ketik: sembunyikan ${g.join(' / ')}`}
                        icon={<FaXmark size={12} />}
                        className="h-6 w-6"
                        onClick={() => tandaiBukanSalahKetik(g)}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11.5px] text-[#8a6100]/80 sm:pl-[23px]">
                Angka = jumlah rute.{canEdit && ' Tombol × menandai kelompok yang memang berbeda tempat (bukan salah ketik), mis. SUBAN dan SUBANG.'}
                {jumlahDisembunyikan > 0 && (
                  <>
                    {' '}{jumlahDisembunyikan} kelompok disembunyikan.{' '}
                    <button type="button" onClick={tampilkanLagi} className="font-semibold underline underline-offset-2 hover:text-ink">Tampilkan lagi</button>
                  </>
                )}
              </p>
            </>
          )}
        </section>
      )}

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari No. Rute, nama, atau kode area..." />
              <PanelFilter filter={filter} chips={chips}>
                <Field label="Area (pick up atau destinasi)">
                  {(id) => (
                    <Select id={id} value={d.kode} onChange={(e) => filter.ubah({ kode: e.target.value })}>
                      <option value="">Semua</option>
                      {kodeOpsi.map(([k, p]) => <option key={k} value={k}>{`${k} (${p.rute})`}</option>)}
                    </Select>
                  )}
                </Field>
                {pakaiFeet && (
                  <Field label="Feet">
                    {(id) => (
                      <Select id={id} value={d.feet} onChange={(e) => filter.ubah({ feet: e.target.value })}>
                        <option value="">Semua</option>
                        {FEET_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                        <option value="-">Belum diisi</option>
                      </Select>
                    )}
                  </Field>
                )}
                <Field label="Nominal">
                  {(id) => (
                    <Select id={id} value={d.kira} onChange={(e) => filter.ubah({ kira: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="ya">Masih ada perkiraan</option>
                      <option value="tidak">Sudah pasti</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={(
            <span className="text-[12.5px] text-ink-3">
              {db.routes.length} rute terdaftar{jumlahKira > 0 && <> · {jumlahKira} bernominal perkiraan</>}
              {kelompok.length === 0 && jumlahDisembunyikan > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={tampilkanLagi} className="underline underline-offset-2 hover:text-ink" title="Tampilkan lagi kelompok kode area mirip yang ditandai bukan salah ketik">
                    {jumlahDisembunyikan} kode mirip disembunyikan
                  </button>
                </>
              )}
            </span>
          )}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="rute" />}
          notFound={<NotFoundState onReset={resetFilter} />}
          footer={
            table.total > 0 ? (
              <tr>
                <td className="px-3 py-2 text-[12px] text-ink-2" colSpan={kolomSebelumUj}>Total {formatNumber(table.total)} rute</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.ujroute))}</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.toll ?? 0))}</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px] text-ink">{formatRupiah(sum(table.filtered, (r) => r.price))}</td>
                <td />
              </tr>
            ) : undefined
          }
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      {/* Form rute dipakai bersama form trip (tambah rute di tempat). */}
      <ModalRute open={formOpen} rute={editing} onClose={() => setFormOpen(false)} />
      {rapikan && (
        <ModalRapikanKode
          kelompok={rapikan}
          pakai={pakaiLengkap}
          onClose={() => setRapikan(null)}
          onBuka={(r) => { setRapikan(null); setEditing(r); setFormOpen(true) }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.route_code} — {deleting?.route_name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
