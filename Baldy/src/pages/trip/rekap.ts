/**
 * Rekap Trip (permintaan Ibu 13 Okt 2026): rangkuman lengkap satu trip, dari identitas, kendaraan,
 * pengiriman, perjalanan, sampai keuangannya, beserta daftar hal yang masih kurang. Tampil dari
 * menu ⋯ "Rekap Trip" dan sebelum Tutup Trip, supaya kekurangan bisa dibetulkan dulu.
 */
import type { Database, InternalCost, ItemMuatan, OperationalExpense, TransactionRow, TripEvent, UjPayment } from '../../types'
import { CLIENT_TYPE_LABEL, JENIS_TERMIN_LABEL } from '../../types'
import { biayaDitagihkan, dibayarPerusahaan, kejadianTrip, muatanTrip } from '../../lib/trip'
import { biayaPerusahaanTransaksi, komisiTransaksi, nettoTransaksi, uangJalanTransaksi } from '../../lib/calculations'
import { formatRupiah } from '../../lib/format'
import { labelGandengan } from './form/aturan'

/** Satu baris pemeriksaan: lengkap, kurang (perlu dibetulkan), atau catatan. */
export interface CekRekap {
  tingkat: 'ok' | 'kurang' | 'catatan'
  teks: string
  /** Tab detail trip tempat membetulkannya. */
  tab?: 'overview' | 'perjalanan' | 'uj' | 'biaya' | 'internal' | 'lainnya' | 'edit'
}

export interface DataRekap {
  trip: TransactionRow
  klien: string
  layanan: string
  kontrak: string
  supir: string[]
  manager: string
  gandengan: string
  muatan: ItemMuatan[]
  kejadian: TripEvent[]
  termin: UjPayment[]
  biaya: OperationalExpense[]
  internal: InternalCost[]
  namaKaryawan: (id: string) => string
  angka: {
    uj: number
    kasbon: number
    tf: number
    biaya: number
    biayaPerusahaan: number
    biayaSopir: number
    ditagihkan: number
    internal: number
    komisi: number
    harga: number
    tagihan: number
    /** Uang jalan yang dihitung keluar (patokan bila trip belum ditutup dan belum lunas dibayar). */
    ujDihitung: number
    netto: number
  }
  cek: CekRekap[]
}

