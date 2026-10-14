import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaFloppyDisk, FaPlus, FaPrint, FaXmark } from '../../components/ui/icons'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button, IconButton } from '../../components/ui/Button'
import { DateInput, Field, Input } from '../../components/ui/Field'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import type { Option } from '../../components/ui/SearchableSelect'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { formatRupiah, todayISO } from '../../lib/format'
import { nomorTripBerikut } from '../../lib/kode'
import { idBackload, kodeAreaRute, kunciTr, muatanTrip, normalKodeArea, trTrip } from '../../lib/trip'
import { CLIENT_TYPE_LABEL } from '../../types'
import type { Alamat, CommissionTransaction, ItemMuatan, Route, ServiceType, TitikAlamat, TripStatus } from '../../types'
import { STATUS_LABEL } from './status'
import { KunciTrip, tripSudahJalan } from './KunciTrip'
import { ModalRute } from '../master/FormRute'
import { ModalAlamat } from '../master/FormAlamat'
import { Bagian, KotakInfo, NilaiInfo, Peringatan, TombolTeks } from './form/Bagian'
import { NoReferensiInput } from './form/NoReferensiInput'
import { PilihAlamatTrip, TITIK_LAMA, samaArea, samaTitik, titikDariAlamat, titikRapi, titikTerisi } from './form/TitikAlamatInput'
import { alasanDitahan, labelGandengan, opsiGandengan, petaDitahan, rapikanGandengan } from './form/aturan'

/** Isian form trip Karawang (satu trip = satu mobil), urut mock atasan 13 Okt 2026 (1a + 1b). */
interface Isian {
  /** Klien trip; tipe layanan (Callout / Dedicated) terdeteksi dari klien ini. */
  klien: string
  contract_id: string
  /** No. Referensi (TR DHL / Order Release) dari klien. */
  tr: string[]
  transaction_date: string
  vehicle_id: string
  gandengan: string
  /** Supir utama di urutan pertama, sisanya pendamping. */
  driver_ids: string[]
  route_id: string
  harga: number
  override_note: string
  override_attachments: string[]
  /** Id Master Alamat, TITIK_LAMA (isian lama trip ini), atau kosong. */
  pengirim: string
  catatan_pengirim: string
  penerima: string
  catatan_penerima: string
  /** Add Items Details: ID Perjalanan + keterangan barang. */
  muatan: ItemMuatan[]
  kosongan: string
}

type Galat = Partial<Record<'klien' | 'contract_id' | 'transaction_date' | 'vehicle_id' | 'route_id', string>>

/** Field trip yang tidak diisi di form ini (milik Priok / dokumen / penutupan), untuk trip baru. */
const FIELD_LAIN = {
  sj_no: '', recipient_name: '', recipient_address_1: '', recipient_address_2: '',
  job_order_id: '', party: '', goods_type: '', kosongan: '', location: '', ship: '', destination_detail: '',
  tr_reference: '', pi_number: '', pi_status: '', is_marked: false, bon_date: null, personal_bon: 0,
  printed_at: null, cancelled_at: null, cancel_reason: '', cancel_settlement: [], container_no: '',
  manager_id: '', manager_name: '', notes: '', lokasi_muat: '', lokasi_bongkar: '',
} satisfies Partial<CommissionTransaction>

const itemKosong = (): ItemMuatan => ({ id_perjalanan: '', keterangan: '' })

/**
 * Form Tambah / Ubah Trip workspace Karawang, disederhanakan mengikuti mock atasan 13 Okt 2026
 * (1a & 1b = satu form dari atas ke bawah): Konfigurasi (Klien, No Referensi) · Informasi
 * Kendaraan dan Supir · Informasi Pengiriman (Rute, lalu Pick Up & Destination Details berikut
 * catatannya, Add Items Details, Kosongan). Kode Trip langsung dibuat saat Tambah Trip diklik dan
 * menjadi judul. Tipe layanan ikut klien. Backload tidak dipilih di sini: dibuka dari menu ⋯
 * tabel trip ("Ada Backload / Lanjutan", ?backload=<id trip asal>).
 */
