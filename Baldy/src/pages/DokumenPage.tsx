import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaDownload, FaFileArrowUp, FaLink, FaPen, FaTrashCan, FaTriangleExclamation } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { DateInput, Field, Input, Radio, Select, Textarea } from '../components/ui/Field'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import type { Option } from '../components/ui/SearchableSelect'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { ambilLampiran, hapusLampiran, urlLampiran } from '../lib/lampiran'
import { idTampil } from '../lib/trip'
import { formatDate, formatNumber, formatPrintedAt, galatRentang, rentangTanggal, todayISO } from '../lib/format'
import { matchesQuery } from '../lib/utils'
import { DOKUMEN_KARYAWAN, DOKUMEN_KENDARAAN, JENIS_TERMIN_LABEL, KASBON_LABEL, KATEGORI_DOKUMEN, PERJALANAN_LABEL, labelBiaya } from '../types'
import type { CommissionTransaction, Database, Dokumen, Workspace } from '../types'

/**
 * Sumber berkas: record mana yang menyimpan id lampirannya. Urutannya = urutan pilihan
 * filter. Daftar ini mengikuti lampiranDipakai di DataProvider: berkas yang tidak dirujuk
 * record mana pun dibersihkan otomatis, jadi semua berkas yang masih ada tampil di sini.
 */
const SUMBER = [
  'dokumen', 'tripNotes', 'pod', 'pi', 'override', 'ujPayments', 'expenses', 'internalCosts', 'tripEvents',
  'kasbonEntries', 'drivers', 'vehicles', 'contracts',
] as const
type Sumber = (typeof SUMBER)[number]

const SUMBER_LABEL: Record<Sumber, string> = {
  dokumen: 'Dokumen umum',
  tripNotes: 'Dokumen trip',
  pod: 'Foto POD',
  pi: 'Bukti PI',
  override: 'Bukti override harga',
  ujPayments: 'Uang jalan',
  expenses: 'Nota biaya operasional',
  internalCosts: 'Biaya internal',
  tripEvents: 'Perjalanan',
  kasbonEntries: 'Bukti kasbon',
  drivers: 'Dokumen karyawan',
  vehicles: 'Dokumen kendaraan',
  contracts: 'Dokumen kontrak',
}

/** Tempat berkas itu diubah atau dihapus (untuk tombol tautan). */
const SUMBER_TEMPAT: Record<Sumber, string> = {
  dokumen: 'halaman ini',
  tripNotes: 'tab Dokumen di detail trip',
  pod: 'Tutup Trip di detail trip',
  pi: 'halaman Tagihan / detail trip',
  override: 'form trip',
  ujPayments: 'tab Uang Jalan di detail trip',
  expenses: 'tab Biaya Operasional di detail trip',
  internalCosts: 'tab Komisi di detail trip',
  tripEvents: 'tab Perjalanan di detail trip',
  kasbonEntries: 'menu Piutang Karyawan',
  drivers: 'Ubah karyawan di Supir / Karyawan',
  vehicles: 'Ubah kendaraan di halaman Kendaraan',
  contracts: 'daftar kontrak di halaman klien',
}

const wsOf = (r: { workspace?: Workspace }): Workspace => r.workspace ?? 'priok'

/** Satu berkas beserta record pemiliknya. */
interface BerkasSumber {
  kunci: string
  lampiranId: string
  sumber: Sumber
  /** Rincian sumber, mis. jenis biaya, termin, jenis kejadian, kategori dokumen. */
  rincian: string
  /** Judul / keterangan record. */
  judul: string
  /** Pemilik yang dibaca orang: ID Trip, nama karyawan, plat, no. kontrak. */
  milik: string
  milikKet: string
  tautan: string | null
  /** Tanggal record (dokumen, nota, termin, trip); kosong bila record tidak bertanggal. */
  tanggal: string
  recordId: string
}

/** Metadata berkas dari IndexedDB; null = berkasnya tidak ada lagi di browser ini. */
type Meta = { name: string; type: string; size: number; created_at: string } | null

interface BarisBerkas extends BerkasSumber {
  jenisLabel: string
  nama: string
  /** Byte; -1 bila belum diketahui. */
  ukuran: number
  tipe: string
  /** Waktu unggah (ISO), dari metadata berkas. */
  diunggah: string
  keadaan: 'memuat' | 'ada' | 'hilang'
  /** Tanggal yang ditampilkan & disaring: tanggal record, atau tanggal unggah. */
  tanggalTampil: string
}

