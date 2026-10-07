import {
  FaBuilding, FaChartLine, FaFileInvoiceDollar, FaGaugeHigh, FaListCheck, FaMagnifyingGlass, FaPercent,
  FaRoute, FaSackDollar, FaScrewdriverWrench, FaShieldHalved, FaTruck, FaTruckFast, FaUsers, FaWallet,
} from '../ui/icons'
import type { IconComponent } from '../ui/icons'
import type { Workspace } from '../../types'

export interface NavItem {
  label: string
  to: string
  icon: IconComponent
  /** Hanya tampil di workspace ini (mis. pencarian SI/JO khusus container Priok). */
  workspace?: Workspace
}

export interface NavGroup {
  /** Judul grup; kosong berarti item berdiri sendiri (Dashboard, Trip / Job Order). */
  title?: string
  items: NavItem[]
}

/**
 * Struktur navigasi utama, mengikuti susunan menu dari atasan (6 Okt 2026):
 * Dashboard, Trip / Job Order, Laporan, Master Data, Administrasi.
 * Pengeluaran = uang jalan, biaya operasional, dan biaya internal per trip.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/dashboard', icon: FaGaugeHigh }],
  },
  {
    items: [{ label: 'Trip / Job Order', to: '/transaksi/trip', icon: FaTruckFast }],
  },
  {
    title: 'Laporan',
    items: [
      { label: 'Pengeluaran', to: '/laporan/pengeluaran', icon: FaWallet },
      { label: 'Tagihan', to: '/transaksi/tagihan', icon: FaFileInvoiceDollar },
      { label: 'Komisi', to: '/laporan/komisi', icon: FaSackDollar },
      { label: 'Netto', to: '/laporan/netto', icon: FaChartLine },
      { label: 'Ritan', to: '/laporan/ritan', icon: FaListCheck },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { label: 'Supir / Karyawan', to: '/master/karyawan', icon: FaUsers },
      { label: 'Kendaraan', to: '/master/mobil', icon: FaTruck },
      { label: 'Rute', to: '/master/route', icon: FaRoute },
      { label: 'Klien / Pelanggan', to: '/master/klien', icon: FaBuilding },
      { label: 'Aturan Komisi', to: '/master/komisi', icon: FaPercent },
    ],
  },
  {
    title: 'Pencarian',
    items: [{ label: 'SI / Job Order', to: '/pencarian/sijo', icon: FaMagnifyingGlass, workspace: 'priok' }],
  },
  {
    title: 'Administrasi',
    items: [
      { label: 'User & Roles', to: '/admin/peran', icon: FaShieldHalved },
      { label: 'Tools', to: '/tools', icon: FaScrewdriverWrench },
    ],
  },
]

/** Menu yang tampil di satu workspace; grup tanpa isi ikut disembunyikan. */
export function navUntuk(workspace: Workspace): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.workspace || it.workspace === workspace) }))
    .filter((g) => g.items.length > 0)
}

/**
 * Cari tujuan untuk satu label breadcrumb.
 * Judul grup (mis. "Master Data") diarahkan ke halaman pertama grup itu, label menu
 * diarahkan ke halamannya sendiri. Dipakai PageHeader supaya seluruh breadcrumb
 * bisa diklik tanpa tiap halaman perlu menuliskan path-nya satu per satu.
 */
export function findNavHref(label: string): string | undefined {
  const cari = label.trim().toLowerCase()
  for (const g of NAV_GROUPS) {
    if (g.title && g.title.toLowerCase() === cari) return g.items[0]?.to
    for (const it of g.items) if (it.label.toLowerCase() === cari) return it.to
  }
  return undefined
}
