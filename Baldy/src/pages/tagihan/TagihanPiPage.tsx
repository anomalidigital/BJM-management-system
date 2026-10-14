import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaArrowsRotate, FaCheck, FaClipboardCheck, FaFileExport, FaFileInvoiceDollar, FaPrint } from '../../components/ui/icons'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Button, DetailButton } from '../../components/ui/Button'
import { OverflowMenu } from '../../components/ui/Menu'
import type { MenuAction } from '../../components/ui/Menu'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { DateInput, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, NotFoundState } from '../../components/ui/States'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { PrintDocument, PrintPage, chunkRows } from '../../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../../components/report/ReportPreview'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { useTable } from '../../lib/useTable'
import { useFilter } from '../../lib/useFilter'
import { downloadFile, matchesQuery } from '../../lib/utils'
import { formatDate, formatNumber, formatRupiah, galatRentang, rentangTanggal, todayISO } from '../../lib/format'
import { bedaRecord } from '../../lib/audit'
import { biayaDitagihkan, formatWaktu, nomorPiBerikut } from '../../lib/trip'
import { labelBiaya, PI_TAHAP, PI_TAHAP_LABEL } from '../../types'
import type { Alamat, CommissionTransaction, OperationalExpense, PerubahanAudit, PiTahap, TransactionRow } from '../../types'
import { KotakInfo, PesanGalat } from '../trip/bagian'

type TabId = 'siap' | PiTahap | 'semua'

const TONE: Record<PiTahap, 'neutral' | 'brand' | 'warning' | 'good'> = {
  tercetak: 'neutral', dikirim: 'brand', revisi: 'warning', disetujui: 'good', lunas: 'good',
}

/** Nama biaya di Summary Submission PI (OVERNIGHT, ESCORT, ...). */
const NAMA_PI: Record<string, string> = { Nginap: 'OVERNIGHT', Tol: 'TOL', Escort: 'ESCORT' }
const namaBiayaPi = (kode: string) => NAMA_PI[kode] ?? kode.toUpperCase()

/** Nilai satu PI: harga (pokok) + biaya ditagihkan (tambahan). */
type NilaiPi = { pokok: number; tambahan: number; total: number }

/**
 * Baris tabel Tagihan: trip beserta nilai PI yang dipakai tabel, export, dan cetak, yaitu
 * nilai beku saat PI dibuat; trip yang belum ber-PI memakai nilai sekarang.
 */
interface BarisPi extends TransactionRow {
  nilai_pokok: number
  nilai_tambahan: number
  nilai_total: number
  /** Nilai trip sekarang dikurangi nilai PI beku; 0 bila sama atau PI belum dibuat. */
  selisih: number
}

/** Trip yang bisa ditagihkan: selesai, atau batal dengan biaya cancel. */
const bisaDitagih = (t: TransactionRow) => t.status === 'selesai' || (t.status === 'batal' && (t.cancel_fee ?? 0) > 0)

/** Nilai tagihan trip sekarang: harga (trip batal: biaya cancel) + biaya yang ditagihkan. */
function nilaiSekarang(t: TransactionRow): NilaiPi {
  const batal = t.status === 'batal'
  const pokok = batal ? t.cancel_fee ?? 0 : t.harga
  const tambahan = batal ? 0 : t.biaya_ditagihkan
  return { pokok, tambahan, total: pokok + tambahan }
}

function barisPi(t: TransactionRow): BarisPi {
  const beku = t.pi_tahap && t.pi_nilai ? t.pi_nilai : null
  const nilai = beku ?? nilaiSekarang(t)
  return {
    ...t, nilai_pokok: nilai.pokok, nilai_tambahan: nilai.tambahan, nilai_total: nilai.total,
    selisih: beku ? t.tagihan_total - beku.total : 0,
  }
}

/** +Rp 500.000 / −Rp 500.000 */
const rupiahBertanda = (n: number) => `${n > 0 ? '+' : '−'}${formatRupiah(Math.abs(n))}`

/**
 * Isian yang berubah untuk Audit Log. Nilai PI dirinci per bagian (harga, tambahan, total)
 * supaya mudah dibaca, bukan satu teks JSON.
 */
function perubahanPi(lama: CommissionTransaction, patch: Partial<CommissionTransaction>): PerubahanAudit[] {
  const { pi_nilai: baru, ...lain } = patch
  const out = bedaRecord(lama, lain)
  if (baru) {
    const dulu = lama.pi_nilai
    for (const k of ['pokok', 'tambahan', 'total'] as const) {
      if (dulu && dulu[k] === baru[k]) continue
      out.push({ field: `pi_nilai.${k}`, dari: dulu ? formatRupiah(dulu[k]) : '—', ke: formatRupiah(baru[k]) })
    }
  }
  return out
}

/**
 * Titik pick up / destinasi trip untuk export dan rekap: salinan alamat di trip. Trip lama
 * belum punya salinan, jadi dicari di Master Alamat dengan kode area rute yang sama (klien
 * trip atau alamat umum), hanya bila cocoknya tepat satu supaya tidak salah alamat.
 */
function titikTrip(t: TransactionRow, sisi: 'asal' | 'tujuan', master: Alamat[]): { nama: string; alamat: string } | null {
  const titik = sisi === 'asal' ? t.pengirim : t.penerima
  const nama = (titik?.nama ?? '').trim()
  const alamat = (titik?.alamat ?? '').trim()
  if (nama || alamat) return { nama, alamat }
  const kode = ((sisi === 'asal' ? t.area_asal : t.area_tujuan) ?? '').trim().toUpperCase()
  if (!kode) return null
  const cocok = master.filter((a) => a.status !== 'nonaktif' && (a.kode_area ?? '').trim().toUpperCase() === kode && (!a.project_id || a.project_id === t.project_id))
  const pilih = cocok.length > 1 ? cocok.filter((a) => a.project_id === t.project_id) : cocok
  if (pilih.length !== 1) return null
  const a = pilih[0]
  return { nama: (a.nama ?? '').trim(), alamat: [a.alamat, a.kota].map((x) => (x ?? '').trim()).filter(Boolean).join(', ') }
}

