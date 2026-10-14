/**
 * Aturan kecil form trip Karawang yang tidak bergantung pada tampilan: label gandengan,
 * daftar kode area dari master Rute, dan kendaraan / supir yang masih ditahan trip lain.
 */
import type { Route, TransactionRow } from '../../../types'
import { GANDENGAN_LABEL, VEHICLE_CONFIGS } from '../../../types'
import { kodeAreaRute } from '../../../lib/trip'
import { STATUS_LABEL } from '../status'

/** "LB" -> "Low Bed", "6X6 DL" -> "6x6 DL", "HB EXT" -> "Hi Bed Extension". */
export function labelGandengan(kode: string): string {
  const k = kode.trim().toUpperCase()
  if (!k) return ''
  return GANDENGAN_LABEL[k] ?? k.split(/\s+/).map((t) => GANDENGAN_LABEL[t] ?? t).join(' ')
}

/** Kode gandengan yang disimpan: huruf besar, spasi rapi. */
export const rapikanGandengan = (v: string) => v.trim().toUpperCase().replace(/\s+/g, ' ')

/**
 * Pilihan Sub Kendaraan / Gandengan: kode VEHICLE_CONFIGS, ditambah konfigurasi kendaraan
 * dan nilai sekarang bila berupa gabungan (mis. "6X6 DL") supaya tetap bisa dipilih.
 */
export function opsiGandengan(nilai: string, konfigurasiKendaraan: string): Array<{ value: string; label: string }> {
  const baku: string[] = [...VEHICLE_CONFIGS]
  const kendaraan = rapikanGandengan(konfigurasiKendaraan)
  const lain = [kendaraan, rapikanGandengan(nilai)].filter((x) => x && !baku.includes(x))
  return [...new Set([...lain, ...baku])].map((k) => ({
    value: k,
    label: `${labelGandengan(k)}${k === kendaraan ? ' (sesuai kendaraan)' : ''}`,
  }))
}

/** Kode area pick up & destinasi tiap rute, dihitung sekali per daftar rute. */
export function petaAreaRute(routes: Route[]): Map<string, { asal: string; tujuan: string }> {
  return new Map(routes.map((r) => [r.id, kodeAreaRute(r)]))
}

/** Trip yang masih menahan kendaraan dan supirnya (belum kembali ke pool). */
export interface Ditahan {
  kendaraan: Map<string, TransactionRow>
  supir: Map<string, TransactionRow>
}

/**
 * Kendaraan & supir yang masih dipakai trip lain (aturan Baldy 12 Okt 2026). Trip yang sedang
 * diubah dan trip asal backload dilewati: kendaraannya memang dipakai lagi oleh trip ini.
 */
export function petaDitahan(rows: TransactionRow[], kecuali: Array<string | undefined>): Ditahan {
  const lewati = new Set(kecuali.filter(Boolean))
  const kendaraan = new Map<string, TransactionRow>()
  const supir = new Map<string, TransactionRow>()
  for (const t of rows) {
    if (!t.menahan_kendaraan || lewati.has(t.id)) continue
    if (t.vehicle_id && !kendaraan.has(t.vehicle_id)) kendaraan.set(t.vehicle_id, t)
    for (const s of t.driver_ids) if (s && !supir.has(s)) supir.set(s, t)
  }
  return { kendaraan, supir }
}

/** "Masih di trip 1760…KDF · Aktif · belum kembali ke pool" */
export const alasanDitahan = (t: Pick<TransactionRow, 'id_tampil' | 'status'>) =>
  `Masih di trip ${t.id_tampil} · ${STATUS_LABEL[t.status]} · belum kembali ke pool`

/** Lokasi ikut nilai otomatis baru bila masih kosong atau belum diubah sendiri. */
export const ikutOtomatis = (isi: string, otomatisLama: string, otomatisBaru: string) =>
  !isi.trim() || isi.trim().toUpperCase() === otomatisLama.trim().toUpperCase() ? otomatisBaru : isi
