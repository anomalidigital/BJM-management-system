import type { Database } from '../types'
import { generateDatabase, generateSampleDatabase } from '../data/dummy'

const DB_KEY = 'sikotis.db.v2'
const AUTH_KEY = 'sikotis.auth.v1'

/** Koleksi inti yang sudah ada sejak versi pertama. */
const CORE_KEYS: Array<keyof Database> = ['drivers', 'routes', 'vehicles', 'jobOrders', 'transactions', 'billings']
/** Koleksi yang ditambahkan belakangan - boleh belum ada di data tersimpan. */
const ADDED_KEYS: Array<keyof Database> = ['deliveryNotes', 'projects', 'ujPayments', 'expenses']

function hasCore(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return CORE_KEYS.every((k) => Array.isArray(v[k]))
}

/**
 * Migrasi non-destruktif: data lama dipertahankan, koleksi baru diisi dari
 * dummy segar. Jadi menambah modul tidak menghapus perubahan yang sudah
 * dibuat user pada master maupun transaksi.
 */
function migrate(stored: Record<string, unknown>): Database {
  const merged = { ...stored }

  // 1) Koleksi yang belum ada diisi dari dummy segar.
  const missing = ADDED_KEYS.filter((k) => !Array.isArray(merged[k]))
  if (missing.length > 0) {
    const fresh = generateDatabase() as unknown as Record<string, unknown>
    for (const k of missing) merged[k] = fresh[k]
  }

  // 2) Field baru pada record lama diberi nilai awal, supaya data yang sudah
  //    tersimpan tetap terbaca dan tidak ada kolom kosong di tabel.
  const trx = merged.transactions as Array<Record<string, unknown>> | undefined
  if (Array.isArray(trx)) {
    merged.transactions = trx.map((t) => ({
      project_id: '',
      tr_reference: '',
      pi_number: '',
      pi_status: '',
      cost_value: 0,
      notes: '',
      ...t,
      // Field lama is_done dipetakan ke status baru, bukan dibuang.
      status: t.status ?? (t.is_done ? 'selesai' : 'aktif'),
    }))
  }

  const veh = merged.vehicles as Array<Record<string, unknown>> | undefined
  if (Array.isArray(veh)) {
    merged.vehicles = veh.map((v) => ({ configuration: '', ...v }))
  }

  return merged as unknown as Database
}

/** Muat dari localStorage; jika kosong / rusak, bangun ulang dari dummy. */
export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (hasCore(parsed)) {
        const migrated = migrate(parsed as Record<string, unknown>)
        saveDatabase(migrated)
        return migrated
      }
    }
  } catch {
    // localStorage tidak tersedia / JSON rusak -> jatuh ke dummy
  }
  const fresh = generateDatabase()
  saveDatabase(fresh)
  return fresh
}

export function saveDatabase(db: Database): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // storage penuh atau mode privat: prototype tetap jalan dari memori
  }
}

/** Buang data tersimpan dan bangun ulang dummy database. */
export function resetDatabase(): Database {
  try {
    localStorage.removeItem(DB_KEY)
  } catch {
    /* abaikan */
  }
  const fresh = generateDatabase()
  saveDatabase(fresh)
  return fresh
}

/** Ganti isi database dengan dataset contoh sepenuhnya (tanpa data operasional asli). */
export function resetToSampleDatabase(): Database {
  const fresh = generateSampleDatabase()
  saveDatabase(fresh)
  return fresh
}

export const authStorage = {
  read<T>(): T | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  write(value: unknown): void {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(value))
    } catch {
      /* abaikan */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      /* abaikan */
    }
  },
}
