import type { Database } from '../types'
import { generateDatabase } from '../data/dummy'

const DB_KEY = 'sikotis.db.v1'
const AUTH_KEY = 'sikotis.auth.v1'

/** Bentuk minimal yang wajib ada supaya data lama tidak merusak aplikasi. */
const REQUIRED_KEYS: Array<keyof Database> = ['drivers', 'routes', 'vehicles', 'jobOrders', 'transactions', 'billings', 'deliveryNotes']

function isValidDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return REQUIRED_KEYS.every((k) => Array.isArray(v[k]))
}

/** Muat dari localStorage; jika kosong / rusak, bangun ulang dari dummy. */
export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidDatabase(parsed)) return parsed
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