export function FormTripKarawang({ mode, tripId, backloadDari }: {
  mode: 'create' | 'edit'
  tripId?: string
  /** Buat backload / lanjutan dari trip ini: kendaraan & supir ikut trip asal. */
  backloadDari?: string
}) {
  const navigate = useNavigate()
  const { db, dbAll, transactionRows, buatTrip, ubahTrip } = useData()
  const { bisa, user } = useAuth()
  const toast = useToast()
  const bolehSimpan = bisa('trip')
  const bolehOverride = bisa('override')
  const bolehMaster = bisa('master')
  const akarRef = useRef<HTMLDivElement>(null)

  const existing = mode === 'edit' ? db.transactions.find((t) => t.id === tripId) : undefined
  const calonAsal = mode === 'create' && backloadDari ? transactionRows.find((t) => t.id === backloadDari) : undefined
  /** Trip asal backload; trip yang sudah dibatalkan tidak bisa dilanjutkan. */
  const asal = calonAsal && calonAsal.status !== 'batal' ? calonAsal : undefined
  const backload = !!asal
  const daftarAlamat = useMemo(() => db.alamat ?? [], [db.alamat])
  const ruteMap = useMemo(() => new Map(db.routes.map((r) => [r.id, r])), [db.routes])
  const klienMap = useMemo(() => new Map(db.projects.map((p) => [p.id, p])), [db.projects])
  const semuaNomor = useMemo(() => dbAll.transactions.filter((t) => t.id !== existing?.id).map((t) => t.transaction_no), [dbAll.transactions, existing?.id])
  /** Kode area pick up backload: area tujuan / lokasi bongkar trip asal. */
  const areaBackload = asal ? asal.area_tujuan || normalKodeArea(asal.bongkar) : ''

  /** Kode Trip: dibuat sekali saat form dibuka (mock: "langsung ter-generate begitu Tambah Trip diklik"). */
  const [kodeAwal] = useState(() => existing?.transaction_no
    ?? (asal ? idBackload(asal.transaction_no, semuaNomor) : nomorTripBerikut(semuaNomor, todayISO())))

  /** Titik trip lama yang diketik manual (tanpa Master Alamat) tetap bisa dipertahankan. */
  const titikLama = (t: TitikAlamat | undefined) => (t && titikTerisi(t) && !(t.alamat_id && daftarAlamat.some((a) => a.id === t.alamat_id)) ? t : undefined)
  const pengirimLama = titikLama(existing?.pengirim)
  const penerimaLama = titikLama(existing?.penerima)
  const nilaiTitik = (t: TitikAlamat | undefined) => (!t ? '' : t.alamat_id && daftarAlamat.some((a) => a.id === t.alamat_id) ? t.alamat_id : titikTerisi(t) ? TITIK_LAMA : '')

  /** Isian awal; mode ubah: pembanding supaya nilai yang tidak disentuh disimpan apa adanya. */
  const [awal] = useState<Isian>(() => {
    if (existing) {
      const r = ruteMap.get(existing.route_id)
      const sopir = existing.driver_ids?.length ? existing.driver_ids : existing.driver_id ? [existing.driver_id] : []
      const konfigurasi = db.vehicles.find((v) => v.id === existing.vehicle_id)?.configuration ?? ''
      const muatan = muatanTrip(existing)
      return {
        klien: existing.project_id ?? '', contract_id: existing.contract_id ?? '', tr: trTrip(existing),
        transaction_date: existing.transaction_date, vehicle_id: existing.vehicle_id ?? '',
        gandengan: rapikanGandengan(existing.gandengan ?? konfigurasi), driver_ids: sopir.length ? [...sopir] : [''],
        route_id: existing.route_id ?? '', harga: existing.cost_value || r?.price || 0,
        override_note: existing.override_note ?? '', override_attachments: existing.override_attachments ?? [],
        pengirim: nilaiTitik(existing.pengirim), catatan_pengirim: existing.pengirim?.catatan ?? '',
        penerima: nilaiTitik(existing.penerima), catatan_penerima: existing.penerima?.catatan ?? '',
        muatan: muatan.length ? muatan.map((m) => ({ ...m })) : [itemKosong()], kosongan: existing.kosongan ?? '',
      }
    }
    const konfigurasiAsal = asal ? db.vehicles.find((v) => v.id === asal.vehicle_id)?.configuration ?? '' : ''
    // Backload: barang balik diambil dari tempat bongkar trip asal (penerimanya menjadi pick up).
    const pickupAsal = asal?.penerima?.alamat_id && daftarAlamat.some((a) => a.id === asal.penerima?.alamat_id) ? asal.penerima.alamat_id : ''
    return {
      klien: asal?.project_id ?? '', contract_id: asal?.service_type === 'dedicated' ? asal.contract_id ?? '' : '', tr: [],
      transaction_date: todayISO(), vehicle_id: asal?.vehicle_id ?? '', gandengan: rapikanGandengan(asal?.gandengan || konfigurasiAsal),
      driver_ids: asal?.driver_ids.length ? [...asal.driver_ids] : [''], route_id: '', harga: 0, override_note: '', override_attachments: [],
      pengirim: pickupAsal, catatan_pengirim: '', penerima: '', catatan_penerima: '', muatan: [itemKosong()], kosongan: '',
    }
  })
  const [f, setF] = useState<Isian>(awal)
  const [galat, setGalat] = useState<Galat>({})
  /** Petunjuk isian otomatis Pick Up / Destinasi dari area rute. */
  const [otomatis, setOtomatis] = useState<{ pengirim?: boolean; penerima?: boolean }>({})
  /** Trip Aktif / Selesai: klien & kontrak, kendaraan, gandengan, supir, rute dikunci; Manager / Owner boleh membuka. */
  const sudahJalan = mode === 'edit' && tripSudahJalan(existing?.status)
  const [bukaKunci, setBukaKunci] = useState(false)
  const kunci = sudahJalan && !bukaKunci
  const [tambahRute, setTambahRute] = useState(false)
  /** Form Tambah Alamat dari dropdown Pick Up / Destination, dengan ketikan pencarian sebagai nama. */
  const [tambahAlamat, setTambahAlamat] = useState<{ sisi: 'pengirim' | 'penerima'; nama: string; kode?: string } | null>(null)

  const klien = klienMap.get(f.klien)
  const layanan: ServiceType = klien?.client_type ?? (existing?.service_type ?? 'callout')
  const dedicated = layanan === 'dedicated'
  const rute = ruteMap.get(f.route_id)
  const area = rute ? kodeAreaRute(rute) : { asal: '', tujuan: '' }
  const kendaraan = db.vehicles.find((v) => v.id === f.vehicle_id)
  const kontrakKlien = useMemo(
    () => db.contracts.filter((c) => c.project_id === f.klien && (c.status === 'aktif' || c.id === f.contract_id)),
    [db.contracts, f.klien, f.contract_id],
  )
  const kontrak = db.contracts.find((c) => c.id === f.contract_id)
  /** Backload: kendaraan & supir mengikuti trip asal dan terkunci. */
  const kunciMobil = kunci || (backload && !!asal?.vehicle_id)
  const kunciSupir = kunci || (backload && (asal?.driver_ids.length ?? 0) > 0)
  /** Trip lama bisa saja belum lengkap; jangan paksa diisi hanya karena diubah. */
  const wajib = (adaSebelumnya: boolean) => mode === 'create' || adaSebelumnya

  /* ── Pilihan ─────────────────────────────────────────── */
  const opsiKlien = useMemo<Option[]>(() => db.projects
    .filter((p) => p.status !== 'nonaktif' || p.id === f.klien)
    .map((p) => ({ value: p.id, label: p.project_name, keywords: p.project_code, meta: `${p.project_code} · ${CLIENT_TYPE_LABEL[p.client_type] ?? 'Callout'}` })),
  [db.projects, f.klien])

  /** Rute yang pernah dipakai klien ini paling atas; backload: rute dari lokasi bongkar trip asal. */
  const opsiRute = useMemo<Option[]>(() => {
    const pakai = new Map<string, number>()
    for (const t of transactionRows) if (t.project_id && t.project_id === f.klien && t.route_id) pakai.set(t.route_id, (pakai.get(t.route_id) ?? 0) + 1)
    const dariBongkar = (r: Route) => !!areaBackload && samaArea(kodeAreaRute(r).asal, areaBackload)
    return [...db.routes]
      .sort((a, b) => Number(dariBongkar(b)) - Number(dariBongkar(a)) || (pakai.get(b.id) ?? 0) - (pakai.get(a.id) ?? 0)
        || (a.route_name || a.route_code).localeCompare(b.route_name || b.route_code, 'id'))
      .map((r) => {
        const a = kodeAreaRute(r)
        return {
          value: r.id,
          label: r.route_name || r.route_code,
          meta: [dariBongkar(r) ? 'dari lokasi bongkar trip asal' : '', pakai.get(r.id) ? `${pakai.get(r.id)}× dipakai klien ini` : '', `No. ${r.route_code}`, `Uang jalan ${formatRupiah(r.ujroute)}`]
            .filter(Boolean).join(' · '),
          keywords: `${r.route_code} ${r.route_code_lama ?? ''} ${a.asal} ${a.tujuan}`,
        }
      })
  }, [db.routes, transactionRows, f.klien, areaBackload])

  const opsiKontrak: Option[] = kontrakKlien.map((c) => ({ value: c.id, label: c.contract_no, meta: `Nilai ${formatRupiah(c.value)}${c.status !== 'aktif' ? ' · selesai' : ''}` }))

  /** Kendaraan & supir yang masih di trip lain dan belum kembali ke pool. */
  const ditahan = useMemo(() => petaDitahan(transactionRows, [existing?.id, asal?.id]), [transactionRows, existing?.id, asal?.id])
  /** Trip lain yang menahan kendaraan ini; kendaraan lama trip yang sedang diubah tetap boleh dipakai. */
  const tahanKendaraan = (vid: string) => (vid && vid !== existing?.vehicle_id ? ditahan.kendaraan.get(vid) : undefined)
  const opsiKendaraan = useMemo<Option[]>(() => {
    const daftar = db.vehicles.map((v) => {
      const t = v.id !== existing?.vehicle_id ? ditahan.kendaraan.get(v.id) : undefined
      return {
        value: v.id, label: v.plate_number, disabled: !!t,
        meta: t ? alasanDitahan(t) : [labelGandengan(v.configuration), v.vehicle_type, v.status !== 'aktif' ? v.status : ''].filter(Boolean).join(' · '),
        keywords: `${v.configuration} ${v.vehicle_type}`,
      }
    })
    // Yang bisa dipilih di atas; yang masih di trip lain di bawah, lengkap dengan alasannya.
    return [...daftar.filter((o) => !o.disabled), ...daftar.filter((o) => o.disabled)]
  }, [db.vehicles, ditahan, existing?.vehicle_id])

  const sopirTerdaftar = useMemo(() => db.drivers.filter((d) => d.role === 'sopir'), [db.drivers])
  /** Supir nonaktif tetap muncul bila sudah tercatat di trip ini; supir yang masih di trip lain diberi keterangan. */
  const opsiSupir = (pilihanIni: string): Option[] => sopirTerdaftar
    .filter((d) => d.status === 'aktif' || d.id === pilihanIni)
    .filter((d) => d.id === pilihanIni || !f.driver_ids.includes(d.id))
    .map((d) => {
      const t = ditahan.supir.get(d.id)
      return {
        value: d.id, label: `${d.driver_code} — ${d.driver_name}`, keywords: d.driver_name,
        meta: t ? `${alasanDitahan(t)}${t.plate_number ? ` (${t.plate_number})` : ''}` : [d.address_2, d.city].filter(Boolean).join(', '),
      }
    })

  /** No. Referensi yang sudah dipakai trip lain: wajar untuk satu order banyak mobil, cukup diberi tahu. */
  const refLain = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const t of transactionRows) {
      if (t.id === existing?.id || t.status === 'batal') continue
      for (const no of t.tr_list) m.set(kunciTr(no), [...(m.get(kunciTr(no)) ?? []), `${t.id_tampil}${t.plate_number ? ` (${t.plate_number})` : ''}`])
    }
    return m
  }, [transactionRows, existing?.id])

  if (mode === 'edit' && !existing) {
    return (
      <>
        <PageHeader title="Trip tidak ditemukan" crumbs={[{ label: 'Trip / Job Order', to: '/transaksi/trip' }]} />
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
  if (existing?.status === 'batal') {
    return (
      <>
        <PageHeader title={`Trip ${existing.transaction_no}`} crumbs={[{ label: 'Trip / Job Order', to: '/transaksi/trip' }, { label: existing.transaction_no }]} />
        <Card>
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-ink">Trip ini sudah dibatalkan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Trip yang dibatalkan disimpan sebagai arsip dan tidak bisa diubah.</p>
            <Button className="mt-4" onClick={() => navigate(`/transaksi/trip/${existing.id}`)}>Lihat trip</Button>
          </div>
        </Card>
      </>
    )
  }

  /* ── Ubah isian ───────────────────────────────────────── */
  const ubah = (patch: Partial<Isian>) => setF((g) => ({ ...g, ...patch }))
  const hapusGalat = (...k: Array<keyof Galat>) => setGalat((g) => {
    const sisa = { ...g }
    for (const x of k) delete sisa[x]
    return sisa
  })

  /** Klien menentukan tipe layanan; Dedicated memakai kontrak aktif klien itu (terpilih sendiri bila hanya satu). */
  function pilihKlien(id: string | null) {
    const k = klienMap.get(id ?? '')
    const aktif = k?.client_type === 'dedicated' ? db.contracts.filter((c) => c.project_id === k.id && c.status === 'aktif') : []
    const kontrakIni = aktif.some((c) => c.id === f.contract_id) ? f.contract_id : aktif.length === 1 ? aktif[0].id : ''
    ubah({ klien: id ?? '', contract_id: kontrakIni })
    hapusGalat('klien', 'contract_id')
  }

  const adaAlamatDiArea = (kode: string) => daftarAlamat.some((a) => a.status === 'aktif' && samaArea(a.kode_area, kode))

  /**
   * Alamat pick up / destinasi dari area rute (Baldy 14 Okt 2026: "ketika rute dipilih, pickup dan destinasinya
   * ikut terisi"). Banyak alamat di satu area: yang terakhir dipakai trip rute ini, lalu yang paling sering
   * dipakai, lalu urut nama. Kosong bila area itu belum punya alamat di Master Alamat.
   */
  function alamatUntukArea(kode: string, sisi: 'pengirim' | 'penerima', routeId: string): string {
    const diArea = daftarAlamat.filter((a) => a.status === 'aktif' && samaArea(a.kode_area, kode))
    const cocokSisi = diArea.filter((a) => a.jenis === 'keduanya' || a.jenis === sisi)
    const calon = cocokSisi.length ? cocokSisi : diArea
    if (calon.length <= 1) return calon[0]?.id ?? ''
    const ids = new Set(calon.map((a) => a.id))
    const terakhir = transactionRows
      .filter((t) => t.route_id === routeId && t.status !== 'batal' && ids.has(t[sisi]?.alamat_id ?? ''))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.transaction_no.localeCompare(a.transaction_no))[0]
    if (terakhir?.[sisi]?.alamat_id) return terakhir[sisi].alamat_id
    const pakai = new Map<string, number>()
    for (const t of transactionRows) {
      const id = t[sisi]?.alamat_id
      if (id && ids.has(id)) pakai.set(id, (pakai.get(id) ?? 0) + 1)
    }
    return [...calon].sort((a, b) => (pakai.get(b.id) ?? 0) - (pakai.get(a.id) ?? 0) || a.nama.localeCompare(b.nama, 'id'))[0].id
  }

  /**
   * Pilih rute: harga ikut Harga Rute (kecuali sudah diganti), pick up & destinasi diisi dari area rute.
   * Isian yang tadinya terisi otomatis ikut berganti bersama rutenya; yang dipilih sendiri tidak disentuh.
   */
  function pilihRute(routeId: string | null, ruteBaru?: Route) {
    const baru = ruteBaru ?? (routeId ? ruteMap.get(routeId) : undefined)
    const a = baru ? kodeAreaRute(baru) : { asal: '', tujuan: '' }
    const ikutRute = (sisi: 'pengirim' | 'penerima') => !f[sisi] || !!otomatis[sisi]
    const isi = (sisi: 'pengirim' | 'penerima', kode: string) =>
      ikutRute(sisi) ? (baru ? alamatUntukArea(kode, sisi, baru.id) : '') : f[sisi]
    const pengirim = isi('pengirim', a.asal)
    const penerima = isi('penerima', a.tujuan)
    setF({
      ...f,
      route_id: baru?.id ?? '',
      // Harga selalu ikut rute (Baldy 14 Okt 2026: harga diubah di Master Rute, bukan di trip).
      harga: baru?.price ?? 0,
      pengirim,
      penerima,
    })
    setOtomatis((o) => ({ ...o, pengirim: ikutRute('pengirim') && !!pengirim, penerima: ikutRute('penerima') && !!penerima }))
    hapusGalat('route_id')
  }

  /** Kode area rute yang belum punya alamat: dipakai sebagai kode area alamat baru. */
  const areaKosong = (kode: string) => (kode && !adaAlamatDiArea(kode) ? kode : undefined)
  /** Rute sudah dipilih tapi areanya belum punya alamat: tawarkan langsung menambah alamat area itu. */
  function petunjukTanpaAlamat(sisi: 'pengirim' | 'penerima', kode: string): ReactNode {
    if (!rute || f[sisi] || !kode || adaAlamatDiArea(kode)) return null
    return (
      <>
        Area {kode} belum punya alamat di Master Alamat.{' '}
        {bolehMaster
          ? <TombolTeks onClick={() => setTambahAlamat({ sisi, nama: '', kode })}><FaPlus size={10} className="mr-1 inline" />Tambah alamat {kode}</TombolTeks>
          : 'Minta Manager / Owner menambahkannya.'}
      </>
    )
  }

  /*
   * ── Kendaraan & supir ──────────────────────────────────
   * Tidak saling mengisi lagi (Baldy 14 Okt 2026: "ketika kendaraan dipilih, sopirnya jangan auto kepilih,
   * biar user yang isi sendiri"): kendaraan dan supir dipilih sendiri-sendiri.
   */
  /** Gandengan ikut konfigurasi kendaraan baru, kecuali sudah dipilih sendiri. */
  function gandenganIkut(gandengan: string, kendaraanLama: string, kendaraanBaru: string) {
    const lama = rapikanGandengan(db.vehicles.find((v) => v.id === kendaraanLama)?.configuration ?? '')
    const baru = rapikanGandengan(db.vehicles.find((v) => v.id === kendaraanBaru)?.configuration ?? '')
    return !gandengan || gandengan === lama ? baru : gandengan
  }

  function pilihKendaraan(v: string | null) {
    const id = v ?? ''
    setF({ ...f, vehicle_id: id, gandengan: gandenganIkut(f.gandengan, f.vehicle_id, id) })
    hapusGalat('vehicle_id')
  }

  function ubahSupir(k: number, v: string | null) {
    const id = v ?? ''
    setF({ ...f, driver_ids: f.driver_ids.map((x, n) => (n === k ? id : x)) })
  }

  /* ── Add Items Details ────────────────────────────────── */
  const ubahItem = (i: number, patch: Partial<ItemMuatan>) => ubah({ muatan: f.muatan.map((m, n) => (n === i ? { ...m, ...patch } : m)) })
  const hapusItem = (i: number) => ubah({ muatan: f.muatan.length > 1 ? f.muatan.filter((_, n) => n !== i) : [itemKosong()] })

  /* ── Harga ────────────────────────────────────────────── */
  /** Trip lama yang tersimpan dengan harga khusus: tetap ditampilkan apa adanya, tidak bisa diubah di sini. */
  const hargaBeda = !dedicated && !!rute && f.harga > 0 && f.harga !== rute.price

  /* ── Validasi & simpan ────────────────────────────────── */
  function validasi(): boolean {
    const e: Galat = {}
    if (wajib(!!existing?.project_id) && !f.klien) e.klien = 'Klien wajib dipilih: tipe layanan dan tagihan mengikuti klien.'
    if (!f.transaction_date) e.transaction_date = 'Tanggal berangkat wajib diisi.'
    if (dedicated && !f.contract_id) {
      e.contract_id = kontrakKlien.length ? 'Klien Dedicated: pilih kontrak yang dipakai trip ini.' : 'Klien Dedicated ini belum punya kontrak aktif. Tambahkan dulu di halaman klien.'
    }
    if (wajib(!!existing?.vehicle_id) && !f.vehicle_id) e.vehicle_id = 'Kendaraan wajib dipilih.'
    const tahan = tahanKendaraan(f.vehicle_id)
    if (tahan) e.vehicle_id = `Kendaraan ini masih di trip ${tahan.id_tampil} dan belum kembali ke pool. Pilih kendaraan lain, atau catat dulu kendaraannya kembali di pool pada trip itu.`
    if (!dedicated && wajib(!!existing?.route_id) && !f.route_id) e.route_id = 'Rute wajib dipilih.'
    setGalat(e)
    return Object.keys(e).length === 0
  }

  /** Gulir ke isian merah pertama: jangan sampai pesan galat tidak terlihat. */
  function gulirKeGalat() {
    window.setTimeout(() => {
      akarRef.current?.querySelector('.invalid-feedback, .is-invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  /** Salinan alamat untuk trip; isian lama yang tidak diganti disimpan apa adanya (catatannya ikut yang baru). */
  function titikTrip(nilai: string, catatan: string, lama: TitikAlamat | undefined): TitikAlamat | undefined {
    if (nilai === TITIK_LAMA) return titikRapi(lama ? { ...lama, catatan } : undefined)
    const a = daftarAlamat.find((x) => x.id === nilai)
    if (!a) return undefined
    // Alamat sama dengan salinan lama: pertahankan salinannya (Master Alamat mungkin sudah berubah sesudahnya).
    if (lama?.alamat_id === a.id) return titikRapi({ ...lama, catatan })
    return titikDariAlamat(a, catatan)
  }

  function isiTrip(nomor: string): Omit<CommissionTransaction, 'id' | 'created_at' | 'updated_at' | 'workspace'> {
    const sopir = [...new Set(f.driver_ids.filter(Boolean))]
    const muatan = f.muatan.map((m) => ({ id_perjalanan: m.id_perjalanan.trim().toUpperCase(), keterangan: m.keterangan.trim() }))
      .filter((m) => m.id_perjalanan || m.keterangan)
    /**
     * Mode ubah: isian yang tidak disentuh (masih sama dengan saat form dibuka) menyimpan nilai lama apa adanya,
     * jadi Audit Log hanya mencatat yang benar-benar diubah.
     */
    const tetap = <T,>(k: keyof Isian, baru: T, lama: T | undefined): T | undefined =>
      existing && JSON.stringify(f[k]) === JSON.stringify(awal[k]) ? lama : baru
    const titik = (k: 'pengirim' | 'penerima', ck: 'catatan_pengirim' | 'catatan_penerima', lama: TitikAlamat | undefined) => {
      const baru = titikTrip(f[k], f[ck], lama)
      return existing && (samaTitik(lama, baru) || (f[k] === awal[k] && f[ck] === awal[ck])) ? lama : baru
    }
    const statusTrip: TripStatus = !existing || existing.status === 'menunggu_sopir' || existing.status === 'aktif' || existing.status === 'draft'
      ? (sopir.length ? 'aktif' : 'menunggu_sopir')
      : existing.status
    const isi = {
      ...(existing ?? FIELD_LAIN),
      transaction_no: nomor,
      transaction_date: f.transaction_date,
      // Tanggal order = hari trip didaftarkan (tidak lagi diisi di form).
      order_date: existing ? existing.order_date : todayISO(),
      service_type: layanan,
      contract_id: dedicated ? f.contract_id : '',
      project_id: f.klien,
      tr_numbers: tetap('tr', f.tr, existing?.tr_numbers),
      route_id: f.route_id,
      vehicle_id: f.vehicle_id,
      gandengan: tetap('gandengan', rapikanGandengan(f.gandengan), existing?.gandengan),
      driver_id: sopir[0] ?? '',
      driver_ids: sopir,
      status: statusTrip,
      // Harga 0 di trip lama = ikut Harga Rute; tetap 0 selama harga dan rutenya tidak diubah.
      cost_value: dedicated ? 0 : existing && f.route_id === existing.route_id ? tetap('harga', f.harga, existing.cost_value) ?? 0 : f.harga,
      override_note: hargaBeda ? f.override_note.trim() : '',
      override_attachments: hargaBeda ? f.override_attachments : [],
      pengirim: titik('pengirim', 'catatan_pengirim', existing?.pengirim),
      penerima: titik('penerima', 'catatan_penerima', existing?.penerima),
      muatan: tetap('muatan', muatan, existing?.muatan),
      // ID Perjalanan tetap disalin ke trip_ids supaya bisa dicari dari mana pun.
      trip_ids: tetap('muatan', muatan.map((m) => m.id_perjalanan).filter(Boolean), existing?.trip_ids) ?? [],
      kosongan: f.kosongan.trim(),
      ...(asal ? { backload_dari: asal.id, manager_id: asal.manager_id ?? '', manager_name: asal.manager_name ?? '' } : {}),
    }
    // Kosong tetap kosong seperti tersimpan (undefined / '' / []), supaya tidak tercatat "— → —".
    if (existing) {
      const lama = existing as unknown as Record<string, unknown>
      const baru = isi as unknown as Record<string, unknown>
      const kosong = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
      for (const k of Object.keys(baru)) if (kosong(baru[k]) && kosong(lama[k])) baru[k] = lama[k]
    }
    return isi
  }

  function simpan(cetak: boolean) {
    if (!validasi()) { toast.error('Periksa kembali isian yang ditandai merah.'); gulirKeGalat(); return }
    if (existing) {
      ubahTrip(existing.id, isiTrip(existing.transaction_no))
      toast.success(`Trip ${existing.transaction_no} berhasil diperbarui.`)
      navigate(`/transaksi/trip/${existing.id}${cetak ? '?print=1' : ''}`)
      return
    }
    // Kode Trip dicek ulang saat disimpan: bila sudah dipakai trip lain, dipakai nomor berikutnya.
    const nomorSekarang = dbAll.transactions.map((t) => t.transaction_no)
    const nomor = !nomorSekarang.includes(kodeAwal) ? kodeAwal
      : asal ? idBackload(asal.transaction_no, nomorSekarang) : nomorTripBerikut(nomorSekarang, todayISO())
    const baru = buatTrip(isiTrip(nomor))
    if (asal && !asal.ada_backload) ubahTrip(asal.id, { ada_backload: true })
    toast.success(nomor !== kodeAwal
      ? `Kode ${kodeAwal} sudah dipakai, trip tersimpan sebagai ${nomor}.`
      : asal ? `Backload / lanjutan ${nomor} tersimpan.` : `Trip ${nomor} tersimpan. Catat uang jalan di tab Uang Jalan saat dibayar.`)
    navigate(`/transaksi/trip/${baru.id}${cetak ? '?print=1' : ''}`)
  }

  /* ── Tampilan ─────────────────────────────────────────── */
  const lewatKunci = 'Dikunci karena trip sudah jalan.'
  const kendaraanDiTripLain = f.vehicle_id ? ditahan.kendaraan.get(f.vehicle_id) : undefined
  const refDipakai = f.tr.map((no) => ({ no, trip: refLain.get(kunciTr(no)) ?? [] })).filter((x) => x.trip.length)
  const anakBackload = asal ? transactionRows.filter((t) => t.backload_dari === asal.id && t.status !== 'batal').map((t) => t.id_tampil) : []

  const hintKlien: ReactNode = galat.klien ? undefined
    : kunci ? lewatKunci
    : klien ? <>Tipe layanan <span className="font-semibold text-ink-2">{CLIENT_TYPE_LABEL[klien.client_type] ?? 'Callout'}</span> terdeteksi dari klien {klien.project_code}.</>
    : 'Pilih dari Listing Master Data Klien terdaftar (Tipe Layanan Callout / Dedicated terdeteksi dari kode Klien).'
  const hintKendaraan: ReactNode = galat.vehicle_id ? undefined
    : kunci ? lewatKunci
    : kunciMobil ? 'Mengikuti trip asal backload.'
    : kendaraan && kendaraan.status !== 'aktif' ? `Status kendaraan: ${kendaraan.status}.`
    : undefined
  const konfigurasi = kendaraan?.configuration ?? ''
  const hintGandengan: ReactNode = kunci ? lewatKunci
    : konfigurasi && rapikanGandengan(f.gandengan) !== rapikanGandengan(konfigurasi) ? `Berbeda dari konfigurasi kendaraan (${labelGandengan(konfigurasi)}).`
    : undefined
  const hintRute: ReactNode = galat.route_id ? undefined
    : kunci ? lewatKunci
    : backload && !rute ? `Pilih rute dari lokasi bongkar trip asal${asal?.bongkar ? ` (${asal.bongkar})` : ''}.`
    : dedicated && !rute ? 'Opsional untuk Dedicated: patokan uang jalan dan lokasi muat / bongkar.'
    : 'Pilih rute pengiriman, mis. CIB - DURI.'
  const ringkasan = [
    kodeAwal,
    klien ? `${klien.project_code} (${CLIENT_TYPE_LABEL[klien.client_type] ?? 'Callout'})` : 'klien belum dipilih',
    rute ? rute.route_name : 'rute belum dipilih',
    kendaraan ? kendaraan.plate_number : 'kendaraan belum dipilih',
  ].join(' · ')

  return (
    <div ref={akarRef} className="pb-28 sm:pb-20">
      <PageHeader
        title={kodeAwal}
        crumbs={[
          { label: 'Trip / Job Order', to: '/transaksi/trip' },
          ...(existing ? [{ label: existing.transaction_no, to: `/transaksi/trip/${existing.id}` }] : asal ? [{ label: asal.id_tampil, to: `/transaksi/trip/${asal.id}` }] : []),
          { label: mode === 'edit' ? 'Ubah Trip' : backload ? 'Backload / Lanjutan' : 'Tambah Trip' },
        ]}
        description="Tiap mobil tersimpan sebagai trip sendiri dengan Berita Acara Serah Terima masing-masing."
      />

      {!bolehSimpan && (
        <Peringatan className="mb-4">
          Peran {user?.role === 'viewer' ? 'Viewer' : 'ini'} tidak dapat menyimpan perubahan. Form ini hanya untuk melihat struktur data.
        </Peringatan>
      )}
      {sudahJalan && existing && (
        <KunciTrip status={existing.status} terbuka={bukaKunci} bolehBuka={bolehOverride} onBuka={() => setBukaKunci(true)}
          isian="klien & kontrak, kendaraan, gandengan, supir, dan rute" />
      )}
      {mode === 'create' && backloadDari && !asal && (
        <Peringatan className="mb-4">
          {calonAsal ? `Trip asal ${calonAsal.id_tampil} sudah dibatalkan, jadi tidak bisa dilanjutkan.` : 'Trip asal backload tidak ditemukan (mungkin sudah dihapus).'}
          {' '}Form ini dibuka sebagai trip baru biasa.
        </Peringatan>
      )}
      {asal && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/70 px-4 py-3 text-[12.5px] text-brand-800">
          <p className="font-semibold">
            Backload / Lanjutan dari Trip <Link to={`/transaksi/trip/${asal.id}`} className="underline">{asal.id_tampil}</Link>
          </p>
          <p className="mt-0.5">
            Kendaraan {asal.plate_number || '(belum ada)'}{asal.driver_names && ` dan supir ${asal.driver_names}`} mengikuti trip asal.
            Pick up dari lokasi bongkarnya{asal.bongkar && <>: <span className="font-semibold">{asal.bongkar}</span></>}.
          </p>
          {asal.status !== 'selesai' && (
            <p className="mt-1 text-brand-700">Trip asal masih {STATUS_LABEL[asal.status]}. Tutup trip asal setelah POD-nya difoto atau diterima.</p>
          )}
          {anakBackload.length > 0 && (
            <p className="mt-1 text-brand-700">Trip asal sudah punya backload: {anakBackload.join(', ')}. Yang ini tersimpan sebagai backload berikutnya.</p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Konfigurasi */}
        <Bagian judul="Konfigurasi">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,13rem)]">
            <Field label="Klien" required={wajib(!!existing?.project_id)} error={galat.klien} hint={hintKlien}>
              {(fid) => (
                <SearchableSelect id={fid} options={opsiKlien} value={f.klien || null} invalid={!!galat.klien} disabled={kunci}
                  placeholder="Pilih klien..." searchPlaceholder="Ketik nama atau kode klien..." onChange={pilihKlien} />
              )}
            </Field>
            <Field label="No Referensi"
              hint={refDipakai.length > 0
                ? `${refDipakai.map((x) => `${x.no} juga dipakai trip ${x.trip.join(', ')}`).join('; ')}. Wajar bila satu order dikirim beberapa mobil.`
                : 'Isi dengan nomor referensi penugasan seperti no TR dari klien.'}>
              {(fid) => <NoReferensiInput id={fid} value={f.tr} onChange={(tr) => ubah({ tr })} />}
            </Field>
            <Field label="Tanggal Berangkat" required error={galat.transaction_date} hint={galat.transaction_date ? undefined : 'Hari trip jalan.'}>
              {(fid) => (
                <DateInput id={fid} value={f.transaction_date} invalid={!!galat.transaction_date}
                  onChange={(e) => { ubah({ transaction_date: e.target.value }); hapusGalat('transaction_date') }} />
              )}
            </Field>
          </div>
          {dedicated && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="No. Kontrak" required error={galat.contract_id}
                hint={galat.contract_id ? undefined : kunci ? lewatKunci : kontrakKlien.length === 1 ? 'Satu-satunya kontrak aktif klien ini.' : 'Kontrak aktif klien ini.'}>
                {(fid) => (
                  <SearchableSelect id={fid} options={opsiKontrak} value={f.contract_id || null} invalid={!!galat.contract_id} disabled={kunci}
                    placeholder="Pilih nomor kontrak..." emptyText="Belum ada kontrak aktif."
                    onChange={(v) => { ubah({ contract_id: v ?? '' }); hapusGalat('contract_id') }} />
                )}
              </Field>
              {kontrak && (
                <KotakInfo>
                  <dl className="grid grid-cols-2 gap-x-3">
                    <NilaiInfo label="Nilai kontrak">{formatRupiah(kontrak.value)}</NilaiInfo>
                    <NilaiInfo label="Berlaku">{kontrak.start_date ? `${kontrak.start_date.split('-').reverse().join('/')}` : '—'}{kontrak.end_date ? ` – ${kontrak.end_date.split('-').reverse().join('/')}` : ''}</NilaiInfo>
                  </dl>
                </KotakInfo>
              )}
              {!kontrakKlien.length && (
                <Peringatan className="md:col-span-2">
                  Klien Dedicated ini belum punya kontrak aktif. Tambahkan kontraknya di <Link to={`/master/klien/${f.klien}`} className="font-semibold underline">halaman klien</Link>.
                </Peringatan>
              )}
            </div>
          )}
        </Bagian>

        {/* Informasi Kendaraan dan Supir + Rute */}
        <Bagian judul="Informasi Kendaraan dan Supir">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Kendaraan Utama" required={wajib(!!existing?.vehicle_id)} error={galat.vehicle_id} hint={hintKendaraan}>
              {(fid) => (
                <SearchableSelect id={fid} options={opsiKendaraan} value={f.vehicle_id || null} invalid={!!galat.vehicle_id} disabled={kunciMobil}
                  placeholder="Pilih nomor polisi..." searchPlaceholder="Ketik nomor polisi atau jenis..." onChange={pilihKendaraan} />
              )}
            </Field>
            <Field label="Sub Kendaraan / Gandengan" hint={hintGandengan}>
              {(fid) => (
                <SearchableSelect id={fid} options={opsiGandengan(f.gandengan, konfigurasi)} value={f.gandengan || null} disabled={kunci} cari={false}
                  placeholder="Low Bed / Hi Bed / 4x4 / Dolly" onChange={(v) => ubah({ gandengan: v ?? '' })} />
              )}
            </Field>
            <div className="space-y-3">
              {f.driver_ids.map((v, k) => {
                const diTripLain = v ? ditahan.supir.get(v) : undefined
                const alasanKunci = kunciSupir ? (kunci ? lewatKunci : 'Mengikuti trip asal backload.') : ''
                // Supir yang masih di trip lain hanya diberi peringatan, tidak diblokir.
                const hint: ReactNode = diTripLain
                  ? <span className="text-[#8a6100]">Masih di trip {diTripLain.id_tampil}{diTripLain.plate_number && ` (${diTripLain.plate_number})`} yang belum kembali ke pool. Boleh tetap disimpan bila memang benar.</span>
                  : alasanKunci || (k > 0 ? 'Supir pendamping (double driver).'
                    : `Pilih kode supir yang membawa muatan. Boleh dikosongkan dulu (${STATUS_LABEL.menunggu_sopir}).`)
                return (
                  <Field key={k} label={k === 0 ? 'Supir' : 'Supir Pendamping'} hint={hint}>
                    {(fid) => (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <SearchableSelect id={fid} options={opsiSupir(v)} value={v || null} disabled={kunciSupir}
                            placeholder="Cari kode / nama supir..." onChange={(nv) => ubahSupir(k, nv)} />
                        </div>
                        {k > 0 && !kunciSupir && (
                          <IconButton label="Hapus supir pendamping" tone="danger" icon={<FaXmark size={14} />}
                            onClick={() => ubah({ driver_ids: f.driver_ids.filter((_, n) => n !== k) })} />
                        )}
                      </div>
                    )}
                  </Field>
                )
              })}
              {!kunciSupir && f.driver_ids.length < 3 && (
                <TombolTeks onClick={() => ubah({ driver_ids: [...f.driver_ids, ''] })}>+ Tambah supir pendamping</TombolTeks>
              )}
            </div>
          </div>


          {kendaraanDiTripLain && (f.vehicle_id === existing?.vehicle_id || kunciMobil) && (
            <Peringatan className="mt-4">
              Kendaraan ini juga tercatat di trip{' '}
              <Link to={`/transaksi/trip/${kendaraanDiTripLain.id}`} className="font-semibold underline">{kendaraanDiTripLain.id_tampil}</Link>
              {' '}yang belum kembali ke pool.
            </Peringatan>
          )}
        </Bagian>

        {/*
          Informasi Pengiriman (Baldy 14 Okt 2026: Rute masuk ke sini): rute dulu, lalu pick up dan destinasi
          yang terisi dari area rutenya, berdampingan supaya form lebih pendek.
        */}
        <Bagian judul="Informasi Pengiriman">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rute" required={!dedicated && wajib(!!existing?.route_id)} error={galat.route_id} hint={hintRute}>
                {(fid) => (
                  <SearchableSelect id={fid} options={opsiRute} value={f.route_id || null} invalid={!!galat.route_id} disabled={kunci}
                    placeholder="Pilih rute..." searchPlaceholder="Ketik nama, kode area, atau No. Rute..." onChange={(v) => pilihRute(v)}
                    tambahan={kunci ? undefined : {
                      label: 'Tambah rute baru',
                      disabled: !bolehMaster,
                      hint: bolehMaster ? undefined : 'Perlu Manager atau Owner.',
                      onClick: () => setTambahRute(true),
                    }} />
                )}
              </Field>
              {rute && (
                <KotakInfo className="self-start md:mt-[22px]">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <NilaiInfo label="No. Rute">{rute.route_code}</NilaiInfo>
                    <NilaiInfo label="Patokan Uang Jalan">{formatRupiah(rute.ujroute)}</NilaiInfo>
                    <NilaiInfo label="Patokan Tol">{formatRupiah(rute.toll ?? 0)}</NilaiInfo>
                    {!dedicated && (
                      <NilaiInfo label={hargaBeda ? 'Harga trip (khusus)' : 'Harga'}>
                        {formatRupiah(hargaBeda ? f.harga : rute.price)}
                      </NilaiInfo>
                    )}
                  </dl>
                  {!dedicated && (
                    <p className="mt-2 text-[11.5px] text-brand-700">
                      {hargaBeda
                        ? `Harga khusus tersimpan di trip ini (Harga Rute ${formatRupiah(rute.price)}). Memilih rute lagi memakai Harga Rute.`
                        : 'Harga mengikuti rute. Perubahan harga dilakukan di Master Rute.'}
                    </p>
                  )}
                </KotakInfo>
              )}
            </div>

            <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
              <PilihAlamatTrip
                label="Pick Up Details"
                hint={otomatis.pengirim && f.pengirim
                  ? `Terisi dari area pick up rute (${area.asal}). Ganti bila beda.`
                  : backload && f.pengirim && f.pengirim === awal.pengirim ? 'Terisi dari penerima trip asal (lokasi bongkarnya).'
                  : petunjukTanpaAlamat('pengirim', area.asal)
                    ?? 'Bisa save alamat, catatan spt info kapal, lokasi di pelabuhan, dan kontak pengambilan'}
                nilai={f.pengirim} onChange={(v) => { ubah({ pengirim: v }); setOtomatis((o) => ({ ...o, pengirim: false })) }}
                catatan={f.catatan_pengirim} onCatatan={(v) => ubah({ catatan_pengirim: v })}
                labelCatatan="Catatan Pick Up" placeholderCatatan="mis. info kapal, lokasi di pelabuhan, kontak pengambilan"
                daftar={daftarAlamat} area={area.asal || areaBackload} titikLama={pengirimLama}
                bolehTambah={bolehMaster} onTambah={(q) => setTambahAlamat({ sisi: 'pengirim', nama: q.trim(), kode: areaKosong(area.asal) })}
              />
              <PilihAlamatTrip
                label="Destination Details"
                hint={otomatis.penerima && f.penerima
                  ? `Terisi dari area destinasi rute (${area.tujuan}). Ganti bila beda.`
                  : petunjukTanpaAlamat('penerima', area.tujuan) ?? 'Bisa save alamat, catatan tambahan, dan kontak penerima'}
                nilai={f.penerima} onChange={(v) => { ubah({ penerima: v }); setOtomatis((o) => ({ ...o, penerima: false })) }}
                catatan={f.catatan_penerima} onCatatan={(v) => ubah({ catatan_penerima: v })}
                labelCatatan="Catatan Destinasi" placeholderCatatan="mis. jam bongkar, gerbang masuk, kontak penerima di lokasi"
                daftar={daftarAlamat} area={area.tujuan} titikLama={penerimaLama}
                bolehTambah={bolehMaster} onTambah={(q) => setTambahAlamat({ sisi: 'penerima', nama: q.trim(), kode: areaKosong(area.tujuan) })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="min-w-0">
                <legend className="form-label">Add Items Details</legend>
                <div className="space-y-2">
                  {f.muatan.map((m, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Input value={m.id_perjalanan} aria-label={`ID Perjalanan item ${i + 1}`} placeholder="ID Perjalanan"
                        className="tnum w-40 shrink-0 uppercase sm:w-44" onChange={(e) => ubahItem(i, { id_perjalanan: e.target.value.replace(/\s+/g, '') })} />
                      <Input value={m.keterangan} aria-label={`Keterangan barang item ${i + 1}`} placeholder="Info terkait barang yang dibawa / No Container"
                        className="min-w-0 flex-1" onChange={(e) => ubahItem(i, { keterangan: e.target.value })} />
                      {(f.muatan.length > 1 || m.id_perjalanan || m.keterangan) && (
                        <IconButton label={`Hapus item ${i + 1}`} tone="danger" icon={<FaXmark size={14} />} onClick={() => hapusItem(i)} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="form-text m-0">ID Perjalanan + keterangan barang; satu baris per item. Boleh dikosongkan.</p>
                  <TombolTeks onClick={() => ubah({ muatan: [...f.muatan, itemKosong()] })}>
                    <FaPlus size={10} className="mr-1 inline" />Tambah item
                  </TombolTeks>
                </div>
              </fieldset>
              <Field label="Kosongan" hint="Depo container kosong (tempat ambil / kembalikan), bila trip membawa container. Kosongkan bila tidak ada.">
                {(fid) => <Input id={fid} value={f.kosongan} placeholder="DEPO MUSTIKA CAKUNG" onChange={(e) => ubah({ kosongan: e.target.value })} />}
              </Field>
            </div>
          </div>
        </Bagian>
      </div>

      {/* Rute baru langsung dipilih untuk trip ini. */}
      <ModalRute
        open={tambahRute}
        onClose={() => setTambahRute(false)}
        awal={{ kode_area_asal: areaBackload || undefined }}
        keterangan="Rute baru langsung dipilih untuk trip ini. Tanda * wajib diisi."
        pesanSukses={(r) => `Rute ${r.route_name} tersimpan dan dipilih untuk trip ini.`}
        onSaved={(r) => pilihRute(r.id, r)}
        onPakai={(r) => pilihRute(r.id, r)}
      />
      <ModalAlamat
        open={!!tambahAlamat}
        onClose={() => setTambahAlamat(null)}
        awal={{ nama: tambahAlamat?.nama ?? '', kode_area: tambahAlamat?.kode }}
        keterangan={tambahAlamat?.sisi === 'penerima' ? 'Alamat tujuan baru langsung dipilih sebagai Destination Details.' : 'Alamat baru langsung dipilih sebagai Pick Up Details.'}
        pesanSukses={(a) => `${a.nama} tersimpan di Master Alamat.`}
        onSaved={(a: Alamat) => {
          if (tambahAlamat?.sisi === 'penerima') ubah({ penerima: a.id })
          else ubah({ pengirim: a.id })
          setOtomatis((o) => ({ ...o, [tambahAlamat?.sisi ?? 'pengirim']: false }))
        }}
      />

      {/* Bar dimulai setelah rel sidebar (68px) supaya teks kirinya tidak tertutup. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-2.5 backdrop-blur lg:left-[68px] lg:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="tnum min-w-0 flex-1 basis-full truncate text-[12.5px] text-ink-3 sm:basis-0">{ringkasan}</p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => navigate(existing ? `/transaksi/trip/${existing.id}` : asal ? `/transaksi/trip/${asal.id}` : '/transaksi/trip')}>Batal</Button>
            <Button icon={<FaPrint size={15} />} disabled={!bolehSimpan} onClick={() => simpan(true)}>Simpan &amp; Cetak Berita Acara</Button>
            <Button variant="primary" icon={<FaFloppyDisk size={15} />} disabled={!bolehSimpan} onClick={() => simpan(false)}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