/** Kumpulkan seluruh berkas yang dirujuk record di workspace ini (master & kasbon dipakai bersama). */
function kumpulkanBerkas(d: Database, workspace: Workspace): BerkasSumber[] {
  const out: BerkasSumber[] = []
  const tambah = (ids: string[] | undefined, isi: Omit<BerkasSumber, 'kunci' | 'lampiranId'>) => {
    for (const id of ids ?? []) if (id) out.push({ ...isi, lampiranId: id, kunci: `${isi.sumber}:${isi.recordId}:${id}` })
  }
  const trips = d.transactions.filter((t) => wsOf(t) === workspace)
  const tripMap = new Map(trips.map((t) => [t.id, t]))
  const milikTrip = (t: CommissionTransaction) => ({ milik: idTampil(t), milikKet: t.status === 'batal' ? 'Trip batal (arsip)' : 'Trip' })
  const keTrip = (t: CommissionTransaction, tab?: string) => `/transaksi/trip/${t.id}${tab ? `?tab=${tab}` : ''}`

  for (const t of trips) {
    tambah(t.pod_attachments, {
      sumber: 'pod', rincian: t.pod_fisik ? 'fisik diterima' : t.pod_fisik === false ? 'fisik menyusul' : '',
      judul: 'Foto POD (BA / SJ bertanda tangan penerima)', ...milikTrip(t), tautan: keTrip(t), tanggal: t.closed_at || t.transaction_date, recordId: t.id,
    })
    tambah(t.pi_attachments, {
      sumber: 'pi', rincian: t.pi_number ? `PI ${t.pi_number}` : '', judul: t.pi_note ?? '',
      ...milikTrip(t), tautan: keTrip(t), tanggal: t.pi_tahap_date || t.pi_date || t.transaction_date, recordId: t.id,
    })
    tambah(t.override_attachments, {
      sumber: 'override', rincian: '', judul: t.override_note ?? '', ...milikTrip(t), tautan: keTrip(t), tanggal: t.transaction_date, recordId: t.id,
    })
  }
  for (const n of d.tripNotes) {
    const t = tripMap.get(n.trip_id)
    if (t) tambah(n.attachments, { sumber: 'tripNotes', rincian: '', judul: [n.title, n.notes].filter(Boolean).join(' · '), ...milikTrip(t), tautan: keTrip(t, 'lainnya'), tanggal: n.note_date, recordId: n.id })
  }
  for (const p of d.ujPayments) {
    const t = tripMap.get(p.trip_id)
    const jenis = p.jenis && p.jenis !== 'uj' ? ` · ${JENIS_TERMIN_LABEL[p.jenis]}` : ''
    if (t) tambah(p.attachments, { sumber: 'ujPayments', rincian: `Termin ${p.sequence}${jenis}`, judul: p.notes, ...milikTrip(t), tautan: keTrip(t, 'uj'), tanggal: p.payment_date, recordId: p.id })
  }
  for (const e of d.expenses) {
    const t = tripMap.get(e.trip_id)
    if (t) tambah(e.attachments, { sumber: 'expenses', rincian: labelBiaya(e.expense_type), judul: e.notes, ...milikTrip(t), tautan: keTrip(t, 'biaya'), tanggal: e.expense_date, recordId: e.id })
  }
  for (const c of d.internalCosts) {
    const t = tripMap.get(c.trip_id)
    if (t) tambah(c.attachments, { sumber: 'internalCosts', rincian: c.cost_type, judul: c.notes, ...milikTrip(t), tautan: keTrip(t, 'internal'), tanggal: c.cost_date, recordId: c.id })
  }
  for (const ev of d.tripEvents ?? []) {
    const t = tripMap.get(ev.trip_id)
    // Tab Perjalanan hanya ada di trip Karawang.
    if (t) {
      tambah(ev.attachments, {
        sumber: 'tripEvents', rincian: PERJALANAN_LABEL[ev.jenis] ?? ev.jenis, judul: [ev.lokasi, ev.catatan].filter(Boolean).join(' · '),
        ...milikTrip(t), tautan: keTrip(t, wsOf(t) === 'karawang' ? 'perjalanan' : undefined), tanggal: (ev.waktu ?? '').slice(0, 10), recordId: ev.id,
      })
    }
  }
  const orang = new Map(d.drivers.map((x) => [x.id, x]))
  for (const k of d.kasbonEntries) {
    const o = orang.get(k.employee_id)
    tambah(k.attachments, {
      sumber: 'kasbonEntries', rincian: KASBON_LABEL[k.kind] ?? k.kind, judul: k.notes, milik: o?.driver_name ?? 'Karyawan sudah dihapus', milikKet: 'Kasbon karyawan',
      tautan: o ? `/master/karyawan/${o.id}` : null, tanggal: k.entry_date, recordId: k.id,
    })
  }
  for (const o of d.drivers) {
    const milikKet = o.role === 'manager' ? 'Manager' : 'Supir'
    // Dokumen penting per jenis (KTP, SIM, ...), lalu dokumen lainnya.
    for (const j of DOKUMEN_KARYAWAN) {
      const dok = o.dokumen?.[j.kode]
      tambah(dok?.berkas, {
        sumber: 'drivers', rincian: j.label, judul: dok?.berlaku_sampai ? `Berlaku s/d ${dok.berlaku_sampai.split('-').reverse().join('/')}` : j.label,
        milik: o.driver_name, milikKet, tautan: `/master/karyawan/${o.id}`, tanggal: '', recordId: `${o.id}:${j.kode}`,
      })
    }
    tambah(o.attachments, {
      sumber: 'drivers', rincian: 'Lainnya', judul: 'Dokumen lainnya karyawan', milik: o.driver_name, milikKet,
      tautan: `/master/karyawan/${o.id}`, tanggal: '', recordId: o.id,
    })
  }
  for (const v of d.vehicles) {
    const milikKet = v.vehicle_type || 'Kendaraan'
    for (const j of DOKUMEN_KENDARAAN) {
      const dok = v.dokumen?.[j.kode]
      tambah(dok?.berkas, {
        sumber: 'vehicles', rincian: j.label, judul: dok?.berlaku_sampai ? `Berlaku s/d ${dok.berlaku_sampai.split('-').reverse().join('/')}` : j.label,
        milik: v.plate_number, milikKet, tautan: '/master/mobil', tanggal: '', recordId: `${v.id}:${j.kode}`,
      })
    }
    tambah(v.attachments, {
      sumber: 'vehicles', rincian: 'Lainnya', judul: 'Foto kendaraan & dokumen lainnya', milik: v.plate_number, milikKet,
      tautan: '/master/mobil', tanggal: '', recordId: v.id,
    })
  }
  const klien = new Map(d.projects.map((p) => [p.id, p]))
  for (const c of (d.contracts ?? []).filter((x) => wsOf(x) === workspace)) {
    const k = klien.get(c.project_id)
    tambah(c.attachments, {
      sumber: 'contracts', rincian: k?.project_code ?? '', judul: c.notes, milik: c.contract_no, milikKet: k?.project_name ?? 'Kontrak',
      tautan: k ? `/master/klien/${k.id}` : '/master/klien', tanggal: c.start_date, recordId: c.id,
    })
  }
  for (const dk of (d.dokumen ?? []).filter((x) => wsOf(x) === workspace)) {
    tambah(dk.attachments, {
      sumber: 'dokumen', rincian: dk.kategori, judul: [dk.judul, dk.catatan].filter(Boolean).join(' · '), milik: dk.judul, milikKet: `Dokumen umum · ${dk.kategori || 'Umum'}`,
      tautan: null, tanggal: dk.tanggal, recordId: dk.id,
    })
  }
  return out
}

