import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCircleCheck, FaCircleInfo, FaPrint, FaTriangleExclamation } from '../../components/ui/icons'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ReportPreview } from '../../components/report/ReportPreview'
import { PrintDocument, PrintPage } from '../../components/report/PrintDocument'
import { useData } from '../../store/DataProvider'
import { formatDate, formatRupiah } from '../../lib/format'
import { formatWaktu } from '../../lib/trip'
import { cn } from '../../lib/utils'
import { PEMBAYAR_LABEL, PERJALANAN_LABEL, PI_TAHAP_LABEL, labelBiaya, labelInternal } from '../../types'
import type { TitikAlamat, TransactionRow } from '../../types'
import { STATUS_LABEL, STATUS_TONE } from './status'
import { labelTermin, susunRekap } from './rekap'
import type { CekRekap, DataRekap } from './rekap'
import { biayaDitagihkan, dibayarPerusahaan } from '../../lib/trip'

/* ── Tampilan layar ──────────────────────────────────────────────────────── */

/** Daftar pemeriksaan rekap: yang kurang paling atas, lalu catatan, lalu yang sudah lengkap. */
export function DaftarCek({ cek, onBuka, sebelumTutup }: {
  cek: CekRekap[]
  onBuka?: (tab: NonNullable<CekRekap['tab']>) => void
  /** Trip belum ditutup: ajak memeriksa sebelum ditutup. */
  sebelumTutup?: boolean
}) {
  const urut = [...cek].sort((a, b) => ['kurang', 'catatan', 'ok'].indexOf(a.tingkat) - ['kurang', 'catatan', 'ok'].indexOf(b.tingkat))
  const kurang = cek.filter((c) => c.tingkat === 'kurang').length
  if (cek.length === 0) return null
  return (
    <section aria-label="Pemeriksaan kelengkapan" className={cn('rounded-lg border px-3.5 py-3', kurang ? 'border-[#f6e2ac] bg-[#fff8e6]' : 'border-[#cfeccf] bg-[#effaef]')}>
      <p className={cn('text-[12.5px] font-semibold', kurang ? 'text-[#8a6100]' : 'text-[#0a7d0a]')}>
        {kurang ? `${kurang} hal masih kurang.${sebelumTutup ? ' Periksa sebelum trip ditutup.' : ''}` : 'Data trip sudah lengkap.'}
      </p>
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {urut.map((c) => (
          <li key={c.teks} className="flex min-w-0 items-start gap-2 text-[12.5px]">
            {c.tingkat === 'ok' ? <FaCircleCheck size={13} className="mt-0.5 shrink-0 text-[#0ca30c]" />
              : c.tingkat === 'kurang' ? <FaTriangleExclamation size={13} className="mt-0.5 shrink-0 text-[#b7791f]" />
              : <FaCircleInfo size={13} className="mt-0.5 shrink-0 text-ink-3" />}
            <span className={cn('min-w-0', c.tingkat === 'ok' ? 'text-ink-2' : c.tingkat === 'kurang' ? 'font-medium text-ink' : 'text-ink-2')}>
              {c.teks}
              {c.tab && c.tingkat !== 'ok' && onBuka && (
                <>
                  {' · '}
                  <button type="button" onClick={() => onBuka(c.tab!)} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
                    {c.tab === 'edit' ? 'Ubah trip' : 'Buka'}
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Judul bagian rekap di layar. */
function JudulBagian({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">{children}</h4>
}

/** Pasangan label + isi pada rekap. */
function Isi({ label, children, lebar }: { label: string; children: ReactNode; lebar?: boolean }) {
  return (
    <div className={cn('min-w-0', lebar && 'sm:col-span-2')}>
      <dt className="text-[11px] font-semibold text-ink-3">{label}</dt>
      <dd className="text-[13px] break-words text-ink">{children}</dd>
    </div>
  )
}

/** "NAMA · alamat · kontak telp" + catatan khusus trip. */
function Titik({ t }: { t?: TitikAlamat }) {
  if (!t?.nama && !t?.alamat) return <span className="text-ink-3">—</span>
  const kontak = [t.kontak, t.telepon].filter(Boolean).join(' ')
  return (
    <span className="block leading-snug">
      <span className="font-medium">{t.nama || '—'}</span>
      {t.alamat && <span className="block text-[12px] text-ink-3">{t.alamat}</span>}
      {kontak && <span className="block text-[12px] text-ink-3">Kontak: {kontak}</span>}
      {t.catatan && <span className="block text-[12px] text-ink-2">Catatan: {t.catatan}</span>}
    </span>
  )
}

/** Tabel kecil rekap di layar. */
function TabelKecil({ kolom, baris, kosong, kaki }: {
  kolom: Array<{ label: string; kanan?: boolean }>
  baris: ReactNode[][]
  kosong: string
  kaki?: ReactNode[]
}) {
  if (baris.length === 0) return <p className="rounded-md border border-dashed border-hairline px-3 py-2.5 text-[12.5px] text-ink-3">{kosong}</p>
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="table table-sm">
        <thead><tr>{kolom.map((k) => <th key={k.label} className={k.kanan ? 'text-right' : undefined}>{k.label}</th>)}</tr></thead>
        <tbody>
          {baris.map((b, i) => <tr key={i}>{b.map((sel, j) => <td key={j} className={cn(kolom[j]?.kanan && 'tnum text-right')}>{sel}</td>)}</tr>)}
        </tbody>
        {kaki && <tfoot><tr>{kaki.map((sel, j) => <td key={j} className={cn(kolom[j]?.kanan && 'tnum text-right')}>{sel}</td>)}</tr></tfoot>}
      </table>
    </div>
  )
}

/** Isi rekap trip untuk layar (modal Rekap Trip dan Tutup Trip). */
export function RekapTripIsi({ data }: { data: DataRekap }) {
  const { trip, angka } = data
  const dedicated = trip.service_type === 'dedicated'
  return (
    <div className="space-y-5">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
        <Isi label="ID Trip"><span className="tnum font-semibold">{trip.transaction_no}</span></Isi>
        <Isi label="Berangkat">{formatDate(trip.transaction_date)}</Isi>
        <Isi label="Klien">{data.klien}</Isi>
        <Isi label="Tipe Layanan">{data.layanan}{data.kontrak && ` · ${data.kontrak}`}</Isi>
        <Isi label="No Referensi"><span className="tnum">{trip.tr_list.join(', ') || '—'}</span></Isi>
        <Isi label="Status"><Badge tone={STATUS_TONE[trip.status]}>{STATUS_LABEL[trip.status]}</Badge></Isi>
        <Isi label="Berita Acara">{trip.printed_at ? `Dicetak ${formatDate(trip.printed_at)}` : 'Belum dicetak'}</Isi>
        <Isi label="Ditutup">{trip.closed_at ? formatDate(trip.closed_at) : '—'}</Isi>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <JudulBagian>Kendaraan &amp; supir</JudulBagian>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Isi label="Kendaraan Utama"><span className="tnum">{trip.plate_number || '—'}</span></Isi>
            <Isi label="Sub Kendaraan / Gandengan">{data.gandengan || '—'}</Isi>
            <Isi label="Supir">{data.supir.join(', ') || '—'}</Isi>
            <Isi label="Manager">{data.manager || '—'}</Isi>
          </dl>
        </section>
        <section>
          <JudulBagian>Rute</JudulBagian>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Isi label="Rute">{trip.route_name || '—'}{trip.route_code && <span className="tnum text-ink-3"> · {trip.route_code}</span>}</Isi>
            <Isi label="Muat → Bongkar">{trip.muat || '—'} → {trip.bongkar || '—'}</Isi>
            <Isi label="Patokan Uang Jalan">{formatRupiah(trip.ujroute)}</Isi>
            {!dedicated && <Isi label="Harga">{formatRupiah(trip.harga)}{trip.harga_khusus && <span className="text-ink-3"> (khusus)</span>}</Isi>}
          </dl>
        </section>
      </div>

      <section>
        <JudulBagian>Informasi pengiriman</JudulBagian>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Isi label="Pick Up Details"><Titik t={trip.pengirim} /></Isi>
          <Isi label="Destination Details"><Titik t={trip.penerima} /></Isi>
          <Isi label="Add Items Details" lebar={!trip.kosongan}>
            {data.muatan.length === 0 ? <span className="text-ink-3">—</span> : (
              <ul className="space-y-0.5">
                {data.muatan.map((m, i) => (
                  <li key={i}><span className="tnum font-medium">{m.id_perjalanan || 'Tanpa ID'}</span>{m.keterangan && <span className="text-ink-2"> · {m.keterangan}</span>}</li>
                ))}
              </ul>
            )}
          </Isi>
          {trip.kosongan && <Isi label="Kosongan">{trip.kosongan}</Isi>}
        </dl>
      </section>

      <section>
        <JudulBagian>Perjalanan</JudulBagian>
        <TabelKecil
          kolom={[{ label: 'Waktu' }, { label: 'Kejadian' }, { label: 'Lokasi' }, { label: 'Catatan' }]}
          baris={data.kejadian.map((e) => [<span className="tnum">{formatWaktu(e.waktu)}</span>, PERJALANAN_LABEL[e.jenis] ?? e.jenis, e.lokasi || '—', e.catatan || '—'])}
          kosong="Belum ada catatan perjalanan."
        />
      </section>

      <section>
        <JudulBagian>Uang jalan</JudulBagian>
        <TabelKecil
          kolom={[{ label: 'Termin' }, { label: 'Tanggal' }, { label: 'Jenis' }, { label: 'Supir' }, { label: 'Uang Jalan', kanan: true }, { label: 'Potong Kasbon', kanan: true }, { label: 'Transfer ke Supir', kanan: true }]}
          baris={data.termin.map((p) => [p.sequence, formatDate(p.payment_date), labelTermin(p), data.namaKaryawan(p.driver_id), formatRupiah(p.uj_amount), p.kasbon_deduction ? formatRupiah(p.kasbon_deduction) : '—', formatRupiah(p.uj_amount - p.kasbon_deduction)])}
          kosong="Uang jalan belum dicatat."
          kaki={['Total', '', '', '', formatRupiah(angka.uj), formatRupiah(angka.kasbon), formatRupiah(angka.tf)]}
        />
      </section>

      <section>
        <JudulBagian>Biaya operasional</JudulBagian>
        <TabelKecil
          kolom={[{ label: 'Jenis' }, { label: 'Tanggal' }, { label: 'Dibayar oleh' }, { label: 'Ke klien' }, { label: 'Nominal', kanan: true }]}
          baris={data.biaya.map((e) => [labelBiaya(e.expense_type), formatDate(e.expense_date), PEMBAYAR_LABEL[e.dibayar ?? 'sopir'], biayaDitagihkan(e) ? 'Ditagihkan' : '—', formatRupiah(e.amount)])}
          kosong="Belum ada biaya operasional."
          kaki={['Total', '', angka.biayaPerusahaan ? `${formatRupiah(angka.biayaPerusahaan)} perusahaan` : '', angka.ditagihkan ? formatRupiah(angka.ditagihkan) : '', formatRupiah(angka.biaya)]}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <JudulBagian>Komisi</JudulBagian>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Isi label="Komisi supir (aturan)">{formatRupiah(trip.komisi_sopir)}</Isi>
            <Isi label="Komisi manager (aturan)">{formatRupiah(trip.komisi_manager)}</Isi>
            <Isi label="Biaya internal dicatat" lebar>
              {data.internal.length === 0 ? '—' : data.internal.map((c) => `${labelInternal(c.cost_type)} ${formatRupiah(c.amount)}`).join(' · ')}
            </Isi>
          </dl>
        </section>
        <section>
          <JudulBagian>Tagihan &amp; netto</JudulBagian>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Isi label="Tagihan ke klien">{formatRupiah(angka.tagihan)}{angka.ditagihkan > 0 && <span className="text-ink-3"> (termasuk biaya {formatRupiah(angka.ditagihkan)})</span>}</Isi>
            <Isi label="No PI / tahap">{trip.pi_number || '—'}{trip.pi_tahap && ` · ${PI_TAHAP_LABEL[trip.pi_tahap]}`}</Isi>
            <Isi label="Uang jalan + biaya perusahaan + komisi">{formatRupiah(angka.ujDihitung + angka.biayaPerusahaan + angka.komisi)}</Isi>
            <Isi label="Perkiraan netto"><span className={cn('font-semibold', angka.netto < 0 && 'text-[color:var(--color-critical)]')}>{formatRupiah(angka.netto)}</span></Isi>
          </dl>
          {trip.status !== 'selesai' && trip.ujroute > angka.uj && (
            <p className="mt-1.5 text-[11.5px] text-ink-3">Selama trip belum ditutup, sisa patokan uang jalan dianggap masih akan dibayar.</p>
          )}
        </section>
      </div>
    </div>
  )
}

/* ── Dokumen cetak ───────────────────────────────────────────────────────── */

/** Tabel bergaris untuk lembar cetak. */
function TabelCetak({ kolom, baris, kosong, kaki }: {
  kolom: Array<{ label: string; kanan?: boolean; lebar?: string }>
  baris: ReactNode[][]
  kosong: string
  kaki?: ReactNode[]
}) {
  return (
    <table className="w-full border-collapse text-[9.5px]">
      <thead>
        <tr>{kolom.map((k) => <th key={k.label} style={k.lebar ? { width: k.lebar } : undefined} className={cn('border border-neutral-500 bg-neutral-100 px-1.5 py-1 font-semibold', k.kanan ? 'text-right' : 'text-left')}>{k.label}</th>)}</tr>
      </thead>
      <tbody>
        {baris.length === 0 ? (
          <tr><td colSpan={kolom.length} className="border border-neutral-500 px-1.5 py-1.5 text-neutral-600">{kosong}</td></tr>
        ) : baris.map((b, i) => (
          <tr key={i}>{b.map((sel, j) => <td key={j} className={cn('border border-neutral-500 px-1.5 py-1 align-top', kolom[j]?.kanan && 'text-right tabular-nums')}>{sel}</td>)}</tr>
        ))}
      </tbody>
      {kaki && baris.length > 0 && (
        <tfoot><tr>{kaki.map((sel, j) => <td key={j} className={cn('border border-neutral-500 px-1.5 py-1 font-semibold', kolom[j]?.kanan && 'text-right tabular-nums')}>{sel}</td>)}</tr></tfoot>
      )}
    </table>
  )
}

const JudulCetak = ({ children }: { children: ReactNode }) => <p className="mt-3 mb-1 text-[10.5px] font-bold uppercase">{children}</p>
const teksTitik = (t?: TitikAlamat) => (t?.nama || t?.alamat
  ? [t.nama, t.alamat, [t.kontak, t.telepon].filter(Boolean).join(' '), t.catatan ? `Catatan: ${t.catatan}` : ''].filter(Boolean).join(' · ')
  : '—')

/** Rekap Trip sebagai dokumen A4 (Cetak / PDF). Trip ramai dicetak dua lembar. */
export function RekapTripDokumen({ data }: { data: DataRekap }) {
  const { trip, angka } = data
  const baris = data.kejadian.length + data.termin.length + data.biaya.length + data.muatan.length
  const duaLembar = baris > 16
  const identitas = (
    <>
      <table className="w-full border-collapse text-[10px]">
        <tbody>
          {[
            ['ID Trip', trip.transaction_no, 'Berangkat', formatDate(trip.transaction_date)],
            ['Klien', data.klien, 'Tipe Layanan', `${data.layanan}${data.kontrak ? ` · ${data.kontrak}` : ''}`],
            ['No Referensi', trip.tr_list.join(', ') || '—', 'Status', STATUS_LABEL[trip.status]],
            ['Kendaraan', `${trip.plate_number || '—'}${data.gandengan ? ` · ${data.gandengan}` : ''}`, 'Supir', data.supir.join(', ') || '—'],
            ['Rute', `${trip.route_name || '—'}${trip.route_code ? ` (${trip.route_code})` : ''}`, 'Manager', data.manager || '—'],
            ['Pick Up', teksTitik(trip.pengirim), 'Destinasi', teksTitik(trip.penerima)],
            ['Barang', data.muatan.map((m) => [m.id_perjalanan, m.keterangan].filter(Boolean).join(' · ')).join('; ') || '—', 'Kosongan', trip.kosongan || '—'],
          ].map((r) => (
            <tr key={r[0]}>
              <th className="w-[15%] border border-neutral-500 bg-neutral-100 px-1.5 py-1 text-left align-top font-semibold">{r[0]}</th>
              <td className="w-[35%] border border-neutral-500 px-1.5 py-1 align-top">{r[1]}</td>
              <th className="w-[15%] border border-neutral-500 bg-neutral-100 px-1.5 py-1 text-left align-top font-semibold">{r[2]}</th>
              <td className="w-[35%] border border-neutral-500 px-1.5 py-1 align-top">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <JudulCetak>Perjalanan</JudulCetak>
      <TabelCetak kolom={[{ label: 'Waktu', lebar: '18%' }, { label: 'Kejadian', lebar: '22%' }, { label: 'Lokasi', lebar: '25%' }, { label: 'Catatan' }]}
        baris={data.kejadian.map((e) => [formatWaktu(e.waktu), PERJALANAN_LABEL[e.jenis] ?? e.jenis, e.lokasi || '—', e.catatan || '—'])}
        kosong="Belum ada catatan perjalanan." />
    </>
  )
  const keuangan = (
    <>
      <JudulCetak>Uang jalan</JudulCetak>
      <TabelCetak
        kolom={[{ label: 'Termin', lebar: '8%' }, { label: 'Tanggal', lebar: '13%' }, { label: 'Jenis', lebar: '15%' }, { label: 'Supir' }, { label: 'Uang Jalan', kanan: true, lebar: '14%' }, { label: 'Potong Kasbon', kanan: true, lebar: '14%' }, { label: 'Transfer', kanan: true, lebar: '14%' }]}
        baris={data.termin.map((p) => [p.sequence, formatDate(p.payment_date), labelTermin(p), data.namaKaryawan(p.driver_id), formatRupiah(p.uj_amount), formatRupiah(p.kasbon_deduction), formatRupiah(p.uj_amount - p.kasbon_deduction)])}
        kosong="Uang jalan belum dicatat."
        kaki={['Total', '', '', '', formatRupiah(angka.uj), formatRupiah(angka.kasbon), formatRupiah(angka.tf)]} />
      <JudulCetak>Biaya operasional</JudulCetak>
      <TabelCetak
        kolom={[{ label: 'Jenis', lebar: '20%' }, { label: 'Tanggal', lebar: '13%' }, { label: 'Dibayar oleh' }, { label: 'Ke klien', lebar: '13%' }, { label: 'Nominal', kanan: true, lebar: '16%' }]}
        baris={data.biaya.map((e) => [labelBiaya(e.expense_type), formatDate(e.expense_date), dibayarPerusahaan(e) ? 'Perusahaan langsung' : 'Supir, dari uang jalan', biayaDitagihkan(e) ? 'Ditagihkan' : '—', formatRupiah(e.amount)])}
        kosong="Belum ada biaya operasional."
        kaki={['Total', '', '', '', formatRupiah(angka.biaya)]} />
      <JudulCetak>Ringkasan keuangan</JudulCetak>
      <TabelCetak
        kolom={[{ label: 'Pos' }, { label: 'Nominal', kanan: true, lebar: '22%' }]}
        baris={[
          ['Harga trip', formatRupiah(angka.harga)],
          ['Biaya ditagihkan ke klien', formatRupiah(angka.ditagihkan)],
          [<span className="font-semibold">Tagihan ke klien{trip.pi_number ? ` (PI ${trip.pi_number})` : ''}</span>, <span className="font-semibold">{formatRupiah(angka.tagihan)}</span>],
          ['Uang jalan (patokan bila belum lunas dibayar)', `− ${formatRupiah(angka.ujDihitung)}`],
          ['Biaya dibayar perusahaan langsung', `− ${formatRupiah(angka.biayaPerusahaan)}`],
          ['Komisi supir', `− ${formatRupiah(angka.komisi)}`],
          [<span className="font-semibold">Perkiraan netto</span>, <span className="font-semibold">{formatRupiah(angka.netto)}</span>],
        ]}
        kosong="" />
      {data.internal.length > 0 && (
        <p className="mt-1 text-[9.5px] text-neutral-700">
          Biaya internal dicatat (tidak mengurangi netto): {data.internal.map((c) => `${labelInternal(c.cost_type)} ${formatRupiah(c.amount)}`).join(' · ')}.
        </p>
      )}
      {data.cek.some((c) => c.tingkat !== 'ok') && (
        <>
          <JudulCetak>Perlu dicek</JudulCetak>
          <ul className="list-disc pl-4 text-[9.5px]">
            {data.cek.filter((c) => c.tingkat !== 'ok').map((c) => <li key={c.teks}>{c.teks}</li>)}
          </ul>
        </>
      )}
      <div className="mt-6 grid grid-cols-3 gap-6 text-center text-[9.5px]">
        {['Dibuat oleh (Admin)', 'Diperiksa (Manager)', 'Disetujui'].map((p) => (
          <div key={p}><p>{p}</p><p className="mt-12 border-t border-neutral-500 pt-1">(..............................)</p></div>
        ))}
      </div>
    </>
  )
  const judul = `Rekap Trip ${trip.transaction_no}`
  const sub = `${formatDate(trip.transaction_date)} · ${trip.plate_number || 'tanpa kendaraan'} · ${data.supir.join(', ') || 'tanpa supir'}`
  return duaLembar ? (
    <>
      <PrintPage title={judul} subtitle={sub} page={1} totalPages={2}>{identitas}</PrintPage>
      <PrintPage title={judul} subtitle={sub} page={2} totalPages={2}>{keuangan}</PrintPage>
    </>
  ) : (
    <PrintPage title={judul} subtitle={sub} page={1} totalPages={1}>{identitas}{keuangan}</PrintPage>
  )
}

/** Preview cetak Rekap Trip (Print / Export PDF). */
export function CetakRekapTrip({ data, onClose }: { data: DataRekap; onClose: () => void }) {
  return (
    <ReportPreview onClose={onClose} onPrint={() => window.print()} orientasiTetap="potret">
      <PrintDocument><RekapTripDokumen data={data} /></PrintDocument>
    </ReportPreview>
  )
}

/** Rekap data satu trip, dibaca dari seluruh data (arsip trip batal ikut). */
export function useRekap(trip: TransactionRow | null): DataRekap | null {
  const { dbAll } = useData()
  return useMemo(() => (trip ? susunRekap(trip, dbAll) : null), [trip, dbAll])
}

/** Menu ⋯ "Rekap Trip": rekap keseluruhan trip, bisa dicetak / disimpan PDF. */
export function ModalRekapTrip({ trip, onClose }: { trip: TransactionRow | null; onClose: () => void }) {
  const data = useRekap(trip)
  const navigate = useNavigate()
  const [cetak, setCetak] = useState(false)
  if (!trip || !data) return null
  if (cetak) return <CetakRekapTrip data={data} onClose={() => setCetak(false)} />
  const buka = (tab: NonNullable<CekRekap['tab']>) => {
    onClose()
    navigate(tab === 'edit' ? `/transaksi/trip/${trip.id}/edit` : `/transaksi/trip/${trip.id}${tab === 'overview' ? '' : `?tab=${tab}`}`)
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Rekap Trip ${trip.transaction_no}`}
      subtitle={[formatDate(trip.transaction_date), trip.plate_number, trip.driver_names].filter(Boolean).join(' · ')}
      footer={
        <>
          <Button onClick={onClose}>Tutup</Button>
          <Button variant="primary" icon={<FaPrint size={14} />} onClick={() => setCetak(true)}>Cetak / PDF</Button>
        </>
      }
    >
      <div className="space-y-5">
        <DaftarCek cek={data.cek} onBuka={buka} sebelumTutup={trip.status === 'aktif' || trip.status === 'menunggu_sopir'} />
        <RekapTripIsi data={data} />
      </div>
    </Modal>
  )
}
