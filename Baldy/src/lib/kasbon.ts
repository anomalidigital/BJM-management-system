/**
 * Kasbon karyawan: saldo dan mutasinya.
 *
 * Saldo = jumlah seluruh mutasi (positif menambah kasbon, negatif mengurangi).
 * Mutasi "trip" tertaut ke termin uang jalan yang memotong kasbon, sehingga
 * mengubah atau menghapus termin ikut memperbarui kasbon.
 */
import type { CommissionTransaction, KasbonEntry, KasbonKind, UjPayment } from '../types'

export function saldoKasbon(entries: KasbonEntry[], employeeId: string, kecualiUjId = ''): number {
  return entries.reduce(
    (a, e) => (e.employee_id === employeeId && (!kecualiUjId || e.uj_payment_id !== kecualiUjId) ? a + e.amount : a),
    0,
  )
}

/** Peta saldo seluruh karyawan sekaligus, untuk tabel. */
export function petaSaldoKasbon(entries: KasbonEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of entries) m.set(e.employee_id, (m.get(e.employee_id) ?? 0) + e.amount)
  return m
}

/** Arah bawaan tiap jenis mutasi; manual dipilih pengguna. */
export const ARAH_KASBON: Record<KasbonKind, 1 | -1 | 0> = { admin: 1, trip: -1, pembatalan: 1, manual: 0 }

/**
 * Susun mutasi kasbon dari data lama.
 *
 * Data operasional mencatat potongan kasbon per termin, tetapi tidak mencatat
 * kasbon yang diberikan. Supaya saldo tidak negatif, tiap karyawan diberi satu
 * "saldo awal" sebesar total potongannya - diberi keterangan jelas, bukan angka
 * karangan. Hasilnya saldo setiap orang mulai dari nol.
 */
export function susunKasbonDariDataLama(
  payments: UjPayment[],
  trips: Pick<CommissionTransaction, 'id' | 'driver_id'>[],
  stamp: string,
): KasbonEntry[] {
  const sopirTrip = new Map(trips.map((t) => [t.id, t.driver_id]))
  const keluar: KasbonEntry[] = []
  const total = new Map<string, { jumlah: number; awal: string }>()

  for (const p of payments) {
    if (!(p.kasbon_deduction > 0)) continue
    const orang = p.driver_id || sopirTrip.get(p.trip_id) || ''
    if (!orang) continue
    keluar.push({
      id: `ksb-${p.id}`,
      employee_id: orang,
      entry_date: p.payment_date,
      kind: 'trip',
      amount: -p.kasbon_deduction,
      trip_id: p.trip_id,
      uj_payment_id: p.id,
      notes: '',
      attachments: [],
      created_at: stamp,
      updated_at: stamp,
    })
    const t = total.get(orang) ?? { jumlah: 0, awal: p.payment_date }
    t.jumlah += p.kasbon_deduction
    if (p.payment_date < t.awal) t.awal = p.payment_date
    total.set(orang, t)
  }

  const awal: KasbonEntry[] = [...total.entries()].map(([orang, t]) => ({
    id: `ksb-awal-${orang}`,
    employee_id: orang,
    entry_date: t.awal,
    kind: 'admin',
    amount: t.jumlah,
    trip_id: '',
    uj_payment_id: '',
    notes: 'Saldo awal dari data lama — jumlah potong kasbon yang tercatat',
    attachments: [],
    created_at: stamp,
    updated_at: stamp,
  }))

  return [...awal, ...keluar]
}
