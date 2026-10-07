import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FaFloppyDisk, FaPlus, FaPrint, FaTriangleExclamation, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button, IconButton } from '../components/ui/Button'
import { Field, Input, DateInput, Radio, Select, Textarea } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { PilihKaryawan } from '../components/ui/PilihKaryawan'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { formatRupiah, todayISO } from '../lib/format'
import { hitungKomisiTrip } from '../lib/komisi'
import { buatKodeUnik, nomorSuratJalanBerikut, nomorTripBerikut } from '../lib/kode'
import { cn } from '../lib/utils'
import type { CommissionTransaction, JobOrder, ServiceType, TripStatus } from '../types'
import { STATUS_FORM, STATUS_LABEL } from './trip/status'
import { PakaiNilai } from './trip/bagian'
import { KodeInput } from '../components/ui/KodeInput'
import { LampiranInput } from '../components/ui/Lampiran'
import { FormTripKarawang } from './trip/FormTripKarawang'

type FormState = Omit<CommissionTransaction, 'id' | 'created_at' | 'updated_at' | 'workspace'>

const BLANK: FormState = {
  transaction_no: '', transaction_date: '', order_date: '', service_type: 'callout', contract_id: '',
  trip_ids: [''], route_id: '',
  sj_no: '', manager_id: '', manager_name: '', project_id: '', status: 'aktif',
  recipient_name: '', recipient_address_1: '', recipient_address_2: '',
  vehicle_id: '', driver_id: '', driver_ids: [''], job_order_id: '', party: '', goods_type: '', kosongan: '',
  location: '', ship: '', destination_detail: '',
  tr_reference: '', pi_number: '', pi_status: '', cost_value: 0, override_note: '', override_attachments: [],
  notes: '', is_marked: false, bon_date: null, personal_bon: 0, printed_at: null,
  cancelled_at: null, cancel_reason: '', cancel_settlement: [], container_no: '',
}

const bersih = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '')

/** Alamat customer SI/JO dipecah jadi dua baris "di". */
function alamatJo(jo?: JobOrder): [string, string] {
  if (!jo) return ['', '']
  const [baris1, ...sisa] = jo.customer_address.split(',')
  return [baris1.trim(), sisa.join(',').trim()]
}

function Section({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={description} actions={actions} />
      <div className="p-4">{children}</div>
    </Card>
  )
}

/**
 * Tunggu data ter-hidrasi dulu: nomor otomatis dan pencarian record bergantung padanya.
 * Karawang memakai form alat berat (banyak mobil, TR, backload); Priok form container.
 */
export function TripFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { loading } = useData()
  const { id } = useParams()
  const { workspace } = useWorkspace()
  const [params] = useSearchParams()
  const backload = mode === 'create' ? params.get('backload') ?? undefined : undefined

  if (loading) {
    return (
      <>
        <PageHeader title={mode === 'edit' ? 'Memuat trip...' : 'Tambah Trip'} crumbs={[{ label: 'Trip / Job Order', to: '/transaksi/trip' }]} />
        <div className="skeleton h-40 rounded-xl" />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="skeleton h-56 rounded-xl" />
          <div className="skeleton h-56 rounded-xl" />
        </div>
      </>
    )
  }
  if (workspace === 'karawang') {
    return <FormTripKarawang mode={mode} tripId={id} backloadDari={backload} key={`${id ?? 'baru'}-${backload ?? ''}`} />
  }
  return <TripForm mode={mode} key={id ?? 'baru'} />
}

function TripForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, dbAll, transactionRows, buatTrip, ubahTrip } = useData()
  const { bisa, user } = useAuth()
  /** Admin, Manager, Owner boleh input trip; mengubah harga di luar Harga route hanya Manager & Owner. */
  const bolehSimpan = bisa('trip')
  const bolehOverride = bisa('override')
  const toast = useToast()
  const { workspace } = useWorkspace()
  /** Priok = angkutan container (SI/BL, Party, Kapal). Karawang = alat berat & DHL (TR / No PI). */
  const cabangContainer = workspace === 'priok'

  const existing = mode === 'edit' ? db.transactions.find((t) => t.id === id) : undefined
  /** Status mengikuti sopir (Menunggu Sopir <-> Aktif) sampai diubah sendiri; trip lama tidak diubah. */
  const statusManual = useRef(mode === 'edit')

  const [form, setForm] = useState<FormState>(() => {
    if (existing) {
      const sopir = existing.driver_ids?.length ? existing.driver_ids : existing.driver_id ? [existing.driver_id] : []
      return {
        ...BLANK,
        ...existing,
        trip_ids: existing.trip_ids?.length ? [...existing.trip_ids] : [''],
        driver_ids: sopir.length ? [...sopir] : [''],
      }
    }
    // Nomor dihitung dari seluruh workspace supaya tidak pernah kembar.
    const hariIni = todayISO()
    return {
      ...BLANK,
      // Belum ada sopir = Menunggu Sopir; begitu sopir dipilih, status ikut jadi Aktif.
      status: 'menunggu_sopir',
      order_date: hariIni,
      transaction_date: hariIni,
      transaction_no: nomorTripBerikut(dbAll.transactions.map((t) => t.transaction_no), hariIni),
      sj_no: nomorSuratJalanBerikut(dbAll.transactions.map((t) => t.sj_no).filter(Boolean)),
      trip_ids: [buatKodeUnik(dbAll.transactions.flatMap((t) => t.trip_ids ?? []))],
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dedicated = form.service_type === 'dedicated'

  /** Trip lama bisa saja belum lengkap; jangan paksa diisi hanya karena diubah. */
  const wajib = (adaSebelumnya: boolean) => mode === 'create' || adaSebelumnya
  const wajibId = !dedicated && wajib(!!existing?.trip_ids?.length)
  const wajibRoute = !dedicated && wajib(!!existing?.route_id)
  const menungguSopir = form.status === 'menunggu_sopir'
  const wajibSopir = !menungguSopir && wajib(!!(existing?.driver_ids?.length || existing?.driver_id))
  const wajibKendaraan = wajib(!!existing?.vehicle_id)

  const sopirTerdaftar = useMemo(() => db.drivers.filter((d) => d.role === 'sopir'), [db.drivers])
  const managerTerdaftar = useMemo(() => db.drivers.filter((d) => d.role === 'manager'), [db.drivers])

  /** Terpakai per kontrak: uang jalan + biaya seluruh trip kontrak (selain trip ini). */
  const terpakaiKontrak = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactionRows) {
      if (!t.contract_id || t.status === 'batal' || t.id === existing?.id) continue
      m.set(t.contract_id, (m.get(t.contract_id) ?? 0) + t.uj_total + t.expense_total + t.internal_total)
    }
    return m
  }, [transactionRows, existing?.id])

  /** Jumlah trip berangkat per tanggal: penanda di kalender Tanggal Berangkat. */
  const tripPerTanggal = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactionRows) {
      if (t.status === 'batal' || t.id === existing?.id) continue
      m.set(t.transaction_date, (m.get(t.transaction_date) ?? 0) + 1)
    }
    return m
  }, [transactionRows, existing?.id])

  /**
   * Sopir dan mobil saling mengisi dari trip terakhir: di data asli, sopir membawa mobil
   * yang sama dengan trip terakhirnya pada 99% trip, dan mobil dibawa sopir terakhirnya 91%.
   */
  const pasangan = useMemo(() => {
    const urut = dbAll.transactions
      .filter((t) => t.status !== 'batal' && t.vehicle_id && (t.driver_ids?.[0] || t.driver_id))
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.transaction_no.localeCompare(b.transaction_no))
    const mobilSopir = new Map<string, string>()
    const sopirMobil = new Map<string, string>()
    for (const t of urut) {
      const sopir = t.driver_ids?.[0] || t.driver_id
      mobilSopir.set(sopir, t.vehicle_id)
      sopirMobil.set(t.vehicle_id, sopir)
    }
    return { mobilSopir, sopirMobil }
  }, [dbAll.transactions])
  const [otomatis, setOtomatis] = useState<{ kendaraan?: string; sopir?: string }>({})

  const joOptions = useMemo(
    () => db.jobOrders.map((j) => ({ value: j.id, label: j.sijo, meta: `${j.customer_name} · ${j.party}`, keywords: `${j.customer_code} ${j.goods} ${j.ship}` })),
    [db.jobOrders],
  )
  const vehicleOptions = useMemo(
    () => db.vehicles.map((v) => ({
      value: v.id,
      label: v.plate_number,
      meta: [v.configuration, v.vehicle_type, v.status !== 'aktif' ? v.status : ''].filter(Boolean).join(' · '),
    })),
    [db.vehicles],
  )
  const klienMap = useMemo(() => new Map(db.projects.map((p) => [p.id, p])), [db.projects])
  /** Rute klien terpilih di urutan atas (di data asli, 99% rute hanya dipakai satu klien). */
  const routeOptions = useMemo(() => {
    const milikKlien = (r: { project_id?: string }) => !!form.project_id && r.project_id === form.project_id
    return [...db.routes]
      .sort((a, b) => Number(milikKlien(b)) - Number(milikKlien(a)))
      .map((r) => {
        const pemilik = klienMap.get(r.project_id ?? '')
        return {
          value: r.id,
          label: r.route_name || r.route_code,
          meta: [pemilik ? `Klien ${pemilik.project_code}` : '', r.feet, `UJ ${formatRupiah(r.ujroute)}`].filter(Boolean).join(' · '),
          keywords: `${r.route_code} ${r.feet} ${pemilik?.project_code ?? ''} ${pemilik?.project_name ?? ''}`,
        }
      })
  }, [db.routes, form.project_id, klienMap])
  const contractOptions = useMemo(
    () => db.contracts
      .filter((c) => c.status === 'aktif' || c.id === form.contract_id)
      // Klien kontrak sudah dipilih: tampilkan kontrak miliknya saja.
      .filter((c) => !form.project_id || klienMap.get(form.project_id)?.client_type !== 'kontrak' || c.project_id === form.project_id)
      .map((c) => {
        const klien = klienMap.get(c.project_id)
        return {
          value: c.id,
          label: c.contract_no,
          meta: `${klien?.project_name ?? 'Klien tidak ditemukan'} · sisa ${formatRupiah(c.value - (terpakaiKontrak.get(c.id) ?? 0))}`,
          keywords: `${klien?.project_code ?? ''} ${klien?.project_name ?? ''}`,
        }
      }),
    [db.contracts, form.contract_id, form.project_id, terpakaiKontrak, klienMap],
  )
  /** Sopir nonaktif tetap muncul bila sudah tercatat di trip ini. */
  const sopirOptions = (pilihanIni: string) =>
    sopirTerdaftar
      .filter((d) => d.status === 'aktif' || d.id === pilihanIni)
      .filter((d) => d.id === pilihanIni || !form.driver_ids.includes(d.id))
      .map((d) => ({ value: d.id, label: `${d.driver_code} — ${d.driver_name}`, meta: [d.address_2, d.city].filter(Boolean).join(', '), keywords: d.driver_name }))

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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  /** Tanggal berganti bulan -> nomor trip otomatis ikut bulan barunya. */
  function ubahTanggal(tanggal: string) {
    setForm((f) => {
      if (mode === 'edit' || !tanggal) return { ...f, transaction_date: tanggal }
      const lamaOtomatis = nomorTripBerikut(dbAll.transactions.map((t) => t.transaction_no), f.transaction_date)
      const nomor = f.transaction_no === lamaOtomatis
        ? nomorTripBerikut(dbAll.transactions.map((t) => t.transaction_no), tanggal)
        : f.transaction_no
      return { ...f, transaction_date: tanggal, transaction_no: nomor }
    })
  }

  /**
   * Pilih, ganti, atau kosongkan SI/BL. Kolom yang masih kosong atau masih berisi data
   * SI/JO sebelumnya ikut diganti (atau dikosongkan saat SI/BL dihapus), jadi salah pilih
   * tidak perlu dihapus satu per satu. Kolom yang sudah diketik sendiri dibiarkan.
   */
  function applyJobOrder(joId: string | null) {
    const baru = joId ? db.jobOrders.find((j) => j.id === joId) : undefined
    if (joId && !baru) return
    const lama = db.jobOrders.find((j) => j.id === form.job_order_id)
    setForm((f) => {
      const sebelumnya = db.jobOrders.find((j) => j.id === f.job_order_id)
      const [lama1, lama2] = alamatJo(sebelumnya)
      const [baru1, baru2] = alamatJo(baru)
      const ikut = (isi: string, dariLama: string, dariBaru: string) => (!isi.trim() || isi === dariLama ? dariBaru : isi)
      return {
        ...f,
        job_order_id: joId ?? '',
        recipient_name: ikut(f.recipient_name, sebelumnya?.customer_name ?? '', baru?.customer_name ?? ''),
        recipient_address_1: ikut(f.recipient_address_1, lama1, baru1),
        recipient_address_2: ikut(f.recipient_address_2, lama2, baru2),
        party: ikut(f.party, sebelumnya?.party ?? '', baru?.party ?? ''),
        ship: ikut(f.ship, sebelumnya?.ship ?? '', baru?.ship ?? ''),
        goods_type: ikut(f.goods_type, sebelumnya?.goods ?? '', baru?.goods ?? ''),
      }
    })
    if (baru) toast.info(`Data customer diambil dari SI/JO ${baru.sijo}. Kolom yang sudah diisi sendiri tidak ditimpa.`)
    else if (lama) toast.info(`Isian dari SI/JO ${lama.sijo} ikut dikosongkan.`)
  }

  /**
   * Pilih rute -> Klien, Tujuan, dan Harga ikut terisi. Satu rute dimiliki satu klien
   * (di data asli: 130 dari 130 rute yang dipakai), jadi klien tidak dipilih lagi di form.
   * Klien kontrak -> Dedicated, dan kontraknya terpilih bila hanya ada satu. Tujuan &
   * Harga yang sudah diganti manual tidak ditimpa; Kepada Yth ikut nama klien bila kosong.
   */
  function applyRoute(routeId: string | null) {
    const route = db.routes.find((r) => r.id === routeId)
    const klienRute = klienMap.get(route?.project_id ?? '')
    const kontrakKlien = klienRute?.client_type === 'kontrak'
      ? db.contracts.filter((c) => c.project_id === klienRute.id && c.status === 'aktif')
      : []
    if (form.service_type === 'callout' && kontrakKlien.length > 0) {
      toast.info(`${klienRute!.project_name} klien kontrak: layanan diganti ke Dedicated.`)
    }
    setForm((f) => {
      const sebelumnya = db.routes.find((r) => r.id === f.route_id)
      const tujuanBoleh = !f.destination_detail.trim() || f.destination_detail.trim() === (sebelumnya?.route_name ?? '').trim()
      const hargaBoleh = !f.cost_value || f.cost_value === (sebelumnya?.price ?? 0)
      const layanan: ServiceType = f.service_type === 'dedicated' || kontrakKlien.length > 0 ? 'dedicated' : 'callout'
      const kontrakIni = f.service_type === 'dedicated' && f.contract_id ? f.contract_id
        : kontrakKlien.length === 1 ? kontrakKlien[0].id : ''
      // Dedicated: klien ikut kontrak; rute hanya patokan uang jalan & tujuan.
      const pemilikKontrak = db.contracts.find((c) => c.id === kontrakIni)?.project_id
      const projectId = layanan === 'dedicated' ? pemilikKontrak ?? route?.project_id ?? f.project_id : route?.project_id ?? ''
      const klienLama = klienMap.get(f.project_id)
      const penerimaBoleh = !f.recipient_name.trim() || f.recipient_name === (klienLama?.project_name ?? '')
      return {
        ...f,
        route_id: routeId ?? '',
        service_type: layanan,
        contract_id: layanan === 'dedicated' ? kontrakIni : '',
        project_id: projectId,
        cost_value: route && hargaBoleh ? route.price : f.cost_value,
        destination_detail: route && tujuanBoleh ? route.route_name : f.destination_detail,
        recipient_name: layanan === 'callout' && penerimaBoleh ? klienMap.get(projectId)?.project_name ?? '' : f.recipient_name,
      }
    })
    setErrors((er) => { const { route_id: _r, contract_id: _c, ...sisa } = er; return sisa })
  }

  /* ── Daftar dinamis: ID Perjalanan/Trip dan Sopir ─────────── */
  const ubahId = (i: number, v: string) => setForm((f) => ({ ...f, trip_ids: f.trip_ids.map((x, j) => (j === i ? v.toUpperCase().replace(/\s+/g, '') : x)) }))
  /** Baris ID baru langsung terisi ID unik; tetap bisa diganti nomor container. */
  const tambahId = () => setForm((f) => ({
    ...f,
    trip_ids: [...f.trip_ids, buatKodeUnik([...dbAll.transactions.flatMap((t) => t.trip_ids ?? []), ...f.trip_ids])],
  }))
  const hapusId = (i: number) => setForm((f) => ({ ...f, trip_ids: f.trip_ids.length > 1 ? f.trip_ids.filter((_, j) => j !== i) : [''] }))
  /** Tombol Generate: ID unik yang belum ada di trip mana pun maupun di baris lain form ini. */
  function generateId(i: number) {
    const terpakai = [...dbAll.transactions.flatMap((t) => t.trip_ids ?? []), ...form.trip_ids]
    ubahId(i, buatKodeUnik(terpakai))
    setErrors((er) => { const { trip_ids: _t, ...sisa } = er; return sisa })
  }

  /** Status ikut sopir: ada sopir = Aktif, belum ada = Menunggu Sopir (selama belum diubah sendiri). */
  const statusIkutSopir = (f: FormState): FormState => {
    if (statusManual.current) return f
    const adaSopir = f.driver_ids.some(Boolean)
    if (adaSopir && f.status === 'menunggu_sopir') return { ...f, status: 'aktif' }
    if (!adaSopir && f.status === 'aktif') return { ...f, status: 'menunggu_sopir' }
    return f
  }
  const ubahSopir = (i: number, v: string | null) => {
    const mobilTerakhir = i === 0 && v ? pasangan.mobilSopir.get(v) : undefined
    const isiMobil = !!mobilTerakhir && !form.vehicle_id && db.vehicles.some((x) => x.id === mobilTerakhir && x.status === 'aktif')
    setForm((f) => statusIkutSopir({
      ...f,
      driver_ids: f.driver_ids.map((x, j) => (j === i ? v ?? '' : x)),
      vehicle_id: isiMobil && !f.vehicle_id ? mobilTerakhir! : f.vehicle_id,
    }))
    if (isiMobil) setOtomatis({ kendaraan: db.drivers.find((d) => d.id === v)?.driver_name ?? '' })
    if (i === 0) setOtomatis((o) => ({ ...o, sopir: undefined }))
  }
  function pilihKendaraan(v: string | null) {
    const sopirTerakhir = v ? pasangan.sopirMobil.get(v) : undefined
    const isiSopir = !!sopirTerakhir && !form.driver_ids[0] && sopirTerdaftar.some((d) => d.id === sopirTerakhir && d.status === 'aktif')
    setForm((f) => statusIkutSopir({
      ...f,
      vehicle_id: v ?? '',
      driver_ids: isiSopir && !f.driver_ids[0] ? [sopirTerakhir!, ...f.driver_ids.slice(1)] : f.driver_ids,
    }))
    setOtomatis(isiSopir ? { sopir: db.vehicles.find((x) => x.id === v)?.plate_number ?? '' } : {})
  }
  const tambahSopir = () => setForm((f) => ({ ...f, driver_ids: [...f.driver_ids, ''] }))
  const hapusSopir = (i: number) => setForm((f) => statusIkutSopir({ ...f, driver_ids: f.driver_ids.length > 1 ? f.driver_ids.filter((_, j) => j !== i) : [''] }))

  /**
   * ID Perjalanan/Trip berisi nomor container yang memang dipakai ulang di trip
   * lain, jadi kesamaan dengan trip lain hanya diingatkan, tidak ditolak.
   */
  const idTerisi = form.trip_ids.map(bersih).filter(Boolean)
  const idDipakaiLain = idTerisi
    .map((v) => ({ v, trip: dbAll.transactions.find((t) => t.id !== existing?.id && t.status !== 'batal' && (t.trip_ids ?? []).some((x) => bersih(x) === v)) }))
    .filter((x) => x.trip)

  function validate(): boolean {
    const e: Record<string, string> = {}
    const no = form.transaction_no.trim()
    if (!no) e.transaction_no = 'Nomor Trip wajib diisi.'
    else if (dbAll.transactions.some((t) => t.transaction_no === no && t.id !== existing?.id)) e.transaction_no = 'Nomor Trip sudah dipakai.'
    const sj = form.sj_no.trim()
    if (sj && dbAll.transactions.some((t) => t.sj_no.toLowerCase() === sj.toLowerCase() && t.id !== existing?.id)) e.sj_no = 'Nomor Surat Jalan sudah dipakai.'
    if (!form.transaction_date) e.transaction_date = 'Tanggal Berangkat wajib diisi.'
    if (dedicated && !form.contract_id) e.contract_id = 'Layanan Dedicated wajib memilih nomor kontrak.'
    const rute = db.routes.find((r) => r.id === form.route_id)
    if (!dedicated && rute && form.cost_value > 0 && form.cost_value !== rute.price && !(form.override_note ?? '').trim() && form.cost_value !== existing?.cost_value)
      e.override_note = 'Tulis alasan harga berbeda dari Harga route.'
    if (wajibRoute && !form.route_id) e.route_id = 'Rute wajib dipilih.'
    if (wajibKendaraan && !form.vehicle_id) e.vehicle_id = 'No. Kendaraan wajib dipilih.'
    if (wajibSopir && !form.driver_ids.some(Boolean)) e.driver_ids = 'Pilih minimal satu sopir, atau ubah status ke Menunggu Sopir.'
    if (wajibId && idTerisi.length === 0) e.trip_ids = 'Isi minimal satu ID Perjalanan/Trip.'
    const kembar = idTerisi.find((v, i) => idTerisi.indexOf(v) !== i)
    if (kembar) e.trip_ids = `ID ${kembar} tertulis dua kali di trip ini.`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const kontrak = db.contracts.find((c) => c.id === form.contract_id)
  const klienKontrak = kontrak ? klienMap.get(kontrak.project_id) : undefined
  /** Klien trip: ikut kontrak (Dedicated) atau rute (Callout); tidak dipilih di form. */
  const klienDipilih = klienMap.get(form.project_id)

  /** Pilih kontrak -> klien trip ikut klien pemilik kontrak (kosong: kembali ke klien rute). */
  function pilihKontrak(id: string | null) {
    const k = db.contracts.find((c) => c.id === id)
    setForm((f) => ({
      ...f,
      contract_id: id ?? '',
      project_id: k?.project_id ?? db.routes.find((r) => r.id === f.route_id)?.project_id ?? '',
    }))
  }

  function save(thenPrint: boolean) {
    if (!validate()) { toast.error('Periksa kembali isian yang ditandai merah.'); return }
    const driverIds = [...new Set(form.driver_ids.filter(Boolean))]
    const payload = {
      ...form,
      contract_id: dedicated ? form.contract_id : '',
      // Klien tidak diisi di form: Dedicated ikut kontrak, Callout ikut rute (trip lama tanpa klien rute tetap).
      project_id: (dedicated ? klienKontrak?.id : selectedRoute?.project_id) || form.project_id,
      transaction_no: form.transaction_no.trim(),
      sj_no: form.sj_no.trim(),
      trip_ids: idTerisi,
      driver_ids: driverIds,
      driver_id: driverIds[0] ?? '',
      manager_name: form.manager_id ? '' : form.manager_name.trim(),
      // Dedicated: penerima Surat Jalan = klien kontrak bila belum diisi.
      recipient_name: form.recipient_name.trim() || (dedicated ? klienKontrak?.project_name ?? '' : ''),
      destination_detail: form.destination_detail.trim(),
    }
    const suffix = thenPrint ? '?print=1' : ''
    if (existing) {
      ubahTrip(existing.id, payload)
      toast.success('Trip berhasil diperbarui.')
      navigate(`/transaksi/trip/${existing.id}${suffix}`)
    } else {
      const created = buatTrip(payload)
      toast.success('Trip berhasil disimpan. Catat uang jalan di tab Uang Jalan saat dibayar.')
      navigate(`/transaksi/trip/${created.id}${suffix}`)
    }
  }

  const selectedJo = db.jobOrders.find((j) => j.id === form.job_order_id)
  // Bagian yang tampil mengikuti cabang & klien; isian yang sudah terisi tetap ditampilkan.
  const tampilContainer = cabangContainer || !!(form.party || form.job_order_id || form.ship || form.kosongan || form.location || form.goods_type)
  const tampilDokumen = (klienDipilih ? klienDipilih.requires_document : !cabangContainer) || !!(form.tr_reference || form.pi_number || form.pi_status)
  const tampilBon = cabangContainer || !!(form.bon_date || form.personal_bon)
  const selectedRoute = db.routes.find((r) => r.id === form.route_id)
  const selectedVehicle = db.vehicles.find((v) => v.id === form.vehicle_id)
  const routeProject = db.projects.find((p) => p.id === selectedRoute?.project_id)
  const judul = mode === 'edit' ? `Ubah Trip ${existing?.transaction_no}` : 'Tambah Trip'

  /** Perkiraan komisi sopir dari master Komisi, dengan isian form saat ini. */
  const perkiraanKomisi = hitungKomisiTrip(db.commissionSchemes, {
    role: 'sopir',
    layanan: form.service_type,
    konfigurasi: selectedVehicle?.configuration ?? '',
    cost_value: form.cost_value,
    route_price: selectedRoute?.price ?? 0,
    ujroute: selectedRoute?.ujroute ?? 0,
    uj_total: existing ? transactionRows.find((t) => t.id === existing.id)?.uj_total ?? 0 : 0,
  })
  const sisaKontrak = kontrak ? kontrak.value - (terpakaiKontrak.get(kontrak.id) ?? 0) : 0

  /** Harga trip: terisi dari Harga route, boleh diubah bila harga trip ini beda. */
  const hargaOverride = !!selectedRoute && form.cost_value > 0 && form.cost_value !== selectedRoute.price
  const petunjukHarga: ReactNode = !bolehOverride
    ? 'Mengikuti Harga route. Harga berbeda perlu Manager atau Owner.'
    : !selectedRoute
    ? 'Terisi dari Harga route setelah rute dipilih. Dasar komisi & pendapatan.'
    : !form.cost_value
      ? <>Kosong: memakai Harga route {formatRupiah(selectedRoute.price)} · <PakaiNilai label="Isi" onClick={() => set('cost_value', selectedRoute.price)} /></>
      : form.cost_value === selectedRoute.price
        ? 'Sama dengan Harga route. Ubah bila harga trip ini beda; komisi & pendapatan ikut harga ini.'
        : <>Harga khusus trip ini (Harga route {formatRupiah(selectedRoute.price)}) · <PakaiNilai label="Pakai Harga route" onClick={() => set('cost_value', selectedRoute.price)} /></>

  /** Callout: klien ikut rute. Dedicated: klien ikut kontrak, yang terpilih sendiri bila klien rute hanya punya satu. */
  function gantiLayanan(l: ServiceType) {
    setForm((f) => {
      const rute = db.routes.find((r) => r.id === f.route_id)
      if (l === 'callout') return { ...f, service_type: l, contract_id: '', project_id: rute?.project_id ?? '' }
      const kontrakRute = db.contracts.filter((c) => c.status === 'aktif' && !!rute?.project_id && c.project_id === rute.project_id)
      const kontrakIni = f.contract_id || (kontrakRute.length === 1 ? kontrakRute[0].id : '')
      const pemilik = db.contracts.find((c) => c.id === kontrakIni)?.project_id
      return { ...f, service_type: l, contract_id: kontrakIni, project_id: pemilik ?? rute?.project_id ?? '' }
    })
    setErrors({})
  }

  const fieldSopir = (
    <Field
      label="Sopir"
      required={wajibSopir}
      error={errors.driver_ids}
      hint={errors.driver_ids ? undefined
        : otomatis.sopir ? `Terisi dari trip terakhir mobil ${otomatis.sopir}. Ganti bila beda.`
        : menungguSopir && !form.driver_ids.some(Boolean) ? 'Boleh dikosongkan; trip tersimpan sebagai Menunggu Sopir.'
        : form.driver_ids.length > 1 ? 'Sopir pertama adalah sopir utama (penerima komisi).' : 'Memilih sopir ikut mengisi mobil terakhirnya.'}
    >
      {(fid) => (
        <div className="space-y-2">
          {form.driver_ids.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  id={i === 0 ? fid : undefined}
                  options={sopirOptions(v)}
                  value={v || null}
                  invalid={!!errors.driver_ids && i === 0 && !v}
                  placeholder={i === 0 ? 'Cari kode / nama sopir...' : 'Sopir tambahan...'}
                  onChange={(nv) => ubahSopir(i, nv)}
                />
              </div>
              {form.driver_ids.length > 1 && (
                <IconButton label="Hapus sopir ini" tone="danger" icon={<FaXmark size={14} />} onClick={() => hapusSopir(i)} />
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<FaPlus size={14} />} onClick={tambahSopir}>Tambah sopir</Button>
        </div>
      )}
    </Field>
  )

  const fieldKendaraan = (
    <Field
      label="No. Kendaraan"
      required={wajibKendaraan}
      error={errors.vehicle_id}
      hint={errors.vehicle_id ? undefined
        : otomatis.kendaraan ? `Terisi dari trip terakhir ${otomatis.kendaraan}. Ganti bila beda.`
        : selectedVehicle?.configuration ? `Konfigurasi ${selectedVehicle.configuration}` : 'Memilih mobil ikut mengisi sopir terakhirnya.'}
    >
      {(fid) => (
        <SearchableSelect id={fid} options={vehicleOptions} value={form.vehicle_id || null} invalid={!!errors.vehicle_id}
          placeholder="Pilih nomor kendaraan..." onChange={pilihKendaraan} />
      )}
    </Field>
  )

  const fieldTujuan = (
    <Field label="Tujuan" hint="Terisi otomatis dari rute, masih bisa diubah.">
      {(fid) => (
        <Input id={fid} value={form.destination_detail} placeholder="CIB - DURI"
          onChange={(e) => set('destination_detail', e.target.value)} />
      )}
    </Field>
  )

  return (
    <div className="pb-20">
      <PageHeader
        title={judul}
        crumbs={[
          { label: 'Trip / Job Order', to: '/transaksi/trip' },
          ...(existing ? [{ label: existing.transaction_no, to: `/transaksi/trip/${existing.id}` }] : []),
          { label: mode === 'edit' ? 'Ubah' : 'Tambah' },
        ]}
        description="Klien tidak perlu dipilih: ikut rute (Callout) atau kontrak (Dedicated), begitu juga harga dan patokan uang jalan. Uang jalan, biaya, dan lampiran dicatat di halaman detail trip."
      />

      {!bolehSimpan && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] text-[#8a6100]">
          <FaTriangleExclamation size={15} className="mt-px shrink-0" />
          Peran {user?.role === 'viewer' ? 'Viewer' : 'ini'} tidak dapat menyimpan perubahan. Form ini hanya untuk melihat struktur data.
        </div>
      )}

      <div className="mb-4">
        <Section
          title="Layanan"
          description={klienDipilih
            ? `Klien ${klienDipilih.project_name}, ikut ${dedicated && klienKontrak ? `kontrak ${kontrak?.contract_no}` : 'rute'}.`
            : 'Klien ikut rute yang dipilih (Callout) atau pemilik kontrak (Dedicated).'}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Radio
              name="layanan"
              checked={!dedicated}
              onChange={() => gantiLayanan('callout')}
              label="Callout"
              description={cabangContainer ? 'Order per perjalanan: penerima, SI/BL, dan nomor container.' : 'Order per perjalanan: penerima, TR, dan No PI.'}
            />
            <Radio
              name="layanan"
              checked={dedicated}
              onChange={() => gantiLayanan('dedicated')}
              label="Dedicated"
              description="Kendaraan dikontrak satu klien. Form ringkas, wajib memilih nomor kontrak."
            />
          </div>

          {dedicated && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field
                label="No. Kontrak"
                required
                error={errors.contract_id}
                hint={errors.contract_id ? undefined : db.contracts.length === 0 ? <>Belum ada kontrak. Tambahkan di halaman klien, menu <Link to="/master/klien" className="text-brand-700 underline">Klien / Pelanggan</Link>.</> : 'Kontrak aktif di workspace ini.'}
              >
                {(fid) => (
                  <SearchableSelect id={fid} options={contractOptions} value={form.contract_id || null} invalid={!!errors.contract_id}
                    placeholder="Pilih nomor kontrak..." searchPlaceholder="Ketik nomor kontrak atau klien..."
                    onChange={pilihKontrak} />
                )}
              </Field>
              {kontrak && (
                <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
                  <p className="text-[12px] text-brand-800">Klien <span className="font-semibold">{klienKontrak?.project_name ?? '—'}</span></p>
                  <dl className="mt-2 grid grid-cols-3 gap-x-4">
                    {([['Nilai kontrak', kontrak.value], ['Terpakai', kontrak.value - sisaKontrak], ['Sisa', sisaKontrak]] as const).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold tracking-wide text-brand-700/80 uppercase">{k}</dt>
                        <dd className={cn('tnum text-[13px] font-semibold', v < 0 ? 'text-[color:var(--color-critical)]' : 'text-brand-900')}>{formatRupiah(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <div className="mb-4">
        <Card>
          <CardHeader title="Konfigurasi" subtitle="Satu trip boleh memuat beberapa ID Perjalanan/Trip, dengan satu rute." />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <Field
              label="ID Perjalanan/Trip"
              required={wajibId}
              error={errors.trip_ids}
              hint={errors.trip_ids ? undefined : 'Terisi ID unik otomatis; ganti dengan nomor container / ID perjalanan bila ada. Nomor container boleh sama dengan trip lain karena dipakai ulang.'}
            >
              {(fid) => (
                <div className="space-y-2">
                  {form.trip_ids.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="tnum w-5 shrink-0 text-right text-[12px] font-semibold text-ink-3">{i + 1}.</span>
                      <KodeInput
                        id={i === 0 ? fid : undefined}
                        value={v}
                        invalid={!!errors.trip_ids && !v.trim()}
                        placeholder="TCLU1234567"
                        className="min-w-0 flex-1"
                        aria-label={`ID Perjalanan/Trip ${i + 1}`}
                        generateTitle={`Buat ID Perjalanan/Trip ${i + 1} otomatis`}
                        onChange={(nilai) => ubahId(i, nilai)}
                        onGenerate={() => generateId(i)}
                      />
                      <IconButton
                        label="Hapus ID ini"
                        tone="danger"
                        icon={<FaXmark size={14} />}
                        disabled={form.trip_ids.length === 1 && !v}
                        onClick={() => hapusId(i)}
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" icon={<FaPlus size={14} />} className="ml-6" onClick={tambahId}>
                    Tambah ID Perjalanan/Trip
                  </Button>
                  {idDipakaiLain.length > 0 && (
                    <p className="ml-6 text-[12px] text-[#8a6100]">
                      {idDipakaiLain.map((x) => `${x.v} juga ada di Trip ${x.trip!.transaction_no}`).join('; ')}. Pastikan memang benar.
                    </p>
                  )}
                </div>
              )}
            </Field>

            <div className="space-y-3">
              <Field
                label="Rute"
                required={wajibRoute}
                error={errors.route_id}
                hint={errors.route_id ? undefined
                  : !selectedRoute ? (dedicated ? 'Opsional untuk Dedicated: patokan uang jalan & tujuan.' : 'Klien, Harga, dan patokan uang jalan ikut rute.')
                  : routeProject ? `Klien ${routeProject.project_name} ikut rute ini. UJROUTE jadi patokan uang jalan.`
                  : <>Rute ini belum punya klien. Lengkapi di menu <Link to="/master/route" className="text-brand-700 underline">Rute</Link> supaya trip tercatat ke klien.</>}
              >
                {(fid) => (
                  <SearchableSelect
                    id={fid}
                    options={routeOptions}
                    value={form.route_id || null}
                    invalid={!!errors.route_id}
                    placeholder="Pilih rute..."
                    searchPlaceholder="Ketik nama atau kode rute..."
                    onChange={applyRoute}
                  />
                )}
              </Field>
              {!dedicated && (
                <Field label="Harga" hint={petunjukHarga}>
                  {(fid) => <CurrencyInput id={fid} value={form.cost_value} disabled={!bolehOverride} onValueChange={(v) => set('cost_value', v)} />}
                </Field>
              )}
              {!dedicated && hargaOverride && bolehOverride && (
                <Field label="Alasan & bukti persetujuan" error={errors.override_note}
                  hint={errors.override_note ? undefined : 'Harga berbeda dari Harga route: catat alasannya dan lampirkan bukti persetujuan.'}>
                  {(fid) => (
                    <div className="space-y-2">
                      <Input id={fid} value={form.override_note ?? ''} placeholder="mis. nego klien, harga khusus proyek"
                        onChange={(e) => set('override_note', e.target.value)} />
                      {bisa('bukti') && (
                        <LampiranInput label="Tambah bukti" value={form.override_attachments ?? []}
                          onChange={(v) => setForm((f) => ({ ...f, override_attachments: v }))} />
                      )}
                    </div>
                  )}
                </Field>
              )}
              {(selectedRoute || perkiraanKomisi.aturan) && (
                <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
                  {selectedRoute && (
                    <>
                      <p className="text-[12px] text-brand-800">
                        <span className="tnum font-semibold">{selectedRoute.route_code}</span>
                        {selectedRoute.feet && <> · {selectedRoute.feet}</>}
                        {routeProject && <> · Klien <span className="font-semibold">{routeProject.project_name}</span> ({routeProject.project_code})</>}
                      </p>
                      <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5">
                        {([
                          ['UJROUTE (patokan)', selectedRoute.ujroute],
                          ['Uang Tol (patokan)', selectedRoute.toll ?? 0],
                          ['Harga route', selectedRoute.price],
                        ] as const).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[11px] font-semibold tracking-wide text-brand-700/80 uppercase">{k}</dt>
                            <dd className="tnum text-[13px] font-semibold text-brand-900">{formatRupiah(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  <p className={cn('text-[12px] text-brand-800', selectedRoute && 'mt-2 border-t border-brand-100 pt-2')}>
                    Perkiraan komisi sopir: <span className="tnum font-semibold">{formatRupiah(perkiraanKomisi.nilai)}</span>
                    <span className="block text-[11.5px] text-brand-700">
                      {perkiraanKomisi.keterangan}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className={cn('grid gap-4', !dedicated && 'xl:grid-cols-2')}>
        <Section title="Informasi Dokumen">
          <div className={cn('grid gap-4 sm:grid-cols-2', dedicated && 'lg:grid-cols-3')}>
            <Field label="Tanggal Order" hint="Hari permintaan klien masuk.">
              {(fid) => <DateInput id={fid} value={form.order_date ?? ''} onChange={(e) => set('order_date', e.target.value)} />}
            </Field>
            <Field
              label="Tanggal Berangkat"
              required
              error={errors.transaction_date}
              hint={form.order_date && form.transaction_date && form.transaction_date < form.order_date
                ? 'Lebih awal dari Tanggal Order. Pastikan memang benar.'
                : 'Hari trip jalan. Dipakai untuk Nomor Trip, Surat Jalan, dan laporan.'}
            >
              {(fid) => (
                <DateInput id={fid} value={form.transaction_date} invalid={!!errors.transaction_date}
                  penanda={(t) => tripPerTanggal.get(t) ?? 0} penandaLabel="trip berangkat"
                  onChange={(e) => ubahTanggal(e.target.value)} />
              )}
            </Field>
            <Field label="Nomor Trip" required error={errors.transaction_no} hint={errors.transaction_no ? undefined : 'Nomor urut otomatis per bulan.'}>
              {(fid) => (
                <KodeInput id={fid} value={form.transaction_no} invalid={!!errors.transaction_no}
                  generateTitle="Buat nomor trip berikutnya untuk bulan tanggal trip"
                  onChange={(v) => set('transaction_no', v)}
                  onGenerate={() => set('transaction_no', nomorTripBerikut(
                    dbAll.transactions.filter((t) => t.id !== existing?.id).map((t) => t.transaction_no),
                    form.transaction_date || todayISO(),
                  ))} />
              )}
            </Field>
            <Field label="Nomor Surat Jalan" error={errors.sj_no} hint={errors.sj_no ? undefined : form.sj_no ? 'Nomor urut otomatis.' : 'Kosong = dicetak memakai Nomor Trip.'}>
              {(fid) => (
                <KodeInput id={fid} value={form.sj_no} invalid={!!errors.sj_no} placeholder="SJ-000001" uppercase
                  generateTitle="Buat nomor Surat Jalan berikutnya"
                  onChange={(v) => set('sj_no', v)}
                  onGenerate={() => set('sj_no', nomorSuratJalanBerikut(
                    dbAll.transactions.filter((t) => t.id !== existing?.id).map((t) => t.sj_no).filter(Boolean),
                  ))} />
              )}
            </Field>
            <Field
              label="Status"
              hint={menungguSopir && form.driver_ids.some(Boolean)
                ? 'Sopir sudah dipilih. Ubah ke Aktif bila trip sudah jalan.'
                : statusManual.current ? 'Pembatalan lewat tombol Batalkan Trip.' : 'Otomatis: Menunggu Sopir sampai sopir dipilih, lalu Aktif.'}
            >
              {(fid) => (
                <Select
                  id={fid}
                  value={form.status}
                  onChange={(e) => {
                    const next = e.target.value as TripStatus
                    statusManual.current = true
                    set('status', next)
                    // Menunggu Sopir membolehkan sopir kosong, jadi pesan wajib sopir ikut hilang.
                    if (next === 'menunggu_sopir') setErrors((er) => { const { driver_ids: _d, ...sisa } = er; return sisa })
                  }}
                >
                  {STATUS_FORM.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Manager" hint={managerTerdaftar.length ? 'Pilih manager terdaftar, atau isi nama sendiri.' : 'Belum ada manager di Supir / Karyawan — isi nama sendiri.'}>
              {(fid) => (
                <PilihKaryawan
                  id={fid}
                  karyawan={managerTerdaftar}
                  valueId={form.manager_id}
                  valueNama={form.manager_name}
                  peran="manager"
                  placeholder="Pilih manager..."
                  onChange={(mid, nama) => setForm((f) => ({ ...f, manager_id: mid, manager_name: nama }))}
                />
              )}
            </Field>
          </div>
        </Section>

        {!dedicated && (
          <Section title="Penerima" description="Dicetak pada Surat Jalan.">
            <div className="space-y-4">
              <Field label="Kepada Yth">
                {(fid) => (
                  <Input id={fid} value={form.recipient_name} placeholder="PT PINDODELI PULP &amp; PAPER MILLS"
                    onChange={(e) => set('recipient_name', e.target.value)} />
                )}
              </Field>
              <Field label="di" hint="Dua baris alamat penerima.">
                {(fid) => (
                  <div className="space-y-2">
                    <Input id={fid} value={form.recipient_address_1} placeholder="Kawasan Industri Pindodeli"
                      onChange={(e) => set('recipient_address_1', e.target.value)} />
                    <Input value={form.recipient_address_2} placeholder="Karawang"
                      onChange={(e) => set('recipient_address_2', e.target.value)} />
                  </div>
                )}
              </Field>
            </div>
          </Section>
        )}
      </div>

      <div className="mt-4">
        {dedicated ? (
          <Section title="Informasi Pengiriman" description="Penerima Surat Jalan otomatis memakai nama klien kontrak.">
            <div className="grid gap-4 sm:grid-cols-2">
              {fieldKendaraan}
              {fieldSopir}
              {fieldTujuan}
              <Field label="Catatan">
                {(fid) => <Textarea id={fid} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
              </Field>
            </div>
          </Section>
        ) : (
          <Section
            title="Informasi Pengiriman"
            description={tampilContainer
              ? 'SI/BL hanya untuk order container. Memilihnya mengisi Kepada Yth, alamat, Party, Jenis Brg, dan Kapal.'
              : 'Sopir dan mobil saling mengisi dari trip terakhir.'}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {fieldKendaraan}
              {fieldSopir}
              {tampilContainer && (<>
              <Field label="Party">
                {(fid) => <Input id={fid} value={form.party} placeholder="40 X 40" onChange={(e) => set('party', e.target.value)} />}
              </Field>
              <Field label="SI / BL" hint={selectedJo ? `Customer: ${selectedJo.customer_name}. Kosongkan untuk menghapus isian darinya.` : 'Kosongkan bila bukan order container.'}>
                {(fid) => (
                  <SearchableSelect id={fid} options={joOptions} value={form.job_order_id || null}
                    placeholder="Cari SI / Job Order..." onChange={applyJobOrder} />
                )}
              </Field>
              <Field label="Jenis Brg">
                {(fid) => <Input id={fid} value={form.goods_type} placeholder="Container" onChange={(e) => set('goods_type', e.target.value)} />}
              </Field>
              <Field label="Kosongan">
                {(fid) => <Input id={fid} value={form.kosongan} placeholder="DEPO MUSTIKA CAKUNG" onChange={(e) => set('kosongan', e.target.value)} />}
              </Field>
              <Field label="Lokasi">
                {(fid) => <Input id={fid} value={form.location} placeholder="JICT 1" onChange={(e) => set('location', e.target.value)} />}
              </Field>
              <Field label="Kapal">
                {(fid) => <Input id={fid} value={form.ship} placeholder="MV. ORIENTAL DIAMOND" onChange={(e) => set('ship', e.target.value)} />}
              </Field>
              </>)}
              {fieldTujuan}
            </div>
          </Section>
        )}
      </div>

      {!dedicated && (
        <div className="mt-4">
          <Section
            title={tampilDokumen || tampilBon ? 'Identifier & Catatan' : 'Catatan'}
            description={tampilDokumen ? 'TR dari klien; No PI diisi saat ditagihkan.' : undefined}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tampilDokumen && (<>
              <Field label="TR" hint="Nomor referensi dari customer.">
                {(fid) => <Input id={fid} value={form.tr_reference} placeholder="2600305331" onChange={(e) => set('tr_reference', e.target.value)} />}
              </Field>
              <Field label="No PI">
                {(fid) => <Input id={fid} value={form.pi_number} placeholder="0473" onChange={(e) => set('pi_number', e.target.value)} />}
              </Field>
              <Field label="Status PI" hint="mis. di pool, masih moving.">
                {(fid) => <Input id={fid} value={form.pi_status} onChange={(e) => set('pi_status', e.target.value)} />}
              </Field>
              </>)}
              {tampilBon && (<>
              <Field label="Tgl Bon">
                {(fid) => <DateInput id={fid} value={form.bon_date ?? ''} onChange={(e) => set('bon_date', e.target.value || null)} />}
              </Field>
              <Field label="Bon Pribadi">
                {(fid) => <CurrencyInput id={fid} value={form.personal_bon} onValueChange={(v) => set('personal_bon', v)} />}
              </Field>
              </>)}
              <Field label="Catatan" className="sm:col-span-2">
                {(fid) => <Textarea id={fid} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
              </Field>
            </div>
          </Section>
        </div>
      )}

      {/* Bar dimulai setelah rel sidebar (68px) supaya teks kirinya tidak tertutup. */}
      <div className={cn('no-print fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur', 'px-4 py-3 lg:left-[68px] lg:px-6')}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <p className="hidden truncate text-[12.5px] text-ink-3 sm:block">
            {form.transaction_no || 'nomor belum diisi'}
            {' · '}
            {dedicated ? `Dedicated ${kontrak?.contract_no ?? '(kontrak belum dipilih)'}` : `${idTerisi.length} ID Perjalanan/Trip`}
            {selectedRoute && <> · patokan UJ {formatRupiah(selectedRoute.ujroute)}</>}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => navigate(existing ? `/transaksi/trip/${existing.id}` : '/transaksi/trip')}>Batal</Button>
            <Button icon={<FaPrint size={15} />} disabled={!bolehSimpan} onClick={() => save(true)}>Simpan &amp; Cetak</Button>
            <Button variant="primary" icon={<FaFloppyDisk size={15} />} disabled={!bolehSimpan} onClick={() => save(false)}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