/** Susun rekap satu trip dari seluruh data (arsip trip batal ikut terbaca). */
export function susunRekap(trip: TransactionRow, d: Database): DataRekap {
  const karyawan = new Map(d.drivers.map((k) => [k.id, k.driver_name]))
  const namaKaryawan = (id: string) => karyawan.get(id) ?? '—'
  const klien = d.projects.find((p) => p.id === trip.project_id)
  const kontrak = d.contracts.find((c) => c.id === trip.contract_id)
  const termin = d.ujPayments.filter((p) => p.trip_id === trip.id).sort((a, b) => a.sequence - b.sequence)
  const biaya = d.expenses.filter((e) => e.trip_id === trip.id).sort((a, b) => a.expense_date.localeCompare(b.expense_date))
  const internal = d.internalCosts.filter((c) => c.trip_id === trip.id).sort((a, b) => a.cost_date.localeCompare(b.cost_date))
  const kejadian = kejadianTrip(d.tripEvents ?? [], trip.id)
  const jumlah = (xs: Array<{ amount: number }>) => xs.reduce((a, x) => a + x.amount, 0)
  const uj = termin.reduce((a, p) => a + p.uj_amount, 0)
  const kasbon = termin.reduce((a, p) => a + p.kasbon_deduction, 0)
  const biayaPerusahaan = jumlah(biaya.filter(dibayarPerusahaan))
  const batal = trip.status === 'batal'

  const cek: CekRekap[] = []
  const tambah = (ok: boolean, teksOk: string, teksKurang: string, tab?: CekRekap['tab'], tingkatKurang: CekRekap['tingkat'] = 'kurang') =>
    cek.push(ok ? { tingkat: 'ok', teks: teksOk } : { tingkat: tingkatKurang, teks: teksKurang, tab })
  if (!batal) {
    tambah(!!trip.project_id, `Klien ${klien?.project_code ?? ''}`, 'Klien belum dipilih', 'edit')
    tambah(!!trip.vehicle_id, `Kendaraan ${trip.plate_number}`, 'Kendaraan belum dipilih', 'edit')
    tambah(trip.driver_ids.length > 0, `Supir ${trip.driver_names}`, 'Supir belum dipilih', 'edit')
    if (trip.service_type !== 'dedicated') tambah(!!trip.route_id, `Rute ${trip.route_name}`, 'Rute belum dipilih', 'edit')
    if (klien?.requires_document !== false) tambah(trip.tr_list.length > 0, `No Referensi ${trip.tr_list.join(', ')}`, 'No Referensi (TR) dari klien belum diisi', 'edit')
    tambah(!!trip.pengirim?.nama, 'Pick Up Details terisi', 'Pick Up Details belum diisi', 'edit', 'catatan')
    tambah(!!trip.penerima?.nama, 'Destination Details terisi', 'Destination Details (penerima) belum diisi', 'edit')
    tambah(!!trip.printed_at, 'Berita Acara sudah dicetak', 'Berita Acara belum dicetak', 'overview', 'catatan')
    tambah(termin.length > 0, `Uang jalan ${termin.length} termin`, 'Uang jalan belum dicatat', 'uj')
    tambah(kejadian.some((e) => e.jenis === 'tiba' || e.jenis === 'bongkar'), 'Tiba / bongkar di tujuan tercatat', 'Belum ada catatan tiba / selesai bongkar di tab Perjalanan', 'perjalanan', 'catatan')
    if (trip.service_type !== 'dedicated') tambah(trip.harga > 0, `Harga ${formatRupiah(trip.harga)}`, 'Harga trip masih Rp 0: tagihan ke klien akan kosong', 'edit')
    if (biaya.length === 0) cek.push({ tingkat: 'catatan', teks: 'Belum ada biaya operasional (tol, solar, dst.). Abaikan bila memang tidak ada.', tab: 'biaya' })
    if (trip.ujroute > 0 && uj > trip.ujroute) cek.push({ tingkat: 'catatan', teks: `Uang jalan ${formatRupiah(uj)} di atas patokan ${formatRupiah(trip.ujroute)}`, tab: 'uj' })
  }

  return {
    trip,
    klien: klien ? `${klien.project_code} — ${klien.project_name}` : '—',
    layanan: CLIENT_TYPE_LABEL[klien?.client_type ?? trip.service_type ?? 'callout'] ?? 'Callout',
    kontrak: kontrak?.contract_no ?? '',
    supir: trip.driver_ids.map(namaKaryawan),
    manager: trip.manager_label,
    gandengan: labelGandengan(trip.gandengan || trip.vehicle_config),
    muatan: muatanTrip(trip),
    kejadian,
    termin,
    biaya,
    internal,
    namaKaryawan,
    angka: {
      uj,
      kasbon,
      tf: uj - kasbon,
      biaya: jumlah(biaya),
      biayaPerusahaan,
      biayaSopir: jumlah(biaya) - biayaPerusahaan,
      ditagihkan: jumlah(biaya.filter(biayaDitagihkan)),
      internal: jumlah(internal),
      komisi: batal ? 0 : komisiTransaksi(trip),
      harga: trip.harga,
      tagihan: trip.tagihan_total,
      ujDihitung: batal ? 0 : uangJalanTransaksi(trip),
      netto: batal ? 0 : nettoTransaksi(trip),
    },
    cek,
  }
}

/** Jenis termin uang jalan untuk tampilan. */
export const labelTermin = (p: UjPayment) => JENIS_TERMIN_LABEL[p.jenis ?? 'uj']

/** Biaya perusahaan langsung yang ikut dihitung keluar (sama dengan laporan netto). */
export const biayaKeluar = (t: TransactionRow) => biayaPerusahaanTransaksi(t)
