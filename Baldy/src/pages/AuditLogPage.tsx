import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaArrowRight, FaLock } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button, DetailButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { DateInput, Field, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { WORKSPACE_LIST, useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { LABEL_ENTITAS, tautanAudit } from '../lib/audit'
import { formatNumber, formatPrintedAt, galatRentang, rentangTanggal } from '../lib/format'
import { matchesQuery } from '../lib/utils'
import { AKSI_AUDIT, AKSI_AUDIT_LABEL, ROLE_PENGGUNA } from '../types'
import type { AksiAudit, AuditLog, Database, EntityKey, Role, Workspace } from '../types'

/** Jenis data di luar koleksi database (mis. akun dari Pengaturan -> Pengguna & Peran). */
const LABEL_ENTITAS_LAIN: Record<string, string> = { pengguna: 'Pengguna (akun)' }
const labelEntitas = (e: string) => LABEL_ENTITAS[e as EntityKey] ?? LABEL_ENTITAS_LAIN[e] ?? e

const NADA_AKSI: Record<AksiAudit, 'good' | 'brand' | 'critical' | 'serious' | 'neutral' | 'warning'> = {
  buat: 'good', ubah: 'brand', hapus: 'critical', batal: 'serious', tutup: 'neutral', pool: 'neutral', tahap_pi: 'warning', cetak: 'neutral',
}

/** Nama isian yang dibaca orang untuk rincian perubahan; kunci yang tidak dikenal tampil apa adanya. */
const LABEL_FIELD: Record<string, string> = {
  // Trip
  transaction_no: 'No. Trip', transaction_date: 'Tanggal berangkat', order_date: 'Tanggal order', service_type: 'Layanan', contract_id: 'Kontrak',
  trip_ids: 'ID Perjalanan', route_id: 'Rute', tr_numbers: 'No. Referensi', tr_reference: 'No. Referensi (lama)', lokasi_muat: 'Lokasi muat',
  lokasi_bongkar: 'Lokasi bongkar', backload_dari: 'Backload dari trip', ada_backload: 'Ada backload / rute lanjutan', pengirim: 'Pick up (pengirim)',
  penerima: 'Destinasi (penerima)', gandengan: 'Gandengan', pool_at: 'Kembali di pool', sj_no: 'No. Surat Jalan', manager_id: 'Manager',
  manager_name: 'Nama manager', project_id: 'Klien', status: 'Status', vehicle_id: 'Kendaraan', driver_id: 'Supir utama', driver_ids: 'Supir',
  job_order_id: 'SI / JO', goods_type: 'Jenis barang', destination_detail: 'Tujuan', pi_number: 'No. PI',
  pi_tahap: 'Tahap PI', pi_date: 'Tanggal PI', pi_tahap_date: 'Tanggal tahap PI', pi_note: 'Catatan PI', pi_attachments: 'Bukti PI',
  'pi_nilai.pokok': 'Nilai PI: harga', 'pi_nilai.tambahan': 'Nilai PI: tambahan', 'pi_nilai.total': 'Nilai PI: total', pi_nilai: 'Nilai PI',
  closed_at: 'Tanggal ditutup', pod_fisik: 'POD fisik diterima', pod_fisik_at: 'Tanggal POD fisik', pod_attachments: 'Foto POD',
  cancel_fee: 'Biaya cancel', cost_value: 'Harga trip', override_note: 'Alasan override', override_attachments: 'Bukti override',
  notes: 'Catatan', printed_at: 'Dicetak', cancelled_at: 'Tanggal batal', cancel_reason: 'Alasan batal', cancel_settlement: 'Penyelesaian uang jalan',
  is_marked: 'Ditandai',
  // Kendaraan, karyawan, rute, klien, kontrak
  plate_number: 'No. Kendaraan', vehicle_type: 'Jenis kendaraan', configuration: 'Konfigurasi', attachments: 'Lampiran',
  driver_code: 'Kode karyawan', driver_name: 'Nama', role: 'Peran', address_1: 'Alamat', address_2: 'Alamat 2', city: 'Kota', phone: 'Telepon',
  route_code: 'No. Rute', route_name: 'Nama Rute', ujroute: 'UJ Rute', toll: 'Uang tol', price: 'Harga', feet: 'Feet',
  kode_area_asal: 'Kode area pick up', kode_area_tujuan: 'Kode area destinasi', estimated_fields: 'Nominal perkiraan', commissioner: 'Komisioner (lama)',
  project_code: 'Kode klien', project_name: 'Nama klien', client_type: 'Jenis klien', description: 'Keterangan', requires_document: 'Perlu dokumen',
  contract_no: 'No. kontrak', value: 'Nilai kontrak', start_date: 'Tanggal mulai', end_date: 'Tanggal selesai',
  // Uang jalan, biaya, kasbon
  sequence: 'Termin ke-', payment_date: 'Tanggal bayar', uj_amount: 'Uang jalan', kasbon_deduction: 'Potong kasbon', jenis: 'Jenis',
  override_by: 'Disetujui oleh', expense_type: 'Jenis biaya', amount: 'Jumlah', expense_date: 'Tanggal nota', ditagihkan: 'Ditagihkan ke klien',
  dibayar: 'Dibayar oleh', cost_type: 'Jenis biaya', cost_date: 'Tanggal', recipient_role: 'Peran penerima', recipient_id: 'Penerima',
  recipient_name: 'Nama penerima', employee_id: 'Karyawan', entry_date: 'Tanggal', kind: 'Jenis mutasi', trip_id: 'Trip', uj_payment_id: 'Termin uang jalan',
  // Alamat, dokumen, perjalanan, komisi, akun
  kode_area: 'Kode area', nama: 'Nama', alamat: 'Alamat', kota: 'Kota', nama_kontak: 'Kontak', telepon: 'Telepon', lat_long: 'Koordinat',
  id_lokasi_klien: 'ID lokasi klien', catatan: 'Catatan', judul: 'Judul', kategori: 'Kategori', tanggal: 'Tanggal', note_date: 'Tanggal',
  title: 'Judul', waktu: 'Waktu', lokasi: 'Lokasi', name: 'Nama', tiers: 'Tingkat komisi', is_active: 'Aktif', basis: 'Dasar hitung',
  base_deduction_pct: 'Potongan dasar (%)', configurations: 'Jenis kendaraan', username: 'Username', aktif: 'Akun aktif',
}

/** Nilai kode yang dibaca orang (status, peran, layanan). */
const LABEL_NILAI: Record<string, string> = {
  draft: 'Draft', menunggu_sopir: 'Menunggu supir', aktif: 'Aktif', selesai: 'Selesai', batal: 'Batal', nonaktif: 'Nonaktif', servis: 'Servis',
  callout: 'Callout', dedicated: 'Dedicated', sopir: 'Supir', manager: 'Manager', owner: 'Owner', admin: 'Admin', viewer: 'Viewer',
  perusahaan: 'Perusahaan langsung', tetap: 'Klien tetap', kontrak: 'Klien kontrak',
}

/** Isian yang menyimpan id record lain: ditampilkan sebagai nama / plat / nomor. */
function petaRujukan(d: Database): Record<string, Map<string, string>> {
  const karyawan = new Map(d.drivers.map((x) => [x.id, `${x.driver_name} (${x.driver_code})`]))
  return {
    vehicle_id: new Map(d.vehicles.map((x) => [x.id, x.plate_number])),
    driver_id: karyawan, driver_ids: karyawan, manager_id: karyawan, employee_id: karyawan, recipient_id: karyawan,
    route_id: new Map(d.routes.map((x) => [x.id, x.route_name])),
    project_id: new Map(d.projects.map((x) => [x.id, x.project_name])),
    contract_id: new Map((d.contracts ?? []).map((x) => [x.id, x.contract_no])),
  }
}

function tampilNilai(field: string, nilai: string, rujukan: Record<string, Map<string, string>>): string {
  if (nilai === '—') return nilai
  const peta = rujukan[field]
  if (peta) return nilai.split(', ').map((v) => peta.get(v) ?? v).join(', ')
  return LABEL_NILAI[nilai] ?? nilai
}

const waktu = (iso: string) => (iso ? formatPrintedAt(new Date(iso)) : '—')
/** Tanggal lokal yyyy-mm-dd dari waktu ISO, untuk filter periode. */
function tanggalLokal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

const labelPeran = (p: Role | '') => (p ? ROLE_PENGGUNA[p]?.label ?? p : '—')
const labelWs = (w?: Workspace) => WORKSPACE_LIST.find((x) => x.id === w)?.label ?? '—'

interface BarisAudit extends AuditLog {
  tanggal: string
  entitasLabel: string
}

/**
 * Pengaturan -> Audit Log: siapa mengubah data apa dan kapan. Catatannya ditulis otomatis
 * setiap kali data ditambah, diubah, dihapus, atau trip dibatalkan / ditutup / kembali ke
 * pool. Hanya Owner & Manager (bisa('audit')). Klik baris untuk rincian perubahan per isian.
 */
export function AuditLogPage() {
  const { bisa, user } = useAuth()
  if (!bisa('audit')) {
    return (
      <>
        <PageHeader title="Audit Log" crumbs={[{ label: 'Pengaturan' }, { label: 'Audit Log' }]} />
        <Card>
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-sunken text-ink-3"><FaLock size={18} /></div>
            <p className="text-[14px] font-semibold text-ink">Anda tidak berwenang membuka Audit Log.</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">
              Audit Log hanya untuk Owner dan Manager. Anda masuk sebagai {user ? labelPeran(user.role) : 'tamu'}.
              Minta Manager atau Owner bila perlu menelusuri perubahan data.
            </p>
          </div>
        </Card>
      </>
    )
  }
  return <DaftarAudit />
}

function DaftarAudit() {
  const { dbAll, loading, error, reload } = useData()
  const { workspace, setWorkspace } = useWorkspace()
  const navigate = useNavigate()

  const filter = useFilter({ pengguna: '', aksi: '', entitas: '', ws: '', dari: '', sampai: '' })
  const { pengguna, aksi, entitas, ws, dari, sampai } = filter.nilai
  const d = filter.draf
  const [rinci, setRinci] = useState<BarisAudit | null>(null)

  const semua = useMemo<BarisAudit[]>(
    () => (dbAll.auditLogs ?? []).map((l) => ({ ...l, tanggal: tanggalLokal(l.waktu), entitasLabel: labelEntitas(l.entitas) })),
    [dbAll.auditLogs],
  )
  const opsiPengguna = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of semua) if (!m.has(l.username)) m.set(l.username, `${l.nama || l.username || 'Tanpa nama'} (${labelPeran(l.peran)})`)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [semua])
  const opsiEntitas = useMemo(() => [...new Set(semua.map((l) => l.entitas))].map((e) => [e, labelEntitas(e)] as const).sort((a, b) => a[1].localeCompare(b[1])), [semua])

  const search = useCallback(
    (l: BarisAudit, q: string) => matchesQuery(q, l.label, l.ringkasan, l.nama, l.username, l.entitasLabel, AKSI_AUDIT_LABEL[l.aksi], l.entity_id,
      l.perubahan.map((p) => `${LABEL_FIELD[p.field] ?? p.field} ${p.dari} ${p.ke}`).join(' ')),
    [],
  )
  const extraFilter = useCallback(
    (l: BarisAudit) => (!pengguna || l.username === pengguna) && (!aksi || l.aksi === aksi) && (!entitas || l.entitas === entitas)
      && (!ws || (l.workspace ?? '') === ws) && (!dari || l.tanggal >= dari) && (!sampai || l.tanggal <= sampai),
    [pengguna, aksi, entitas, ws, dari, sampai],
  )
  const jumlahFilter = [pengguna, aksi, entitas, ws, dari || sampai].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
  const table = useTable(semua, { search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'waktu', initialSortDir: 'desc', pageSize: 25 })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const chips = [
    (dari || sampai) && { label: `Tanggal ${rentangTanggal(dari, sampai)}`, lepas: () => filter.lepas('dari', 'sampai') },
    pengguna && { label: `Pengguna: ${opsiPengguna.find(([u]) => u === pengguna)?.[1] ?? pengguna}`, lepas: () => filter.lepas('pengguna') },
    aksi && { label: `Aksi: ${AKSI_AUDIT_LABEL[aksi as keyof typeof AKSI_AUDIT_LABEL] ?? aksi}`, lepas: () => filter.lepas('aksi') },
    ws && { label: `Workspace: ${WORKSPACE_LIST.find((w) => w.id === ws)?.label ?? ws}`, lepas: () => filter.lepas('ws') },
    entitas && { label: `Data: ${opsiEntitas.find(([e]) => e === entitas)?.[1] ?? entitas}`, lepas: () => filter.lepas('entitas') },
  ]

  /**
   * Tautan ke data sumber. Trip & catatan trip milik workspace lain dibuka dengan pindah
   * workspace lebih dulu (halaman trip hanya mencari di workspace aktif).
   */
  const tujuan = useCallback((l: AuditLog): { ke: string; ws: Workspace | null } | null => {
    if (l.aksi === 'hapus') return null
    const ke = l.entitas === 'pengguna' ? '/pengaturan/pengguna' : tautanAudit(l.entitas, l.entity_id, dbAll)
    if (!ke) return null
    const m = /^\/transaksi\/trip\/([^/?]+)/.exec(ke)
    const t = m ? dbAll.transactions.find((x) => x.id === m[1]) : undefined
    const wsTrip = t ? (t.workspace ?? 'priok') : null
    return { ke, ws: wsTrip && wsTrip !== workspace ? wsTrip : null }
  }, [dbAll, workspace])

  function buka(t: { ke: string; ws: Workspace | null }) {
    if (t.ws) setWorkspace(t.ws)
    navigate(t.ke)
  }

  const columns: Column<BarisAudit>[] = [
    { key: 'waktu', header: 'Waktu', sortable: true, width: '138px', render: (l) => <span className="tnum whitespace-nowrap text-ink-2">{waktu(l.waktu)}</span> },
    {
      key: 'nama', header: 'Pengguna', sortable: true, width: '170px',
      render: (l) => (
        <div className="leading-tight">
          <span className="font-medium text-ink">{l.nama || l.username || '—'}</span>
          <span className="block text-[12px] text-ink-3">{labelPeran(l.peran)}{l.username ? ` · ${l.username}` : ''}</span>
        </div>
      ),
    },
    {
      key: 'aksi', header: 'Aksi', sortable: true, width: '128px',
      render: (l) => <Badge tone={NADA_AKSI[l.aksi] ?? 'neutral'}>{AKSI_AUDIT_LABEL[l.aksi] ?? l.aksi}</Badge>,
    },
    { key: 'entitasLabel', header: 'Jenis Data', sortable: true, width: '150px', render: (l) => <span className="text-ink-2">{l.entitasLabel}</span> },
    {
      key: 'label', header: 'Data', sortable: true, width: '190px',
      render: (l) => {
        const t = tujuan(l)
        const teks = l.label || '—'
        return t ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); buka(t) }}
            title={t.ws ? `Pindah ke workspace ${labelWs(t.ws)} lalu buka data ini` : 'Buka data ini'}
            className="tnum text-left font-semibold break-all text-brand-700 hover:underline">
            {teks}
            {t.ws && <span className="block text-[11.5px] font-normal text-ink-3">di workspace {labelWs(t.ws)}</span>}
          </button>
        ) : (
          <span className="tnum font-medium break-all text-ink">{teks}</span>
        )
      },
    },
    {
      key: 'ringkasan', header: 'Ringkasan', sortable: false,
      render: (l) => (
        <div className="max-w-[420px] min-w-[220px] leading-snug">
          <span className="line-clamp-2 text-ink-2" title={l.ringkasan}>{l.ringkasan || '—'}</span>
          {l.perubahan.length > 0 && <span className="text-[11.5px] text-ink-3">{l.perubahan.length} isian berubah</span>}
        </div>
      ),
    },
    {
      key: 'action', header: '', align: 'right', width: '52px',
      render: (l) => <DetailButton label="Lihat rincian perubahan" onClick={(e) => { e.stopPropagation(); setRinci(l) }} />,
    },
  ]

  const adaWsLain = semua.some((l) => l.workspace && l.workspace !== workspace)

  return (
    <>
      <PageHeader
        title="Audit Log"
        crumbs={[{ label: 'Pengaturan' }, { label: 'Audit Log' }]}
        description="Catatan siapa menambah, mengubah, atau menghapus data, dan kapan. Ditulis otomatis; tidak bisa diubah dari layar."
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-72" placeholder="Cari data, ringkasan, pengguna, isian..." />
              <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.dari, d.sampai)} lebar={360}>
                <div>
                  <p className="form-label">Tanggal</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput aria-label="Tanggal dari" placeholder="Dari" value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} />
                    <DateInput aria-label="Tanggal sampai" placeholder="Sampai" value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} />
                  </div>
                </div>
                <Field label="Pengguna">
                  {(id) => (
                    <Select id={id} value={d.pengguna} onChange={(e) => filter.ubah({ pengguna: e.target.value })}>
                      <option value="">Semua</option>
                      {opsiPengguna.map(([u, label]) => <option key={u} value={u}>{label}</option>)}
                    </Select>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Aksi">
                    {(id) => (
                      <Select id={id} value={d.aksi} onChange={(e) => filter.ubah({ aksi: e.target.value })}>
                        <option value="">Semua</option>
                        {AKSI_AUDIT.map((a) => <option key={a} value={a}>{AKSI_AUDIT_LABEL[a]}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Workspace">
                    {(id) => (
                      <Select id={id} value={d.ws} onChange={(e) => filter.ubah({ ws: e.target.value })}>
                        <option value="">Semua</option>
                        {WORKSPACE_LIST.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
                <Field label="Jenis data">
                  {(id) => (
                    <Select id={id} value={d.entitas} onChange={(e) => filter.ubah({ entitas: e.target.value })}>
                      <option value="">Semua</option>
                      {opsiEntitas.map(([e, label]) => <option key={e} value={e}>{label}</option>)}
                    </Select>
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={<span className="tnum text-[12.5px] text-ink-3">{formatNumber(table.total)} dari {formatNumber(semua.length)} catatan</span>}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(l) => l.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          onRowClick={setRinci}
          empty={
            <div className="px-6 py-14 text-center">
              <p className="text-[14px] font-semibold text-ink">Belum ada catatan.</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-3">
                Catatan muncul otomatis begitu ada data yang ditambah, diubah, atau dihapus, mis. mengubah data kendaraan atau menutup trip.
              </p>
            </div>
          }
          notFound={
            <div className="px-6 py-14 text-center">
              <p className="text-[14px] font-semibold text-ink">Catatan tidak ditemukan.</p>
              <p className="mt-1 text-[13px] text-ink-3">Coba periksa kembali kata kunci atau filter.</p>
              <Button size="sm" className="mt-4" onClick={resetFilter}>Reset filter</Button>
            </div>
          }
        />
        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
        <p className="border-t border-hairline px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">
          Di sistem produksi, Audit Log dicatat oleh server. Selama prototipe, catatan disimpan di browser ini saja (catatan terbaru), jadi perangkat lain tidak melihatnya.
          {adaWsLain && ' Catatan dari workspace lain ikut tampil; pilih Workspace untuk menyaring.'}
        </p>
      </Card>

      <RincianAudit log={rinci} dbAll={dbAll} tujuan={rinci ? tujuan(rinci) : null} onBuka={(t) => { setRinci(null); buka(t) }} onClose={() => setRinci(null)} />
    </>
  )
}

/** Rincian satu catatan: siapa, kapan, dan isian apa berubah dari apa ke apa. */
function RincianAudit({ log, dbAll, tujuan, onBuka, onClose }: {
  log: BarisAudit | null
  dbAll: Database
  tujuan: { ke: string; ws: Workspace | null } | null
  onBuka: (t: { ke: string; ws: Workspace | null }) => void
  onClose: () => void
}) {
  const rujukan = useMemo(() => petaRujukan(dbAll), [dbAll])
  if (!log) return null
  const info: Array<[string, ReactNode]> = [
    ['Waktu', waktu(log.waktu)],
    ['Pengguna', `${log.nama || '—'} · ${labelPeran(log.peran)}${log.username ? ` (${log.username})` : ''}`],
    ['Aksi', <Badge key="aksi" tone={NADA_AKSI[log.aksi] ?? 'neutral'}>{AKSI_AUDIT_LABEL[log.aksi] ?? log.aksi}</Badge>],
    ['Jenis data', log.entitasLabel],
    ['Data', log.label || '—'],
    ['Workspace', labelWs(log.workspace)],
  ]
  return (
    <Modal
      open
      onClose={onClose}
      title={`${AKSI_AUDIT_LABEL[log.aksi] ?? log.aksi}: ${log.label || log.entitasLabel}`}
      subtitle={log.ringkasan}
      size="lg"
      footer={
        <>
          {tujuan && (
            <Button icon={<FaArrowRight size={14} />} onClick={() => onBuka(tujuan)}>
              {tujuan.ws ? `Buka data (pindah ke ${labelWs(tujuan.ws)})` : 'Buka data'}
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>Tutup</Button>
        </>
      }
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {info.map(([label, nilai]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
            <dd className="mt-0.5 text-[13px] font-medium break-words text-ink">{nilai}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] text-ink-3">ID data: <span className="tnum">{log.entity_id || '—'}</span></p>

      <h3 className="mt-5 mb-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Rincian perubahan</h3>
      {log.perubahan.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-sunken px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-3">
          {log.aksi === 'buat' ? 'Data baru ditambahkan; tidak ada nilai lama untuk dibandingkan.'
            : log.aksi === 'hapus' ? 'Data dihapus; isinya tidak dicatat per isian.'
            : 'Dicatat sebagai satu kejadian, tanpa rincian per isian. Lihat ringkasan di atas.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[520px] text-[12.5px]">
            <thead className="bg-sunken">
              <tr className="border-b border-hairline text-left text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">
                <th className="px-3 py-2">Isian</th>
                <th className="px-3 py-2">Dari</th>
                <th className="px-3 py-2">Menjadi</th>
              </tr>
            </thead>
            <tbody>
              {log.perubahan.map((p, i) => (
                <tr key={`${p.field}-${i}`} className="border-b border-grid align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink">{LABEL_FIELD[p.field] ?? p.field}</span>
                    {LABEL_FIELD[p.field] && <span className="tnum block text-[11px] text-ink-3">{p.field}</span>}
                  </td>
                  <td className="px-3 py-2 break-words text-ink-3">{tampilNilai(p.field, p.dari, rujukan)}</td>
                  <td className="px-3 py-2 font-medium break-words text-ink">{tampilNilai(p.field, p.ke, rujukan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