/** "Nama, alamat" untuk kolom Detail Origin / Detail Address; tanpa alamat memakai lokasi rute. */
const teksTitik = (p: { nama: string; alamat: string } | null, cadangan: string) =>
  (p ? [p.nama, p.alamat].filter(Boolean).join(', ') : '') || cadangan

/**
 * Tagihan Karawang (alur atasan): trip selesai dan POD-nya diterima dibuatkan PI,
 * lalu dipantau tahapnya sampai lunas: PI Tercetak -> PI Dikirim -> (PI Revisi) ->
 * Disetujui -> Lunas. Satu PI per trip, seperti Summary Submission PI. Nilai PI
 * dibekukan saat PI dibuat; bila nilai trip berubah sesudahnya, barisnya ditandai dan
 * nilainya bisa diperbarui. Halaman ini juga mencetak ringkasan PI dan rekap dokumen
 * (kelengkapan berkas hardcopy yang dikirim ke klien).
 */
export function TagihanPiPage() {
  const { db, dbAll, transactionRows, loading, error, reload, update, denganAudit } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const boleh = bisa('tagihan')

  const [tab, setTab] = useState<TabId>('siap')
  const filter = useFilter({ klien: '', dari: '', sampai: '', pod: '' })
  const { klien, dari, sampai, pod } = filter.nilai
  const d = filter.draf
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [buatPi, setBuatPi] = useState<BarisPi[] | null>(null)
  const [ubah, setUbah] = useState<{ rows: BarisPi[]; tahap: PiTahap } | null>(null)
  const [perbarui, setPerbarui] = useState<BarisPi[] | null>(null)
  const [cetak, setCetak] = useState<BarisPi[] | null>(null)
  const [rekap, setRekap] = useState<BarisPi[] | null>(null)

  /** Nota biaya operasional yang ditagihkan ke klien, per trip. */
  const notaTagih = useMemo(() => {
    const m = new Map<string, OperationalExpense[]>()
    for (const e of dbAll.expenses) {
      if (!biayaDitagihkan(e)) continue
      const list = m.get(e.trip_id) ?? []
      list.push(e)
      m.set(e.trip_id, list)
    }
    return m
  }, [dbAll.expenses])
  // Trip batal hanya menagih biaya cancel, jadi nota biayanya tidak ikut.
  const notaTrip = useCallback((t: TransactionRow) => (t.status === 'batal' ? [] : notaTagih.get(t.id) ?? []), [notaTagih])
  /** Rincian Additional Cost format Summary Submission PI: "TOL 150.000, DEX 500.000". */
  const rincianPi = useCallback(
    (t: TransactionRow, pemisah = ', ') => notaTrip(t).map((e) => `${namaBiayaPi(e.expense_type)} ${formatNumber(e.amount)}`).join(pemisah),
    [notaTrip],
  )

  // Klien tanpa alur dokumen (CASH, order tunai) dibayar langsung, jadi tidak dibuatkan PI.
  // Trip Dedicated ditagihkan lewat kontraknya, bukan PI per trip (TBD-20).
  const tanpaPi = useMemo(() => new Set(dbAll.projects.filter((p) => p.requires_document === false).map((p) => p.id)), [dbAll.projects])
  const semua = useMemo(
    () => transactionRows
      .filter((t) => !!t.pi_tahap || (bisaDitagih(t) && !tanpaPi.has(t.project_id) && t.service_type !== 'dedicated'))
      .map(barisPi),
    [transactionRows, tanpaPi],
  )
  const tahapTrip = (t: TransactionRow): TabId => (t.pi_tahap ?? 'siap')
  const jumlahTab = useMemo(() => {
    const m: Record<string, number> = { semua: semua.length, siap: 0 }
    for (const p of PI_TAHAP) m[p] = 0
    for (const t of semua) m[tahapTrip(t)] = (m[tahapTrip(t)] ?? 0) + 1
    return m
  }, [semua])

  // No. Trip lama tetap bisa dicari walau tidak ditampilkan.
  const search = useCallback(
    (t: BarisPi, q: string) => matchesQuery(q, t.id_tampil, t.transaction_no, t.tr_list.join(' '), t.pi_number, t.plate_number, t.muat, t.bongkar,
      t.route_name, t.project_code, t.driver_names, t.pengirim?.nama, t.penerima?.nama),
    [],
  )
  const extraFilter = useCallback(
    (t: BarisPi) => (tab === 'semua' || tahapTrip(t) === tab) && (!klien || t.project_id === klien)
      && (!dari || t.transaction_date >= dari) && (!sampai || t.transaction_date <= sampai)
      && (!pod || (pod === 'menyusul' ? t.pod_fisik === false : !!t.pod_fisik)),
    [tab, klien, dari, sampai, pod],
  )
  const jumlahFilter = [klien, dari || sampai, pod].filter(Boolean).length
  const chips = [
    (dari || sampai) && { label: `Berangkat ${rentangTanggal(dari, sampai)}`, lepas: () => filter.lepas('dari', 'sampai') },
    klien && { label: `Klien: ${dbAll.projects.find((p) => p.id === klien)?.project_code ?? '—'}`, lepas: () => filter.lepas('klien') },
    pod && { label: pod === 'menyusul' ? 'POD fisik menyusul' : 'POD fisik diterima', lepas: () => filter.lepas('pod') },
  ]
  const table = useTable(semua, {
    search, extraFilter, extraFilterActive: jumlahFilter > 0,
    initialSortKey: 'transaction_date', initialSortDir: 'desc', tieBreakKey: 'transaction_no', pageSize: 10,
  })
  const terpilih = useMemo(() => semua.filter((t) => selected.has(t.id)), [semua, selected])
  const berubahTerpilih = terpilih.filter((t) => t.selisih !== 0)

  function gantiTab(t: string) { setTab(t as TabId); setSelected(new Set()) }
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    const ids = table.pageRows.map((t) => t.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  /** Langkah berikutnya yang wajar dari tiap tahap. */
  const lanjut: Record<PiTahap, PiTahap[]> = {
    tercetak: ['dikirim'], dikirim: ['revisi', 'disetujui'], revisi: ['dikirim', 'disetujui'], disetujui: ['lunas'], lunas: [],
  }
  const AKSI: Record<PiTahap, string> = {
    tercetak: 'Tandai PI Tercetak', dikirim: 'Tandai PI Dikirim', revisi: 'Minta revisi PI', disetujui: 'Tandai Disetujui', lunas: 'Tandai Lunas',
  }

  /** Baris terbaru (data bisa berubah selama dialog terbuka). */
  const terbaru = (id: string) => semua.find((x) => x.id === id)

  /** Buat PI: tahap PI Tercetak, dan nilai PI dibekukan dari nilai trip saat ini. */
  function simpanBuatPi(isi: Array<{ id: string; nomor: string; tanggal: string }>, bukti: string[]) {
    let n = 0
    for (const { id, nomor, tanggal } of isi) {
      const t = terbaru(id)
      if (!t) continue
      const patch: Partial<CommissionTransaction> = {
        pi_number: nomor, pi_tahap: 'tercetak', pi_date: tanggal, pi_tahap_date: tanggal, pi_nilai: nilaiSekarang(t),
        ...(bukti.length ? { pi_attachments: [...(t.pi_attachments ?? []), ...bukti] } : {}),
      }
      denganAudit({
        aksi: 'tahap_pi', entitas: 'transactions', entity_id: id, label: t.id_tampil,
        ringkasan: `PI ${nomor}: Siap PI → ${PI_TAHAP_LABEL.tercetak}`, perubahan: perubahanPi(t, patch),
      }, () => update('transactions', id, patch))
      n++
    }
    toast.success(`${n} PI dibuat dengan tahap PI Tercetak. Nilainya dibekukan.`)
    setBuatPi(null); setSelected(new Set()); setTab('tercetak')
  }

  function simpanTahap(rows: BarisPi[], tahap: PiTahap, tanggal: string, catatan: string, bukti: string[]) {
    for (const r of rows) {
      const t = terbaru(r.id) ?? r
      const patch: Partial<CommissionTransaction> = {
        pi_tahap: tahap, pi_tahap_date: tanggal,
        ...(catatan ? { pi_note: [t.pi_note, `${PI_TAHAP_LABEL[tahap]} ${formatDate(tanggal)}: ${catatan}`].filter(Boolean).join('\n') } : {}),
        ...(bukti.length ? { pi_attachments: [...(t.pi_attachments ?? []), ...bukti] } : {}),
      }
      const dari = t.pi_tahap ? PI_TAHAP_LABEL[t.pi_tahap] : 'Siap PI'
      denganAudit({
        aksi: 'tahap_pi', entitas: 'transactions', entity_id: t.id, label: t.id_tampil,
        ringkasan: `PI ${t.pi_number || t.id_tampil}: ${dari} → ${PI_TAHAP_LABEL[tahap]}`, perubahan: perubahanPi(t, patch),
      }, () => update('transactions', t.id, patch))
    }
    toast.success(`${rows.length} PI menjadi ${PI_TAHAP_LABEL[tahap]}.`)
    setUbah(null); setSelected(new Set())
  }

  /** Timpa nilai PI beku dengan nilai trip sekarang (mis. ada biaya tambahan yang menyusul). */
  function simpanNilai(rows: BarisPi[]) {
    let n = 0
    for (const r of rows) {
      const t = terbaru(r.id)
      if (!t?.pi_nilai || t.selisih === 0) continue
      const baru = nilaiSekarang(t)
      const patch: Partial<CommissionTransaction> = { pi_nilai: baru }
      denganAudit({
        aksi: 'tahap_pi', entitas: 'transactions', entity_id: t.id, label: t.id_tampil,
        ringkasan: `PI ${t.pi_number || t.id_tampil}: nilai PI diperbarui ${formatRupiah(t.pi_nilai.total)} → ${formatRupiah(baru.total)}`,
        perubahan: perubahanPi(t, patch),
      }, () => update('transactions', t.id, patch))
      n++
    }
    toast.success(n ? `Nilai ${n} PI diperbarui mengikuti nilai trip sekarang.` : 'Nilai PI sudah sama dengan nilai trip.')
    setPerbarui(null)
  }

  function exportTabel(rows: BarisPi[]) {
    const kolom = ['No.', 'TR/OR', 'No.Pol', 'Service type shipment', 'Detail Origin', 'Detail Address', 'Buying Trucking',
      'Additional Cost', 'Additional Cost Buying', 'Total Buying', 'Vendor Name', 'Proforma Invoice No.', 'Date submit PI',
      'ATA (Actual Time Arrive) Date', 'Tahap', 'ID Trip']
    const sel = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const baris = rows.map((t, i) => [
      i + 1, t.tr_list.join(', '), t.plate_number, t.status === 'batal' ? 'Cancel Fee' : t.service_type === 'dedicated' ? 'Dedicated' : 'Call-Out',
      teksTitik(titikTrip(t, 'asal', db.alamat), t.muat || t.area_asal), teksTitik(titikTrip(t, 'tujuan', db.alamat), t.bongkar || t.area_tujuan),
      t.nilai_pokok, notaTrip(t).map((e) => `${namaBiayaPi(e.expense_type)} ${e.amount}`).join('; '), t.nilai_tambahan, t.nilai_total,
      'PT. BIMA JAYA MANGGALA', t.pi_number, t.pi_date ? formatDate(t.pi_date) : '', t.ata ? formatWaktu(t.ata).slice(0, 10) : '',
      t.pi_tahap ? PI_TAHAP_LABEL[t.pi_tahap] : 'Siap PI', t.id_tampil,
    ].map(sel).join(';'))
    // BOM supaya Excel membaca huruf dengan benar; pemisah titik koma untuk Excel berbahasa Indonesia.
    downloadFile(`summary-pi-${todayISO()}.csv`, '\uFEFF' + [kolom.map(sel).join(';'), ...baris].join('\r\n'), 'text/csv;charset=utf-8')
    toast.success(`${rows.length} baris diexport. Kirim berkasnya ke finance klien.`)
  }

  const columns: Column<BarisPi>[] = [
    {
      key: 'id_tampil', header: 'ID Trip', sortable: true, width: '128px',
      render: (t) => (
        <div className="leading-tight">
          <Link to={`/transaksi/trip/${t.id}`} className="tnum font-semibold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{t.id_tampil}</Link>
          <div className="tnum text-xs text-ink-3">{formatDate(t.transaction_date)}</div>
        </div>
      ),
    },
    {
      key: 'tr_list', header: 'No. Referensi', sortable: true, width: '140px',
      render: (t) => (
        <div className="leading-tight" title={t.tr_list.join(', ')}>
          <div className="tnum flex items-center gap-1.5 text-ink-2">{t.tr_list[0] ?? '—'}{t.tr_list.length > 1 && <Badge tone="neutral">+{t.tr_list.length - 1}</Badge>}</div>
          {t.project_code && <div className="text-xs text-ink-3">{t.project_code}</div>}
        </div>
      ),
    },
    { key: 'plate_number', header: 'No. Pol', sortable: true, width: '108px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    {
      key: 'bongkar', header: 'Muat → Bongkar', sortable: true,
      render: (t) => (
        <div className="leading-tight">
          <span className="text-ink-2">{t.muat || '?'} → {t.bongkar || '?'}</span>
          <span className="tnum block text-xs text-ink-3">{t.ata ? `ATA ${formatWaktu(t.ata).slice(0, 10)}` : 'ATA belum dicatat'}</span>
        </div>
      ),
    },
    {
      key: 'nilai_pokok', header: 'Harga', sortable: true, align: 'right', width: '124px',
      render: (t) => (
        <div className="tnum leading-tight">
          <span className="font-medium text-ink">{formatRupiah(t.nilai_pokok)}</span>
          {t.status === 'batal' && <span className="block text-[11.5px] text-ink-3">cancel fee</span>}
        </div>
      ),
    },
    {
      key: 'nilai_tambahan', header: 'Tambahan', sortable: true, align: 'right', width: '120px',
      render: (t) => {
        const rincian = notaTrip(t).map((e) => `${labelBiaya(e.expense_type)} ${formatRupiah(e.amount)}`).join(', ')
        return t.nilai_tambahan
          ? <span className="tnum text-ink-2" title={t.selisih ? `Rincian sekarang: ${rincian || 'tidak ada'}` : rincian}>{formatRupiah(t.nilai_tambahan)}</span>
          : <span className="text-ink-3">—</span>
      },
    },
    {
      key: 'nilai_total', header: 'Total', sortable: true, align: 'right', width: '136px',
      render: (t) => (
        <div className="flex flex-col items-end gap-1 leading-tight">
          <span className="tnum font-semibold text-ink">{formatRupiah(t.nilai_total)}</span>
          {t.selisih !== 0 && (
            <span title={`Nilai PI dibekukan ${formatRupiah(t.nilai_total)} saat PI dibuat. Nilai trip sekarang ${formatRupiah(t.tagihan_total)}.`}>
              <Badge tone="warning">Nilai trip berubah {rupiahBertanda(t.selisih)}</Badge>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'pi_tahap', header: 'PI', sortable: true, width: '150px',
      render: (t) => (t.pi_tahap ? (
        <div className="flex flex-col items-start gap-1 leading-tight">
          <span className="tnum text-[12.5px] text-ink">{t.pi_number || '—'}</span>
          <Badge tone={TONE[t.pi_tahap]}>{PI_TAHAP_LABEL[t.pi_tahap]}{t.pi_tahap_date ? ` · ${formatDate(t.pi_tahap_date)}` : ''}</Badge>
        </div>
      ) : <Badge tone="warning">Siap dibuatkan PI</Badge>),
    },
    {
      key: 'bukti', header: 'Bukti', width: '110px',
      render: (t) => ((t.pi_attachments?.length ?? 0) > 0 ? <LampiranThumbs ids={t.pi_attachments!} ukuran={28} /> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'pod', header: 'POD', width: '96px',
      render: (t) => (t.pod_fisik === false ? <Badge tone="warning">Fisik menyusul</Badge> : t.pod_fisik ? <Badge tone="good">Fisik</Badge> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (t) => {
        const aksi: MenuAction[] = [
          ...(!t.pi_tahap
            ? [{ label: 'Buat PI', disabled: !boleh, onSelect: () => setBuatPi([t]) }]
            : lanjut[t.pi_tahap].map((p) => ({ label: AKSI[p], disabled: !boleh, onSelect: () => setUbah({ rows: [t], tahap: p }) }))),
          ...(t.selisih !== 0 ? [{ label: 'Perbarui nilai PI', disabled: !boleh, onSelect: () => setPerbarui([t]) }] : []),
          ...(t.pi_tahap ? [{ label: 'Cetak ringkasan', onSelect: () => setCetak([t]) }] : []),
          { label: 'Cetak rekap dokumen', onSelect: () => setRekap([t]) },
          // Hardcopy POD yang menyusul: dibutuhkan untuk berkas tagihan fisik.
          ...(t.pod_fisik === false ? [{ label: 'Tandai fisik diterima', disabled: !bisa('trip'), onSelect: () => {
            update('transactions', t.id, { pod_fisik: true, pod_fisik_at: todayISO() })
            toast.success(`Dokumen fisik POD ${t.id_tampil} diterima.`)
          } }] : []),
        ]
        return (
          <div className="flex justify-end gap-1">
            <DetailButton label={`Lihat trip ${t.id_tampil}`} onClick={() => navigate(`/transaksi/trip/${t.id}`)} />
            <OverflowMenu actions={aksi} />
          </div>
        )
      },
    },
  ]

  const jumlah = useMemo(() => table.filtered.reduce(
    (a, t) => ({ pokok: a.pokok + t.nilai_pokok, tambahan: a.tambahan + t.nilai_tambahan, total: a.total + t.nilai_total }),
    { pokok: 0, tambahan: 0, total: 0 },
  ), [table.filtered])
  const kaki = (
    <tr className="text-[13px]">
      {/* Kolom pilih + ID Trip, No. Referensi, No. Pol, Muat → Bongkar */}
      <td colSpan={5} className="px-3 py-2.5 text-ink-2">
        Total {formatNumber(table.total)} trip{table.total > table.pageSize ? ' (semua halaman)' : ''}
      </td>
      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(jumlah.pokok)}</td>
      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(jumlah.tambahan)}</td>
      <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(jumlah.total)}</td>
      <td colSpan={4} />
    </tr>
  )

  const tabs = [
    { id: 'siap', label: 'Siap PI', badge: jumlahTab.siap },
    ...PI_TAHAP.map((p) => ({ id: p, label: PI_TAHAP_LABEL[p], badge: jumlahTab[p] })),
    { id: 'semua', label: 'Semua', badge: jumlahTab.semua },
  ]
  const tahapPilihan = tab !== 'siap' && tab !== 'semua' ? lanjut[tab] : []

  if (cetak) {
    return <CetakRingkasan rows={cetak} rincianPi={rincianPi} onClose={() => setCetak(null)} />
  }
  if (rekap) {
    return <CetakRekapDokumen rows={rekap} notaTrip={notaTrip} alamat={db.alamat} onClose={() => setRekap(null)} />
  }

  return (
    <>
      <PageHeader
        title="Tagihan"
        crumbs={[{ label: 'Laporan' }, { label: 'Tagihan' }]}
        description="Pemantauan status PI dan cetak rekap dokumen."
      />

      <Card>
        <Tabs items={tabs} value={tab} onChange={gantiTab} className="px-2" />
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-80" placeholder="Cari ID Trip, No. Referensi, No PI, plat, lokasi..." />
              <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.dari, d.sampai)}>
                <div>
                  <p className="form-label">Tanggal berangkat trip</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} aria-label="Berangkat dari" />
                    <DateInput value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} aria-label="Berangkat sampai" />
                  </div>
                </div>
                <Field label="Klien">
                  {(id) => (
                    <Select id={id} value={d.klien} onChange={(e) => filter.ubah({ klien: e.target.value })}>
                      <option value="">Semua</option>
                      {dbAll.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Dokumen POD">
                  {(id) => (
                    <Select id={id} value={d.pod} onChange={(e) => filter.ubah({ pod: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="fisik">Fisik sudah diterima</option>
                      <option value="menyusul">Fisik menyusul</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={
            <>
              <Button size="sm" icon={<FaFileExport size={14} />} disabled={table.total === 0} onClick={() => exportTabel(table.filtered)}>Export tabel</Button>
              <Button size="sm" icon={<FaPrint size={14} />} disabled={table.total === 0} onClick={() => setCetak(table.filtered)}>Cetak ringkasan</Button>
            </>
          }
        />

        {terpilih.length > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">
              {terpilih.length} trip dipilih · {formatRupiah(terpilih.reduce((a, t) => a + t.nilai_total, 0))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {tab === 'siap' && (
                <Button size="sm" variant="primary" icon={<FaFileInvoiceDollar size={14} />} disabled={!boleh} onClick={() => setBuatPi(terpilih)}>Buat PI</Button>
              )}
              {tahapPilihan.map((p) => (
                <Button key={p} size="sm" disabled={!boleh} onClick={() => setUbah({ rows: terpilih, tahap: p })}>{AKSI[p]}</Button>
              ))}
              {berubahTerpilih.length > 0 && (
                <Button size="sm" icon={<FaArrowsRotate size={14} />} disabled={!boleh} onClick={() => setPerbarui(berubahTerpilih)}>
                  Perbarui nilai PI ({berubahTerpilih.length})
                </Button>
              )}
              <Button size="sm" icon={<FaClipboardCheck size={14} />} onClick={() => setRekap(terpilih)}>Cetak rekap dokumen</Button>
              <Button size="sm" icon={<FaPrint size={14} />} onClick={() => setCetak(terpilih)}>Cetak ringkasan</Button>
              <Button size="sm" icon={<FaFileExport size={14} />} onClick={() => exportTabel(terpilih)}>Export</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan pilihan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || !!klien || tab !== 'semua'}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          footer={kaki}
          empty={<EmptyState entity="trip selesai" />}
          notFound={!table.isFiltered && !klien
            ? (
              <p className="px-6 py-14 text-center text-[13px] text-ink-3">
                {tab === 'siap' ? 'Semua trip yang sudah ditutup sudah dibuatkan PI.' : `Belum ada PI di tahap ${PI_TAHAP_LABEL[tab as PiTahap] ?? tab}.`}
              </p>
            )
            : <NotFoundState onReset={() => { table.reset(); filter.lepasSemua() }} />}
        />
        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <ModalBuatPi
        rows={buatPi}
        nomorAda={dbAll.transactions.map((t) => t.pi_number).filter(Boolean)}
        onClose={() => setBuatPi(null)}
        onSimpan={simpanBuatPi}
      />
      <ModalUbahTahap isi={ubah} onClose={() => setUbah(null)} onSimpan={simpanTahap} />
      <ModalPerbaruiNilai rows={perbarui} onClose={() => setPerbarui(null)} onSimpan={simpanNilai} />
    </>
  )
}

/** Buat PI untuk trip terpilih: nomor berurutan mengikuti format Summary Submission PI. */
function ModalBuatPi({ rows, nomorAda, onClose, onSimpan }: {
  rows: BarisPi[] | null
  nomorAda: string[]
  onClose: () => void
  onSimpan: (isi: Array<{ id: string; nomor: string; tanggal: string }>, bukti: string[]) => void
}) {
  const [tanggal, setTanggal] = useState(todayISO())
  const [nomor, setNomor] = useState<Record<string, string>>({})
  const [bukti, setBukti] = useState<string[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  if (!rows) return null
  const usulan = (t: TransactionRow, i: number) => nomor[t.id] ?? nomorPiBerikut(nomorAda, t.project_code, tanggal, i)

  function simpan() {
    if (!rows) return
    const isi = rows.map((t, i) => ({ id: t.id, nomor: usulan(t, i).trim(), tanggal }))
    if (!tanggal) { setGalat('Tanggal PI wajib diisi.'); return }
    if (isi.some((x) => !x.nomor)) { setGalat('Nomor PI tidak boleh kosong.'); return }
    const semua = [...nomorAda, ...isi.map((x) => x.nomor)].map((x) => x.toUpperCase())
    if (new Set(semua).size < semua.length) { setGalat('Ada nomor PI yang sama dengan PI lain.'); return }
    setNomor({}); setGalat(null); setBukti([])
    onSimpan(isi, bukti)
  }

  return (
    <Modal
      open
      onClose={() => { setNomor({}); setGalat(null); setBukti([]); onClose() }}
      title={`Buat PI untuk ${rows.length} trip`}
      subtitle="Satu PI per trip. Nomor terisi otomatis dan boleh diganti. Harga dan biaya tambahan dibekukan saat PI dibuat."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>Buat PI</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tanggal PI" required>
          {(fid) => <DateInput id={fid} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />}
        </Field>
        <ul className="max-h-72 divide-y divide-grid overflow-y-auto rounded-lg border border-hairline">
          {rows.map((t, i) => (
            <li key={t.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 text-[12.5px]">
                <p className="tnum truncate font-semibold text-ink">{t.id_tampil} · {t.plate_number || 'tanpa mobil'}</p>
                <p className="truncate text-ink-3">{t.tr_list.join(', ') || 'tanpa No. Referensi'} · {formatRupiah(t.nilai_total)}</p>
              </div>
              <Input aria-label={`Nomor PI trip ${t.id_tampil}`} value={usulan(t, i)} className="tnum sm:w-60"
                onChange={(e) => setNomor((n) => ({ ...n, [t.id]: e.target.value }))} />
            </li>
          ))}
        </ul>
        <Field label="Bukti PI" hint={rows.length > 1 ? 'Scan / PDF PI. Dilampirkan ke semua trip yang dipilih.' : 'Scan / PDF PI yang dicetak.'}>
          {(fid) => <LampiranInput id={fid} label="Tambah bukti" value={bukti} onChange={setBukti} />}
        </Field>
        <PesanGalat>{galat}</PesanGalat>
      </div>
    </Modal>
  )
}

/** Bukti yang biasanya menyertai tiap tahap PI. */
const BUKTI_TAHAP: Record<PiTahap, string> = {
  tercetak: 'Scan / PDF PI.',
  dikirim: 'Tanda terima atau email pengiriman PI ke klien.',
  revisi: 'Email / catatan revisi dari klien.',
  disetujui: 'Email konfirmasi atau approval sheet dari klien.',
  lunas: 'Bukti transfer dari klien.',
}

/** Pindah tahap PI: tanggal wajib, catatan wajib untuk revisi. */
function ModalUbahTahap({ isi, onClose, onSimpan }: {
  isi: { rows: BarisPi[]; tahap: PiTahap } | null
  onClose: () => void
  onSimpan: (rows: BarisPi[], tahap: PiTahap, tanggal: string, catatan: string, bukti: string[]) => void
}) {
  const [tanggal, setTanggal] = useState(todayISO())
  const [catatan, setCatatan] = useState('')
  const [bukti, setBukti] = useState<string[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  if (!isi) return null
  const { rows, tahap } = isi

  function simpan() {
    if (!tanggal) { setGalat('Tanggal wajib diisi.'); return }
    if (tahap === 'revisi' && !catatan.trim()) { setGalat('Tulis apa yang perlu direvisi, mis. selisih harga atau biaya tambahan.'); return }
    onSimpan(rows, tahap, tanggal, catatan.trim(), bukti)
    setCatatan(''); setGalat(null); setBukti([])
  }

  return (
    <Modal
      open
      onClose={() => { setCatatan(''); setGalat(null); setBukti([]); onClose() }}
      title={`${PI_TAHAP_LABEL[tahap]}: ${rows.length} PI`}
      subtitle={rows.map((t) => t.pi_number || t.id_tampil).slice(0, 4).join(', ') + (rows.length > 4 ? ', ...' : '')}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tanggal" required>
          {(fid) => <DateInput id={fid} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />}
        </Field>
        <Field label={tahap === 'revisi' ? 'Yang direvisi' : 'Catatan'} required={tahap === 'revisi'}
          hint={tahap === 'disetujui' ? 'mis. dikonfirmasi lewat email finance klien.' : tahap === 'lunas' ? 'mis. nomor bukti transfer.' : undefined}>
          {(fid) => <Textarea id={fid} rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} />}
        </Field>
        <Field label="Bukti" hint={BUKTI_TAHAP[tahap] + (rows.length > 1 ? ' Dilampirkan ke semua PI yang dipilih.' : '')}>
          {(fid) => <LampiranInput id={fid} label="Tambah bukti" value={bukti} onChange={setBukti} />}
        </Field>
        <PesanGalat>{galat}</PesanGalat>
      </div>
    </Modal>
  )
}

/** Konfirmasi menimpa nilai PI beku dengan nilai trip sekarang. */
function ModalPerbaruiNilai({ rows, onClose, onSimpan }: {
  rows: BarisPi[] | null
  onClose: () => void
  onSimpan: (rows: BarisPi[]) => void
}) {
  if (!rows) return null
  const sudahDikirim = rows.filter((t) => t.pi_tahap && t.pi_tahap !== 'tercetak').length
  return (
    <Modal
      open
      onClose={onClose}
      title={rows.length > 1 ? `Perbarui nilai ${rows.length} PI` : 'Perbarui nilai PI'}
      subtitle="Nilai PI dibekukan saat PI dibuat. Nilai di bawah ini akan diganti dengan nilai trip sekarang."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" icon={<FaArrowsRotate size={14} />} onClick={() => onSimpan(rows)}>Perbarui nilai PI</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="max-h-72 divide-y divide-grid overflow-y-auto rounded-lg border border-hairline">
          {rows.map((t) => {
            const baru = nilaiSekarang(t)
            return (
              <li key={t.id} className="px-3 py-2.5 text-[12.5px]">
                <p className="tnum font-semibold text-ink">PI {t.pi_number || '—'} · {t.id_tampil}</p>
                <p className="tnum mt-0.5 text-ink-2">
                  {formatRupiah(t.nilai_total)} → <span className="font-semibold text-ink">{formatRupiah(baru.total)}</span>
                  <span className="ml-1.5 text-ink-3">({rupiahBertanda(t.selisih)})</span>
                </p>
                <p className="tnum text-[12px] text-ink-3">
                  Harga {formatRupiah(baru.pokok)} · tambahan {formatRupiah(baru.tambahan)}
                </p>
              </li>
            )
          })}
        </ul>
        {sudahDikirim > 0 && (
          <KotakInfo nada="peringatan">
            {sudahDikirim > 1 ? `${sudahDikirim} PI` : 'PI ini'} sudah dikirim ke klien. Setelah nilainya diperbarui, kirim ulang PI-nya
            atau tandai PI Revisi supaya klien tahu ada perubahan.
          </KotakInfo>
        )}
      </div>
    </Modal>
  )
}

/** Ringkasan PI (gabungan PI / shipment summary) dalam format tabel Summary Submission. */
function CetakRingkasan({ rows, rincianPi, onClose }: {
  rows: BarisPi[]
  rincianPi: (t: TransactionRow) => string
  onClose: () => void
}) {
  const total = rows.reduce((a, t) => a + t.nilai_total, 0)
  return (
    <ReportPreview onClose={onClose} onPrint={() => window.print()} orientasiAwal="lanskap">
      {(orientasi) => {
        const per = barisPerLembar(orientasi, 22)
        const pages = chunkRows(rows, per)
        return (
          <PrintDocument>
            {pages.map((isi, i) => (
              <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Summary Submission PI" subtitle="PT Bima Jaya Manggala"
                meta={[{ label: 'Jumlah PI', value: formatNumber(rows.length) }, { label: 'Total', value: formatRupiah(total) }]}>
                <PrintTable cols={[
                  { label: 'No.', align: 'right', width: '4%' }, { label: 'TR/OR', width: '13%' }, { label: 'No.Pol', width: '9%' },
                  { label: 'Origin' }, { label: 'Destination' }, { label: 'Trucking', align: 'right' },
                  { label: 'Additional Cost', width: '16%' }, { label: 'Total', align: 'right' }, { label: 'No. PI', width: '15%' }, { label: 'ATA', width: '8%' },
                ]}>
                  {isi.map((t, ri) => (
                    <PRow key={t.id}>
                      <PCell align="right">{i * per + ri + 1}</PCell>
                      <PCell>{t.tr_list.join(', ') || '-'}</PCell>
                      <PCell>{t.plate_number || '-'}</PCell>
                      <PCell>{t.muat || '-'}</PCell>
                      <PCell>{t.bongkar || '-'}</PCell>
                      <PCell align="right">{formatNumber(t.nilai_pokok)}</PCell>
                      <PCell>{rincianPi(t) || '-'}</PCell>
                      <PCell align="right" bold>{formatNumber(t.nilai_total)}</PCell>
                      <PCell>{t.pi_number || '-'}</PCell>
                      <PCell>{t.ata ? formatWaktu(t.ata).slice(0, 10) : '-'}</PCell>
                    </PRow>
                  ))}
                  {i === pages.length - 1 && (
                    <PRow tone="total">
                      <PCell align="right" colSpan={7}>TOTAL</PCell>
                      <PCell align="right">{formatNumber(total)}</PCell>
                      <PCell colSpan={2} />
                    </PRow>
                  )}
                </PrintTable>
              </PrintPage>
            ))}
          </PrintDocument>
        )
      }}
    </ReportPreview>
  )
}

/** Kotak centang di lembar cetak: tercentang = sudah ada di sistem; strip = tidak perlu. */
function Kotak({ ada }: { ada: boolean | null }) {
  return (
    <span className="grid h-3.5 w-3.5 shrink-0 place-items-center border border-black">
      {ada === true && <FaCheck size={10} />}
      {ada === null && <span style={{ display: 'block', width: 6, height: 1, background: '#000' }} />}
    </span>
  )
}

function BarisCek({ ada, children, ket }: { ada: boolean | null; children: ReactNode; ket?: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <Kotak ada={ada} />
      <span className="min-w-0">
        {children}
        {ket && <span className="text-neutral-600"> · {ket}</span>}
      </span>
    </li>
  )
}

/**
 * Rekap dokumen tagihan per trip, untuk menyiapkan berkas hardcopy ke klien (catatan proses
 * PI DHL): kelengkapan yang tercatat di sistem tercentang otomatis, dokumen dari luar sistem
 * (Approval Sheet, Invoice, Faktur Pajak, Shipment Summary) dicentang manual di kertas.
 */
function CetakRekapDokumen({ rows, notaTrip, alamat, onClose }: {
  rows: BarisPi[]
  notaTrip: (t: TransactionRow) => OperationalExpense[]
  alamat: Alamat[]
  onClose: () => void
}) {
  const total = rows.reduce((a, t) => a + t.nilai_total, 0)
  const klien = [...new Set(rows.map((t) => t.project_code).filter(Boolean))].join(', ')
  // Tata letak blok per trip hanya pas di kertas potret (3 trip per lembar), jadi orientasinya dikunci.
  const per = 3
  const pages = chunkRows(rows, per)
  return (
    <ReportPreview onClose={onClose} onPrint={() => window.print()} orientasiTetap="potret">
      <PrintDocument>
        {pages.map((isi, i) => (
          <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Rekap Dokumen PI" subtitle="Kelengkapan berkas tagihan per trip"
            meta={[
              { label: 'Jumlah trip', value: formatNumber(rows.length) },
              { label: 'Total nilai PI', value: formatRupiah(total) },
              { label: 'Klien', value: klien || '-' },
            ]}>
            <div className="space-y-3">
              {isi.map((t, ri) => (
                <RekapTrip key={t.id} no={i * per + ri + 1} t={t} nota={notaTrip(t)} alamat={alamat} />
              ))}
            </div>
          </PrintPage>
        ))}
      </PrintDocument>
    </ReportPreview>
  )
}

function RekapTrip({ no, t, nota, alamat }: { no: number; t: BarisPi; nota: OperationalExpense[]; alamat: Alamat[] }) {
  const batal = t.status === 'batal'
  const asal = titikTrip(t, 'asal', alamat)
  const tujuan = titikTrip(t, 'tujuan', alamat)
  const podFoto = t.pod_attachments?.length ?? 0
  const buktiPi = t.pi_attachments?.length ?? 0
  const lampiranNota = nota.reduce((a, e) => a + (e.attachments?.length ?? 0), 0)
  const notaTanpaLampiran = nota.filter((e) => !(e.attachments?.length)).length
  const jumlahNota = nota.reduce((a, e) => a + e.amount, 0)

  const statusPod = t.pod_fisik ? `fisik diterima${t.pod_fisik_at ? ` ${formatDate(t.pod_fisik_at)}` : ''}`
    : t.pod_fisik === false ? 'baru foto, fisik menyusul'
    : batal ? 'tidak ada (trip batal)' : 'belum dicatat'

  const info: Array<[string, ReactNode]> = [
    ['Rute', <>{t.muat || '?'} → {t.bongkar || '?'}{t.route_name ? <span className="text-neutral-600"> ({t.route_name})</span> : null}</>],
    ['Pick up → Destinasi', `${asal?.nama || t.muat || '-'} → ${tujuan?.nama || t.bongkar || '-'}`],
    ['Mobil / Supir', `${t.plate_number || '-'} · ${t.driver_names || '-'}`],
    ['PI', t.pi_tahap
      ? `${t.pi_number || '-'} · ${formatDate(t.pi_date)} · ${PI_TAHAP_LABEL[t.pi_tahap]}`
      : 'Belum dibuatkan PI'],
    ['Nilai PI', (
      <>
        Harga {formatRupiah(t.nilai_pokok)} + tambahan {formatRupiah(t.nilai_tambahan)} = <b>{formatRupiah(t.nilai_total)}</b>
        <span className="text-neutral-600">
          {t.pi_tahap ? ' (beku saat PI dibuat)' : ' (nilai trip sekarang)'}
          {t.selisih !== 0 && ` · nilai trip sekarang ${formatRupiah(t.tagihan_total)} (${rupiahBertanda(t.selisih)})`}
        </span>
      </>
    )],
    // Status POD tidak diulang di sini: sudah ada di daftar kelengkapan (POD foto & POD fisik).
  ]

  // Satu blok tidak boleh terpotong ke halaman berikutnya saat dicetak.
  return (
    <article className="border border-neutral-400 text-[10px]" style={{ breakInside: 'avoid' }}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 border-b border-neutral-400 bg-neutral-100 px-2 py-1 text-[11px]">
        <p className="font-bold">{no}. ID Trip {t.id_tampil}{batal ? ' (batal, cancel fee)' : ''}</p>
        <p>No. Referensi: <b>{t.tr_list.join(', ') || '-'}</b>{t.project_code ? ` · ${t.project_code}` : ''}</p>
      </header>
      <table className="w-full border-collapse">
        <tbody>
          {info.map(([label, nilai]) => (
            <tr key={label}>
              <th scope="row" className="w-28 px-2 py-px text-left align-top font-semibold whitespace-nowrap">{label}</th>
              <td className="px-2 py-px align-top">{nilai}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 grid grid-cols-2 border-t border-neutral-400">
        <section className="border-r border-neutral-400 px-2 py-1">
          <h3 className="mb-1 font-semibold">Kelengkapan di sistem</h3>
          <ul className="space-y-1">
            <BarisCek ada={t.printed_at ? true : batal ? null : false} ket={t.printed_at ? formatDate(t.printed_at) : batal ? 'trip batal' : 'belum dicetak'}>
              Berita Acara dicetak
            </BarisCek>
            <BarisCek ada={podFoto > 0 ? true : batal ? null : false} ket={podFoto > 0 ? `${podFoto} berkas` : batal ? 'trip batal' : 'belum diunggah'}>
              POD foto
            </BarisCek>
            <BarisCek ada={t.pod_fisik === true ? true : batal ? null : false} ket={statusPod}>POD fisik</BarisCek>
            <BarisCek
              ada={nota.length === 0 ? null : notaTanpaLampiran === 0}
              ket={nota.length === 0
                ? 'tidak ada biaya ditagihkan'
                : `${nota.length} nota · ${formatRupiah(jumlahNota)} · ${lampiranNota} lampiran${notaTanpaLampiran ? ` (${notaTanpaLampiran} nota belum ada lampiran)` : ''}`}
            >
              Nota biaya ditagihkan
            </BarisCek>
            <BarisCek ada={buktiPi > 0} ket={buktiPi > 0 ? `${buktiPi} berkas` : t.pi_tahap ? 'belum diunggah' : 'PI belum dibuat'}>
              Scan / bukti PI
            </BarisCek>
          </ul>
        </section>
        <section className="px-2 py-1">
          <h3 className="mb-1 font-semibold">Dokumen luar sistem (centang manual)</h3>
          <ul className="space-y-1">
            <BarisCek ada={false}>Approval Sheet (portal DHL)</BarisCek>
            <BarisCek ada={false}>Invoice</BarisCek>
            <BarisCek ada={false}>Faktur Pajak (2 lembar)</BarisCek>
            <BarisCek ada={false}>Shipment Summary (gabungan PI)</BarisCek>
            <BarisCek ada={false}>Lainnya: ..............................</BarisCek>
          </ul>
        </section>
      </div>
    </article>
  )
}
