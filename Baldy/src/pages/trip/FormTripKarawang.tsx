import { useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaFloppyDisk, FaPlus, FaPrint, FaRotateLeft, FaTriangleExclamation, FaXmark } from '../../components/ui/icons'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button, IconButton } from '../../components/ui/Button'
import { Checkbox, DateInput, Field, Input, Radio, Select, Textarea } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { PilihKaryawan } from '../../components/ui/PilihKaryawan'
import { KodeInput } from '../../components/ui/KodeInput'
import { LampiranInput } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { formatDate, formatRupiah, todayISO } from '../../lib/format'
import { hitungKomisiTrip } from '../../lib/komisi'
import { buatKodeUnik, nomorTripBerikut } from '../../lib/kode'
import { idBackload, kunciTr, lokasiRute, lokasiTrip, rapikanTr, samaLokasi, trTrip } from '../../lib/trip'
import { cn } from '../../lib/utils'
import type { CommissionTransaction, Route, ServiceType, TripStatus } from '../../types'
import { STATUS_LABEL } from './status'
import { PakaiNilai } from './bagian'
import { ModalRute } from '../master/FormRute'

/** Satu mobil di form: tersimpan sebagai satu trip. */
interface MobilForm {
  kunci: string
  vehicle_id: string
  driver_ids: string[]
  /** ID Perjalanan: satu per trip, dibuat sistem, boleh diganti. */
  trip_id: string
  tr: string[]
  harga: number
  /** Petunjuk isian otomatis dari pasangan sopir-mobil terakhir. */
  otomatis: { kendaraan?: string; sopir?: string }
}

/** Isian yang sama untuk semua mobil satu order. */
interface Bersama {
  service_type: ServiceType
  contract_id: string
  route_id: string
  project_id: string
  lokasi_muat: string
  lokasi_bongkar: string
  order_date: string
  transaction_date: string
  transaction_no: string
  status: TripStatus
  manager_id: string
  manager_name: string
  notes: string
  override_note: string
  override_attachments: string[]
}

type Galat = Record<string, string>

/** Status yang bisa dipilih saat mengubah trip. Selesai lewat Tutup Trip, Dibatalkan lewat Batalkan Trip. */
const STATUS_UBAH: TripStatus[] = ['draft', 'menunggu_sopir', 'aktif']

let urutKunci = 0
const kunciBaru = () => `m${++urutKunci}`

/**
 * Form trip workspace Karawang (alat berat & DHL), mengikuti alur atasan:
 * Layanan -> Rute -> Mobil (head unit, sopir) -> Harga. Satu order boleh
 * beberapa mobil: rute & jadwal diisi sekali, tiap mobil tersimpan sebagai trip
 * sendiri (ID Perjalanan, TR, uang jalan, POD, dan PI masing-masing), lalu
 * dicetak satu Berita Acara per mobil.
 */