/**
 * Metadata berkas (nama, jenis, ukuran, waktu unggah) dibaca dari IndexedDB sekali per id.
 * Id baru (mis. sesudah unggah) dimuat menyusul tanpa membaca ulang yang sudah ada.
 */
function useMetaLampiran(ids: string[]): Map<string, Meta> {
  const [meta, setMeta] = useState<Map<string, Meta>>(() => new Map())
  const kunci = useMemo(() => [...new Set(ids)].sort().join('|'), [ids])
  useEffect(() => {
    const perlu = (kunci ? kunci.split('|') : []).filter((id) => !meta.has(id))
    if (perlu.length === 0) return
    let batal = false
    Promise.all(perlu.map((id) => ambilLampiran(id)
      .then((b): [string, Meta] => [id, b ? { name: b.name, type: b.type, size: b.size, created_at: b.created_at } : null])
      .catch((): [string, Meta] => [id, null])))
      .then((hasil) => {
        if (batal) return
        setMeta((lama) => {
          const baru = new Map(lama)
          for (const [id, m] of hasil) baru.set(id, m)
          return baru
        })
      })
    return () => { batal = true }
    // `meta` sengaja tidak ikut: hanya id yang belum termuat yang dibaca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])
  return meta
}

/** 1536 -> "1,5 KB"; 2400000 -> "2,3 MB". */
function formatUkuran(b: number): string {
  if (b < 0) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0).replace('.', ',')} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** "image/jpeg" -> "Gambar"; "application/pdf" -> "PDF"; lainnya ekstensi nama berkas. */
function jenisBerkas(tipe: string, nama: string): string {
  if (tipe.startsWith('image/')) return 'Gambar'
  if (tipe === 'application/pdf') return 'PDF'
  const ext = /\.([a-z0-9]{1,5})$/i.exec(nama)?.[1]
  return ext ? ext.toUpperCase() : 'Berkas'
}

/** Waktu ISO -> "12/10/2026 14:35" (jam lokal). */
const waktuUnggah = (iso: string) => (iso ? formatPrintedAt(new Date(iso)) : '')

const ISO_TGL = /^\d{4}-\d{2}-\d{2}$/

/**
 * Dokumen ("File upload"): daftar gabungan semua berkas yang sudah diunggah di workspace
 * aktif, dari trip (POD, PI, override, dokumen trip, perjalanan), uang jalan, nota biaya,
 * biaya internal, kasbon, karyawan, kendaraan, kontrak, sampai dokumen umum perusahaan.
 * Berkas bisa dilihat dan diunduh di sini; berkas milik record lain diubah / dihapus dari
 * tempat asalnya (tautan di kolom Action). Dokumen umum diunggah dan dikelola di halaman ini.
 */
export function DokumenPage() {
  const { dbAll, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { bisa } = useAuth()
  const { workspace, meta: cabang } = useWorkspace()
  const toast = useToast()
  const navigate = useNavigate()
  const bolehUnggah = bisa('trip')
  const bolehKelola = bisa('master')

  const filter = useFilter({ jenis: '' as Sumber | '', dari: '', sampai: '' })
  const { jenis, dari, sampai } = filter.nilai
  const d = filter.draf
  const [unggah, setUnggah] = useState<{ edit: Dokumen | null } | null>(null)
  const [menghapus, setMenghapus] = useState<BarisBerkas | null>(null)

  const sumber = useMemo(() => kumpulkanBerkas(dbAll, workspace), [dbAll, workspace])
  const meta = useMetaLampiran(useMemo(() => sumber.map((s) => s.lampiranId), [sumber]))

  const semua = useMemo<BarisBerkas[]>(() => sumber.map((s) => {
    const m = meta.get(s.lampiranId)
    const keadaan = m === undefined ? 'memuat' : m === null ? 'hilang' : 'ada'
    const diunggah = m?.created_at ?? ''
    const tglRecord = String(s.tanggal ?? '').slice(0, 10)
    return {
      ...s,
      jenisLabel: SUMBER_LABEL[s.sumber],
      nama: m?.name ?? '',
      ukuran: m ? m.size : -1,
      tipe: m?.type ?? '',
      diunggah,
      keadaan,
      tanggalTampil: (ISO_TGL.test(tglRecord) ? tglRecord : '') || waktuLokal(diunggah),
    }
  }), [sumber, meta])

  const jumlahJenis = useMemo(() => {
    const m = new Map<Sumber, number>()
    for (const r of semua) m.set(r.sumber, (m.get(r.sumber) ?? 0) + 1)
    return m
  }, [semua])

  const search = useCallback(
    (r: BarisBerkas, q: string) => matchesQuery(q, r.nama, r.jenisLabel, r.rincian, r.judul, r.milik, r.milikKet),
    [],
  )
  const extraFilter = useCallback(
    (r: BarisBerkas) => (!jenis || r.sumber === jenis) && (!dari || r.tanggalTampil >= dari) && (!sampai || (!!r.tanggalTampil && r.tanggalTampil <= sampai)),
    [jenis, dari, sampai],
  )
  const jumlahFilter = [jenis, dari || sampai].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
  const table = useTable(semua, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'tanggalTampil', initialSortDir: 'desc', tieBreakKey: 'diunggah', pageSize: 25,
  })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const chips = [
    jenis && { label: `Jenis: ${SUMBER_LABEL[jenis]}`, lepas: () => filter.lepas('jenis') },
    (dari || sampai) && { label: `Tanggal ${rentangTanggal(dari, sampai)}`, lepas: () => filter.lepas('dari', 'sampai') },
  ]

  const totalUkuran = table.filtered.reduce((a, r) => a + Math.max(0, r.ukuran), 0)
  const hilang = semua.filter((r) => r.keadaan === 'hilang').length

  /** Opsi trip untuk "Simpan di trip": trip workspace ini, terbaru dulu. Trip batal hanya arsip. */
  const opsiTrip = useMemo<Option[]>(() => [...transactionRows]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at))
    .map((t) => ({
      value: t.id,
      label: t.id_tampil,
      meta: t.status === 'batal'
        ? 'Trip batal: dokumennya hanya arsip, tidak bisa ditambah'
        : [formatDate(t.transaction_date), t.route_name || [t.muat, t.bongkar].filter(Boolean).join(' → '), t.plate_number].filter(Boolean).join(' · '),
      keywords: [t.transaction_no, t.tr_list.join(' '), t.driver_names, t.project_code].join(' '),
      disabled: t.status === 'batal',
    })), [transactionRows])

  async function unduh(r: BarisBerkas) {
    const d = await urlLampiran(r.lampiranId).catch(() => null)
    if (!d) { toast.error('Berkas tidak ditemukan di penyimpanan browser ini.'); return }
    const a = document.createElement('a')
    a.href = d.url
    a.download = d.berkas.name || 'berkas'
    a.click()
  }

  function hapusBerkas() {
    const r = menghapus
    if (!r) return
    const dok = dbAll.dokumen.find((x) => x.id === r.recordId)
    if (dok) {
      const sisa = (dok.attachments ?? []).filter((a) => a !== r.lampiranId)
      if (sisa.length > 0) {
        update('dokumen', dok.id, { attachments: sisa })
        toast.success(`Berkas ${r.nama || ''} dihapus dari dokumen “${dok.judul}”. ${sisa.length} berkas lain tetap tersimpan.`)
      } else {
        remove('dokumen', dok.id)
        toast.success(`Dokumen “${dok.judul}” dihapus.`)
      }
      void hapusLampiran([r.lampiranId])
    }
    setMenghapus(null)
  }

  const dokumenHapus = menghapus ? dbAll.dokumen.find((x) => x.id === menghapus.recordId) : undefined
  const sisaBerkas = dokumenHapus ? (dokumenHapus.attachments ?? []).length - 1 : 0

  const columns: Column<BarisBerkas>[] = [
    {
      key: 'nama', header: 'Berkas', sortable: true,
      render: (r) => (
        <div className="flex max-w-[360px] min-w-[220px] items-center gap-2.5">
          <LampiranThumbs ids={[r.lampiranId]} ukuran={38} className="shrink-0" />
          <div className="min-w-0 leading-tight">
            {r.keadaan === 'memuat' ? <span className="text-ink-3">Memuat...</span>
              : r.keadaan === 'hilang' ? (
                <span className="flex items-center gap-1.5 text-ink-3" title="Berkas tidak ditemukan di penyimpanan browser ini.">
                  <Badge tone="critical">Hilang</Badge> berkas tidak ditemukan
                </span>
              ) : <span className="block truncate font-medium text-ink" title={r.nama}>{r.nama}</span>}
            <span className="block truncate text-[12px] text-ink-3" title={r.judul || undefined}>
              {[r.keadaan === 'ada' ? jenisBerkas(r.tipe, r.nama) : '', r.judul].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'jenisLabel', header: 'Jenis / Sumber', sortable: true, width: '190px',
      render: (r) => (
        <div className="leading-tight">
          <Badge tone={r.sumber === 'dokumen' ? 'brand' : 'neutral'}>{r.jenisLabel}</Badge>
          {r.rincian && <span className="mt-1 block text-[12px] text-ink-3">{r.rincian}</span>}
        </div>
      ),
    },
    {
      key: 'milik', header: 'Milik', sortable: true, width: '200px',
      render: (r) => (
        <div className="leading-tight">
          {r.tautan
            ? <Link to={r.tautan} onClick={(e) => e.stopPropagation()} className="tnum font-semibold break-all text-brand-700 hover:underline">{r.milik || '—'}</Link>
            : <span className="font-medium text-ink">{r.milik || '—'}</span>}
          <span className="block text-[12px] text-ink-3">{r.milikKet}</span>
        </div>
      ),
    },
    {
      key: 'tanggalTampil', header: 'Tanggal', sortable: true, width: '150px',
      render: (r) => (
        <div className="tnum leading-tight">
          <span className="text-ink-2">{r.tanggalTampil ? formatDate(r.tanggalTampil) : '—'}</span>
          {r.diunggah && (
            <span className="block text-[11.5px] text-ink-3">{r.tanggal ? `diunggah ${waktuUnggah(r.diunggah)}` : 'tanggal unggah'}</span>
          )}
        </div>
      ),
    },
    {
      key: 'ukuran', header: 'Ukuran', sortable: true, align: 'right', width: '92px',
      render: (r) => <span className="tnum text-ink-2">{formatUkuran(r.ukuran)}</span>,
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '120px',
      render: (r) => {
        const dok = r.sumber === 'dokumen' ? dbAll.dokumen.find((x) => x.id === r.recordId) : undefined
        return (
          <div className="flex justify-end gap-1">
            <IconButton label={`Unduh ${r.nama || 'berkas'}`} icon={<FaDownload size={14} />} disabled={r.keadaan !== 'ada'} onClick={() => void unduh(r)} />
            {dok ? (
              <>
                <IconButton label={bolehKelola ? 'Ubah dokumen' : 'Ubah dokumen umum: hanya Manager / Owner'} icon={<FaPen size={14} />} disabled={!bolehKelola}
                  onClick={() => setUnggah({ edit: dok })} />
                <IconButton label={bolehKelola ? 'Hapus berkas' : 'Hapus dokumen umum: hanya Manager / Owner'} tone="danger" icon={<FaTrashCan size={14} />} disabled={!bolehKelola}
                  onClick={() => setMenghapus(r)} />
              </>
            ) : (
              <IconButton
                label={r.tautan ? `Buka sumbernya. Ubah atau hapus berkas ini di ${SUMBER_TEMPAT[r.sumber]}.` : 'Record pemiliknya sudah tidak ada'}
                icon={<FaLink size={14} />} disabled={!r.tautan} onClick={() => r.tautan && navigate(r.tautan)}
              />
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Dokumen"
        crumbs={[{ label: 'Dokumen' }]}
        description={`File upload: semua berkas yang sudah diunggah di workspace ${cabang.label}, dari trip, nota biaya, kasbon, karyawan, kendaraan, kontrak, sampai dokumen umum perusahaan.`}
        actions={
          <Button variant="primary" icon={<FaFileArrowUp size={15} />} disabled={!bolehUnggah} onClick={() => setUnggah({ edit: null })}
            title={bolehUnggah ? 'Unggah dokumen umum, atau dokumen untuk satu trip' : 'Peran Viewer hanya melihat dan mengunduh'}>
            Unggah dokumen
          </Button>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-72" placeholder="Cari nama berkas, judul, ID Trip, karyawan, plat..." />
              <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.dari, d.sampai)} lebar={360}>
                <Field label="Jenis / sumber berkas">
                  {(id) => (
                    <Select id={id} value={d.jenis} onChange={(e) => filter.ubah({ jenis: e.target.value as Sumber | '' })}>
                      <option value="">{`Semua jenis (${formatNumber(semua.length)})`}</option>
                      {SUMBER.map((s) => (
                        <option key={s} value={s}>{`${SUMBER_LABEL[s]} (${formatNumber(jumlahJenis.get(s) ?? 0)})`}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <div>
                  <p className="form-label">Tanggal</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput aria-label="Tanggal dari" placeholder="Dari" value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} />
                    <DateInput aria-label="Tanggal sampai" placeholder="Sampai" value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} />
                  </div>
                </div>
              </PanelFilter>
            </>
          }
          right={
            <span className="tnum text-[12.5px] text-ink-3">
              {formatNumber(table.total)} berkas{totalUkuran > 0 ? ` · ${formatUkuran(totalUkuran)}` : ''}
            </span>
          }
        />

        {dari && sampai && dari > sampai && (
          <p className="border-b border-hairline px-4 py-2 text-[12px] font-medium text-[color:var(--color-critical)]">Tanggal “dari” lebih besar dari tanggal “sampai”: tidak ada berkas yang cocok.</p>
        )}
        {hilang > 0 && (
          <div className="flex items-start gap-2 border-b border-hairline bg-[#fff8e6] px-4 py-2.5 text-[12.5px] text-[#8a6100]">
            <FaTriangleExclamation size={14} className="mt-0.5 shrink-0" />
            <span>
              {formatNumber(hilang)} berkas bertanda <b>Hilang</b>: datanya masih menunjuk berkas itu, tetapi isinya tidak ada di penyimpanan browser ini.
              Unggah ulang dari tempat asalnya bila masih diperlukan.
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(r) => r.kunci}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <div className="px-6 py-14 text-center">
              <p className="text-[14px] font-semibold text-ink">Belum ada berkas yang diunggah.</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-3">
                Berkas yang dilampirkan di trip, nota biaya, kasbon, karyawan, kendaraan, dan kontrak otomatis tampil di sini.
                Dokumen perusahaan yang tidak menempel pada satu trip diunggah lewat tombol Unggah dokumen di kanan atas.
              </p>
            </div>
          }
          notFound={
            <div className="px-6 py-14 text-center">
              <p className="text-[14px] font-semibold text-ink">Berkas tidak ditemukan.</p>
              <p className="mt-1 text-[13px] text-ink-3">Coba periksa kembali kata kunci, jenis, atau tanggal.</p>
              <Button size="sm" className="mt-4" onClick={resetFilter}>Reset filter</Button>
            </div>
          }
        />
        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
        <p className="border-t border-hairline px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">
          Tanggal = tanggal dokumen, nota, atau transaksinya (karyawan & kendaraan: tanggal unggah). Klik gambar kecil untuk melihat berkas.
          Berkas milik trip, nota, karyawan, atau kendaraan diubah dan dihapus dari tempat asalnya lewat tombol tautan; dokumen umum dikelola di sini oleh Manager / Owner.
        </p>
      </Card>

      {unggah && (
        <ModalUnggah
          edit={unggah.edit}
          opsiTrip={opsiTrip}
          tripDate={(id) => transactionRows.find((t) => t.id === id)?.transaction_date ?? ''}
          onClose={() => setUnggah(null)}
          onSimpan={(isi) => {
            if (isi.simpan === 'trip') {
              const t = transactionRows.find((x) => x.id === isi.trip_id)
              create('tripNotes', { trip_id: isi.trip_id, note_date: isi.tanggal, title: isi.judul, notes: isi.catatan, attachments: isi.attachments })
              toast.success(`Dokumen “${isi.judul}” tersimpan di trip ${t?.id_tampil ?? ''}. Bisa dibuka juga di tab Dokumen trip itu.`)
            } else if (unggah.edit) {
              const lama = unggah.edit
              const dilepas = (lama.attachments ?? []).filter((a) => !isi.attachments.includes(a))
              update('dokumen', lama.id, { judul: isi.judul, kategori: isi.kategori, tanggal: isi.tanggal, catatan: isi.catatan, attachments: isi.attachments })
              if (dilepas.length) void hapusLampiran(dilepas)
              toast.success(`Dokumen “${isi.judul}” diperbarui.`)
            } else {
              create('dokumen', { judul: isi.judul, kategori: isi.kategori, tanggal: isi.tanggal, catatan: isi.catatan, attachments: isi.attachments })
              toast.success(`Dokumen umum “${isi.judul}” tersimpan (${isi.attachments.length} berkas).`)
            }
            setUnggah(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus berkas dokumen umum?"
        message={
          <>
            <span className="block font-medium text-ink">{menghapus?.nama || 'Berkas ini'}</span>
            <span className="mt-1 block">
              {sisaBerkas > 0
                ? `Berkas ini dikeluarkan dari dokumen “${dokumenHapus?.judul}”. ${sisaBerkas} berkas lain di dokumen itu tetap tersimpan.`
                : `Ini satu-satunya berkas di dokumen “${dokumenHapus?.judul ?? ''}”, jadi dokumennya ikut dihapus.`}
            </span>
            <span className="mt-1 block text-[12.5px] text-ink-3">Berkas yang sudah dihapus tidak dapat dikembalikan.</span>
          </>
        }
        onCancel={() => setMenghapus(null)}
        onConfirm={hapusBerkas}
      />
    </>
  )
}

/** ISO waktu -> tanggal lokal yyyy-mm-dd (untuk saring & urut). */
function waktuLokal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

interface IsiUnggah {
  simpan: 'umum' | 'trip'
  trip_id: string
  judul: string
  kategori: string
  tanggal: string
  catatan: string
  attachments: string[]
}

/**
 * Unggah dokumen. "Dokumen umum" = tidak menempel pada satu trip (SOP, surat, dokumen
 * perusahaan) dan disimpan di Dokumen. "Dokumen trip" = disimpan ke tab Dokumen trip itu,
 * sama seperti menambah dokumen dari detail trip. Saat mengubah dokumen umum, jenisnya tetap.
 */
function ModalUnggah({ edit, opsiTrip, tripDate, onClose, onSimpan }: {
  edit: Dokumen | null
  opsiTrip: Option[]
  tripDate: (id: string) => string
  onClose: () => void
  onSimpan: (isi: IsiUnggah) => void
}) {
  const [isi, setIsi] = useState<IsiUnggah>(() => edit
    ? { simpan: 'umum', trip_id: '', judul: edit.judul, kategori: edit.kategori || 'Umum', tanggal: edit.tanggal, catatan: edit.catatan, attachments: edit.attachments ?? [] }
    : { simpan: 'umum', trip_id: '', judul: '', kategori: 'Umum', tanggal: todayISO(), catatan: '', attachments: [] })
  /** Tanggal sudah diubah sendiri: memilih trip tidak lagi mengganti tanggalnya. */
  const [tanggalSendiri, setTanggalSendiri] = useState(!!edit)
  const [galat, setGalat] = useState<Partial<Record<'trip_id' | 'judul' | 'tanggal' | 'attachments', string>>>({})
  const keTrip = isi.simpan === 'trip'

  function pilihTrip(id: string | null) {
    setIsi((f) => ({ ...f, trip_id: id ?? '', tanggal: id && !tanggalSendiri ? tripDate(id) || f.tanggal : f.tanggal }))
    setGalat((g) => ({ ...g, trip_id: undefined }))
  }

  function simpan() {
    const g: typeof galat = {}
    if (keTrip && !isi.trip_id) g.trip_id = 'Pilih trip yang memiliki dokumen ini.'
    if (!isi.judul.trim()) g.judul = 'Judul dokumen wajib diisi.'
    if (!isi.tanggal) g.tanggal = 'Tanggal wajib diisi.'
    if (isi.attachments.length === 0) g.attachments = 'Pilih minimal satu berkas.'
    setGalat(g)
    if (Object.keys(g).length > 0) return
    onSimpan({ ...isi, judul: isi.judul.trim(), catatan: isi.catatan.trim() })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? 'Ubah Dokumen Umum' : 'Unggah Dokumen'}
      subtitle={edit ? edit.judul : 'Tanda * wajib diisi. Gambar diperkecil otomatis.'}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>{edit ? 'Simpan Perubahan' : 'Simpan'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {!edit && (
          <fieldset className="sm:col-span-3">
            <legend className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-2">Simpan sebagai</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Radio name="simpan-dokumen" checked={!keTrip} onChange={() => setIsi((f) => ({ ...f, simpan: 'umum' }))}
                label="Dokumen umum" description="Tidak menempel pada satu trip: SOP, surat, dokumen perusahaan." />
              <Radio name="simpan-dokumen" checked={keTrip} onChange={() => setIsi((f) => ({ ...f, simpan: 'trip' }))}
                label="Dokumen trip" description="Masuk ke tab Dokumen trip yang dipilih: BA, surat jalan, foto barang." />
            </div>
          </fieldset>
        )}
        {keTrip && (
          <Field label="Trip" required className="sm:col-span-3" error={galat.trip_id}
            hint="Ketik ID Trip, No. Referensi, plat, atau supir. Tanggal ikut tanggal berangkat trip, boleh diganti.">
            {(fid) => (
              <SearchableSelect id={fid} options={opsiTrip} value={isi.trip_id || null} invalid={!!galat.trip_id}
                placeholder="Pilih trip..." searchPlaceholder="Cari ID Trip, plat, supir..." onChange={pilihTrip} />
            )}
          </Field>
        )}
        <Field label="Judul" required className="sm:col-span-2" error={galat.judul}>
          {(fid) => (
            <Input id={fid} value={isi.judul} invalid={!!galat.judul} placeholder={keTrip ? 'BA bertanda tangan penerima' : 'SOP pemuatan alat berat'}
              onChange={(e) => setIsi((f) => ({ ...f, judul: e.target.value }))} />
          )}
        </Field>
        <Field label="Tanggal" required error={galat.tanggal}>
          {(fid) => (
            <DateInput id={fid} value={isi.tanggal} invalid={!!galat.tanggal}
              onChange={(e) => { setTanggalSendiri(true); setIsi((f) => ({ ...f, tanggal: e.target.value })) }} />
          )}
        </Field>
        {!keTrip && (
          <Field label="Kategori" className="sm:col-span-3">
            {(fid) => (
              <Select id={fid} value={isi.kategori} onChange={(e) => setIsi((f) => ({ ...f, kategori: e.target.value }))}>
                {/* Kategori lama di luar daftar tetap bisa dipertahankan. */}
                {[...KATEGORI_DOKUMEN, ...(isi.kategori && !(KATEGORI_DOKUMEN as readonly string[]).includes(isi.kategori) ? [isi.kategori] : [])].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Berkas" required className="sm:col-span-3" error={galat.attachments}
          hint="Gambar, PDF, atau berkas lain. Boleh lebih dari satu.">
          {(fid) => (
            <LampiranInput id={fid} accept="" label="Tambah berkas" value={isi.attachments}
              onChange={(v) => { setIsi((f) => ({ ...f, attachments: v })); if (v.length) setGalat((g) => ({ ...g, attachments: undefined })) }} />
          )}
        </Field>
        <Field label="Catatan" className="sm:col-span-3">
          {(fid) => (
            <Textarea id={fid} rows={2} value={isi.catatan} className="resize-y" placeholder={keTrip ? 'mis. diterima petugas gudang; fisik menyusul' : 'mis. berlaku mulai Oktober 2026'}
              onChange={(e) => setIsi((f) => ({ ...f, catatan: e.target.value }))} />
          )}
        </Field>
      </div>
    </Modal>
  )
}
