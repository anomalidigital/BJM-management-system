import {
  BadgeDollarSign, Building2, FileSpreadsheet, Handshake, LayoutDashboard, Percent, Receipt,
  Route as RouteIcon, Search, Settings2, TrendingUp, Truck, Users, Wallet, Waypoints,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroup {
  /** Judul grup; kosong berarti item berdiri sendiri (Dashboard). */
  title?: string
  items: NavItem[]
}

/** Struktur navigasi utama aplikasi. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Master',
    items: [
      { label: 'Data Karyawan', to: '/master/karyawan', icon: Users },
      { label: 'Data Mobil', to: '/master/mobil', icon: Truck },
      { label: 'Data Route', to: '/master/route', icon: RouteIcon },
      { label: 'Klien', to: '/master/project', icon: Building2 },
      { label: 'Data Kontrak', to: '/master/kontrak', icon: Handshake },
      { label: 'Komisi', to: '/master/komisi', icon: Percent },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { label: 'Trip', to: '/transaksi/trip', icon: Waypoints },
      { label: 'Data Tagihan', to: '/transaksi/tagihan', icon: Receipt },
    ],
  },
  {
    title: 'Invoice',
    items: [
      { label: 'Komisi Bulan Berjalan', to: '/laporan/komisi', icon: BadgeDollarSign },
      { label: 'Netto Bulan Berjalan', to: '/laporan/netto', icon: TrendingUp },
      { label: 'Cek Ritan Bulan Ini', to: '/laporan/ritan', icon: FileSpreadsheet },
      { label: 'Rekap Uang Jalan', to: '/laporan/uang-jalan', icon: Wallet },
      { label: 'Rekap Biaya Operasional', to: '/laporan/biaya', icon: Receipt },
    ],
  },
  {
    title: 'Pencarian',
    items: [{ label: 'SI / Job Order', to: '/pencarian/sijo', icon: Search }],
  },
  {
    title: 'Lainnya',
    items: [{ label: 'Tools', to: '/tools', icon: Settings2 }],
  },
]

/**
 * Cari tujuan untuk satu label breadcrumb.
 * Judul grup (mis. "Master") diarahkan ke halaman pertama grup itu, label menu
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
