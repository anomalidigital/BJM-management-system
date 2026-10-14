/**
 * Audit Log (Pengaturan -> Audit Log): siapa mengubah data apa dan kapan.
 * Selama prototipe, catatan ditulis DataProvider di setiap create / update / remove
 * dan aksi domain (batal, tutup, kembali ke pool). Di produksi ditulis backend.
 */
import type { Database, EntityKey, PerubahanAudit } from '../types'
import { idTampil } from './trip'

/** Nama jenis data yang dibaca orang. */
export const LABEL_ENTITAS: Partial<Record<EntityKey, string>> = {
  transactions: 'Trip',
  routes: 'Rute',
  drivers: 'Supir / Karyawan',
  vehicles: 'Kendaraan',
  projects: 'Klien',
  contracts: 'Kontrak',
  ujPayments: 'Uang jalan',
  expenses: 'Biaya operasional',
  internalCosts: 'Biaya internal',
  tripNotes: 'Dokumen trip',
  tripEvents: 'Perjalanan',
  kasbonEntries: 'Kasbon',
  commissionSchemes: 'Aturan komisi',
  alamat: 'Alamat',
  dokumen: 'Dokumen',
  billings: 'Tagihan',
  jobOrders: 'SI / Job Order',
}

/** Isian yang tidak perlu dicatat perubahannya. */
const ABAIKAN = new Set(['updated_at', 'created_at', 'id'])

/** Satu nilai sebagai teks ringkas untuk kolom dari / ke. */
export function nilaiAudit(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ').slice(0, 80) : '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v).slice(0, 80)
}

/** Isian yang berubah antara record lama dan patch. */
export function bedaRecord(lama: object, patch: object): PerubahanAudit[] {
  const a = lama as Record<string, unknown>
  const out: PerubahanAudit[] = []
  for (const [field, ke] of Object.entries(patch as Record<string, unknown>)) {
    if (ABAIKAN.has(field)) continue
    const dari = a[field]
    if (JSON.stringify(dari ?? null) === JSON.stringify(ke ?? null)) continue
    out.push({ field, dari: nilaiAudit(dari), ke: nilaiAudit(ke) })
  }
  return out
}

/** Penanda record yang dibaca orang: ID trip, nama rute, plat, nama karyawan, ... */
export function labelRecord(key: EntityKey, row: Record<string, unknown> | undefined, d: Database): string {
  if (!row) return ''
  const trip = (id: unknown) => {
    const t = d.transactions.find((x) => x.id === id)
    return t ? idTampil(t) : ''
  }
  switch (key) {
    case 'transactions': return idTampil(row as never)
    case 'routes': return String(row.route_name ?? '')
    case 'drivers': return String(row.driver_name ?? '')
    case 'vehicles': return String(row.plate_number ?? '')
    case 'projects': return String(row.project_name ?? '')
    case 'contracts': return String(row.contract_no ?? '')
    case 'alamat': return [row.kode_area, row.nama].filter(Boolean).join(' · ')
    case 'dokumen': return String(row.judul ?? '')
    case 'commissionSchemes': return String(row.name ?? '')
    case 'billings': return String(row.invoice_no ?? '')
    case 'jobOrders': return String(row.sijo ?? '')
    case 'ujPayments': return [`Termin ${row.sequence ?? ''}`.trim(), trip(row.trip_id)].filter(Boolean).join(' · ')
    case 'expenses': return [row.expense_type, trip(row.trip_id)].filter(Boolean).join(' · ')
    case 'internalCosts': return [row.cost_type, trip(row.trip_id)].filter(Boolean).join(' · ')
    case 'tripEvents': return [row.jenis, trip(row.trip_id)].filter(Boolean).join(' · ')
    case 'tripNotes': return [row.title, trip(row.trip_id)].filter(Boolean).join(' · ')
    case 'kasbonEntries': {
      const k = d.drivers.find((x) => x.id === row.employee_id)
      return k?.driver_name ?? ''
    }
    default: return String(row.id ?? '')
  }
}

/** Tautan ke halaman sumber record, bila ada. */
export function tautanAudit(entitas: string, id: string, d: Database): string | null {
  const keTrip = (tripId: unknown) => (tripId ? `/transaksi/trip/${String(tripId)}` : null)
  switch (entitas) {
    case 'transactions': return d.transactions.some((t) => t.id === id) ? `/transaksi/trip/${id}` : null
    case 'ujPayments': return keTrip(d.ujPayments.find((x) => x.id === id)?.trip_id)
    case 'expenses': return keTrip(d.expenses.find((x) => x.id === id)?.trip_id)
    case 'internalCosts': return keTrip(d.internalCosts.find((x) => x.id === id)?.trip_id)
    case 'tripEvents': return keTrip((d.tripEvents ?? []).find((x) => x.id === id)?.trip_id)
    case 'tripNotes': return keTrip(d.tripNotes.find((x) => x.id === id)?.trip_id)
    case 'drivers': return d.drivers.some((x) => x.id === id) ? `/master/karyawan/${id}` : null
    case 'projects': return d.projects.some((x) => x.id === id) ? `/master/klien/${id}` : null
    case 'routes': return '/master/rute'
    case 'vehicles': return '/master/mobil'
    case 'alamat': return '/master/alamat'
    case 'commissionSchemes': return '/laporan/komisi?tab=aturan'
    case 'dokumen': return '/dokumen'
    default: return null
  }
}