export function FormTripKarawang({ mode, tripId, backloadDari }: {
  mode: 'create' | 'edit'
  tripId?: string
  /** Buat backload dari trip ini: mobil & sopir ikut trip asal. */
  backloadDari?: string
}) {
  const navigate = useNavigate()
  const { db, dbAll, transactionRows, buatTrip, ubahTrip } = useData()
  const { bisa, user } = useAuth()
  const toast = useToast()
  const bolehSimpan = bisa('trip')
  const bolehOverride = bisa('override')

  const existing = mode === 'edit' ? db.transactions.find((t) => t.id === tripId) : undefined
  const asal = mode === 'create' && backloadDari ? transactionRows.find((t) => t.id === backloadDari) : undefined
  const backload = !!asal
  const ruteMap = useMemo(() => new Map(db.routes.map((r) => [r.id, r])), [db.routes])
  const klienMap = useMemo(() => new Map(db.projects.map((p) => [p.id, p])), [db.projects])
  const semuaId = useMemo(() => dbAll.transactions.filter((t) => t.id !== existing?.id).flatMap((t) => t.trip_ids ?? []), [dbAll.transactions, existing?.id])

  const [bersama, setBersama] = useState<Bersama>(() => {
    const hariIni = todayISO()
    if (existing) {
      const r = ruteMap.get(existing.route_id)
      const lokasi = lokasiTrip(existing, r?.route_name ?? '')
      return {
        service_type: existing.service_type ?? 'callout', contract_id: existing.contract_id ?? '', route_id: existing.route_id ?? '',
        project_id: existing.project_id ?? '', lokasi_muat: lokasi.muat, lokasi_bongkar: lokasi.bongkar,
        order_date: existing.order_date ?? '', transaction_date: existing.transaction_date, transaction_no: existing.transaction_no,
        status: existing.status, manager_id: existing.manager_id ?? '', manager_name: existing.manager_name ?? '', notes: existing.notes ?? '',
        override_note: existing.override_note ?? '', override_attachments: existing.override_attachments ?? [],
      }
    }
    return {
      service_type: 'callout', contract_id: '', route_id: '', project_id: '',
      // Backload: lokasi bongkar trip asal menjadi lokasi muat.
      lokasi_muat: asal?.bongkar ?? '', lokasi_bongkar: '',
      order_date: hariIni, transaction_date: hariIni, transaction_no: '', status: 'menunggu_sopir',
      manager_id: asal?.manager_id ?? '', manager_name: asal?.manager_name ?? '', notes: '', override_note: '', override_attachments: [],
    }
  })

  const [mobil, setMobil] = useState<MobilForm[]>(() => {
    if (existing) {
      const sopir = existing.driver_ids?.length ? existing.driver_ids : existing.driver_id ? [existing.driver_id] : []
      const r = ruteMap.get(existing.route_id)
      return [{
        kunci: kunciBaru(), vehicle_id: existing.vehicle_id, driver_ids: sopir.length ? [...sopir] : [''],
        trip_id: existing.trip_ids?.[0] ?? '', tr: trTrip(existing), harga: existing.cost_value || r?.price || 0, otomatis: {},
      }]
    }
    if (asal) {
      return [{
        kunci: kunciBaru(), vehicle_id: asal.vehicle_id, driver_ids: asal.driver_ids.length ? [...asal.driver_ids] : [''],
        trip_id: idBackload(asal.trip_ids[0] || asal.transaction_no, semuaId), tr: [], harga: 0, otomatis: {},
      }]
    }
    return [{ kunci: kunciBaru(), vehicle_id: '', driver_ids: [''], trip_id: buatKodeUnik(semuaId), tr: [], harga: 0, otomatis: {} }]
  })
  const [galat, setGalat] = useState<Galat>({})
  const [pilihAsal, setPilihAsal] = useState(false)
  /** Modal tambah rute di tempat, supaya admin tidak bolak-balik ke menu Rute. */
  const [tambahRute, setTambahRute] = useState(false)
  const bolehTambahRute = bisa('master')

  const dedicated = bersama.service_type === 'dedicated'
  const rute = ruteMap.get(bersama.route_id)
  const klien = klienMap.get(bersama.project_id)
  const kontrak = db.contracts.find((c) => c.id === bersama.contract_id)
  const klienKontrak = kontrak ? klienMap.get(kontrak.project_id) : undefined
  const wajib = (adaSebelumnya: boolean) => mode === 'create' || adaSebelumnya

  /* ── Pilihan ─────────────────────────────────────────── */
  const sopirTerdaftar = useMemo(() => db.drivers.filter((d) => d.role === 'sopir'), [db.drivers])
  const managerTerdaftar = useMemo(() => db.drivers.filter((d) => d.role === 'manager'), [db.drivers])
  const vehicleOptions = useMemo(
    () => db.vehicles.map((v) => ({
      value: v.id, label: v.plate_number,
      meta: [v.configuration, v.vehicle_type, v.status !== 'aktif' ? v.status : ''].filter(Boolean).join(' · '),
    })),
    [db.vehicles],
  )
  /** Rute dari lokasi muat backload tampil paling atas, lalu rute klien kontrak. */
  const routeOptions = useMemo(() => {
    const skor = (r: { route_name: string; project_id?: string }) =>
      (bersama.lokasi_muat && samaLokasi(lokasiRute(r.route_name).asal, bersama.lokasi_muat) ? 2 : 0) +
      (dedicated && klienKontrak && r.project_id === klienKontrak.id ? 1 : 0)
    return [...db.routes]
      .sort((a, b) => skor(b) - skor(a))
      .map((r) => {
        const pemilik = klienMap.get(r.project_id ?? '')
        const dariSini = !!bersama.lokasi_muat && samaLokasi(lokasiRute(r.route_name).asal, bersama.lokasi_muat)
        return {
          value: r.id,
          label: r.route_name || r.route_code,
          meta: [dariSini ? `dari ${bersama.lokasi_muat}` : '', pemilik ? `Klien ${pemilik.project_code}` : '', `UJ ${formatRupiah(r.ujroute)}`].filter(Boolean).join(' · '),
          keywords: `${r.route_code} ${pemilik?.project_code ?? ''} ${pemilik?.project_name ?? ''}`,
        }
      })
  }, [db.routes, klienMap, bersama.lokasi_muat, dedicated, klienKontrak])
  const terpakaiKontrak = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactionRows) {
      if (!t.contract_id || t.status === 'batal' || t.id === existing?.id) continue
      m.set(t.contract_id, (m.get(t.contract_id) ?? 0) + t.uj_total + t.expense_total + t.internal_total)
    }
    return m
  }, [transactionRows, existing?.id])
  const contractOptions = useMemo(
    () => db.contracts.filter((c) => c.status === 'aktif' || c.id === bersama.contract_id).map((c) => {
      const k = klienMap.get(c.project_id)
      return {
        value: c.id, label: c.contract_no,
        meta: `${k?.project_name ?? 'Klien tidak ditemukan'} · sisa ${formatRupiah(c.value - (terpakaiKontrak.get(c.id) ?? 0))}`,
        keywords: `${k?.project_code ?? ''} ${k?.project_name ?? ''}`,
      }
    }),
    [db.contracts, bersama.contract_id, klienMap, terpakaiKontrak],
  )
  /** Sopir & mobil saling mengisi dari trip terakhir (data asli: 99% dan 91% cocok). */
  const pasangan = useMemo(() => {
    const urut = dbAll.transactions
      .filter((t) => t.status !== 'batal' && t.vehicle_id && (t.driver_ids?.[0] || t.driver_id))
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.transaction_no.localeCompare(b.transaction_no))
    const mobilSopir = new Map<string, string>()
    const sopirMobil = new Map<string, string>()
    for (const t of urut) {
      const s = t.driver_ids?.[0] || t.driver_id
      mobilSopir.set(s, t.vehicle_id)
      sopirMobil.set(t.vehicle_id, s)
    }
    return { mobilSopir, sopirMobil }
  }, [dbAll.transactions])
  /** TR yang sudah dipakai trip lain: wajar untuk satu order banyak mobil, cukup diberi tahu. */
  const trLain = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const t of transactionRows) {
      if (t.id === existing?.id || t.status === 'batal') continue
      for (const tr of t.tr_list) m.set(kunciTr(tr), [...(m.get(kunciTr(tr)) ?? []), `${t.transaction_no}${t.plate_number ? ` (${t.plate_number})` : ''}`])
    }
    return m
  }, [transactionRows, existing?.id])
  const tripPerTanggal = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactionRows) {
      if (t.status === 'batal' || t.id === existing?.id) continue
      m.set(t.transaction_date, (m.get(t.transaction_date) ?? 0) + 1)
    }
    return m
  }, [transactionRows, existing?.id])
  /** Backload yang sudah dibuat per trip asal (yang batal tidak dihitung). */
  const anakBackload = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const t of transactionRows) {
      if (t.backload_dari && t.status !== 'batal') m.set(t.backload_dari, [...(m.get(t.backload_dari) ?? []), t.transaction_no])
    }
    return m
  }, [transactionRows])
  /**
   * Trip yang bisa jadi asal backload: ditandai saat Tutup Trip, atau masih berjalan. Satu trip boleh
   * punya beberapa backload (muatan balik ke tujuan berbeda), dan trip backload boleh dibuatkan
   * backload lagi; yang sudah punya backload diberi keterangan supaya tidak dobel tanpa sengaja.
   */
  const calonAsal = useMemo(() => transactionRows
    .filter((t) => t.status !== 'batal' && t.vehicle_id && (t.ada_backload || t.status === 'aktif'))
    .sort((a, b) => Number(!!b.ada_backload) - Number(!!a.ada_backload) || b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, 60)
    .map((t) => {
      const sudah = anakBackload.get(t.id) ?? []
      return {
        value: t.id,
        label: `${t.transaction_no} · ${t.plate_number || 'tanpa mobil'}`,
        meta: [
          t.ada_backload ? 'ditandai backload' : STATUS_LABEL[t.status], `${t.muat || '?'} → ${t.bongkar || '?'}`, t.driver_names,
          sudah.length ? `sudah ada backload: Trip ${sudah.join(', ')}` : '',
        ].filter(Boolean).join(' · '),
      }
    }), [transactionRows, anakBackload])

  /** Nomor trip tiap mobil: urut per bulan Tanggal Berangkat, dibagikan saat disimpan. */
  const nomorRencana = useMemo(() => {
    if (mode === 'edit') return [bersama.transaction_no]
    const ada = dbAll.transactions.map((t) => t.transaction_no)
    const out: string[] = []
    for (let i = 0; i < mobil.length; i++) out.push(nomorTripBerikut([...ada, ...out], bersama.transaction_date || todayISO()))
    return out
  }, [mode, bersama.transaction_no, bersama.transaction_date, dbAll.transactions, mobil.length])

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

  /* ── Ubah isian bersama ───────────────────────────────── */
  const setB = <K extends keyof Bersama>(k: K, v: Bersama[K]) => setBersama((b) => ({ ...b, [k]: v }))
  const hapusGalat = (...kunci: string[]) => setGalat((g) => {
    const sisa = { ...g }
    for (const k of kunci) delete sisa[k]
    return sisa
  })

  /**
   * Pilih rute -> klien, lokasi muat & bongkar, dan harga tiap mobil ikut rute.
   * Lokasi & harga yang sudah diganti sendiri tidak ditimpa. Klien kontrak -> Dedicated.
   * `ruteBaru`: rute yang baru saja ditambahkan dari form ini (belum ada di daftar render ini).
   */
  function pilihRute(routeId: string | null, ruteBaru?: Route) {
    const baru = ruteBaru ?? (routeId ? ruteMap.get(routeId) : undefined)
    const lama = rute
    const klienRute = klienMap.get(baru?.project_id ?? '')
    const kontrakKlien = klienRute?.client_type === 'kontrak'
      ? db.contracts.filter((c) => c.project_id === klienRute.id && c.status === 'aktif')
      : []
    if (!dedicated && kontrakKlien.length > 0) toast.info(`${klienRute!.project_name} klien kontrak: layanan diganti ke Dedicated.`)
    const lamaL = lokasiRute(lama?.route_name ?? '')
    const baruL = lokasiRute(baru?.route_name ?? '')
    setBersama((b) => {
      const layanan: ServiceType = b.service_type === 'dedicated' || kontrakKlien.length > 0 ? 'dedicated' : 'callout'
      const kontrakIni = b.service_type === 'dedicated' && b.contract_id ? b.contract_id : kontrakKlien.length === 1 ? kontrakKlien[0].id : ''
      const pemilikKontrak = db.contracts.find((c) => c.id === kontrakIni)?.project_id
      const ikut = (isi: string, dariLama: string, dariBaru: string) => (!isi.trim() || samaLokasi(isi, dariLama) ? dariBaru : isi)
      return {
        ...b,
        route_id: routeId ?? '',
        service_type: layanan,
        contract_id: layanan === 'dedicated' ? kontrakIni : '',
        project_id: layanan === 'dedicated' ? pemilikKontrak ?? baru?.project_id ?? '' : baru?.project_id ?? '',
        lokasi_muat: ikut(b.lokasi_muat, lamaL.asal, baruL.asal),
        lokasi_bongkar: ikut(b.lokasi_bongkar, lamaL.tujuan, baruL.tujuan),
      }
    })
    setMobil((ms) => ms.map((m) => (!m.harga || m.harga === (lama?.price ?? 0) ? { ...m, harga: baru?.price ?? 0 } : m)))
    hapusGalat('route_id', 'contract_id')
  }

  function gantiLayanan(l: ServiceType) {
    setBersama((b) => {
      if (l === 'callout') return { ...b, service_type: l, contract_id: '', project_id: rute?.project_id ?? '' }
      const kontrakRute = db.contracts.filter((c) => c.status === 'aktif' && !!rute?.project_id && c.project_id === rute.project_id)
      const kontrakIni = b.contract_id || (kontrakRute.length === 1 ? kontrakRute[0].id : '')
      const pemilik = db.contracts.find((c) => c.id === kontrakIni)?.project_id
      return { ...b, service_type: l, contract_id: kontrakIni, project_id: pemilik ?? rute?.project_id ?? '' }
    })
    setGalat({})
  }

  function pilihKontrak(cid: string | null) {
    const k = db.contracts.find((c) => c.id === cid)
    setBersama((b) => ({ ...b, contract_id: cid ?? '', project_id: k?.project_id ?? rute?.project_id ?? '' }))
    hapusGalat('contract_id')
  }

  /* ── Ubah isian per mobil ─────────────────────────────── */
  const ubahMobil = (i: number, patch: Partial<MobilForm>) => setMobil((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const sopirAktif = (id: string) => sopirTerdaftar.some((d) => d.id === id && d.status === 'aktif')

  function pilihKendaraan(i: number, v: string | null) {
    const sopirTerakhir = v ? pasangan.sopirMobil.get(v) : undefined
    setMobil((ms) => ms.map((m, j) => {
      if (j !== i) return m
      const dipakaiLain = !!sopirTerakhir && ms.some((x, k) => k !== i && x.driver_ids.includes(sopirTerakhir))
      const isi = !!sopirTerakhir && !m.driver_ids[0] && sopirAktif(sopirTerakhir) && !dipakaiLain
      return {
        ...m, vehicle_id: v ?? '',
        driver_ids: isi ? [sopirTerakhir!, ...m.driver_ids.slice(1)] : m.driver_ids,
        otomatis: isi ? { sopir: db.vehicles.find((x) => x.id === v)?.plate_number ?? '' } : {},
      }
    }))
    hapusGalat(`m${i}.vehicle`, 'mobil')
  }

  function ubahSopir(i: number, k: number, v: string | null) {
    const mobilTerakhir = k === 0 && v ? pasangan.mobilSopir.get(v) : undefined
    setMobil((ms) => ms.map((m, j) => {
      if (j !== i) return m
      const dipakaiLain = !!mobilTerakhir && ms.some((x, n) => n !== i && x.vehicle_id === mobilTerakhir)
      const isi = !!mobilTerakhir && !m.vehicle_id && !dipakaiLain && db.vehicles.some((x) => x.id === mobilTerakhir && x.status === 'aktif')
      return {
        ...m,
        driver_ids: m.driver_ids.map((x, n) => (n === k ? v ?? '' : x)),
        vehicle_id: isi ? mobilTerakhir! : m.vehicle_id,
        otomatis: isi ? { kendaraan: db.drivers.find((d) => d.id === v)?.driver_name ?? '' } : k === 0 ? { ...m.otomatis, sopir: undefined } : m.otomatis,
      }
    }))
    hapusGalat(`m${i}.sopir`, 'mobil')
  }

  function tambahMobil() {
    setMobil((ms) => {
      const terakhir = ms.at(-1)
      const terpakai = [...semuaId, ...ms.map((m) => m.trip_id)]
      // Satu order biasanya satu TR untuk semua mobil: TR mobil sebelumnya ikut tersalin.
      return [...ms, {
        kunci: kunciBaru(), vehicle_id: '', driver_ids: [''], trip_id: buatKodeUnik(terpakai),
        tr: [...(terakhir?.tr ?? [])], harga: rute?.price ?? 0, otomatis: {},
      }]
    })
  }

  /* ── Harga & komisi ───────────────────────────────────── */
  const hargaBeda = (m: MobilForm) => !!rute && m.harga > 0 && m.harga !== rute.price
  const adaOverride = !dedicated && mobil.some(hargaBeda)
  const perkiraanKomisi = hitungKomisiTrip(db.commissionSchemes, {
    role: 'sopir', layanan: bersama.service_type,
    konfigurasi: db.vehicles.find((v) => v.id === mobil[0]?.vehicle_id)?.configuration ?? '',
    cost_value: mobil[0]?.harga ?? 0, route_price: rute?.price ?? 0, ujroute: rute?.ujroute ?? 0, uj_total: 0,
  })

  /* ── Validasi & simpan ────────────────────────────────── */
  function validasi(): boolean {
    const e: Galat = {}
    if (!bersama.transaction_date) e.transaction_date = 'Tanggal Berangkat wajib diisi.'
    if (dedicated && !bersama.contract_id) e.contract_id = 'Layanan Dedicated wajib memilih nomor kontrak.'
    if (!dedicated && wajib(!!existing?.route_id) && !bersama.route_id) e.route_id = 'Rute wajib dipilih.'
    if (mode === 'edit') {
      const no = bersama.transaction_no.trim()
      if (!no) e.transaction_no = 'Nomor Trip wajib diisi.'
      else if (dbAll.transactions.some((t) => t.transaction_no === no && t.id !== existing?.id)) e.transaction_no = 'Nomor Trip sudah dipakai.'
    }
    if (adaOverride && !bersama.override_note.trim() && (mode === 'create' || mobil[0].harga !== existing?.cost_value)) {
      e.override_note = 'Tulis alasan harga berbeda dari Harga route.'
    }
    const idDiForm = mobil.map((m) => m.trip_id.trim().toUpperCase())
    mobil.forEach((m, i) => {
      if (wajib(!!existing?.vehicle_id) && !m.vehicle_id) e[`m${i}.vehicle`] = 'No. Kendaraan wajib dipilih.'
      const id = m.trip_id.trim().toUpperCase()
      if (!id) e[`m${i}.id`] = 'ID Perjalanan wajib diisi. Klik Generate untuk membuatnya.'
      else if (idDiForm.indexOf(id) !== i) e[`m${i}.id`] = 'ID Perjalanan sama dengan mobil lain di form ini.'
      else {
        const lain = dbAll.transactions.find((t) => t.id !== existing?.id && (t.trip_ids ?? []).some((x) => x.toUpperCase() === id))
        if (lain) e[`m${i}.id`] = `ID Perjalanan sudah dipakai Trip ${lain.transaction_no}.`
      }
      const adaSopir = m.driver_ids.some(Boolean)
      if (mode === 'edit' && bersama.status === 'aktif' && !adaSopir && wajib(!!(existing?.driver_ids?.length || existing?.driver_id))) {
        e[`m${i}.sopir`] = 'Pilih sopir, atau ubah status ke Menunggu Sopir.'
      }
    })
    const mobilDipilih = mobil.map((m) => m.vehicle_id).filter(Boolean)
    const sopirDipilih = mobil.flatMap((m) => m.driver_ids.filter(Boolean))
    if (new Set(mobilDipilih).size < mobilDipilih.length) e.mobil = 'Satu kendaraan dipilih di dua mobil. Tiap mobil harus kendaraan berbeda.'
    else if (new Set(sopirDipilih).size < sopirDipilih.length) e.mobil = 'Satu sopir dipilih di dua mobil.'
    setGalat(e)
    return Object.keys(e).length === 0
  }

  function isiTrip(m: MobilForm, nomor: string): Omit<CommissionTransaction, 'id' | 'created_at' | 'updated_at' | 'workspace'> {
    const sopir = [...new Set(m.driver_ids.filter(Boolean))]
    const projectId = (dedicated ? klienKontrak?.id : rute?.project_id) || bersama.project_id
    const harga = dedicated ? 0 : m.harga
    const beda = !dedicated && hargaBeda(m)
    const statusOtomatis: TripStatus = sopir.length ? 'aktif' : 'menunggu_sopir'
    return {
      ...(existing ?? {
        sj_no: '', recipient_name: '', recipient_address_1: '', recipient_address_2: '',
        job_order_id: '', party: '', goods_type: '', kosongan: '', location: '', ship: '',
        tr_reference: '', pi_number: '', pi_status: '', is_marked: false, bon_date: null, personal_bon: 0,
        printed_at: null, cancelled_at: null, cancel_reason: '', cancel_settlement: [], container_no: '',
      }),
      transaction_no: nomor,
      transaction_date: bersama.transaction_date,
      order_date: bersama.order_date,
      service_type: bersama.service_type,
      contract_id: dedicated ? bersama.contract_id : '',
      // ID lain dari data lama (bila ada) tetap disimpan di belakang ID utama.
      trip_ids: [m.trip_id.trim().toUpperCase(), ...(existing?.trip_ids ?? []).slice(1)],
      route_id: bersama.route_id,
      tr_numbers: m.tr,
      lokasi_muat: bersama.lokasi_muat.trim(),
      lokasi_bongkar: bersama.lokasi_bongkar.trim(),
      destination_detail: bersama.lokasi_bongkar.trim(),
      manager_id: bersama.manager_id,
      manager_name: bersama.manager_id ? '' : bersama.manager_name.trim(),
      project_id: projectId,
      status: mode === 'edit' ? bersama.status : statusOtomatis,
      vehicle_id: m.vehicle_id,
      driver_id: sopir[0] ?? '',
      driver_ids: sopir,
      cost_value: harga,
      override_note: beda ? bersama.override_note.trim() : '',
      override_attachments: beda ? bersama.override_attachments : [],
      notes: bersama.notes.trim(),
      ...(asal ? { backload_dari: asal.id } : {}),
    }
  }

  function simpan(cetak: boolean) {
    if (!validasi()) { toast.error('Periksa kembali isian yang ditandai merah.'); return }
    if (existing) {
      ubahTrip(existing.id, isiTrip(mobil[0], bersama.transaction_no.trim()))
      toast.success('Trip berhasil diperbarui.')
      navigate(`/transaksi/trip/${existing.id}${cetak ? '?print=1' : ''}`)
      return
    }
    const dibuat = mobil.map((m, i) => buatTrip(isiTrip(m, nomorRencana[i])))
    if (asal && !asal.ada_backload) ubahTrip(asal.id, { ada_backload: true })
    if (dibuat.length === 1) {
      toast.success(asal ? `Backload tersimpan sebagai Trip ${dibuat[0].transaction_no}.` : 'Trip berhasil disimpan. Catat uang jalan di tab Uang Jalan saat dibayar.')
      navigate(`/transaksi/trip/${dibuat[0].id}${cetak ? '?print=1' : ''}`)
      return
    }
    toast.success(`${dibuat.length} trip tersimpan: ${dibuat.map((t) => t.transaction_no).join(', ')}.`)
    navigate(cetak ? `/transaksi/trip?cetak=${dibuat.map((t) => t.id).join(',')}` : '/transaksi/trip')
  }

  /* ── Tampilan ─────────────────────────────────────────── */
  const judul = mode === 'edit' ? `Ubah Trip ${existing?.transaction_no}` : backload ? 'Tambah Trip Backload' : 'Tambah Trip'
  const sisaKontrak = kontrak ? kontrak.value - (terpakaiKontrak.get(kontrak.id) ?? 0) : 0
  const ringkas = mode === 'edit' ? `Trip ${bersama.transaction_no}`
    : mobil.length === 1 ? `Trip ${nomorRencana[0]}`
    : `${mobil.length} mobil · Trip ${nomorRencana[0]} – ${nomorRencana.at(-1)}`

  return (
    <div className="pb-20">
      <PageHeader
        title={judul}
        crumbs={[
          { label: 'Trip / Job Order', to: '/transaksi/trip' },
          ...(existing ? [{ label: existing.transaction_no, to: `/transaksi/trip/${existing.id}` }] : []),
          { label: mode === 'edit' ? 'Ubah' : 'Tambah' },
        ]}
        description={mode === 'edit'
          ? 'Klien, harga, dan patokan uang jalan ikut rute. Uang jalan, biaya, perjalanan, dan lampiran dicatat di halaman detail trip.'
          : 'Isi layanan dan rute sekali, lalu tambahkan mobil. Tiap mobil tersimpan sebagai trip sendiri dengan Berita Acara masing-masing.'}
      />

      {!bolehSimpan && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] text-[#8a6100]">
          <FaTriangleExclamation size={15} className="mt-px shrink-0" />
          Peran {user?.role === 'viewer' ? 'Viewer' : 'ini'} tidak dapat menyimpan perubahan. Form ini hanya untuk melihat struktur data.
        </div>
      )}

      {asal && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/70 px-4 py-3 text-[12.5px] text-brand-800">
          <p>
            Backload dari <Link to={`/transaksi/trip/${asal.id}`} className="font-semibold underline">Trip {asal.transaction_no}</Link>
            {' '}({asal.plate_number || 'tanpa mobil'}{asal.driver_names && `, ${asal.driver_names}`}). Mobil dan sopir mengikuti trip asal;
            lokasi muat diambil dari lokasi bongkarnya{asal.bongkar && <>: <span className="font-semibold">{asal.bongkar}</span></>}.
          </p>
          {asal.status !== 'selesai' && (
            <p className="mt-1 text-brand-700">Trip asal masih {STATUS_LABEL[asal.status]}. Tutup trip asal setelah POD-nya difoto atau diterima.</p>
          )}
          {(anakBackload.get(asal.id) ?? []).length > 0 && (
            <p className="mt-1 text-brand-700">
              Trip asal sudah punya backload: Trip {anakBackload.get(asal.id)!.join(', ')}. Yang ini tersimpan sebagai backload berikutnya dengan ID sendiri.
            </p>
          )}
        </div>
      )}

      {/* Layanan & Rute */}
      <Card className="mb-4">
        <CardHeader
          title="Layanan & Rute"
          subtitle={klien
            ? `Klien ${klien.project_name}, ikut ${dedicated && klienKontrak ? `kontrak ${kontrak?.contract_no}` : 'rute'}.`
            : 'Klien ikut rute yang dipilih (Callout) atau pemilik kontrak (Dedicated).'}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Radio name="layanan" checked={!dedicated} onChange={() => gantiLayanan('callout')} label="Callout"
              description="Order per perjalanan dengan TR dari klien; harga ikut rute." />
            <Radio name="layanan" checked={dedicated} onChange={() => gantiLayanan('dedicated')} label="Dedicated"
              description="Kendaraan dikontrak satu klien; wajib memilih nomor kontrak." />
          </div>

          {mode === 'create' && !backload && (
            <div>
              <Checkbox label="Trip ini backload dari trip sebelumnya" checked={pilihAsal} onChange={(e) => setPilihAsal(e.target.checked)} />
              {pilihAsal && (
                <div className="mt-2 max-w-xl">
                  <SearchableSelect options={calonAsal} value={null} placeholder="Pilih trip asal..." searchPlaceholder="Ketik nomor trip atau plat..."
                    emptyText="Belum ada trip yang ditandai backload atau masih berjalan."
                    onChange={(v) => v && navigate(`/transaksi/trip/tambah?backload=${v}`, { replace: true })} />
                  <p className="mt-1 text-[12px] text-ink-3">Trip yang ditandai "ada backload" saat Tutup Trip tampil paling atas.</p>
                </div>
              )}
            </div>
          )}

          {dedicated && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="No. Kontrak" required error={galat.contract_id}
                hint={galat.contract_id ? undefined : db.contracts.length === 0 ? <>Belum ada kontrak. Tambahkan di menu <Link to="/master/klien" className="text-brand-700 underline">Klien / Pelanggan</Link>.</> : 'Kontrak aktif di workspace ini.'}>
                {(fid) => (
                  <SearchableSelect id={fid} options={contractOptions} value={bersama.contract_id || null} invalid={!!galat.contract_id}
                    placeholder="Pilih nomor kontrak..." searchPlaceholder="Ketik nomor kontrak atau klien..." onChange={pilihKontrak} />
                )}
              </Field>
              {kontrak && (
                <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
                  <p className="text-[12px] text-brand-800">Klien <span className="font-semibold">{klienKontrak?.project_name ?? '—'}</span></p>
                  <dl className="mt-2 grid grid-cols-3 gap-x-4">
                    {([['Nilai kontrak', kontrak.value], ['Terpakai', kontrak.value - sisaKontrak], ['Sisa', sisaKontrak]] as const).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold text-brand-700/80">{k}</dt>
                        <dd className={cn('tnum text-[13px] font-semibold', v < 0 ? 'text-[color:var(--color-critical)]' : 'text-brand-900')}>{formatRupiah(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Field
                label="Rute"
                required={!dedicated && wajib(!!existing?.route_id)}
                error={galat.route_id}
                hint={galat.route_id ? undefined
                  : !rute ? (backload && bersama.lokasi_muat
                    ? `Rute dari ${bersama.lokasi_muat} tampil paling atas. Belum ada? ${bolehTambahRute ? 'Pilih "Tambah rute baru" di daftar.' : 'Minta Manager atau Owner menambahkannya.'}`
                    : dedicated ? 'Opsional untuk Dedicated: patokan uang jalan & lokasi.' : 'Klien, harga, dan patokan uang jalan ikut rute.')
                  : klien && !dedicated ? `Klien ${klien.project_name} ikut rute ini.`
                  : !rute.project_id ? <>Rute ini belum punya klien. Lengkapi di menu <Link to="/master/route" className="text-brand-700 underline">Rute</Link>.</>
                  : 'UJROUTE rute jadi patokan uang jalan.'}
              >
                {(fid) => (
                  <SearchableSelect id={fid} options={routeOptions} value={bersama.route_id || null} invalid={!!galat.route_id}
                    placeholder="Pilih rute..." searchPlaceholder="Ketik nama atau kode rute..." onChange={(v) => pilihRute(v)}
                    tambahan={{
                      label: 'Tambah rute baru',
                      disabled: !bolehTambahRute,
                      hint: bolehTambahRute ? undefined : 'Perlu Manager atau Owner.',
                      onClick: () => setTambahRute(true),
                    }} />
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lokasi Muat" hint={backload ? 'Lokasi bongkar trip asal.' : 'Terisi dari rute, bisa diubah.'}>
                  {(fid) => <Input id={fid} value={bersama.lokasi_muat} placeholder="CIB" onChange={(e) => setB('lokasi_muat', e.target.value)} />}
                </Field>
                <Field label="Lokasi Bongkar" hint="Terisi dari rute, bisa diubah.">
                  {(fid) => <Input id={fid} value={bersama.lokasi_bongkar} placeholder="DURI" onChange={(e) => setB('lokasi_bongkar', e.target.value)} />}
                </Field>
              </div>
            </div>

            {(rute || perkiraanKomisi.aturan) && (
              <div className="self-start rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
                {rute && (
                  <>
                    <p className="text-[12px] text-brand-800">
                      <span className="tnum font-semibold">{rute.route_code}</span>
                      {klienMap.get(rute.project_id) && <> · Klien <span className="font-semibold">{klienMap.get(rute.project_id)!.project_name}</span></>}
                    </p>
                    <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5">
                      {([['UJROUTE (patokan)', rute.ujroute], ['Uang Tol (patokan)', rute.toll ?? 0], ['Harga route', rute.price]] as const).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[11px] font-semibold text-brand-700/80">{k}</dt>
                          <dd className="tnum text-[13px] font-semibold text-brand-900">{formatRupiah(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <p className={cn('text-[12px] text-brand-800', rute && 'mt-2 border-t border-brand-100 pt-2')}>
                  Perkiraan komisi sopir per mobil: <span className="tnum font-semibold">{formatRupiah(perkiraanKomisi.nilai)}</span>
                  <span className="block text-[11.5px] text-brand-700">{perkiraanKomisi.keterangan}</span>
                </p>
              </div>
            )}
          </div>

          {adaOverride && bolehOverride && (
            <Field label="Alasan & bukti persetujuan harga" error={galat.override_note}
              hint={galat.override_note ? undefined : 'Ada mobil dengan harga berbeda dari Harga route: catat alasannya dan lampirkan bukti persetujuan.'}>
              {(fid) => (
                <div className="space-y-2">
                  <Input id={fid} value={bersama.override_note} placeholder="mis. trailer lowbed, harga nego klien"
                    onChange={(e) => { setB('override_note', e.target.value); hapusGalat('override_note') }} />
                  {bisa('bukti') && (
                    <LampiranInput label="Tambah bukti" value={bersama.override_attachments} onChange={(v) => setB('override_attachments', v)} />
                  )}
                </div>
              )}
            </Field>
          )}
        </div>
      </Card>

      {/* Mobil */}
      <div className="mb-4 space-y-4">
        {mobil.map((m, i) => (
          <KartuMobil
            key={m.kunci}
            urutan={i}
            jumlah={mobil.length}
            nomor={nomorRencana[i]}
            mode={mode}
            m={m}
            galat={galat}
            terkunci={backload}
            dedicated={dedicated}
            hargaRoute={rute?.price ?? 0}
            bolehOverride={bolehOverride}
            vehicleOptions={vehicleOptions.filter((o) => o.value === m.vehicle_id || !mobil.some((x) => x.vehicle_id === o.value))}
            sopirOptions={(pilihanIni) => sopirTerdaftar
              .filter((d) => d.status === 'aktif' || d.id === pilihanIni)
              .filter((d) => d.id === pilihanIni || !mobil.some((x) => x.driver_ids.includes(d.id)))
              .map((d) => ({ value: d.id, label: `${d.driver_code} — ${d.driver_name}`, meta: [d.address_2, d.city].filter(Boolean).join(', '), keywords: d.driver_name }))}
            trLain={trLain}
            onKendaraan={(v) => pilihKendaraan(i, v)}
            onSopir={(k, v) => ubahSopir(i, k, v)}
            onTambahSopir={() => ubahMobil(i, { driver_ids: [...m.driver_ids, ''] })}
            onHapusSopir={(k) => ubahMobil(i, { driver_ids: m.driver_ids.length > 1 ? m.driver_ids.filter((_, n) => n !== k) : [''] })}
            onId={(v) => { ubahMobil(i, { trip_id: v.toUpperCase().replace(/\s+/g, '') }); hapusGalat(`m${i}.id`) }}
            onGenerateId={() => { ubahMobil(i, { trip_id: buatKodeUnik([...semuaId, ...mobil.map((x) => x.trip_id)]) }); hapusGalat(`m${i}.id`) }}
            onTr={(tr) => ubahMobil(i, { tr })}
            onHarga={(v) => ubahMobil(i, { harga: v })}
            onHapus={() => setMobil((ms) => ms.filter((_, j) => j !== i))}
          />
        ))}
        {galat.mobil && <p className="text-[12.5px] font-medium text-[color:var(--color-critical)]">{galat.mobil}</p>}
        {mode === 'create' && !backload && (
          <Button variant="ghost" icon={<FaPlus size={14} />} onClick={tambahMobil}>Tambah mobil</Button>
        )}
      </div>

      {/* Jadwal & Catatan */}
      <Card>
        <CardHeader title="Jadwal & Catatan" subtitle={mobil.length > 1 ? 'Berlaku untuk semua mobil di order ini.' : undefined} />
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tanggal Order" hint="Hari permintaan klien masuk.">
            {(fid) => <DateInput id={fid} value={bersama.order_date} onChange={(e) => setB('order_date', e.target.value)} />}
          </Field>
          <Field label="Tanggal Berangkat" required error={galat.transaction_date}
            hint={galat.transaction_date ? undefined : bersama.order_date && bersama.transaction_date && bersama.transaction_date < bersama.order_date
              ? 'Lebih awal dari Tanggal Order. Pastikan memang benar.' : 'Dipakai untuk Nomor Trip, Berita Acara, dan laporan.'}>
            {(fid) => (
              <DateInput id={fid} value={bersama.transaction_date} invalid={!!galat.transaction_date}
                penanda={(t) => tripPerTanggal.get(t) ?? 0} penandaLabel="trip berangkat"
                onChange={(e) => { setB('transaction_date', e.target.value); hapusGalat('transaction_date') }} />
            )}
          </Field>
          <Field label="Manager" hint={managerTerdaftar.length ? 'Pilih manager terdaftar, atau isi nama sendiri.' : 'Belum ada manager di Supir / Karyawan — isi nama sendiri.'}>
            {(fid) => (
              <PilihKaryawan id={fid} karyawan={managerTerdaftar} valueId={bersama.manager_id} valueNama={bersama.manager_name} peran="manager"
                placeholder="Pilih manager..." onChange={(mid, nama) => setBersama((b) => ({ ...b, manager_id: mid, manager_name: nama }))} />
            )}
          </Field>
          {mode === 'edit' ? (
            <Field label="Status" hint={bersama.status === 'selesai' ? `Ditutup ${formatDate(existing?.closed_at ?? null)}.` : 'Selesai lewat Tutup Trip; batal lewat Batalkan Trip.'}>
              {(fid) => bersama.status === 'selesai'
                ? <Input id={fid} value={STATUS_LABEL.selesai} readOnly />
                : (
                  <Select id={fid} value={bersama.status} onChange={(e) => { setB('status', e.target.value as TripStatus); hapusGalat(...mobil.map((_, i) => `m${i}.sopir`)) }}>
                    {STATUS_UBAH.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                )}
            </Field>
          ) : (
            <Field label="Status">
              {(fid) => <Input id={fid} readOnly value={mobil.every((m) => m.driver_ids.some(Boolean)) ? 'Aktif' : mobil.some((m) => m.driver_ids.some(Boolean)) ? 'Aktif / Menunggu Sopir' : 'Menunggu Sopir'} />}
            </Field>
          )}
          {mode === 'edit' && (
            <Field label="Nomor Trip" required error={galat.transaction_no} hint={galat.transaction_no ? undefined : 'Nomor urut otomatis per bulan.'}>
              {(fid) => (
                <KodeInput id={fid} value={bersama.transaction_no} invalid={!!galat.transaction_no}
                  generateTitle="Buat nomor trip berikutnya untuk bulan tanggal trip"
                  onChange={(v) => setB('transaction_no', v)}
                  onGenerate={() => setB('transaction_no', nomorTripBerikut(
                    dbAll.transactions.filter((t) => t.id !== existing?.id).map((t) => t.transaction_no), bersama.transaction_date || todayISO(),
                  ))} />
              )}
            </Field>
          )}
          <Field label="Catatan" className={mode === 'edit' ? 'sm:col-span-2 xl:col-span-3' : 'sm:col-span-2 xl:col-span-4'}>
            {(fid) => <Textarea id={fid} rows={2} value={bersama.notes} onChange={(e) => setB('notes', e.target.value)} />}
          </Field>
        </div>
      </Card>

      {/* Rute baru: nama diawali lokasi muat (mis. backload "DURI - "), klien ikut trip asal / kontrak / rute terpilih. */}
      <ModalRute
        open={tambahRute}
        onClose={() => setTambahRute(false)}
        awal={{
          route_name: bersama.lokasi_muat.trim() ? `${bersama.lokasi_muat.trim()} - ` : '',
          project_id: asal?.project_id || klienKontrak?.id || rute?.project_id || '',
        }}
        keterangan="Rute baru langsung dipilih untuk trip ini. Tanda * wajib diisi."
        pesanSukses={(r) => `Rute ${r.route_name} tersimpan dan dipilih untuk trip ini.`}
        onSaved={(r) => pilihRute(r.id, r)}
      />

      {/* Bar dimulai setelah rel sidebar (68px) supaya teks kirinya tidak tertutup. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur lg:left-[68px] lg:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <p className="hidden truncate text-[12.5px] text-ink-3 sm:block">
            {ringkas}
            {rute && <> · patokan UJ {formatRupiah(rute.ujroute)}{mobil.length > 1 && ' per mobil'}</>}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => navigate(existing ? `/transaksi/trip/${existing.id}` : asal ? `/transaksi/trip/${asal.id}` : '/transaksi/trip')}>Batal</Button>
            <Button icon={<FaPrint size={15} />} disabled={!bolehSimpan} onClick={() => simpan(true)}>Simpan &amp; Cetak</Button>
            <Button variant="primary" icon={<FaFloppyDisk size={15} />} disabled={!bolehSimpan} onClick={() => simpan(false)}>
              {mode === 'create' && mobil.length > 1 ? `Simpan ${mobil.length} trip` : 'Simpan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Opsi { value: string; label: string; meta?: string; keywords?: string }

/** Satu mobil: kendaraan, sopir, ID Perjalanan, TR, dan harga. */
function KartuMobil({
  urutan, jumlah, nomor, mode, m, galat, terkunci, dedicated, hargaRoute, bolehOverride, vehicleOptions, sopirOptions, trLain,
  onKendaraan, onSopir, onTambahSopir, onHapusSopir, onId, onGenerateId, onTr, onHarga, onHapus,
}: {
  urutan: number
  jumlah: number
  nomor: string
  mode: 'create' | 'edit'
  m: MobilForm
  galat: Galat
  /** Backload: kendaraan & sopir mengikuti trip asal. */
  terkunci: boolean
  dedicated: boolean
  hargaRoute: number
  bolehOverride: boolean
  vehicleOptions: Opsi[]
  sopirOptions: (pilihanIni: string) => Opsi[]
  trLain: Map<string, string[]>
  onKendaraan: (v: string | null) => void
  onSopir: (k: number, v: string | null) => void
  onTambahSopir: () => void
  onHapusSopir: (k: number) => void
  onId: (v: string) => void
  onGenerateId: () => void
  onTr: (tr: string[]) => void
  onHarga: (v: number) => void
  onHapus: () => void
}) {
  const g = (k: string) => galat[`m${urutan}.${k}`]
  const dipakai = m.tr.map((tr) => ({ tr, trip: trLain.get(kunciTr(tr)) ?? [] })).filter((x) => x.trip.length)
  const judul = jumlah > 1 ? `Mobil ${urutan + 1}` : 'Mobil'
  const petunjukHarga: ReactNode = !bolehOverride
    ? 'Mengikuti Harga route. Harga berbeda perlu Manager atau Owner.'
    : !hargaRoute ? 'Terisi dari Harga route setelah rute dipilih.'
    : m.harga === hargaRoute ? 'Sama dengan Harga route. Ubah bila harga mobil ini beda.'
    : <>Harga khusus (Harga route {formatRupiah(hargaRoute)}) · <PakaiNilai label="Pakai Harga route" onClick={() => onHarga(hargaRoute)} /></>

  return (
    <Card>
      <CardHeader
        title={judul}
        subtitle={mode === 'create' ? `Tersimpan sebagai Trip ${nomor}` : `Trip ${nomor}`}
        actions={mode === 'create' && jumlah > 1 && (
          <IconButton label={`Hapus ${judul.toLowerCase()}`} tone="danger" icon={<FaXmark size={14} />} onClick={onHapus} />
        )}
      />
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <Field label="No. Kendaraan" required={mode === 'create'} error={g('vehicle')}
          hint={g('vehicle') ? undefined : terkunci ? 'Mengikuti trip asal backload.'
            : m.otomatis.kendaraan ? `Terisi dari trip terakhir ${m.otomatis.kendaraan}. Ganti bila beda.` : 'Head unit. Memilih mobil ikut mengisi sopir terakhirnya.'}>
          {(fid) => (
            <SearchableSelect id={fid} options={vehicleOptions} value={m.vehicle_id || null} invalid={!!g('vehicle')} disabled={terkunci}
              placeholder="Pilih nomor kendaraan..." onChange={onKendaraan} />
          )}
        </Field>
        <Field label="Sopir" error={g('sopir')}
          hint={g('sopir') ? undefined : terkunci ? 'Mengikuti trip asal backload.'
            : m.otomatis.sopir ? `Terisi dari trip terakhir mobil ${m.otomatis.sopir}. Ganti bila beda.`
            : m.driver_ids.length > 1 ? 'Sopir pertama adalah sopir utama (penerima komisi).' : 'Boleh dikosongkan dulu: trip tersimpan sebagai Menunggu Sopir.'}>
          {(fid) => (
            <div className="space-y-2">
              {m.driver_ids.map((v, k) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchableSelect id={k === 0 ? fid : undefined} options={sopirOptions(v)} value={v || null} disabled={terkunci}
                      placeholder={k === 0 ? 'Cari kode / nama sopir...' : 'Sopir tambahan...'} onChange={(nv) => onSopir(k, nv)} />
                  </div>
                  {m.driver_ids.length > 1 && !terkunci && (
                    <IconButton label="Hapus sopir ini" tone="danger" icon={<FaXmark size={14} />} onClick={() => onHapusSopir(k)} />
                  )}
                </div>
              ))}
              {!terkunci && <Button size="sm" variant="ghost" icon={<FaPlus size={14} />} onClick={onTambahSopir}>Tambah sopir</Button>}
            </div>
          )}
        </Field>
        <Field label="ID Perjalanan" required error={g('id')}
          hint={g('id') ? undefined : terkunci ? 'ID trip asal + BL, supaya backload tetap terhubung.' : 'Satu ID per trip, dibuat otomatis. Boleh diganti.'}>
          {(fid) => (
            <KodeInput id={fid} value={m.trip_id} invalid={!!g('id')} uppercase placeholder="Klik Generate"
              generateTitle="Buat ID Perjalanan unik" onChange={onId} onGenerate={onGenerateId} />
          )}
        </Field>
        <Field label="TR"
          hint={dipakai.length > 0
            ? `${dipakai.map((x) => `${x.tr} juga dipakai Trip ${x.trip.join(', ')}`).join('; ')}. Wajar bila satu order dikirim beberapa mobil.`
            : 'Nomor order dari klien (TR / Order Release). Boleh lebih dari satu; kosongkan bila belum ada, nanti ditulis di Berita Acara.'}>
          {(fid) => <TrInput id={fid} value={m.tr} onChange={onTr} />}
        </Field>
        {!dedicated && (
          <Field label="Harga" hint={petunjukHarga}>
            {(fid) => <CurrencyInput id={fid} value={m.harga} disabled={!bolehOverride} onValueChange={onHarga} />}
          </Field>
        )}
      </div>
    </Card>
  )
}

/** Isian TR: ketik lalu Enter (atau koma) untuk menambah; TR dari klien, tidak dibuat sistem. */
function TrInput({ id, value, onChange }: { id?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [ketik, setKetik] = useState('')
  function tambah(teks = ketik) {
    const baru = teks.split(/[,;\n]/).map(rapikanTr).filter(Boolean)
    const gabung = [...value]
    for (const tr of baru) if (!gabung.some((x) => kunciTr(x) === kunciTr(tr))) gabung.push(tr)
    if (gabung.length !== value.length) onChange(gabung)
    setKetik('')
  }
  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tambah() }
    if (e.key === 'Backspace' && !ketik && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <Input id={id} value={ketik} placeholder="TR2600512595" className="min-w-0 flex-1"
          onChange={(e) => setKetik(e.target.value)} onKeyDown={tombol} onBlur={() => ketik.trim() && tambah()} />
        <Button size="sm" icon={<FaPlus size={13} />} disabled={!ketik.trim()} onClick={() => tambah()}>Tambah</Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tr) => (
            <li key={tr} className="tnum inline-flex items-center gap-1 rounded-md border border-hairline bg-sunken py-0.5 pr-1 pl-2 text-[12.5px] font-medium text-ink">
              {tr}
              <button type="button" aria-label={`Hapus TR ${tr}`} onClick={() => onChange(value.filter((x) => x !== tr))}
                className="grid h-5 w-5 place-items-center rounded text-ink-3 transition hover:bg-surface hover:text-[color:var(--color-critical)]">
                <FaXmark size={11} />
              </button>
            </li>
          ))}
          {value.length > 1 && (
            <li>
              <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 px-1 py-0.5 text-[12px] text-ink-3 hover:text-ink">
                <FaRotateLeft size={11} /> Kosongkan
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
